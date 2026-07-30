import express from "express";
import cors from "cors";
import multer from "multer";
import { mkdir } from "node:fs/promises";
import { env } from "./config.js";
import { createAdapters } from "./adapters/index.js";
import { PipelineService } from "./pipeline/pipeline.js";
import { createSessionRouter } from "./routes/api.js";

async function main() {
  await mkdir(env.dataDir, { recursive: true });
  const adapters = createAdapters();
  const pipeline = new PipelineService(adapters);
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 40 * 1024 * 1024 },
  });

  app.use(cors());
  app.use(express.json({ limit: "4mb" }));

  app.use(createSessionRouter(pipeline, adapters));

  app.post("/uploads", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "file is required" });
        return;
      }
      const saved = await adapters.files.saveUpload({
        filename: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
      });
      res.status(201).json(saved);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/uploads/:id", async (req, res) => {
    const meta = await adapters.files.getUpload(req.params.id);
    if (!meta) {
      res.status(404).json({ error: "Upload not found" });
      return;
    }
    res.json(meta);
  });

  app.listen(env.port, () => {
    console.log(
      `Thomas API listening on http://localhost:${env.port} (mode=${env.mode}). Standing by, sir.`,
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
