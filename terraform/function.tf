resource "google_cloudfunctions2_function" "fraud_inference_function" {
  name        = "fraud-inference-function"
  location    = var.region
  description = "A serverless ML inference engine triggered by Pub/Sub"

  build_config {
    runtime     = "python310"
    entry_point = "process_transaction"  # The name of the function in main.py
    
    source {
      storage_source {
        bucket = google_storage_bucket.function_bucket.name
        object = google_storage_bucket_object.function_zip_upload.name
      }
    }
  }

  service_config {
    max_instance_count = 5
    available_memory   = "512M"
    timeout_seconds    = 60
    environment_variables = {
      GCP_PROJECT_ID = var.project_id
    }
  }

  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = google_pubsub_topic.fraud_transactions.id
    retry_policy   = "RETRY_POLICY_DO_NOT_RETRY"
  }
}
