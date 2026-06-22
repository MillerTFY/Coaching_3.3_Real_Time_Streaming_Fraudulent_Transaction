const alertsContainer = document.getElementById('alertsContainer');
const emptyState = document.getElementById('emptyState');
const queueCountEl = document.getElementById('queueCount');
const toastContainer = document.getElementById('toastContainer');
const bankNameEl = document.getElementById('bankName');
const autoModeToggle = document.getElementById('autoModeToggle');

// Settings Elements
const settingsMenuBtn = document.getElementById('settingsMenuBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdDisplay = document.getElementById('thresholdDisplay');

const menuAlerts = document.getElementById('menuAlerts');
const menuAnalytics = document.getElementById('menuAnalytics');
const analyticsContainer = document.getElementById('analyticsContainer');

let sysLatencyTotal = 0;
let sysLatencyCount = 0;

let opLatencyTotal = 0;
let opLatencyCount = 0;

const alertRenderTimes = {};

if (menuAlerts && menuAnalytics) {
    menuAlerts.addEventListener('click', () => {
        menuAlerts.classList.add('active');
        menuAnalytics.classList.remove('active');
        alertsContainer.style.display = 'flex';
        analyticsContainer.style.display = 'none';
    });

    menuAnalytics.addEventListener('click', () => {
        menuAnalytics.classList.add('active');
        menuAlerts.classList.remove('active');
        alertsContainer.style.display = 'none';
        analyticsContainer.style.display = 'block';
    });
}

let autoModeThreshold = 0.70;

// Settings Modal Logic
settingsMenuBtn.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
});

closeSettings.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

thresholdSlider.addEventListener('input', (e) => {
    thresholdDisplay.innerText = `${e.target.value}%`;
    autoModeThreshold = parseInt(e.target.value, 10) / 100;
});

// Generate random codename
const NATO_PHONETIC = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet'];
const randomName = NATO_PHONETIC[Math.floor(Math.random() * NATO_PHONETIC.length)];
const sessionSuffix = Math.floor(1000 + Math.random() * 9000);
bankNameEl.value = randomName;

const sessionSuffixDisplay = document.getElementById('sessionSuffixDisplay');
if (sessionSuffixDisplay) {
    sessionSuffixDisplay.innerText = `-${sessionSuffix}`;
}

let alertsQueue = [];
let ws;

// Format Currency
const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amt);
};

// Initialize WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
        const alert = JSON.parse(event.data);
        handleNewAlert(alert);
    };

    ws.onclose = () => {
        console.log("WebSocket connection closed. Reconnecting...");
        setTimeout(connectWebSocket, 3000);
    };
}

function handleNewAlert(alert) {
    // Calculate System Latency (happens for both Manual and Auto modes)
    const now = new Date();
    let eventTime = alert.event_time ? new Date(alert.event_time) : now;
    if (now - eventTime > 86400000) {
        eventTime = alert.ingestion_time ? new Date(alert.ingestion_time) : now;
    }
    const latency = Math.max(0, now - eventTime);
    sysLatencyTotal += latency;
    sysLatencyCount += 1;
    const sysEl = document.getElementById('metricSysLatency');
    if (sysEl) sysEl.innerText = Math.round(sysLatencyTotal / sysLatencyCount) + ' ms';
    
    // Track render time for Analyst Response Time
    alertRenderTimes[alert.trans_num] = now;

    if (autoModeToggle && autoModeToggle.checked) {
        // Auto-mode processing
        const actionType = alert.prob >= autoModeThreshold ? 'freeze' : 'whitelist';
        processAction(alert.trans_num, actionType, true);
        return;
    }

    // Add to internal queue
    alertsQueue.unshift(alert);
    
    // Keep max 10 alerts in UI
    if (alertsQueue.length > 10) {
        alertsQueue.pop();
    }
    
    updateQueueCount();
    renderAlert(alert);
    showToast(`New Fraud Alert: ${formatCurrency(alert.amt)} on card ending in ${alert.trans_num.slice(-4)}.`, 'fa-triangle-exclamation', 'var(--accent-red)');
}

