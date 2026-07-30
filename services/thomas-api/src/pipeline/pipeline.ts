import { nanoid } from "nanoid";
import {
  STAGE_ORDER,
  STAGE_LABELS,
  nextStage,
  pointedOverrideAck,
  type Question,
  type Session,
  type StageId,
  type Tone,
  type AgentMessage,
  type ProcessWhiteboard,
  type SolutionDesignMap,
  type StageRecord,
} from "@thomas/shared";
import { env } from "../config.js";
import type { Adapters } from "../adapters/index.js";
import {
  stageSystemPrompt,
  stageUserPrompt,
  questionGenUserPrompt,
  parseGeneratedBriefing,
  type GeneratedStageBriefing,
} from "../adapters/llm.js";

/** Emergency fallback only — one short choice per stage, not a script. */
const STAGE_FALLBACK: Record<
  StageId,
  { verdict: string; prompt: string; options: string[]; recommended: string }
> = {
  problem_intake: {
    verdict: "I need one clear win condition before we go further.",
    prompt: "What does a win look like?",
    options: ["Saves me time", "People use it often", "It can make money", "Just proves the idea"],
    recommended: "Saves me time",
  },
  existing_cheap_fix: {
    verdict: "I would look for an existing cheap tool before building.",
    prompt: "If something already covers most of this?",
    options: ["Use it and stop", "Use it, tweak a little", "Still build my own", "You pick"],
    recommended: "You pick",
  },
  good_problem: {
    verdict: "I need your call on whether this is worth solving.",
    prompt: "Is this worth solving now?",
    options: ["Yes — pain is real", "Maybe — reshape it", "No — drop it", "You decide"],
    recommended: "Yes — pain is real",
  },
  risk_mvp_gate: {
    verdict: "I recommend a thin MVP first.",
    prompt: "How should we ship first?",
    options: ["Small MVP soon", "Production from day one", "Throwaway prototype", "You recommend"],
    recommended: "Small MVP soon",
  },
  solution_type: {
    verdict: "I lean toward gluing existing tools.",
    prompt: "What kind of solution fits?",
    options: ["Custom software", "Glue existing tools", "Process change only", "You recommend"],
    recommended: "Glue existing tools",
  },
  laws_regs: {
    verdict: "I do not see special rules yet — confirm.",
    prompt: "Any rules we must follow?",
    options: ["None I know", "Privacy data", "Health / money / kids", "Not sure — flag risks"],
    recommended: "None I know",
  },
  cost_effective_path: {
    verdict: "Keep the first version near zero cost.",
    prompt: "Budget for v1?",
    options: ["Near $0", "Under $50/mo", "Under $500 total", "Flexible"],
    recommended: "Near $0",
  },
  whiteboard_decomposition: {
    verdict: "I would keep the flow short and clear.",
    prompt: "Which step must feel right?",
    options: ["First setup", "Main daily action", "Sharing", "History / insights"],
    recommended: "Main daily action",
  },
  per_piece_tech: {
    verdict: "I prefer simple cheap pieces.",
    prompt: "Any hard tech yes/no?",
    options: ["You choose simple", "Stay on GCP", "Prefer open source", "I will name bans"],
    recommended: "You choose simple",
  },
  architecture_stack: {
    verdict: "Fewest parts you can run alone.",
    prompt: "What trade-off do you want?",
    options: ["Fewest parts", "More modular later", "Match what I run", "You pick"],
    recommended: "You pick",
  },
  ops_cost: {
    verdict: "Near-zero idle cost; pay when used.",
    prompt: "Monthly spend that feels too high?",
    options: ["Over ~$10", "Over ~$50", "Over ~$200", "Flexible"],
    recommended: "Over ~$50",
  },
  final_design_map: {
    verdict: "Lock the big calls; leave deliberate gaps.",
    prompt: "What should we lock now?",
    options: ["Lock big decisions", "Lock stack only", "Keep several open", "Show your locks"],
    recommended: "Lock big decisions",
  },
  build_approach: {
    verdict: "AI drafts; you review checkpoints.",
    prompt: "How hands-on do you want?",
    options: ["AI drafts; I check", "Pair on every piece", "AI builds; I spot-check", "Plan only"],
    recommended: "AI drafts; I check",
  },
  learn_retrospect: {
    verdict: "One thing to remember next time.",
    prompt: "What should I remember?",
    options: ["Keep choices short", "Bias to buy tools", "Bias to build", "I will write a note"],
    recommended: "Keep choices short",
  },
};

