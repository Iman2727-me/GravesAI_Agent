import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Session, ProcessWhiteboard, SolutionDesignMap } from "@thomas/shared";
import type { StoreAdapter } from "./types.js";

async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

export function createLocalStore(dataDir: string): StoreAdapter {
  const sessionsDir = join(dataDir, "sessions");
  const boardsDir = join(dataDir, "whiteboards");
  const mapsDir = join(dataDir, "design-maps");

  async function readJson<T>(path: string): Promise<T | null> {
    try {
      const raw = await readFile(path, "utf8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async function writeJson(path: string, value: unknown) {
    await writeFile(path, JSON.stringify(value, null, 2), "utf8");
  }

  return {
    async getSession(id) {
      await ensureDir(sessionsDir);
      return readJson<Session>(join(sessionsDir, `${id}.json`));
    },
    async saveSession(session) {
      await ensureDir(sessionsDir);
      await writeJson(join(sessionsDir, `${session.id}.json`), session);
    },
    async listSessions() {
      await ensureDir(sessionsDir);
      const files = await readdir(sessionsDir);
      const sessions: Session[] = [];
      for (const f of files.filter((x) => x.endsWith(".json"))) {
        const s = await readJson<Session>(join(sessionsDir, f));
        if (s) sessions.push(s);
      }
      return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async getWhiteboard(processId) {
      await ensureDir(boardsDir);
      return readJson<ProcessWhiteboard>(join(boardsDir, `${processId}.json`));
    },
    async saveWhiteboard(board) {
      await ensureDir(boardsDir);
      await writeJson(join(boardsDir, `${board.processId}.json`), board);
    },
    async getDesignMap(processId) {
      await ensureDir(mapsDir);
      return readJson<SolutionDesignMap>(join(mapsDir, `${processId}.json`));
    },
    async saveDesignMap(map) {
      await ensureDir(mapsDir);
      await writeJson(join(mapsDir, `${map.processId}.json`), map);
    },
  };
}
