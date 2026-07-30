import {
  STAGE_LABELS,
  STAGE_MODEL_TIER,
  buildSystemPrompt,
  type StageId,
  type Tone,
} from "@thomas/shared";
import { VertexAI } from "@google-cloud/vertexai";
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
      const ideaMatch = user.match(/IDEA:\s*([\s\S]*?)(?:\nANSWERS:|\nOVERRIDE:|\nPRIOR_DECISIONS:|\nSTAGE_PURPOSE:|$)/);
      const idea = (ideaMatch?.[1] ?? "the proposed idea").trim().slice(0, 200);

      let text: string;
      if (user.includes("TASK: generate_questions")) {
        const prompts = mockQuestionsForIdea(stage, idea);
        text = JSON.stringify({ questions: prompts });
      } else {
        const opener = pointed
          ? `As you wish, Isaac. Proceeding with ${label} despite the prior recommendation.`
          : `Very well, Isaac. I have begun ${label}.`;
        text = [
          opener,
          `Regarding “${idea || "your idea"}”: I would note that several particulars remain underspecified.`,
          `Might I recommend we clarify the points below before advancing? I prefer not to invent constraints on your behalf.`,
          `It appears a measured approach will keep both cost and intellectual honesty intact.`,
        ].join(" ");
      }

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

function mockQuestionsForIdea(stage: StageId, idea: string): string[] {
  const short = idea.slice(0, 80) || "this idea";
  const byStage: Record<StageId, string[]> = {
    problem_intake: [
      `For “${short}”, what painful problem are you actually solving, Isaac?`,
      `Who experiences this most acutely, and how often?`,
      `What have you already tried related to “${short}”?`,
      `Which constraints (time, budget, skills, compliance) are non-negotiable?`,
    ],
    existing_cheap_fix: [
      `Do you already know a product or workflow that nearly solves “${short}”?`,
      `Would adopting an existing tool be acceptable, or is differentiation required?`,
      `What would “good enough without building” look like here?`,
    ],
    good_problem: [
      `Why is “${short}” worth solving now rather than later?`,
      `What happens if nobody solves it for twelve months?`,
      `How will you know the problem is solved — what metric or signal?`,
    ],
    risk_mvp_gate: [
      `What is the worst plausible failure mode if we ship the wrong thing for “${short}”?`,
      `Is there a smaller slice we could validate in days rather than months?`,
      `Are you inclined toward MVP validation, or production-direct?`,
    ],
    solution_type: [
      `Is the primary lever for “${short}” software, process/behavior, physical, or org change?`,
      `Could existing software plus APIs cover most of this without a custom build?`,
      `What must be custom, if anything, for strategic reasons?`,
    ],
    laws_regs: [
      `Does “${short}” touch healthcare, finance, education, children, or regulated personal data?`,
      `Are there jurisdictions or certifications you already know apply?`,
      `Who is accountable if compliance goes wrong?`,
    ],
    cost_effective_path: [
      `Which parts of “${short}” can you execute yourself with current skills?`,
      `Where would hiring be cheaper than your time?`,
      `What is a rough budget ceiling for the first version?`,
    ],
    whiteboard_decomposition: [
      `What are the major steps from start to done for “${short}”?`,
      `Which step is the bottleneck or source of most errors today?`,
      `Are there steps that should remain human-in-the-loop on purpose?`,
    ],
    per_piece_tech: [
      `Any hard preferences or bans in the tech stack for “${short}”?`,
      `Must pieces run on-prem, in GCP (US), or either?`,
      `Where would you rather buy a component than build one?`,
    ],
    architecture_stack: [
      `Do you prefer fewer moving parts even if each piece is less perfect?`,
      `Any existing systems must “${short}” integrate with on day one?`,
      `What does “simple enough to operate alone” mean for you?`,
    ],
    ops_cost: [
      `Expected monthly volume for “${short}” in the first year?`,
      `What monthly ops spend would make you uncomfortable?`,
      `Who will monitor and maintain this after launch?`,
    ],
    final_design_map: [
      `Which decisions from earlier stages are you willing to lock now for “${short}”?`,
      `What remains explicitly undecided on purpose?`,
      `Anything I recommended that you are overriding for the final map?`,
    ],
    build_approach: [
      `How much of the build for “${short}” should AI agents perform versus you reviewing?`,
      `Any IP or secrecy constraints on tooling?`,
      `Preferred development tools later — for planning only in v1?`,
    ],
    learn_retrospect: [
      `What surprised you most about working through “${short}”?`,
      `What should Thomas remember for the next idea you bring?`,
      `Which stage questions felt wasteful, if any?`,
    ],
  };
  return byStage[stage] ?? [
    `What remains unclear about “${short}” for ${STAGE_LABELS[stage]}?`,
    `What would change your mind at this stage?`,
  ];
}

