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
      const ideaMatch = user.match(
        /IDEA:\s*([\s\S]*?)(?:\nANSWERS:|\nOVERRIDE:|\nPRIOR_DECISIONS:|\nSTAGE_PURPOSE:|$)/,
      );
      const idea = (ideaMatch?.[1] ?? "the proposed idea").trim().slice(0, 200);

      let text: string;
      if (user.includes("TASK: generate_questions")) {
        const turnMatch = user.match(/TURN:\s*(\d+)/);
        const turn = Number(turnMatch?.[1] ?? "1");
        text = JSON.stringify(mockStageBriefing(stage, idea, turn));
      } else {
        const opener = pointed
          ? `As you wish, Isaac. Proceeding with ${label} despite the prior recommendation.`
          : `Very well, Isaac. I have finished ${label}.`;
        text = [
          opener,
          `Regarding “${idea || "your idea"}”: my recommendation stands unless you overruled it.`,
          `I would keep the path cheap and clear.`,
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

function mockStageBriefing(stage: StageId, idea: string, turn: number): GeneratedStageBriefing {
  const short = idea.slice(0, 60) || "this idea";

  // Local mock: one answered choice is enough; Vertex decides via done.
  if (turn >= 2) {
    return {
      verdict: `I have enough to finish ${STAGE_LABELS[stage]}.`,
      inferred: [],
      done: true,
    };
  }

  const byStage: Partial<Record<StageId, GeneratedStageBriefing>> = {
    problem_intake: {
      verdict: `I read “${short}” as a real pain — I need what “win” means.`,
      inferred: [
        {
          key: "working_premise",
          value: `Treat “${short}” as the working premise.`,
          rationale: "Stated clearly enough to proceed.",
        },
      ],
      done: false,
      question: {
        prompt: "What does a win look like?",
        options: ["Saves me time every week", "People use it often", "It can make money", "Just proves the idea"],
        allowCustom: true,
        required: true,
        recommendedOption: "Saves me time every week",
      },
    },
    existing_cheap_fix: {
      verdict: "I would try an existing tool before building anything custom.",
      inferred: [
        {
          key: "search_bias",
          value: "Prefer off-the-shelf or spreadsheet+automation first.",
          rationale: "Cost posture.",
        },
      ],
      done: false,
      question: {
        prompt: "If a tool already covers most of this?",
        options: ["Use it and stop", "Use it, tweak a little", "Still build my own", "You pick after a quick scan"],
        allowCustom: true,
        required: true,
        recommendedOption: "You pick after a quick scan",
      },
    },
    good_problem: {
      verdict: `“${short}” looks worth a try — unless the pain is mild.`,
      inferred: [],
      done: false,
      question: {
        prompt: "Is this worth solving now?",
        options: ["Yes — pain is real", "Maybe — reshape it", "No — drop it", "You decide"],
        allowCustom: true,
        required: true,
        recommendedOption: "Yes — pain is real",
      },
    },
    risk_mvp_gate: {
      verdict: "I recommend a thin MVP first, not a full production build.",
      inferred: [
        {
          key: "default_risk",
          value: "Default toward a thin MVP.",
          rationale: "Lower blast radius.",
        },
      ],
      done: false,
      question: {
        prompt: "How should we ship the first version?",
        options: ["Small MVP soon", "Production-ready from day one", "Throwaway prototype", "You recommend"],
        allowCustom: true,
        required: true,
        recommendedOption: "Small MVP soon",
      },
    },
    solution_type: {
      verdict: "I lean software glued to existing tools, not a greenfield build.",
      inferred: [],
      done: false,
      question: {
        prompt: "What kind of solution fits?",
        options: ["Custom software", "Glue existing tools", "Process change only", "You recommend a split"],
        allowCustom: true,
        required: true,
        recommendedOption: "Glue existing tools",
      },
    },
    laws_regs: {
      verdict: "I do not see a regulated domain yet — confirm if I am wrong.",
      inferred: [
        {
          key: "regs_default",
          value: "No special regulated domain detected.",
          rationale: "Idea text unclear on healthcare/finance.",
        },
      ],
      done: false,
      question: {
        prompt: "Any rules we must follow?",
        options: ["None I know", "Privacy / personal data", "Health / money / kids", "Not sure — flag risks"],
        allowCustom: true,
        required: true,
        recommendedOption: "None I know",
      },
    },
    cost_effective_path: {
      verdict: "I assume you build it with AI help and keep spend near zero.",
      inferred: [],
      done: false,
      question: {
        prompt: "Budget for the first version?",
        options: ["Near $0", "Under $50/mo", "Under $500 total", "Flexible if worth it"],
        allowCustom: true,
        required: true,
        recommendedOption: "Near $0",
      },
    },
    whiteboard_decomposition: {
      verdict: "I would map: start → main action → result → come back.",
      inferred: [],
      done: false,
      question: {
        prompt: "Which step must feel right?",
        options: ["First setup", "The main daily action", "Sharing with others", "Looking back / history"],
        allowCustom: true,
        required: true,
        recommendedOption: "The main daily action",
      },
    },
    per_piece_tech: {
      verdict: "I prefer simple, cheap, US-region managed pieces.",
      inferred: [],
      done: false,
      question: {
        prompt: "Any hard tech yes/no?",
        options: ["You choose simple", "Stay on Google Cloud", "Prefer open source", "I will name bans"],
        allowCustom: true,
        required: true,
        recommendedOption: "You choose simple",
      },
    },
    architecture_stack: {
      verdict: "Fewer moving parts you can run alone beats a fancy stack.",
      inferred: [],
      done: false,
      question: {
        prompt: "What trade-off do you want?",
        options: ["Fewest parts", "More modular later", "Match what I already run", "You pick simplest"],
        allowCustom: true,
        required: true,
        recommendedOption: "You pick simplest",
      },
    },
    ops_cost: {
      verdict: "Design for near-zero idle cost; pay mainly when used.",
      inferred: [],
      done: false,
      question: {
        prompt: "Monthly spend that feels too high?",
        options: ["Over ~$10", "Over ~$50", "Over ~$200", "Flexible for now"],
        allowCustom: true,
        required: true,
        recommendedOption: "Over ~$50",
      },
    },
    final_design_map: {
      verdict: "I would lock the big calls and leave only deliberate gaps.",
      inferred: [],
      done: false,
      question: {
        prompt: "What should we lock now?",
        options: ["Lock the big decisions", "Lock stack only", "Keep several open", "Show your locks"],
        allowCustom: true,
        required: true,
        recommendedOption: "Lock the big decisions",
      },
    },
    build_approach: {
      verdict: "AI should draft; you review the important checkpoints.",
      inferred: [],
      done: false,
      question: {
        prompt: "How hands-on do you want to be?",
        options: ["AI drafts; I check points", "Pair on every piece", "AI builds; I spot-check", "Plan only for now"],
        allowCustom: true,
        required: true,
        recommendedOption: "AI drafts; I check points",
      },
    },
    learn_retrospect: {
      verdict: "I will remember you like short choices and cheap defaults.",
      inferred: [],
      done: false,
      question: {
        prompt: "What should I remember next time?",
        options: ["Keep choices short", "Bias harder to buy tools", "Bias harder to build", "I will write a note"],
        allowCustom: true,
        required: true,
        recommendedOption: "Keep choices short",
      },
    },
  };

  return (
    byStage[stage] ?? {
      verdict: `Here is my take on ${STAGE_LABELS[stage]}.`,
      inferred: [],
      done: false,
      question: {
        prompt: "Accept my recommendation?",
        options: ["Yes — proceed", "No — I will change it"],
        allowCustom: true,
        required: true,
        recommendedOption: "Yes — proceed",
      },
    }
  );
}

const STAGE_TURN_GUIDANCE: Partial<Record<StageId, string>> = {
  problem_intake:
    "Understand the pain in plain words. Infer what you can. Ask one short choice that locks what a win looks like.",
  existing_cheap_fix:
    "Judge whether a cheap existing tool/workflow likely covers this. Recommend buy/adopt vs build. Present cases as options.",
  good_problem:
    "Say clearly if the idea looks weak, unclear, or worth pursuing. Then ask Isaac to accept, reshape, or kill it.",
  risk_mvp_gate:
    "Recommend MVP vs production-direct with a one-line why. Options must include those cases.",
  solution_type:
    "Recommend software / glue existing tools / process-only / hybrid. Present as simple cases.",
  laws_regs: "If unclear, ask one short compliance choice. If clear, set done=true after a short verdict.",
  cost_effective_path: "Recommend DIY+AI vs hire vs buy. One budget/path choice.",
  whiteboard_decomposition: "Propose a simple flow in the verdict. One choice about what must feel right.",
  per_piece_tech: "Recommend a simple stack bias. One hard-preference choice.",
  architecture_stack: "Recommend fewest operable parts. One trade-off choice.",
  ops_cost: "Recommend a cheap ops posture. One spend-ceiling choice.",
  final_design_map: "Recommend what to lock. One lock-scope choice.",
  build_approach: "Recommend AI-heavy build with Isaac reviewing. One hands-on choice.",
  learn_retrospect: "One short memory choice for next time.",
};

export function questionGenUserPrompt(input: {
  stage: StageId;
  idea: string;
  decisions: Record<string, string>;
  priorAnswers: string;
  turn: number;
  maxTurns: number;
}): string {
  const guidance = STAGE_TURN_GUIDANCE[input.stage] ?? "Think, recommend, ask one easy choice.";
  return [
    "TASK: generate_questions",
    `STAGE: ${input.stage}`,
    `STAGE_PURPOSE: ${STAGE_LABELS[input.stage]}`,
    `TURN: ${input.turn}`,
    `MAX_TURNS: ${input.maxTurns}`,
    `IDEA: ${input.idea}`,
    `PRIOR_DECISIONS: ${JSON.stringify(input.decisions)}`,
    `PRIOR_ANSWERS:\n${input.priorAnswers || "(none yet)"}`,
    "",
    "You do the thinking. Isaac only picks.",
    `Stage guidance: ${guidance}`,
    "",
    "Rules:",
    "1) Write a VERDICT: one short plain sentence (everyday words, no jargon stacks).",
    "2) INFER any defaults you can responsibly conclude (optional).",
    "3) Ask AT MOST ONE question — or set done=true with no question if this stage is finished.",
    "4) Question prompt: max ~12 words, one idea, easy to understand.",
    "5) Options: 3–5 concrete decisions Isaac can tap (cases/paths), plus allowCustom=true.",
    "6) Mark recommendedOption as the exact option text you prefer.",
    "7) Do NOT ask homework, multi-part questions, or restate the idea.",
    "8) If TURN > 1 OR Isaac already answered anything for this stage, almost always set done=true. Never re-ask the same idea in different words.",
    "9) Prefer finishing the stage over another question.",
    "",
    "Respond with ONLY valid JSON:",
    '{"verdict":"...","inferred":[{"key":"snake_case","value":"...","rationale":"..."}],"done":false,"question":{"prompt":"...","options":["...","..."],"allowCustom":true,"required":true,"recommendedOption":"..."}}',
  ].join("\n");
}

export interface GeneratedInferred {
  key: string;
  value: string;
  rationale?: string;
}

export interface GeneratedQuestionSpec {
  prompt: string;
  options: string[];
  allowCustom: boolean;
  required: boolean;
  recommendedOption?: string;
}

export interface GeneratedStageBriefing {
  verdict: string;
  inferred: GeneratedInferred[];
  done: boolean;
  question?: GeneratedQuestionSpec;
}

function parseQuestionSpec(raw: unknown): GeneratedQuestionSpec | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  const prompt = typeof rec.prompt === "string" ? rec.prompt.trim() : "";
  if (!prompt) return undefined;
  const options = Array.isArray(rec.options)
    ? rec.options
        .filter((o): o is string => typeof o === "string")
        .map((o) => o.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
  if (options.length < 2) return undefined;
  const recommendedOption =
    typeof rec.recommendedOption === "string" ? rec.recommendedOption.trim() : undefined;
  return {
    prompt,
    options,
    allowCustom: rec.allowCustom !== false,
    required: rec.required !== false,
    recommendedOption:
      recommendedOption && options.includes(recommendedOption) ? recommendedOption : options[0],
  };
}

export function parseGeneratedBriefing(text: string): GeneratedStageBriefing | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence?.[1]?.trim() ?? trimmed;
  try {
    const parsed = JSON.parse(raw) as {
      verdict?: unknown;
      inferred?: unknown;
      done?: unknown;
      question?: unknown;
      questions?: unknown;
    };

    const verdict =
      typeof parsed.verdict === "string" && parsed.verdict.trim()
        ? parsed.verdict.trim()
        : "Here is my take.";

    const inferred: GeneratedInferred[] = [];
    if (Array.isArray(parsed.inferred)) {
      for (const item of parsed.inferred) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        const key = typeof rec.key === "string" ? rec.key.trim() : "";
        const value = typeof rec.value === "string" ? rec.value.trim() : "";
        if (!key || !value) continue;
        inferred.push({
          key,
          value,
          rationale: typeof rec.rationale === "string" ? rec.rationale.trim() : undefined,
        });
      }
    }

    const done = parsed.done === true;

    // Prefer single `question`; tolerate legacy `questions[]` by taking the first.
    let question = parseQuestionSpec(parsed.question);
    if (!question && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      const first = parsed.questions[0];
      if (typeof first === "string" && first.trim()) {
        question = {
          prompt: first.trim(),
          options: ["Accept my recommendation", "I will change it"],
          allowCustom: true,
          required: true,
          recommendedOption: "Accept my recommendation",
        };
      } else {
        question = parseQuestionSpec(first);
      }
    }

    if (done) {
      return { verdict, inferred, done: true };
    }

    if (!question && inferred.length === 0 && !parsed.verdict) return null;

    return {
      verdict,
      inferred,
      done: false,
      question,
    };
  } catch {
    return null;
  }
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
    "Respond as Thomas. Give Isaac a short plain summary of this stage (1–2 sentences max). No lists.",
  ].join("\n");
}
