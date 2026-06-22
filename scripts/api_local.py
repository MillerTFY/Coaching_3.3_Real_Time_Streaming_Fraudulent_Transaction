from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from kafka import KafkaConsumer, KafkaProducer
import json
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()
app = FastAPI(title="Fraud Detection Dashboard API")

APP_VERSION = "1.0.0"
import datetime
LAST_UPDATED = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# Ensure dashboard directory exists for static files
DASHBOARD_DIR = os.path.join(os.path.dirname(__file__), "..", "dashboard")

# Mount static files
app.mount("/static", StaticFiles(directory=DASHBOARD_DIR), name="static")

try:
    kafka_broker = os.environ.get('KAFKA_BROKER', 'localhost:9092')
    producer = KafkaProducer(
        bootstrap_servers=[kafka_broker]
    )
except Exception as e:
    print("Failed to initialize KafkaProducer:", e)
    producer = None

class ActionRequest(BaseModel):
    action_type: str
    trans_num: str
    user: str = ""

@app.get("/")
async def get_index():
    return FileResponse(os.path.join(DASHBOARD_DIR, "index.html"))

@app.get("/api/version")
async def get_version():
    return {"version": APP_VERSION, "last_updated": LAST_UPDATED}

@app.post("/api/action")
async def process_action(req: ActionRequest, request: Request):
    user_identity = req.user.strip()
    if not user_identity:
        user_identity = request.client.host

    # Publish to fraud_resolutions topic for POS terminal to read
    if producer:
        producer.send('fraud_resolutions', value=json.dumps({'trans_num': req.trans_num, 'action_type': req.action_type, 'user': user_identity}).encode('utf-8'))
        
    print(f"Action received: {req.action_type} for transaction {req.trans_num} by {user_identity}")
    return {"status": "success", "message": f"Processed {req.action_type}"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Initialize Kafka Consumer
    try:
        kafka_broker = os.environ.get('KAFKA_BROKER', 'localhost:9092')
        consumer = KafkaConsumer(
            'fraud_alerts',
            bootstrap_servers=[kafka_broker],
            auto_offset_reset='latest',
            consumer_timeout_ms=500
        )
    except Exception as e:
        print("Kafka connection failed:", e)
        await websocket.close()
        return

    try:
        while True:
            # Poll Kafka without blocking the async event loop indefinitely
            records = consumer.poll(timeout_ms=500)
            for tp, messages in records.items():
                for msg in messages:
                    alert = json.loads(msg.value.decode('utf-8'))
                    await websocket.send_json(alert)
                    
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print("WebSocket Error:", e)
    finally:
        consumer.close()