function renderAlert(alert) {
    // Remove empty state if present
    if (emptyState.style.display !== 'none') {
        emptyState.style.display = 'none';
    }

    const card = document.createElement('div');
    card.className = 'alert-card';
    card.id = `alert-${alert.trans_num}`;
    
    card.innerHTML = `
        <div class="alert-header">
            <i class="fa-solid fa-triangle-exclamation alert-icon"></i>
            URGENT: Transaction ${alert.trans_num} - ${formatCurrency(alert.amt)}
        </div>
        <div class="alert-details">
            <div class="detail-group">
                <span class="detail-label">Customer</span>
                <span class="detail-value">${alert.first} ${alert.last}</span>
            </div>
            <div class="detail-group">
                <span class="detail-label">Merchant</span>
                <span class="detail-value">${alert.merchant || 'Unknown'}</span>
            </div>
            <div class="detail-group">
                <span class="detail-label">Terminal ID</span>
                <span class="detail-value">${alert.terminal_id || 'Unknown'}</span>
            </div>
            <div class="detail-group">
                <span class="detail-label">Card Number</span>
                <span class="detail-value">**** ${alert.trans_num.slice(-4)}</span>
            </div>
            <div class="detail-group">
                <span class="detail-label">Amount</span>
                <span class="detail-value">${formatCurrency(alert.amt)}</span>
            </div>
            <div class="detail-group">
                <span class="detail-label">ML Confidence</span>
                <span class="detail-value confidence-high">${(alert.prob * 100).toFixed(2)}%</span>
            </div>
        </div>
        <div class="alert-actions">
            <button class="btn btn-whitelist" onclick="processAction('${alert.trans_num}', 'whitelist')">
                <i class="fa-solid fa-check"></i> Override & Whitelist
            </button>
            <button class="btn btn-freeze" onclick="processAction('${alert.trans_num}', 'freeze')">
                <i class="fa-solid fa-ban"></i> Freeze Account
            </button>
        </div>
    `;

    alertsContainer.prepend(card);

    // Enforce 10 elements max in DOM
    const cards = alertsContainer.querySelectorAll('.alert-card');
    if (cards.length > 10) {
        cards[cards.length - 1].remove();
    }
}

async function processAction(transNum, actionType, isAuto = false) {
    let card = null;
    if (!isAuto) {
        card = document.getElementById(`alert-${transNum}`);
        if (!card) return;
    }

    // Calculate Operational Response Time (Near 0s for Auto-Mode!)
    const rendered = alertRenderTimes[transNum];
    if (rendered) {
        const respTime = (new Date() - rendered) / 1000;
        opLatencyTotal += respTime;
        opLatencyCount += 1;
        const opEl = document.getElementById('metricOpLatency');
        if (opEl) opEl.innerText = (opLatencyTotal / opLatencyCount).toFixed(1) + ' s';
        delete alertRenderTimes[transNum];
    }

    // Send to Backend with retry logic to handle browser connection limits during stress testing
    let retries = 5;
    while (retries > 0) {
        try {
            const response = await fetch('/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action_type: actionType, trans_num: transNum, user: `${bankNameEl.value}-${sessionSuffix}` })
            });
            if (response.ok) break;
            throw new Error(`HTTP ${response.status}`);
        } catch (e) {
            retries--;
            if (retries === 0) {
                console.error(`Failed to notify backend for ${transNum} after retries`, e);
            } else {
                // Wait 500-1000ms to let the browser's connection pool recover
                await new Promise(r => setTimeout(r, Math.random() * 500 + 500));
            }
        }
    }

    // Show appropriate toast
    const last4 = transNum.slice(-4);
    if (actionType === 'whitelist') {
        showToast(isAuto ? `[AUTO] Whitelisted transaction ending in ${last4}.` : `Whitelisted transaction ending in ${last4}.`, "fa-check", "var(--accent-green)");
    } else {
        showToast(isAuto ? `[AUTO] Account Frozen for card ending in ${last4}.` : `Account Frozen for card ending in ${last4}.`, "fa-ban", "var(--accent-red)");
    }

    if (!isAuto && card) {
        // Animate out
        card.classList.add('removing');
        setTimeout(() => {
            card.remove();
            alertsQueue = alertsQueue.filter(a => a.trans_num !== transNum);
            updateQueueCount();

            if (alertsQueue.length === 0) {
                emptyState.style.display = 'flex';
            }
        }, 300); // Matches CSS transition time
    }
}

function updateQueueCount() {
    queueCountEl.innerText = alertsQueue.length;
}

function showToast(message, iconClass, color) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid ${iconClass}" style="color: ${color}"></i> ${message}`;
    
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Fetch Version Info
async function fetchVersion() {
    try {
        const response = await fetch('/api/version');
        const data = await response.json();
        const versionInfoEl = document.getElementById('versionInfo');
        if (versionInfoEl) {
            versionInfoEl.innerText = `FastAPI v${data.version} | Updated: ${data.last_updated}`;
        }
    } catch (error) {
        console.error("Failed to fetch API version:", error);
    }
}

// Start
connectWebSocket();
fetchVersion();
