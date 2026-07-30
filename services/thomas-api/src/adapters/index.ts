import { env } from "../config.js";
import { createLocalStore } from "./localStore.js";
import { createLocalFiles } from "./localFiles.js";
import { selectLlm } from "./llm.js";
import type { FilesAdapter, LlmAdapter, StoreAdapter } from "./types.js";

export interface Adapters {
  store: StoreAdapter;
  files: FilesAdapter;
  llm: LlmAdapter;
}

export function createAdapters(): Adapters {
  // Cheap single-user path: Vertex Gemini for LLM, local files for store/uploads
  // until Cloud Run / Firestore / GCS deploy is explicitly requested.
  return {
    store: createLocalStore(env.dataDir),
    files: createLocalFiles(env.dataDir),
    llm: selectLlm(),
  };
}
