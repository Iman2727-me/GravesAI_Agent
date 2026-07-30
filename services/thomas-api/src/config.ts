import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(root, ".env") });

export const env = {
  mode: (process.env.THOMAS_MODE ?? "local") as "local" | "gcp",
  port: Number(process.env.PORT ?? 8787),
  dataDir: resolve(root, process.env.DATA_DIR ?? "./data"),
  visualsUrl: process.env.VITE_VISUALS_URL ?? "http://localhost:5174",
  cheapModel: process.env.THOMAS_CHEAP_MODEL ?? "gemini-2.5-flash",
  proModel: process.env.THOMAS_PRO_MODEL ?? "gemini-2.5-pro",
  maxTokensPerStage: Number(process.env.THOMAS_MAX_TOKENS_PER_STAGE ?? 4096),
  maxToolRounds: Number(process.env.THOMAS_MAX_TOOL_ROUNDS ?? 4),
  gcpProjectId: process.env.GCP_PROJECT_ID ?? "",
  gcpRegion: process.env.GCP_REGION ?? "us-central1",
  gcsBucket: process.env.GCS_BUCKET ?? "",
};