/** One choice per stage by default; follow-ups only if the model sets done=false before this cap. */
const MAX_TURNS_PER_STAGE = 2;

function now() {
  return new Date().toISOString();
}

function msg(
  role: AgentMessage["role"],
  content: string,
  tone: Tone,
  stageId?: StageId,
): AgentMessage {
  return {
    id: nanoid(8),
    role,
    content,
    tone,
    stageId,
    createdAt: now(),
  };
}

function fallbackBriefing(stage: StageId): GeneratedStageBriefing {
  const fb = STAGE_FALLBACK[stage];
  return {
    verdict: fb.verdict,
    inferred: [],
    done: false,
    question: {
      prompt: fb.prompt,
      options: fb.options,
      allowCustom: true,
      required: true,
      recommendedOption: fb.recommended,
    },
  };
}

/** Apply one adaptive turn. Returns pending questions (0 or 1) and whether the stage is done. */
function applyBriefing(
  session: Session,
  stage: StageId,
  briefing: GeneratedStageBriefing,
  turn: number,
): { pending: Question[]; stageDone: boolean } {
  for (const [i, item] of briefing.inferred.entries()) {
    const q: Question = {
      id: `${stage}_ai_t${turn}_${i + 1}`,
      stageId: stage,
      prompt: `Thomas inferred (${item.key})`,
      required: false,
      source: "ai_inferred",
      answered: true,
      answer: item.value,
      options: [],
      allowCustom: false,
    };
    session.answeredQuestions.push(q);
    session.decisions[`${stage}__${item.key}`] = item.value;
  }

  const stageRec = session.stages.find((s) => s.id === stage);
  if (stageRec) {
    stageRec.latestVerdict = briefing.verdict;
    stageRec.turnCount = turn;
  }

  session.messages.push(msg("thomas", briefing.verdict, "dry", stage));

  if (briefing.done || !briefing.question) {
    return { pending: [], stageDone: true };
  }

  const spec = briefing.question;
  const pending: Question[] = [
    {
      id: `${stage}_q_t${turn}`,
      stageId: stage,
      prompt: spec.prompt,
      required: spec.required !== false,
      options: spec.options,
      allowCustom: spec.allowCustom !== false,
      recommendedOption: spec.recommendedOption,
      source: "user",
    },
  ];

  if (spec.recommendedOption) {
    session.recommendations[stage] = spec.recommendedOption;
  }

  return { pending, stageDone: false };
}

function emptyStages(): StageRecord[] {
  return STAGE_ORDER.map((id) => ({
    id,
    status: id === "problem_intake" ? "waiting_for_answers" : "pending",
  }));
}

export function createEmptySession(idea: string, uploadIds: string[]): Session {
  const id = nanoid(12);
  const tone: Tone = "dry";
  return {
    id,
    idea,
    uploadIds,
    currentStage: "problem_intake",
    stages: emptyStages(),
    pendingQuestions: [],
    answeredQuestions: [],
    messages: [
      msg(
        "thomas",
        `Good day, Isaac. I am Thomas — Tommy, if you prefer. I will think this through and give you short choices. You decide.`,
        tone,
        "problem_intake",
      ),
    ],
    decisions: {},
    recommendations: {
      problem_intake: "Clarify the problem before proposing solutions.",
    },
    overrides: [],
    artifacts: {},
    usage: [],
    status: "active",
    createdAt: now(),
    updatedAt: now(),
  };
}

