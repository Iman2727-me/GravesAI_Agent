import type { StoreAdapter, FilesAdapter } from "./types.js";

/**
 * GCP adapters are stubs until credentials exist.
 * Do not import @google-cloud packages or run gcloud here.
 */
export function createGcpStore(): StoreAdapter {
  const fail = () => {
    throw new Error(
      "THOMAS_MODE=gcp requires Firestore credentials. Set GOOGLE_APPLICATION_CREDENTIALS and GCP_PROJECT_ID, or use THOMAS_MODE=local.",
    );
  };
  return {
    getSession: async () => fail(),
    saveSession: async () => fail(),
    listSessions: async () => fail(),
    getWhiteboard: async () => fail(),
    saveWhiteboard: async () => fail(),
    getDesignMap: async () => fail(),
    saveDesignMap: async () => fail(),
  };
}

export function createGcpFiles(): FilesAdapter {
  const fail = () => {
    throw new Error(
      "THOMAS_MODE=gcp requires GCS credentials. Set GCS_BUCKET and credentials, or use THOMAS_MODE=local.",
    );
  };
  return {
    saveUpload: async () => fail(),
    getUpload: async () => fail(),
    readUploadBuffer: async () => fail(),
  };
}
