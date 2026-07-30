#!/usr/bin/env bash
# Deploy Thomas API to Cloud Run (scale-to-zero).
# DO NOT RUN until you have a GCP account and have filled .env.
set -euo pipefail

echo "Refusing to run automatically. This script is for later use."
echo "When ready: uncomment the gcloud commands below and re-run with CONFIRM_GCP_DEPLOY=1"

if [[ "${CONFIRM_GCP_DEPLOY:-}" != "1" ]]; then
  exit 1
fi

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GCP_REGION:=us-central1}"
: "${SERVICE_NAME:=thomas-api}"

# gcloud config set project "$GCP_PROJECT_ID"
# gcloud services enable run.googleapis.com aiplatform.googleapis.com firestore.googleapis.com storage.googleapis.com secretmanager.googleapis.com
# gcloud builds submit --tag "gcr.io/${GCP_PROJECT_ID}/${SERVICE_NAME}" -f infra/Dockerfile .
# gcloud run deploy "$SERVICE_NAME" \
#   --image "gcr.io/${GCP_PROJECT_ID}/${SERVICE_NAME}" \
#   --region "$GCP_REGION" \
#   --platform managed \
#   --allow-unauthenticated \
#   --min-instances=0 \
#   --max-instances=3 \
#   --cpu=1 \
#   --memory=512Mi \
#   --set-env-vars "THOMAS_MODE=gcp,GCP_PROJECT_ID=${GCP_PROJECT_ID},GCP_REGION=${GCP_REGION}"

echo "Template only — gcloud commands remain commented until Vertex/Firestore adapters are fully wired."
