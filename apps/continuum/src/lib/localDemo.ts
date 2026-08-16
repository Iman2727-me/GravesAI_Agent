import {
  analyzeLiquidBiopsy,
  computeTransAncestryPrs,
  rankNeoantigens,
  routeDiagnosticModality,
  simulateDigitalTwin,
  validateOrganoid,
} from "@graves/bio-engines";
import type {
  LiquidBiopsyTrend,
  NeoantigenRank,
  OrganoidValidationResult,
  PatientRecord,
  PeptideCandidate,
  PrsResult,
  TwinSimulationResult,
} from "@graves/upm-shared";
import { DEMO_PATIENTS, REFERENCE_PANEL } from "../data/demoPatients";

export type TreatmentPlan = {
  chosenDelivery: "mrna" | "slp" | "exosome";
  combineWithImmuneBooster: boolean;
  neoantigens: NeoantigenRank[];
  organoid: OrganoidValidationResult;
  options: Array<{
    id: "mrna" | "slp" | "exosome";
    title: string;
    plain: string;
    selected: boolean;
  }>;
  safetyPlain: string;
  safetyTone: "ok" | "warn" | "bad";
};

function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function listPatients(): PatientRecord[] {
  return DEMO_PATIENTS.map((p) => structuredClone(p));
}

export function getPatient(id: string): PatientRecord | undefined {
  const p = DEMO_PATIENTS.find((x) => x.id === id);
  return p ? structuredClone(p) : undefined;
}

export function runCheck(patient: PatientRecord): {
  patient: PatientRecord;
  routingName: string;
  liquidBiopsy: LiquidBiopsyTrend;
  plain: string;
} {
  const intent =
    patient.ctDna.length > 0 ? "mrd_monitor" : "baseline_genome";
  const routing = routeDiagnosticModality({ intent });
  const next = structuredClone(patient);
  next.assays.unshift({
    id: `as-${Date.now()}`,
    kind: routing.suggestedAssays[0] ?? "clinical",
    modality: routing.primary.id,
    status: "complete",
    orderedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    summary: routing.rationale,
  });
  next.lifecycleStage = "sensing";
  const liquidBiopsy = analyzeLiquidBiopsy(next.ctDna);
  const plain =
    next.ctDna.length > 0
      ? liquidPlain(liquidBiopsy.mrdStatus)
      : "We ran a baseline body/genome-style check and saved the results.";
  return { patient: next, routingName: routing.primary.name, liquidBiopsy, plain };
}

export function runRisk(patient: PatientRecord): PrsResult {
  return computeTransAncestryPrs(
    patient.genotype,
    [...REFERENCE_PANEL],
    patient.ancestry,
    0.35,
    0.45,
  );
}

export function runTwin(patient: PatientRecord): TwinSimulationResult {
  return simulateDigitalTwin({
    initial: patient.baselineState,
    params: patient.twinParams,
    exposome: patient.exposome,
    horizonDays: 90,
    seed: hashId(patient.id),
  });
}

export function runTreatment(patient: PatientRecord): TreatmentPlan {
  const hla = patient.hlaAlleles[0] ?? "HLA-A*02:01";
  const peptides: PeptideCandidate[] = [
    {
      sequence: "YLQPRTFLL",
      mutationLabel: "EGFR-S968F",
      hlaAllele: hla,
      sourceGene: "EGFR",
    },
    {
      sequence: "KLQCVDLHV",
      mutationLabel: "TP53-R175H",
      hlaAllele: hla,
      sourceGene: "TP53",
    },
    {
      sequence: "IMDQVPFSV",
      mutationLabel: "PIK3CA-H1047R",
      hlaAllele: hla,
      sourceGene: "PIK3CA",
    },
    {
      sequence: "GPGPGPGPG",
      mutationLabel: "decoy",
      hlaAllele: hla,
      sourceGene: "TTN",
    },
  ];
  const ranked = rankNeoantigens(peptides);
  const top = ranked.filter((n) => n.passThreshold).slice(0, 5);
  const neoantigens = top.length ? top : ranked.slice(0, 3);
  const chosenDelivery = neoantigens[0]?.recommendedModality ?? "mrna";
  const organoid = validateOrganoid({
    targetId: `${patient.id}-neo`,
    potency: neoantigens[0]?.presentationScore ?? 0.4,
    offTarget: 1 - (neoantigens[0]?.immunogenicity ?? 0.4),
    barrierStress: patient.baselineState.inflammation * 0.5,
    seed: hashId(patient.id + "-org"),
  });

  const options: TreatmentPlan["options"] = [
    {
      id: "mrna",
      title: "mRNA shot",
      plain: "Teaches the body what to look for using a message molecule (like a custom vaccine).",
      selected: chosenDelivery === "mrna",
    },
    {
      id: "slp",
      title: "Peptide medicine",
      plain: "Gives the immune system ready-made target pieces to train on.",
      selected: chosenDelivery === "slp",
    },
    {
      id: "exosome",
      title: "Exosome delivery",
      plain: "Sends the targets inside tiny natural carriers that cells already understand.",
      selected: chosenDelivery === "exosome",
    },
  ];

  let safetyPlain = "Looks okay to try";
  let safetyTone: TreatmentPlan["safetyTone"] = "ok";
  if (organoid.recommendation === "revise") {
    safetyPlain = "Needs a tweak before trying";
    safetyTone = "warn";
  } else if (organoid.recommendation === "halt") {
    safetyPlain = "Not safe — stop";
    safetyTone = "bad";
  }

  return {
    chosenDelivery,
    combineWithImmuneBooster: true,
    neoantigens,
    organoid,
    options,
    safetyPlain,
    safetyTone,
  };
}

function liquidPlain(status: string): string {
  if (status === "negative") return "The warning signal in the blood looks quiet.";
  if (status === "rising") return "The warning signal in the blood is getting louder.";
  if (status === "low") return "There’s a tiny warning signal left.";
  if (status === "positive") return "There’s still a warning signal in the blood.";
  return "We checked their body signals and saved what we found.";
}