function defaultWhiteboard(session: Session, processId: string): ProcessWhiteboard {
  const pieces = [
    { id: "intake", label: "Intake", description: "Capture the problem and constraints" },
    { id: "validate", label: "Validate", description: "Cheap existing fix & problem worth" },
    { id: "design", label: "Design", description: "Solution type, stack, architecture" },
    { id: "operate", label: "Operate", description: "Ops cost and ongoing ownership" },
    { id: "build", label: "Build plan", description: "AI-maximized build approach (plan only)" },
  ];
  return {
    processId,
    sessionId: session.id,
    title: `Process: ${session.idea.slice(0, 60)}`,
    nodes: pieces.map((p, i) => ({
      ...p,
      notes: "",
      status: i === 0 ? "active" : "pending",
      x: 80 + i * 180,
      y: 160,
    })),
    edges: pieces.slice(0, -1).map((p, i) => ({
      id: `e${i}`,
      from: p.id,
      to: pieces[i + 1]!.id,
    })),
    updatedAt: now(),
  };
}

function defaultDesignMap(session: Session, processId: string): SolutionDesignMap {
  return {
    processId,
    sessionId: session.id,
    problemStatement: session.idea,
    solutionType: session.decisions.solution_type ?? "Undecided — pending clarification",
    riskMvpChoice: session.decisions.risk_mvp_gate ?? "MVP recommended until risk is better understood",
    regulations: (session.decisions.laws_regs ?? "To be confirmed").split(";").map((s) => s.trim()),
    stackDecisions: [
      {
        id: "stack_primary",
        key: "primary_stack",
        label: "Primary stack direction",
        value: session.decisions.architecture_stack ?? "Consolidate on few managed services",
        alternatives: ["Fully custom", "Mostly SaaS + glue", "Hybrid"],
      },
    ],
    consolidations: [
      session.decisions.per_piece_tech ??
        "Prefer fewer vendors; merge overlapping pieces where practical.",
    ],
    architectureBlocks: [
      { id: "edge", name: "Intake / UI", detail: "Thin feeder; generative visual surfaces" },
      { id: "agent", name: "Thomas agent", detail: "API-invoked pipeline; scale-to-zero compute" },
      { id: "data", name: "State & files", detail: "Session store + object storage for uploads" },
      { id: "model", name: "Model tiering", detail: "Cheap model for triage; pro for synthesis" },
    ],
    opsCostSummary:
      session.decisions.ops_cost ??
      "Idle compute near zero; spend dominated by model tokens when used.",
    majorDecisions: Object.entries(session.decisions).map(([key, value]) => ({
      id: key,
      key,
      label: STAGE_LABELS[key as StageId] ?? key,
      value,
      locked: true,
    })),
    updatedAt: now(),
  };
}

export class PipelineService {
  constructor(private adapters: Adapters) {}

  async createSession(idea: string, uploadIds: string[] = []): Promise<Session> {
    const session = createEmptySession(idea.trim(), uploadIds);
    const turn = await this.runStageTurn(session, "problem_intake");
    if (turn.stageDone) {
      await this.completeCurrentStage(session, false);
    } else {
      session.pendingQuestions = turn.pending;
    }
    await this.adapters.store.saveSession(session);
    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    return this.adapters.store.getSession(id);
  }

  /** One adaptive turn: Thomas thinks, presents at most one choice. */
  private async runStageTurn(
    session: Session,
    stage: StageId,
  ): Promise<{ pending: Question[]; stageDone: boolean }> {
    const stageRec = session.stages.find((s) => s.id === stage);
    const turn = (stageRec?.turnCount ?? 0) + 1;

    if (turn > MAX_TURNS_PER_STAGE) {
      return { pending: [], stageDone: true };
    }

    const priorAnswers = session.answeredQuestions
      .map((q) => `- [${q.stageId}] ${q.prompt}\n  A: ${q.answer}`)
      .join("\n");

    try {
      const llm = await this.adapters.llm.complete({
        tier: "cheap",
        maxTokens: Math.min(1024, env.maxTokensPerStage),
        messages: [
          {
            role: "system",
            content: `${stageSystemPrompt("dry")}\n\nYou think first, then present ONE short choice (or done=true). Output valid JSON only.`,
          },
          {
            role: "user",
            content: questionGenUserPrompt({
              stage,
              idea: session.idea,
              decisions: session.decisions,
              priorAnswers,
              turn,
              maxTurns: MAX_TURNS_PER_STAGE,
            }),
          },
        ],
      });

      session.usage.push({
        stageId: stage,
        modelTier: "cheap",
        modelName: llm.modelName,
        estimatedInputTokens: llm.estimatedInputTokens,
        estimatedOutputTokens: llm.estimatedOutputTokens,
        at: now(),
      });

      const briefing = parseGeneratedBriefing(llm.text);
      if (briefing) {
        const applied = applyBriefing(session, stage, briefing, turn);
        if (turn >= MAX_TURNS_PER_STAGE && !applied.stageDone && applied.pending.length > 0) {
          // Last allowed turn still asks — keep the question; next answer forces complete.
          return applied;
        }
        return applied;
      }
    } catch (err) {
      console.warn(`Question generation failed for ${stage}; using fallback.`, err);
    }
    return applyBriefing(session, stage, fallbackBriefing(stage), turn);
  }

