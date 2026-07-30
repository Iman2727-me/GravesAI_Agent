# GCP infrastructure (cheap, US-only, single-user)

Default path: **run the API on your machine** and call **Vertex Gemini** (pay-per-token). Do not deploy Cloud Run / Firestore / GCS until you explicitly want that.

## Prerequisites (Vertex from local API)

1. GCP project in the US (e.g. `gravesaiagent`), region **`us-central1`**.
2. Enable **Vertex AI API** for the project.
3. Authenticate:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   gcloud config set project YOUR_PROJECT_ID
   ```
4. Copy `.env.example` → `.env` and set:
   - `THOMAS_MODE=gcp`
   - `GCP_PROJECT_ID=...`
   - `GCP_REGION=us-central1`
5. `npm run dev:api` — sessions/uploads still use `./data` (no billable storage).

## Intended shape when you deploy later (still cost-conscious)

- **Cloud Run** for `services/thomas-api` with **min instances = 0** (scale to zero).
- **Vertex AI Gemini API** (pay-per-token) — no dedicated GPUs / always-on endpoints.
- **Firestore** + **Cloud Storage** only if you need cloud persistence — same US region.
- **Secret Manager** for credentials.

## Scripts (deploy — do not run until asked)

- [`deploy-cloud-run.sh`](./deploy-cloud-run.sh) — build and deploy API to Cloud Run (scale-to-zero).
- [`Dockerfile`](./Dockerfile) — container for the API.

## Local mock (zero cost)

```bash
THOMAS_MODE=local
```

Uses `./data` and the mock LLM — no Vertex calls, no billable GCP resources.
