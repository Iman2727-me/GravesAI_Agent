# GCP infrastructure (do not run until you have a Google Cloud login)

These scripts are **documentation + ready-to-run later**. Do **not** execute `gcloud` until you create an account and explicitly ask to deploy.

## Intended shape (cost-conscious)

- **Cloud Run** service for `services/thomas-api` with **min instances = 0** (scale to zero).
- **Vertex AI Gemini API** (pay-per-token) — no dedicated GPUs / always-on endpoints.
- **Firestore** for sessions / process artifacts.
- **Cloud Storage** bucket for multimodal uploads.
- **Secret Manager** for credentials.

## Prerequisites (later)

1. Create a GCP project.
2. Install Google Cloud SDK and authenticate (`gcloud auth login`).
3. Copy `.env.example` → `.env` and fill `GCP_PROJECT_ID`, `GCP_REGION`, `GCS_BUCKET`.
4. Set `THOMAS_MODE=gcp` only after adapters are fully wired with official client libraries.

## Scripts

- [`deploy-cloud-run.sh`](./deploy-cloud-run.sh) — build and deploy API to Cloud Run (scale-to-zero). **Do not run yet.**
- [`Dockerfile`](./Dockerfile) — container for the API.

## Local mode (now)

```bash
THOMAS_MODE=local
```

Uses `./data` for sessions, whiteboards, design maps, and uploads. Mock LLM — no Vertex calls, no billable GCP resources.
