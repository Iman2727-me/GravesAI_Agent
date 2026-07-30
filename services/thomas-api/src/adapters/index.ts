import { env } from "../config.js";
import { createLocalStore } from "./localStore.js";
import { createLocalFiles } from "./localFiles.js";
import { createGcpStore, createGcpFiles } from "./gcpStubs.js";
import { selectLlm } from "./llm.js";
import type { FilesAdapter, LlmAdapter, StoreAdapter } from "./types.js";

export interface Adapters {
  store: StoreAdapter;
  files: FilesAdapter;
  llm: LlmAdapter;
}

export function createAdapters(): Adapters {
  if (env.mode === "gcp") {
    return {
      store: createGcpStore(),
      files: createGcpFiles(),
      llm: selectLlm(),
    };
  }
  return {
    store: createLocalStore(env.dataDir),
    files: createLocalFiles(env.dataDir),
    llm: selectLlm(),
  };
}
