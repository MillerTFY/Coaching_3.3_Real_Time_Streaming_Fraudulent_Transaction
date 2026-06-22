## <span id="appendix-a"></span><span style="color:orange">🚀 Appendix A: High-Performance Streaming with Redpanda</span> <span style="font-size: 14px; font-weight: normal;">[⬆️ Back to TOC](README.md#toc)</span>
## What is Redpanda?
Redpanda is a modern, high-performance streaming platform built entirely in C++ that is 100% API-compatible with Apache Kafka. 

Because traditional Kafka runs on the JVM (Java Virtual Machine), it can suffer from memory bloat and garbage collection latency spikes under extreme loads. Redpanda was designed to circumvent these limitations by interacting directly with the hardware, resulting in significantly lower tail latencies—all while remaining completely Zookeeper-free.

To demonstrate this architectural evolution, we have provided an alternative `docker-compose-redpanda.yml` file in this repository.

## Step 1: Clean Up Local Kafka
Because Redpanda acts as a drop-in replacement for Kafka, it binds to the exact same port (`9092`). If you are currently running the standard local Kafka broker, you **must** shut it down first to free up the port.

Run the following command in your terminal to safely tear down the Kafka cluster:
```bash
docker-compose down
```

## Step 2: Spin Up Redpanda
Once the port is free, you can spin up the Redpanda cluster in the background using the alternative docker-compose file:

```bash
docker-compose -f docker-compose-redpanda.yml up -d
```

## Step 3: Run Your Applications
Because Redpanda is perfectly API-compatible with Kafka, **you do not need to change a single line of your Python code!** 

You can immediately start the local POS Terminal, the Consumer, and the Dashboard exactly as before:

* **Terminal 1 (Consumer - Local):** `python scripts/consumer_local.py`
* **Terminal 2 (POS Terminal - Local):** `streamlit run scripts/pos_terminal_local.py`
* **Terminal 3 (Central Web Server - Local):** `uvicorn scripts.api_local:app --host 0.0.0.0 --port 8000`

All of your data will now seamlessly flow through the high-performance Redpanda engine instead of Kafka.