  private async persist(session: Session) {
    session.updatedAt = now();
    await this.adapters.store.saveSession(session);
  }

  private toneFor(_session: Session, overridden: boolean): Tone {
    // Pointed only when this action overrides a recommendation — not permanently.
    return overridden ? "pointed" : "dry";
  }

  async answer(
    sessionId: string,
    answers: { questionId: string; answer: string; overrideRecommendation?: boolean }[],
  ): Promise<Session> {
    const session = await this.requireSession(sessionId);
    let overridden = false;

    for (const a of answers) {
      const q =
        session.pendingQuestions.find((x) => x.id === a.questionId) ??
        session.answeredQuestions.find((x) => x.id === a.questionId);
      if (!q) continue;
      q.answered = true;
      q.answer = a.answer;
      session.pendingQuestions = session.pendingQuestions.filter((x) => x.id !== a.questionId);
      if (!session.answeredQuestions.find((x) => x.id === q.id)) {
        session.answeredQuestions.push(q);
      }
      session.messages.push(msg("user", a.answer, "dry", session.currentStage));
      if (a.overrideRecommendation) {
        overridden = true;
        session.overrides.push(`${session.currentStage}:${a.questionId}`);
        const rec = session.recommendations[session.currentStage] ?? "the prior recommendation";
        session.messages.push(
          msg("thomas", pointedOverrideAck(rec), "pointed", session.currentStage),
        );
      }
    }

    const requiredOpen = session.pendingQuestions.filter((q) => q.required && !q.answered);
    if (requiredOpen.length === 0) {
      // One answered choice is enough to finish the stage — avoid slow follow-up loops.
      await this.completeCurrentStage(session, overridden);
    }

    await this.persist(session);
    return session;
  }

  async advance(sessionId: string): Promise<Session> {
    const session = await this.requireSession(sessionId);
    const requiredOpen = session.pendingQuestions.filter((q) => q.required && !q.answered);
    if (requiredOpen.length > 0) {
      session.messages.push(
        msg(
          "thomas",
          `I would observe that required questions remain unanswered, Isaac. Advancing now would be guessing — which I decline to do without an explicit override.`,
          "dry",
          session.currentStage,
        ),
      );
      await this.persist(session);
      return session;
    }
    if (session.stages.find((s) => s.id === session.currentStage)?.status !== "complete") {
      await this.completeCurrentStage(session, false);
    }
    await this.persist(session);
    return session;
  }

