import { nanoid } from "nanoid";
import {
  STAGE_ORDER,
  STAGE_LABELS,
  STAGE_MODEL_TIER,
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
  parseGeneratedQuestions,
} from "../adapters/llm.js";

const STAGE_QUESTIONS: Record<StageId, string[]> = {
  problem_intake: [
    "In one sentence, what painful problem are you actually solving, Isaac?",
    "Who experiences this problem most acutely, and how often?",
    "What have you already tried, if anything?",
    "What constraints (time, budget, skills, compliance) must I treat as non-negotiable?",
  ],
  existing_cheap_fix: [
    "Do you already know of a product or workflow that nearly solves this?",
    "Would adopting an existing tool be acceptable, or is differentiation required?",
    "What would “good enough without building” look like for you?",
  ],
  good_problem: [
    "Why is this worth solving now rather than later?",
    "What happens if nobody solves it for twelve months?",
    "How will you know the problem is solved — what metric or signal?",
  ],
  risk_mvp_gate: [
    "What is the worst plausible failure mode if we ship the wrong thing?",
    "Is there a smaller slice we could validate in days rather than months?",
    "Are you inclined toward MVP validation, or do you believe production-direct is justified?",
  ],
  solution_type: [
    "Is the primary lever software, a process/behavior change, a physical product, or a system/org change?",
    "Could existing software plus APIs cover eighty percent without a custom build?",
    "What must be custom, if anything, for strategic reasons?",
  ],
  laws_regs: [
    "Does this touch healthcare, finance, education, children, or regulated personal data?",
    "Are there jurisdictions or certifications you already know apply?",
    "Who is accountable if we get compliance wrong?",
  ],
  cost_effective_path: [
    "Which parts can you execute yourself with your current skills?",
    "Where would hiring (or contracting) be cheaper than your time?",
    "What is a rough budget ceiling for the first version?",
  ],
  whiteboard_decomposition: [
    "What are the major steps a user or system takes from start to done?",
    "Which step is the bottleneck or the source of most errors today?",
    "Are there steps that should remain human-in-the-loop on purpose?",
  ],
  per_piece_tech: [
    "Any hard preferences or bans in the tech stack (languages, vendors, cloud)?",
    "Must pieces run on-prem, in GCP, or either?",
    "Where would you rather buy a component than build one?",
  ],
  architecture_stack: [
    "Do you prefer fewer moving parts even if each piece is less perfect?",
    "Any existing systems this must integrate with on day one?",
    "What does “simple enough to operate alone” mean for you?",
  ],
  ops_cost: [
    "Expected monthly active users or transaction volume for the first year?",
    "What monthly ops spend would make you uncomfortable?",
    "Who will monitor and maintain this after launch?",
  ],
  final_design_map: [
    "Which decisions from earlier stages are you willing to lock now?",
    "What remains explicitly undecided on purpose?",
    "Anything I recommended that you are overriding for the final map?",
  ],
  build_approach: [
    "How much of the build should AI agents perform versus you reviewing?",
    "Any intellectual-property or secrecy constraints on tooling (e.g. what code may leave your machine)?",
    "Preferred development tools later (Cursor, Cloud Agents, other) — for planning only in v1?",
  ],
  learn_retrospect: [
    "What surprised you most in this session?",
    "What should Thomas remember for the next idea you bring?",
    "Which stage questions felt wasteful, if any?",
  ],
};

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

function fallbackQuestions(stage: StageId): Question[] {
  return STAGE_QUESTIONS[stage].map((prompt, i) => ({
    id: `${stage}_q${i + 1}`,
    stageId: stage,
    prompt,
    required: i < 2,
  }));
}

function toQuestions(stage: StageId, prompts: string[]): Question[] {
  return prompts.map((prompt, i) => ({
    id: `${stage}_q${i + 1}`,
    stageId: stage,
    prompt,
    required: i < 2,
  }));
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
        `Good day, Isaac. I am Thomas — Tommy, if you prefer. I have received your idea and shall refrain from inventing details. ${STAGE_LABELS.problem_intake} begins with a few precise questions.`,
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
    session.pendingQuestions = await this.generateQuestions(session, "problem_intake");
    await this.adapters.store.saveSession(session);
    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    return this.adapters.store.getSession(id);
  }

  private async generateQuestions(session: Session, stage: StageId): Promise<Question[]> {
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
            content: `${stageSystemPrompt("dry")}\n\nYou generate clarifying questions only. Output valid JSON only.`,
          },
          {
            role: "user",
            content: questionGenUserPrompt({
              stage,
              idea: session.idea,
              decisions: session.decisions,
              priorAnswers,
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

      const prompts = parseGeneratedQuestions(llm.text);
      if (prompts) return toQuestions(stage, prompts);
    } catch (err) {
      console.warn(`Question generation failed for ${stage}; using fallback.`, err);
    }
    return fallbackQuestions(stage);
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
      await this.completeCurrentStage(session, overridden);
    } else {
      const tone = this.toneFor(session, overridden);
      session.messages.push(
        msg(
          "thomas",
          tone === "pointed"
            ? `Noted, Isaac. A few required particulars remain before I can responsibly advance ${STAGE_LABELS[session.currentStage]}.`
            : `Thank you, Isaac. A few required questions remain for ${STAGE_LABELS[session.currentStage]}.`,
          tone,
          session.currentStage,
        ),
      );
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
      tier: STAGE_MODEL_TIER[stage],
      maxTokens: env.maxTokensPerStage,
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
      modelTier: STAGE_MODEL_TIER[stage],
      modelName: llm.modelName,
      estimatedInputTokens: llm.estimatedInputTokens,
      estimatedOutputTokens: llm.estimatedOutputTokens,
      at: now(),
    });

    const summary = llm.text;
    const recommendation = this.recommendationFor(stage, session);
    session.recommendations[stage] = recommendation;
    session.decisions[stage] = this.decisionFromAnswers(stage, session);

    const stageRec = session.stages.find((s) => s.id === stage)!;
    stageRec.status = overridden ? "skipped" : "complete";
    stageRec.summary = summary;
    stageRec.recommendation = recommendation;
    stageRec.overridden = overridden;

    session.messages.push(msg("thomas", summary, tone, stage));
    session.messages.push(
      msg(
        "thomas",
        `Recommendation for this stage: ${recommendation}`,
        tone,
        stage,
      ),
    );

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
    session.pendingQuestions = await this.generateQuestions(session, nxt);
    const nextRec = session.stages.find((s) => s.id === nxt)!;
    nextRec.status = "waiting_for_answers";
    session.messages.push(
      msg(
        "thomas",
        `Next: ${STAGE_LABELS[nxt]}. I have prepared additional questions. Shall we continue?`,
        "dry",
        nxt,
      ),
    );

    // Unsolicited suggestion occasionally after gate stages
    if (stage === "existing_cheap_fix" || stage === "risk_mvp_gate") {
      session.messages.push(
        msg(
          "thomas",
          `Unsolicited suggestion, Isaac: before we fall in love with a custom build, I would inventory off-the-shelf options for thirty focused minutes. It is frequently cheaper than dignity.`,
          "dry",
          stage,
        ),
      );
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
      session.pendingQuestions = await this.generateQuestions(session, "per_piece_tech");
      for (const s of session.stages) {
        const si = STAGE_ORDER.indexOf(s.id);
        if (si >= targetIdx) {
          s.status = si === targetIdx ? "waiting_for_answers" : "pending";
        }
      }
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
