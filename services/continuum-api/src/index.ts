import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { FileStore } from "./store/fileStore.js";
import { createApiRouter } from "./routes/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.CONTINUUM_PORT ?? process.env.PORT ?? 8790);
const host = process.env.CONTINUUM_HOST ?? "0.0.0.0";
const dataDir =
  process.env.CONTINUUM_DATA_DIR ??
  path.resolve(__dirname, "../../../data/continuum");
const staticDir =
  process.env.CONTINUUM_STATIC_DIR ??
  path.resolve(__dirname, "../../../apps/continuum/dist");

async function main() {
  const store = new FileStore(dataDir);
  await store.init();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use("/api", createApiRouter(store));

  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(staticDir, "index.html"));
    });
    console.log(`Serving Continuum UI from ${staticDir}`);
  }

  app.listen(port, host, () => {
    console.log(`Graves Continuum on http://${host}:${port}`);
    console.log(`Data directory: ${dataDir}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