  private async completeCurrentStage(session: Session, overridden: boolean) {
    const stage = session.currentStage;
    const tone = this.toneFor(session, overridden);
    const answersText = session.answeredQuestions
      .filter((q) => q.stageId === stage)
      .map((q) => `- ${q.prompt}\n  A: ${q.answer}`)
      .join("\n");

    const llm = await this.adapters.llm.complete({
      tier: "cheap",
      maxTokens: Math.min(512, env.maxTokensPerStage),
      messages: [
        { role: "system", content: stageSystemPrompt(tone) },
        {
          role: "user",
          content: stageUserPrompt({
            stage,
            idea: session.idea,
            answers: answersText,
            overridden,
            decisions: session.decisions,
          }),
        },
      ],
    });

    session.usage.push({
      stageId: stage,
      modelTier: "cheap",
      modelName: llm.modelName,
      estimatedInputTokens: llm.estimatedInputTokens,
      estimatedOutputTokens: llm.estimatedOutputTokens,
      at: now(),
    });

    const summary = llm.text.trim().slice(0, 400);
    const recommendation = this.recommendationFor(stage, session);
    session.recommendations[stage] = recommendation;
    session.decisions[stage] = this.decisionFromAnswers(stage, session);

    const stageRec = session.stages.find((s) => s.id === stage)!;
    stageRec.status = overridden ? "skipped" : "complete";
    stageRec.summary = summary;
    stageRec.recommendation = recommendation;
    stageRec.overridden = overridden;

    session.messages.push(msg("thomas", summary, tone, stage));

    if (stage === "whiteboard_decomposition") {
      await this.ensureWhiteboard(session);
    }
    if (stage === "final_design_map") {
      await this.ensureDesignMap(session);
    }

    // Enrich whiteboard as stages progress
    if (session.artifacts.whiteboardProcessId && stageIndexAfterWhiteboard(stage)) {
      await this.refreshWhiteboardNotes(session);
    }

    const nxt = nextStage(stage);
    if (!nxt) {
      session.status = "complete";
      session.pendingQuestions = [];
      session.messages.push(
        msg(
          "thomas",
          `The pipeline is complete, Isaac. Visual artifacts remain available for revision. I shall remember what you elect to teach me in retrospect.`,
          tone,
          stage,
        ),
      );
      return;
    }

    session.currentStage = nxt;
    const nextRec = session.stages.find((s) => s.id === nxt)!;
    nextRec.status = "waiting_for_answers";
    nextRec.turnCount = 0;
    nextRec.latestVerdict = undefined;

    const turn = await this.runStageTurn(session, nxt);
    if (turn.stageDone) {
      // Rare: model finished next stage with no question — complete it immediately.
      session.pendingQuestions = [];
      await this.completeCurrentStage(session, false);
    } else {
      session.pendingQuestions = turn.pending;
    }
  }

  private recommendationFor(stage: StageId, session: Session): string {
    const map: Partial<Record<StageId, string>> = {
      problem_intake: "Lock a crisp problem statement before solution talk.",
      existing_cheap_fix: "Search for an existing cheap fix before designing a custom system.",
      good_problem: "Proceed only if urgency and a clear success signal exist.",
      risk_mvp_gate: "Default to a smaller MVP unless risk of delay exceeds risk of a thin slice.",
      solution_type: "Prefer process/API integration over greenfield custom software when viable.",
      laws_regs: "Identify regulatory surface area before architecture lock-in.",
      cost_effective_path: "Spend your time on high-leverage pieces; hire or buy the rest.",
      whiteboard_decomposition: "Keep the process map to a handful of coherent pieces.",
      per_piece_tech: "List options per piece, then consolidate vendors.",
      architecture_stack: "Choose the simplest operable architecture that meets constraints.",
      ops_cost: "Estimate run-rate before locking the final design.",
      final_design_map: "Lock major decisions; leave only deliberate unknowns.",
      build_approach: "Maximize AI-assisted build with IP-safe boundaries (plan only in v1).",
      learn_retrospect: "Capture overrides and surprises for the next session.",
    };
    return map[stage] ?? `Complete ${STAGE_LABELS[stage]} carefully.`;
  }

  private decisionFromAnswers(stage: StageId, session: Session): string {
    const answers = session.answeredQuestions
      .filter((q) => q.stageId === stage)
      .map((q) => q.answer)
      .filter(Boolean);
    if (answers.length === 0) return `Stage ${stage} noted without answers.`;
    return answers.join(" | ").slice(0, 500);
  }

