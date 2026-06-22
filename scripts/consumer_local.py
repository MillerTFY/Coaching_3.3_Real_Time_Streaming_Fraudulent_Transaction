import warnings
from kafka import KafkaConsumer, KafkaProducer
import json
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

# Suppress verbose kafka-python deprecation warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

print("Loading XGBoost Model...")
model = joblib.load('fraud_model.joblib')

# Connect to Kafka Topic (Input)
kafka_broker = os.environ.get('KAFKA_BROKER', 'localhost:9092')
consumer = KafkaConsumer(
    'transactions',
    bootstrap_servers=[kafka_broker],
    auto_offset_reset='latest',
    enable_auto_commit=True,
    group_id='fraud-detection-group'
)

# Connect to Kafka Topic (Output Return Channel)
producer = KafkaProducer(
    bootstrap_servers=[kafka_broker]
)

print("\n--- Listening for Transactions ---")

for message in consumer:
    tx = json.loads(message.value.decode('utf-8'))
    ingestion_time = datetime.fromtimestamp(message.timestamp / 1000.0).isoformat()
    
    # Feature Engineering (Must match exactly what was done in training!)
    distance = np.sqrt((tx['lat'] - tx['merch_lat'])**2 + (tx['long'] - tx['merch_long'])**2)
    hour = pd.to_datetime(tx['trans_date_trans_time']).hour
    
    # Extract features in the exact order the model expects them
    features = pd.DataFrame([{
        'amt': tx['amt'],
        'distance': distance,
        'city_pop': tx['city_pop'],
        'hour': hour
    }])
    
    # Run Inference
    fraud_prob = model.predict_proba(features)[0][1]
    is_fraud = model.predict(features)[0]
    
    # Alerting Logic
    if is_fraud == 1:
        print(f"🚨 FRAUD ALERT! TX: {tx['trans_num']} | User: {tx['first']} {tx['last']} | Amount: ${tx['amt']:.2f} | Prob: {fraud_prob:.2f}")
        # Send Alert back to UI
        alert_msg = {
            "trans_num": tx['trans_num'],
            "first": tx['first'],
            "last": tx['last'],
            "amt": float(tx['amt']),
            "prob": float(fraud_prob),
            "merchant": tx.get('merchant', 'Unknown').replace('fraud_', ''),
            "terminal_id": tx.get('terminal_id', 'Unknown'),
            "event_time": tx.get('trans_date_trans_time', 'Unknown'),
            "ingestion_time": ingestion_time,
            "processed_time": datetime.now().isoformat()
        }
        producer.send('fraud_alerts', value=json.dumps(alert_msg).encode('utf-8'))
    else:
        print(f"✅ Approved. TX: {tx['trans_num']} | Amount: ${tx['amt']:.2f}")
