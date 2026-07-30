import {
  STAGE_LABELS,
  STAGE_MODEL_TIER,
  buildSystemPrompt,
  type StageId,
  type Tone,
} from "@thomas/shared";
import { env } from "../config.js";
import type { LlmAdapter, LlmRequest, LlmResponse } from "./types.js";

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Deterministic local mock that follows the pipeline + Jarvis personality.
 * Swapped for Vertex behind the same interface when credentials exist.
 */
export function createMockLlm(): LlmAdapter {
  return {
    async complete(req: LlmRequest): Promise<LlmResponse> {
      const modelName = req.tier === "pro" ? env.proModel : env.cheapModel;
      const user = req.messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
      const system = req.messages.find((m) => m.role === "system")?.content ?? "";
      const pointed = system.includes("CURRENT TONE: pointed");
      const stageMatch = user.match(/STAGE:\s*(\w+)/);
      const stage = (stageMatch?.[1] ?? "problem_intake") as StageId;
      const label = STAGE_LABELS[stage] ?? stage;
      const ideaMatch = user.match(/IDEA:\s*([\s\S]*?)(?:\nANSWERS:|\nOVERRIDE:|$)/);
      const idea = (ideaMatch?.[1] ?? "the proposed idea").trim().slice(0, 200);

      const opener = pointed
        ? `As you wish, sir. Proceeding with ${label} despite the prior recommendation.`
        : `Very well, sir. I have begun ${label}.`;

      const text = [
        opener,
        `Regarding “${idea || "your idea"}”: I would note that several particulars remain underspecified.`,
        `Might I recommend we clarify the points below before advancing? I prefer not to invent constraints on your behalf.`,
        `It appears a measured approach will keep both cost and intellectual honesty intact.`,
      ].join(" ");

      const input = req.messages.map((m) => m.content).join("\n");
      return {
        text,
        modelName: `${modelName} (mock)`,
        estimatedInputTokens: estimateTokens(input),
        estimatedOutputTokens: estimateTokens(text),
      };
    },
  };
}

/**
 * Vertex AI Gemini adapter — structured for later. Throws until GCP is configured.
 * Do not call this path without credentials; local mode uses createMockLlm().
 */
export function createVertexLlm(): LlmAdapter {
  return {
    async complete(_req: LlmRequest): Promise<LlmResponse> {
      if (!env.gcpProjectId) {
        throw new Error(
          "Vertex LLM requires GCP_PROJECT_ID and application credentials. Use THOMAS_MODE=local until then.",
        );
      }
      throw new Error(
        "Vertex Gemini client is not activated yet. Install @google-cloud/vertexai and wire credentials when you have a GCP login. Do not run gcloud until then.",
      );
    },
  };
}

export function selectLlm(): LlmAdapter {
  return env.mode === "gcp" ? createVertexLlm() : createMockLlm();
}

export function stageSystemPrompt(tone: Tone): string {
  return buildSystemPrompt(tone);
}

export function stageUserPrompt(input: {
  stage: StageId;
  idea: string;
  answers: string;
  overridden: boolean;
  decisions: Record<string, string>;
}): string {
  return [
    `STAGE: ${input.stage}`,
    `MODEL_TIER: ${STAGE_MODEL_TIER[input.stage]}`,
    `IDEA: ${input.idea}`,
    `ANSWERS:\n${input.answers || "(none yet)"}`,
    `OVERRIDE: ${input.overridden ? "yes" : "no"}`,
    `DECISIONS_JSON: ${JSON.stringify(input.decisions)}`,
    "Respond as Thomas. Ask clarifying questions. Summarize findings for this stage.",
  ].join("\n");
}
