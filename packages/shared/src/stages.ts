export const STAGE_ORDER = [
  "problem_intake",
  "existing_cheap_fix",
  "good_problem",
  "risk_mvp_gate",
  "solution_type",
  "laws_regs",
  "cost_effective_path",
  "whiteboard_decomposition",
  "per_piece_tech",
  "architecture_stack",
  "ops_cost",
  "final_design_map",
  "build_approach",
  "learn_retrospect",
] as const;

export type StageId = (typeof STAGE_ORDER)[number];

export type Tone = "dry" | "pointed";

export type ModelTier = "cheap" | "pro";

export const STAGE_MODEL_TIER: Record<StageId, ModelTier> = {
  problem_intake: "cheap",
  existing_cheap_fix: "cheap",
  good_problem: "cheap",
  risk_mvp_gate: "cheap",
  solution_type: "cheap",
  laws_regs: "cheap",
  cost_effective_path: "cheap",
  whiteboard_decomposition: "pro",
  per_piece_tech: "pro",
  architecture_stack: "pro",
  ops_cost: "cheap",
  final_design_map: "pro",
  build_approach: "pro",
  learn_retrospect: "cheap",
};

export const STAGE_LABELS: Record<StageId, string> = {
  problem_intake: "Problem intake",
  existing_cheap_fix: "Existing cheap fix?",
  good_problem: "Is this a good problem?",
  risk_mvp_gate: "Risk / MVP gate",
  solution_type: "Solution type",
  laws_regs: "Laws & regulations",
  cost_effective_path: "Cost-effective path",
  whiteboard_decomposition: "Whiteboard decomposition",
  per_piece_tech: "Per-piece tech options",
  architecture_stack: "Architecture & stack",
  ops_cost: "Ongoing ops cost",
  final_design_map: "Final solution design map",
  build_approach: "Build approach",
  learn_retrospect: "Learn / retrospect",
};

export function nextStage(current: StageId): StageId | null {
  const i = STAGE_ORDER.indexOf(current);
  if (i < 0 || i >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[i + 1]!;
}

export function stageIndex(stage: StageId): number {
  return STAGE_ORDER.indexOf(stage);
}
