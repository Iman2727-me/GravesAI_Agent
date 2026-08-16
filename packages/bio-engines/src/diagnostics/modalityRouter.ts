import {
  DIAGNOSTIC_MODALITIES,
  type AssayKind,
  type CtDnaObservation,
  type DiagnosticModalityId,
  type DiagnosticModalitySpec,
  type LiquidBiopsyTrend,
} from "@graves/upm-shared";

export interface DiagnosticRoutingRequest {
  intent:
    | "baseline_genome"
    | "pathogen_dna"
    | "pathogen_rna"
    | "mrd_monitor"
    | "field_poc"
    | "transcript_screen";
  maxTurnaroundHours?: number;
  maxInfrastructure?: "low" | "moderate" | "high";
  fieldDeployable?: boolean;
}

export interface DiagnosticRoutingResult {
  primary: DiagnosticModalitySpec;
  alternates: DiagnosticModalitySpec[];
  rationale: string;
  suggestedAssays: AssayKind[];
}

const INFRA_RANK = { low: 1, moderate: 2, high: 3 } as const;

export function routeDiagnosticModality(
  req: DiagnosticRoutingRequest,
): DiagnosticRoutingResult {
  const maxInfra = req.maxInfrastructure ?? "high";
  const maxHours = req.maxTurnaroundHours ?? 168;

  let preferred: DiagnosticModalityId;
  let assays: AssayKind[];
  let rationale: string;

  switch (req.intent) {
    case "baseline_genome":
      preferred = "ngs_long_read";
      assays = ["wgs", "methylome"];
      rationale =
        "Baseline intake requires whole-genome + long-read methylation/SV resolution; static sequencing establishes the Digital Twin prior.";
      break;
    case "pathogen_dna":
      preferred = "crispr_cas12_detectr";
      assays = ["crispr_poc"];
      rationale =
        "Cas12 DETECTR with RPA delivers attomolar DNA detection in 15–45 minutes for field or POCT pathogen/variant DNA.";
      break;
    case "pathogen_rna":
    case "transcript_screen":
      preferred = "crispr_cas13_sherlock";
      assays = ["crispr_poc"];
      rationale =
        "Cas13 SHERLOCK targets ssRNA/transcripts with isothermal amplification for rapid transcriptomic pathogen screens.";
      break;
    case "mrd_monitor":
      preferred = "liquid_biopsy";
      assays = ["ctdna", "exosome"];
      rationale =
        "Tumor-informed ctDNA allele fractions and exosomal RNA enable longitudinal MRD and resistance monitoring.";
      break;
    case "field_poc":
      preferred = "crispr_cas12_detectr";
      assays = ["crispr_poc"];
      rationale =
        "Field-deployable CRISPR POCT minimizes centralized lab dependency while preserving attomolar analytical sensitivity.";
      break;
  }

  const catalog = DIAGNOSTIC_MODALITIES.filter(
    (m) =>
      INFRA_RANK[m.infrastructure] <= INFRA_RANK[maxInfra] &&
      m.turnaroundHours.min <= maxHours,
  );

  let primary =
    catalog.find((m) => m.id === preferred) ??
    catalog[0] ??
    DIAGNOSTIC_MODALITIES[0]!;

  if (req.fieldDeployable) {
    const low = catalog.find((m) => m.infrastructure === "low");
    if (low) primary = low;
  }

  const alternates = catalog.filter((m) => m.id !== primary.id);
  return { primary, alternates, rationale, suggestedAssays: assays };
}

/**
 * Ordinary-least-squares slope of log(AF) vs time for ctDNA kinetics,
 * MRD classification, and optional doubling time.
 */
export function analyzeLiquidBiopsy(
  observations: CtDnaObservation[],
): LiquidBiopsyTrend {
  const sorted = [...observations].sort(
    (a, b) => Date.parse(a.sampledAt) - Date.parse(b.sampledAt),
  );
  if (sorted.length === 0) {
    return {
      observations: [],
      slopePerDay: 0,
      mrdStatus: "negative",
      doublingDays: null,
      clearanceProbability: 0.85,
    };
  }

  const t0 = Date.parse(sorted[0]!.sampledAt);
  const points = sorted.map((o) => ({
    t: (Date.parse(o.sampledAt) - t0) / 86_400_000,
    y: Math.log(Math.max(o.alleleFraction, 1e-7)),
    af: o.alleleFraction,
  }));

  const slope = olsSlope(
    points.map((p) => p.t),
    points.map((p) => p.y),
  );
  const latest = points[points.length - 1]!.af;
  let mrdStatus: LiquidBiopsyTrend["mrdStatus"];
  if (latest < 0.0001) mrdStatus = "negative";
  else if (latest < 0.001) mrdStatus = "low";
  else if (slope > 0.02) mrdStatus = "rising";
  else mrdStatus = "positive";

  const doublingDays =
    slope > 1e-6 ? Math.log(2) / slope : slope < -1e-6 ? null : null;

  const clearanceProbability = clamp01(
    1 / (1 + Math.exp(8 * latest + 12 * Math.max(0, slope) - 2)),
  );

  return {
    observations: sorted,
    slopePerDay: slope,
    mrdStatus,
    doublingDays: slope > 1e-6 ? doublingDays : null,
    clearanceProbability,
  };
}

function olsSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - meanX) * (ys[i]! - meanY);
    den += (xs[i]! - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
