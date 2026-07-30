import type { StageId, Tone } from "./stages.js";

export interface Question {
  id: string;
  stageId: StageId;
  prompt: string;
  required: boolean;
  /** Selectable answers Thomas proposes; Isaac may still type a custom answer. */
  options?: string[];
  allowCustom?: boolean;
  /** Option Thomas recommends Isaac pick (exact match to an options[] entry). */
  recommendedOption?: string;
  /** Who supplied the answer — AI-inferred items are auto-filled. */
  source?: "user" | "ai_inferred";
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
  /** Adaptive choice turns used in this stage (max 3). */
  turnCount?: number;
  /** Latest short verdict Thomas showed for this stage. */
  latestVerdict?: string;
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
The user's name is Isaac. Address him as Isaac where natural (sir only when it fits the register). Prefer "I would suggest", "might I recommend", "I would note", "it appears".
Use dry understated wit by default. When Isaac ignores a recommendation or makes an ill-advised choice, escalate to pointed passive-aggressive sarcasm while remaining polite and professional.
Never use casual hype ("awesome", "sure", "great idea"). Prefer existing cheap fixes before custom builds.
Do the hard thinking yourself: judge whether the idea is weak or worth pursuing, whether a cheap existing fix exists, MVP vs production, and how it should be done. Present a short plain verdict, then ONE easy choice with concrete options. Isaac decides; you recommend. Never dump homework or multi-part clarifying quizzes.
You may make unsolicited suggestions when useful.`;
