import type { StageId, Tone } from "./stages.js";

export interface Question {
  id: string;
  stageId: StageId;
  prompt: string;
  required: boolean;
  answered?: boolean;
  answer?: string;
}

export interface AgentMessage {
  id: string;
  role: "thomas" | "user" | "system";
  content: string;
  tone: Tone;
  stageId?: StageId;
  createdAt: string;
}

export interface WhiteboardNode {
  id: string;
  label: string;
  description?: string;
  notes?: string;
  status?: "pending" | "active" | "done";
  x: number;
  y: number;
}

export interface WhiteboardEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface ProcessWhiteboard {
  processId: string;
  sessionId: string;
  title: string;
  nodes: WhiteboardNode[];
  edges: WhiteboardEdge[];
  updatedAt: string;
}

export interface DesignDecision {
  id: string;
  key: string;
  label: string;
  value: string;
  alternatives?: string[];
  locked?: boolean;
  invalidatedBy?: string[];
}

export interface SolutionDesignMap {
  processId: string;
  sessionId: string;
  problemStatement: string;
  solutionType: string;
  riskMvpChoice: string;
  regulations: string[];
  stackDecisions: DesignDecision[];
  consolidations: string[];
  architectureBlocks: { id: string; name: string; detail: string }[];
  opsCostSummary: string;
  majorDecisions: DesignDecision[];
  updatedAt: string;
}

export interface StageRecord {
  id: StageId;
  status: "pending" | "waiting_for_answers" | "complete" | "skipped";
  summary?: string;
  recommendation?: string;
  overridden?: boolean;
}

export interface TokenUsage {
  stageId: StageId;
  modelTier: "cheap" | "pro";
  modelName: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  at: string;
}

export interface SessionArtifacts {
  whiteboardProcessId?: string;
  designMapProcessId?: string;
  whiteboardUrl?: string;
  designMapUrl?: string;
}

export interface Session {
  id: string;
  idea: string;
  uploadIds: string[];
  currentStage: StageId;
  stages: StageRecord[];
  pendingQuestions: Question[];
  answeredQuestions: Question[];
  messages: AgentMessage[];
  decisions: Record<string, string>;
  recommendations: Record<string, string>;
  overrides: string[];
  artifacts: SessionArtifacts;
  usage: TokenUsage[];
  status: "active" | "complete" | "paused";
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionRequest {
  idea: string;
  uploadIds?: string[];
}

export interface AnswerItem {
  questionId: string;
  answer: string;
  overrideRecommendation?: boolean;
}

export interface AnswerRequest {
  answers: AnswerItem[];
}

export interface ProcessPatch {
  whiteboard?: Partial<Pick<ProcessWhiteboard, "title" | "nodes" | "edges">>;
  designMap?: Partial<
    Omit<SolutionDesignMap, "processId" | "sessionId" | "updatedAt">
  >;
}

export const THOMAS_SYSTEM_PROMPT = `You are Thomas (also Tommy), a process-development and visual-modeling AI agent.
Speak in a formal, calm, precise register modeled on J.A.R.V.I.S. from Iron Man.
Address the user as sir where natural. Prefer "I would suggest", "might I recommend", "I would note", "it appears".
Use dry understated wit by default. When the user ignores a recommendation or makes an ill-advised choice, escalate to pointed passive-aggressive sarcasm while remaining polite and professional.
Never use casual hype ("awesome", "sure", "great idea"). Ask many clarifying questions. Do not assume. Prefer existing cheap fixes before custom builds.
You may make unsolicited suggestions when useful.`;