  private async ensureWhiteboard(session: Session) {
    const processId = session.artifacts.whiteboardProcessId ?? nanoid(10);
    const board = defaultWhiteboard(session, processId);
    // Customize nodes from answers if present
    const decomp = session.decisions.whiteboard_decomposition;
    if (decomp) {
      const parts = decomp.split("|").map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        board.nodes = parts.slice(0, 8).map((label, i) => ({
          id: `n${i}`,
          label: label.slice(0, 48),
          description: label,
          notes: "",
          status: i === 0 ? "active" : "pending",
          x: 60 + (i % 4) * 200,
          y: 100 + Math.floor(i / 4) * 140,
        }));
        board.edges = board.nodes.slice(0, -1).map((n, i) => ({
          id: `e${i}`,
          from: n.id,
          to: board.nodes[i + 1]!.id,
        }));
      }
    }
    await this.adapters.store.saveWhiteboard(board);
    session.artifacts.whiteboardProcessId = processId;
    session.artifacts.whiteboardUrl = `${env.visualsUrl}/whiteboard/${processId}`;
    session.messages.push(
      msg(
        "thomas",
        `I have prepared the Process Whiteboard, Isaac: ${session.artifacts.whiteboardUrl}`,
        "dry",
        "whiteboard_decomposition",
      ),
    );
  }

  private async ensureDesignMap(session: Session) {
    const processId = session.artifacts.designMapProcessId ?? nanoid(10);
    const map = defaultDesignMap(session, processId);
    await this.adapters.store.saveDesignMap(map);
    session.artifacts.designMapProcessId = processId;
    session.artifacts.designMapUrl = `${env.visualsUrl}/design/${processId}`;
    session.messages.push(
      msg(
        "thomas",
        `The Solution Design Map is ready for your inspection, Isaac: ${session.artifacts.designMapUrl}`,
        "dry",
        "final_design_map",
      ),
    );
  }

  private async refreshWhiteboardNotes(session: Session) {
    const id = session.artifacts.whiteboardProcessId;
    if (!id) return;
    const board = await this.adapters.store.getWhiteboard(id);
    if (!board) return;
    board.nodes = board.nodes.map((n) => ({
      ...n,
      notes: n.notes || session.decisions[session.currentStage] || n.notes,
    }));
    board.updatedAt = now();
    await this.adapters.store.saveWhiteboard(board);
  }

  async reviseFromWhiteboard(processId: string): Promise<Session> {
    const board = await this.adapters.store.getWhiteboard(processId);
    if (!board) throw new Error("Whiteboard not found");
    const session = await this.requireSession(board.sessionId);
    session.decisions.whiteboard_decomposition = board.nodes.map((n) => n.label).join(" | ");
    session.messages.push(
      msg(
        "thomas",
        `I have incorporated your whiteboard edits, Isaac. ${board.nodes.length} pieces are now on record. Downstream stack choices may require revisiting.`,
        "dry",
        "whiteboard_decomposition",
      ),
    );
    // Roll back stage pointer to per_piece_tech if we were past it
    const idx = STAGE_ORDER.indexOf(session.currentStage);
    const targetIdx = STAGE_ORDER.indexOf("per_piece_tech");
    if (idx > targetIdx) {
      session.currentStage = "per_piece_tech";
      for (const s of session.stages) {
        const si = STAGE_ORDER.indexOf(s.id);
        if (si >= targetIdx) {
          s.status = si === targetIdx ? "waiting_for_answers" : "pending";
          if (si === targetIdx) {
            s.turnCount = 0;
            s.latestVerdict = undefined;
          }
        }
      }
      const turn = await this.runStageTurn(session, "per_piece_tech");
      session.pendingQuestions = turn.stageDone ? [] : turn.pending;
    }
    await this.persist(session);
    return session;
  }

  async reviseFromDesignMap(processId: string): Promise<Session> {
    const map = await this.adapters.store.getDesignMap(processId);
    if (!map) throw new Error("Design map not found");
    const session = await this.requireSession(map.sessionId);
    session.idea = map.problemStatement || session.idea;
    session.decisions.solution_type = map.solutionType;
    session.decisions.risk_mvp_gate = map.riskMvpChoice;
    session.decisions.laws_regs = map.regulations.join("; ");
    session.decisions.ops_cost = map.opsCostSummary;
    session.messages.push(
      msg(
        "thomas",
        `Design map revisions noted, Isaac. I shall treat the updated decisions as authoritative unless you contradict yourself again — which remains your prerogative.`,
        "dry",
        "final_design_map",
      ),
    );
    await this.adapters.store.saveDesignMap({ ...map, updatedAt: now() });
    await this.persist(session);
    return session;
  }

  private async requireSession(id: string): Promise<Session> {
    const session = await this.adapters.store.getSession(id);
    if (!session) throw new Error("Session not found");
    return session;
  }
}

function stageIndexAfterWhiteboard(stage: StageId): boolean {
  return STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf("whiteboard_decomposition");
}
