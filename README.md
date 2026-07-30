# Thomas (Tommy)

Headless process-development and visual-modeling AI agent. Thin React feeder UI; thinking runs in the backend. Named Thomas — also answers to Tommy.

## v1 scope

- Question-heavy 14-stage thinking pipeline (Graves process)
- Two editable visual UIs: **Process Whiteboard** and **Solution Design Map**
- Local-first backend (file store + mock LLM) — no GCP login required
- GCP-ready adapters and deploy scripts — **do not run `gcloud` until you have an account**
- J.A.R.V.I.S.-matched personality: formal, dry wit; pointed sarcasm when you override recommendations

## Quick start (local)

```bash
cp .env.example .env   # already defaults to THOMAS_MODE=local
npm install
npm run dev:api        # http://localhost:8787
npm run dev:feeder     # http://localhost:5173
npm run dev:visuals    # http://localhost:5174
```

1. Open the feeder and submit an idea (optional file attachments).
2. Answer Thomas’s questions; check “Override recommendation” to hear pointed tone.
3. After whiteboard / final design stages, open the visual links to edit and “Ask Thomas to revise.”

## Layout

```
apps/feeder           # Intake + Q&A
apps/visuals          # Whiteboard + Solution Design Map
services/thomas-api   # Express API (Cloud Run–shaped)
packages/shared       # Stages, types, personality
infra/                # Dockerfile + deploy script (not executed yet)
corpus/               # Future “think like me” materials
```

## Later: GCP

See [infra/README.md](infra/README.md) and [infra/COST.md](infra/COST.md). Scale-to-zero Cloud Run + Vertex Gemini API — no always-on GPUs.
