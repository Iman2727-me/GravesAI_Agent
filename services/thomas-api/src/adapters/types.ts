import type { Session, ProcessWhiteboard, SolutionDesignMap } from "@thomas/shared";

export interface StoredUpload {
  id: string;
  filename: string;
  mimeType: string;
  path: string;
  size: number;
  createdAt: string;
}

export interface StoreAdapter {
  getSession(id: string): Promise<Session | null>;
  saveSession(session: Session): Promise<void>;
  listSessions(): Promise<Session[]>;
  getWhiteboard(processId: string): Promise<ProcessWhiteboard | null>;
  saveWhiteboard(board: ProcessWhiteboard): Promise<void>;
  getDesignMap(processId: string): Promise<SolutionDesignMap | null>;
  saveDesignMap(map: SolutionDesignMap): Promise<void>;
}

export interface FilesAdapter {
  saveUpload(input: {
    filename: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<StoredUpload>;
  getUpload(id: string): Promise<StoredUpload | null>;
  readUploadBuffer(id: string): Promise<Buffer | null>;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  tier: "cheap" | "pro";
  messages: LlmMessage[];
  maxTokens?: number;
}

export interface LlmResponse {
  text: string;
  modelName: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
}

export interface LlmAdapter {
  complete(req: LlmRequest): Promise<LlmResponse>;
}
