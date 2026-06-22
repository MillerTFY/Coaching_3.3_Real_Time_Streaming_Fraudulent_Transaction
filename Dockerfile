FROM python:3.9-slim

WORKDIR /app

# Copy requirement list (assuming we use standard libraries or need to install fastapi, uvicorn, kafka-python, google-cloud-pubsub)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application directories
COPY scripts /app/scripts
COPY dashboard /app/dashboard

# Expose port
EXPOSE 8080

# Command to run the FastAPI server
CMD ["uvicorn", "scripts.api_cloud:app", "--host", "0.0.0.0", "--port", "8080"]