/**
 * Vertex AI Gemini adapter — pay-per-token, US region, ADC credentials.
 */
export function createVertexLlm(): LlmAdapter {
  if (!env.gcpProjectId) {
    throw new Error(
      "Vertex LLM requires GCP_PROJECT_ID. Set it in .env and run gcloud auth application-default login.",
    );
  }

  const vertex = new VertexAI({
    project: env.gcpProjectId,
    location: env.gcpRegion || "us-central1",
  });

  return {
    async complete(req: LlmRequest): Promise<LlmResponse> {
      const modelName = req.tier === "pro" ? env.proModel : env.cheapModel;
      const maxTokens = req.maxTokens ?? env.maxTokensPerStage;
      const system = req.messages.find((m) => m.role === "system")?.content ?? "";
      const contents = req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

      const model = vertex.getGenerativeModel({
        model: modelName,
        systemInstruction: system || undefined,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.4,
        },
      });

      const result = await model.generateContent({ contents });
      const response = result.response;
      const text =
        response.candidates?.[0]?.content?.parts
          ?.map((p) => ("text" in p ? p.text : ""))
          .filter(Boolean)
          .join("") ?? "";

      if (!text) {
        throw new Error("Vertex Gemini returned an empty response.");
      }

      const input = req.messages.map((m) => m.content).join("\n");
      const usageMeta = response.usageMetadata;
      return {
        text,
        modelName,
        estimatedInputTokens: usageMeta?.promptTokenCount ?? estimateTokens(input),
        estimatedOutputTokens: usageMeta?.candidatesTokenCount ?? estimateTokens(text),
      };
    },
  };
}

export function selectLlm(): LlmAdapter {
  if (env.mode === "gcp") {
    return createVertexLlm();
  }
  return createMockLlm();
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
    "Respond as Thomas. Summarize findings for this stage for Isaac. Do not invent a new stage order.",
  ].join("\n");
}

export function questionGenUserPrompt(input: {
  stage: StageId;
  idea: string;
  decisions: Record<string, string>;
  priorAnswers: string;
}): string {
  return [
    "TASK: generate_questions",
    `STAGE: ${input.stage}`,
    `STAGE_PURPOSE: ${STAGE_LABELS[input.stage]}`,
    `IDEA: ${input.idea}`,
    `PRIOR_DECISIONS: ${JSON.stringify(input.decisions)}`,
    `PRIOR_ANSWERS:\n${input.priorAnswers || "(none yet)"}`,
    "",
    "Generate 2–4 clarifying questions for Isaac that are specific to THIS idea and THIS stage only.",
    "Stay within the stage purpose from the Graves thinking process. Do not advance stages or invent other stages.",
    "Skip questions that are clearly irrelevant to the idea (e.g. healthcare regs for a non-health idea).",
    "Prefer questions that unblock the stage. Address Isaac by name when natural.",
    'Respond with ONLY valid JSON of the form: {"questions":["...","..."]}',
  ].join("\n");
}

export function parseGeneratedQuestions(text: string): string[] | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence?.[1]?.trim() ?? trimmed;
  try {
    const parsed = JSON.parse(raw) as { questions?: unknown };
    if (!Array.isArray(parsed.questions)) return null;
    const prompts = parsed.questions
      .filter((q): q is string => typeof q === "string")
      .map((q) => q.trim())
      .filter(Boolean)
      .slice(0, 4);
    return prompts.length >= 2 ? prompts : null;
  } catch {
    return null;
  }
}
