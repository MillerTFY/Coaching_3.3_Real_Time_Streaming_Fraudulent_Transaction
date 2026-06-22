# Create a Service Account for the Cloud Function to use (Principle of Least Privilege)
resource "google_service_account" "function_sa" {
  account_id   = "fraud-function-sa"
  display_name = "Fraud Detection Cloud Function Service Account"
}

# Allow Eventarc/PubSub to invoke the Cloud Function
resource "google_cloud_run_service_iam_member" "invoker" {
  project  = google_cloudfunctions2_function.fraud_inference_function.project
  location = google_cloudfunctions2_function.fraud_inference_function.location
  service  = google_cloudfunctions2_function.fraud_inference_function.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.function_sa.email}"
}
