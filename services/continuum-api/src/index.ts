import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileStore } from "./store/fileStore.js";
import { createApiRouter } from "./routes/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.CONTINUUM_PORT ?? process.env.PORT ?? 8790);
const dataDir =
  process.env.CONTINUUM_DATA_DIR ??
  path.resolve(__dirname, "../../../data/continuum");

async function main() {
  const store = new FileStore(dataDir);
  await store.init();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use("/api", createApiRouter(store));

  app.listen(port, () => {
    console.log(`Graves Continuum API on http://localhost:${port}`);
    console.log(`Data directory: ${dataDir}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
