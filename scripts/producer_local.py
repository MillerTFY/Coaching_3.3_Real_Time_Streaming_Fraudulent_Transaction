import pandas as pd
import json
import time
import random
from datetime import datetime

# ==========================================
# LOCAL DEVELOPMENT (APACHE KAFKA)
# ==========================================
from kafka import KafkaProducer

# Connect to the local KRaft Kafka cluster
producer = KafkaProducer(
    bootstrap_servers=['localhost:9092']
)


print("Loading Kaggle Test dataset...")
try:
    df_test = pd.read_csv('data/fraudTest.csv').sample(frac=1) # Shuffle data
except FileNotFoundError:
    print("Warning: data/fraudTest.csv not found. Please ensure the dataset is downloaded.")
    df_test = pd.DataFrame()

print("Starting Payment Gateway Stream. Press Ctrl+C (or Control+C on Mac) to stop.")

try:
    for index, row in df_test.iterrows():
        # Convert the Pandas row to a Python dictionary
        transaction = row.to_dict()
        
        # Override the historical timestamp with the LIVE system time
        transaction['trans_date_trans_time'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Publish Event to Kafka
        producer.send('transactions', value=json.dumps(transaction).encode('utf-8'))
        print(f"Sent Transaction: {transaction['trans_num']} | ${transaction['amt']:.2f}")
        
        # Wait a fraction of a second to simulate real-time flow
        time.sleep(random.uniform(0.1, 0.5))

except KeyboardInterrupt:
    print("Stopping stream.")
finally:
    if 'producer' in locals():
        producer.close()
