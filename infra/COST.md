# Cost guardrails

Thomas is designed to stay cheap when idle and predictable when used. Single-user posture: pay for tokens only.

## Runtime

| Mode | Compute | Model | Store |
|---|---|---|---|
| `THOMAS_MODE=local` (default) | Your machine only | Deterministic mock LLM — **$0** | `./data` |
| `THOMAS_MODE=gcp` | Your machine + Vertex API | Gemini pay-per-token (US `us-central1`) | `./data` (until you ask to deploy) |

Cloud Run / Firestore / GCS remain optional later: **min instances = 0**, US-only, no GPUs.

## In-code caps (local and GCP)

- `THOMAS_CHEAP_MODEL` for intake / **question generation** / triage stages
- `THOMAS_PRO_MODEL` only for whiteboard, tech options, architecture, final design, build approach
- `THOMAS_MAX_TOKENS_PER_STAGE` (default 4096)
- `THOMAS_MAX_TOOL_ROUNDS` (default 4) — reserved for future tool use
- Per-session `usage[]` log with estimated input/output tokens

## Explicit non-goals for cost

- No always-on GPUs
- No Vertex dedicated prediction endpoints
- No GKE / always-on VMs in v1
- No multi-region data (keep everything in the United States, default `us-central1`)
- Do not create Cloud Run / Firestore / GCS until you explicitly ask to deploy
