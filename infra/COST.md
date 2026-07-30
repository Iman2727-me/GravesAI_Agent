# Cost guardrails

Thomas is designed to stay cheap when idle and predictable when used.

## Runtime

| Mode | Compute | Model |
|---|---|---|
| `THOMAS_MODE=local` (default) | Your machine only | Deterministic mock LLM — **$0** |
| `THOMAS_MODE=gcp` (later) | Cloud Run **min instances = 0** | Vertex Gemini API pay-per-token |

## In-code caps (local and GCP)

- `THOMAS_CHEAP_MODEL` for intake / questions / triage stages
- `THOMAS_PRO_MODEL` only for whiteboard, tech options, architecture, final design, build approach
- `THOMAS_MAX_TOKENS_PER_STAGE` (default 4096)
- `THOMAS_MAX_TOOL_ROUNDS` (default 4) — reserved for future tool use
- Per-session `usage[]` log with estimated input/output tokens

## Explicit non-goals for cost

- No always-on GPUs
- No Vertex dedicated prediction endpoints
- No GKE / always-on VMs in v1
- Do not run `gcloud` or create billable resources until you have a login and ask to deploy
