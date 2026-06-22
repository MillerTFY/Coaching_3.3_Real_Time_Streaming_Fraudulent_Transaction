import pandas as pd
import numpy as np
import xgboost as xgb
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

print("Loading Kaggle Fraud dataset (Sample 100k)...")
# Load a manageable sample of the 1M+ row dataset
df = pd.read_csv('data/fraudTrain.csv').sample(n=100000, random_state=42)

print("Engineering Features...")
# Convert historical timestamp to datetime and extract the hour
df['trans_date_trans_time'] = pd.to_datetime(df['trans_date_trans_time'])
df['hour'] = df['trans_date_trans_time'].dt.hour

# Feature Engineering: Calculate distance between user and merchant
df['distance'] = np.sqrt((df['lat'] - df['merch_lat'])**2 + (df['long'] - df['merch_long'])**2)

# Select realistic numerical features
features = ['amt', 'distance', 'city_pop', 'hour']
X = df[features]
y = df['is_fraud']

# Train / Test Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

print("Training Pipeline (StandardScaler + XGBoost)...")
# Scale positive weight because fraud is rare (~0.5% of data)
scale_weight = (len(y_train) - y_train.sum()) / y_train.sum()

# MLOps Best Practice: Use a Pipeline to bundle preprocessing and the model
pipeline = Pipeline([
    ('scaler', StandardScaler()), # Even though XGBoost doesn't strictly need it, we show it for MLOps best practices!
    ('classifier', xgb.XGBClassifier(n_estimators=100, max_depth=4, scale_pos_weight=scale_weight, random_state=42))
])

# Train the entire pipeline
pipeline.fit(X_train, y_train)

# Evaluate
predictions = pipeline.predict(X_test)
print("\nModel Evaluation:")
print(classification_report(y_test, predictions))

# Serialize (Save) the entire Pipeline
joblib.dump(pipeline, 'fraud_model.joblib')
print("Pipeline saved as 'fraud_model.joblib' - The Streaming Consumer will now run raw data through this pipeline seamlessly!")
