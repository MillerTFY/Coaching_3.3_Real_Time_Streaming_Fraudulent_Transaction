# Create a unique bucket to store the Cloud Function's source code
resource "random_id" "bucket_prefix" {
  byte_length = 8
}

resource "google_storage_bucket" "function_bucket" {
  name     = "${var.project_id}-cf-source-${random_id.bucket_prefix.hex}"
  location = var.region
  
  # Ensure cleanup is easy when learners run terraform destroy
  force_destroy = true 
}

# Zip the source code locally before uploading
data "archive_file" "function_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../cloud_function"
  output_path = "${path.module}/cloud_function.zip"
}

# Upload the zip to the bucket
resource "google_storage_bucket_object" "function_zip_upload" {
  name   = "function-source-${data.archive_file.function_zip.output_md5}.zip"
  bucket = google_storage_bucket.function_bucket.name
  source = data.archive_file.function_zip.output_path
}
