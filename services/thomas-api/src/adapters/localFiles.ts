import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { nanoid } from "nanoid";
import type { FilesAdapter, StoredUpload } from "./types.js";

export function createLocalFiles(dataDir: string): FilesAdapter {
  const uploadsDir = join(dataDir, "uploads");
  const metaDir = join(dataDir, "upload-meta");

  return {
    async saveUpload({ filename, mimeType, buffer }) {
      await mkdir(uploadsDir, { recursive: true });
      await mkdir(metaDir, { recursive: true });
      const id = nanoid(10);
      const path = join(uploadsDir, `${id}-${filename}`);
      await writeFile(path, buffer);
      const meta: StoredUpload = {
        id,
        filename,
        mimeType,
        path,
        size: buffer.length,
        createdAt: new Date().toISOString(),
      };
      await writeFile(join(metaDir, `${id}.json`), JSON.stringify(meta, null, 2));
      return meta;
    },
    async getUpload(id) {
      try {
        const raw = await readFile(join(metaDir, `${id}.json`), "utf8");
        return JSON.parse(raw) as StoredUpload;
      } catch {
        return null;
      }
    },
    async readUploadBuffer(id) {
      const meta = await this.getUpload(id);
      if (!meta) return null;
      return readFile(meta.path);
    },
  };
}
