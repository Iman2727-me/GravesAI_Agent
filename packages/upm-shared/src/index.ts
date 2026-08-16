/** Ancestral background labels used in trans-ancestry PRS. */
export type AncestryLabel =
  | "AFR"
  | "AMR"
  | "EAS"
  | "EUR"
  | "SAS"
  | "MID"
  | "ADM";

export type Sex = "female" | "male" | "other" | "unknown";

export type LifecycleStage =
  | "intake"
  | "sensing"
  | "risk"
  | "twin"
  | "therapy"
  | "reimbursement"
  | "closed_loop";

export type DiagnosticModalityId =
  | "ngs_long_read"
  | "crispr_cas12_detectr"
  | "crispr_cas13_sherlock"
  | "liquid_biopsy";

export type AssayKind =
  | "wgs"
  | "methylome"
  | "scrna"
  | "spatial_tx"
  | "cytof"
  | "metabolome"
  | "exposome"
  | "ctdna"
  | "exosome"
  | "crispr_poc"
  | "clinical";

export interface DiagnosticModalitySpec {
  id: DiagnosticModalityId;
  name: string;
  primaryTarget: string;
  analyticalSensitivity: string;
  turnaroundHours: { min: number; max: number };
  infrastructure: "low" | "moderate" | "high";
  keyLimitations: string;
}

export interface VariantLocus {
  /** rsID or chrom:pos:ref:alt */
  id: string;
  chromosome: string;
  position: number;
  riskAllele: string;
  /** Ancestry-specific effect sizes β_jk */
  betaByAncestry: Partial<Record<AncestryLabel, number>>;
  /** Posterior fine-mapping weights w_jk */
  weightByAncestry: Partial<Record<AncestryLabel, number>>;
}

export interface GenotypeCall {
  locusId: string;
  /** Dosage X_ij ∈ {0, 1, 2} */
  dosage: 0 | 1 | 2;
}

export interface AncestryAdmixture {
  label: AncestryLabel;
  /** Proportion in [0, 1]; should sum ≈ 1 across labels */
  proportion: number;
}

export interface PrsResult {
  score: number;
  zScore: number;
  percentile: number;
  ancestryAdjusted: boolean;
  contributingLoci: number;
  byAncestryContribution: Partial<Record<AncestryLabel, number>>;
  interpretation: string;
  equitableParityNote: string;
}

export interface MultiOmicState {
  /** Normalized [0,1] state channels for Digital Twin S(t) */
  inflammation: number;
  metabolicLoad: number;
  immuneActivation: number;
  tumorBurden: number;
  epigeneticAgeAccel: number;
  microbiomeDysbiosis: number;
}

export interface ExposomeInput {
  airQualityIndex: number;
  dietaryInflammatoryIndex: number;
  toxinLoad: number;
  pathogenPressure: number;
}

export interface TwinParameters {
  /** Individual-specific biological constants θ */
  recoveryRate: number;
  metabolicSensitivity: number;
  immuneResponsiveness: number;
  noiseScale: number;
}

export interface TwinTrajectoryPoint {
  tDays: number;
  state: MultiOmicState;
  riskIndex: number;
}

export interface TwinSimulationResult {
  horizonDays: number;
  trajectory: TwinTrajectoryPoint[];
  onsetProbability90d: number;
  predictedResponseScore: number;
  narrative: string;
}

export interface CtDnaObservation {
  sampledAt: string;
  alleleFraction: number;
  variantId: string;
}

export interface LiquidBiopsyTrend {
  observations: CtDnaObservation[];
  slopePerDay: number;
  mrdStatus: "negative" | "low" | "positive" | "rising";
  doublingDays: number | null;
  clearanceProbability: number;
}

export interface PhenopacketLike {
  id: string;
  subjectId: string;
  phenotypicFeatures: Array<{
    typeId: string;
    label: string;
    onset?: string;
    severity?: "mild" | "moderate" | "severe";
  }>;
  diseases: Array<{ termId: string; label: string; onset?: string }>;
  interpretations?: Array<{
    diagnosis: string;
    progressStatus: string;
  }>;
}

export interface PeptideCandidate {
  sequence: string;
  mutationLabel: string;
  hlaAllele: string;
  sourceGene: string;
}

export interface NeoantigenRank {
  peptide: PeptideCandidate;
  bindingAffinityNm: number;
  immunogenicity: number;
  presentationScore: number;
  rank: number;
  recommendedModality: "mrna" | "slp" | "exosome";
  passThreshold: boolean;
}

export interface OrganoidValidationResult {
  targetId: string;
  viabilityPercent: number;
  perkChopActivation: number;
  ire1Xbp1sActivation: number;
  barrierIntegrity: number;
  toxicityFlag: boolean;
  efficacyScore: number;
  recommendation: "proceed" | "revise" | "halt";
  notes: string;
}

export interface ObrsaMilestone {
  id: string;
  label: string;
  metric: "ctdna_negativity" | "complete_remission" | "biomarker_recovery" | "survival";
  targetValue: number;
  observedValue: number | null;
  windowDays: number;
  met: boolean | null;
}

export interface ObrsaContract {
  id: string;
  patientId: string;
  therapyLabel: string;
  listPriceUsd: number;
  rebateTiers: Array<{ missedMilestones: number; rebateFraction: number }>;
  milestones: ObrsaMilestone[];
  paidToDateUsd: number;
  accruedRebateUsd: number;
  netLiabilityUsd: number;
  status: "active" | "completed" | "breached";
}

export interface BeaconQuery {
  assemblyId: "GRCh38" | "GRCh37";
  chromosome: string;
  start: number;
  referenceBases: string;
  alternateBases: string;
}

export interface BeaconResponse {
  exists: boolean | null;
  alleleCount: number | null;
  alleleFrequency: number | null;
  datasetCount: number;
  privacyApplied: boolean;
  suppressionReason?: string;
}

export interface DuoConsentTag {
  code: string;
  label: string;
  allows: string[];
}

export interface FederatedNode {
  id: string;
  name: string;
  jurisdiction: string;
  standards: string[];
  online: boolean;
  subjectCount: number;
}

export interface PatientRecord {
  id: string;
  mrn: string;
  displayName: string;
  sex: Sex;
  birthYear: number;
  ancestry: AncestryAdmixture[];
  hlaAlleles: string[];
  lifecycleStage: LifecycleStage;
  genotype: GenotypeCall[];
  baselineState: MultiOmicState;
  twinParams: TwinParameters;
  exposome: ExposomeInput;
  assays: AssayRecord[];
  ctDna: CtDnaObservation[];
  phenopacket: PhenopacketLike;
  consent: DuoConsentTag[];
  createdAt: string;
  updatedAt: string;
}

export interface AssayRecord {
  id: string;
  kind: AssayKind;
  modality: DiagnosticModalityId | "composite";
  status: "ordered" | "in_progress" | "complete" | "failed";
  orderedAt: string;
  completedAt?: string;
  summary?: string;
  metrics?: Record<string, number | string>;
}

export interface TherapyPlan {
  id: string;
  patientId: string;
  neoantigens: NeoantigenRank[];
  organoid: OrganoidValidationResult;
  deliveryModality: "mrna" | "slp" | "exosome";
  combineWithIci: boolean;
  status: "draft" | "validated" | "manufacturing" | "administered";
  createdAt: string;
}

export interface PlatformSnapshot {
  patients: number;
  federatedNodes: number;
  activeContracts: number;
  assaysComplete: number;
  twinSimulations: number;
}

export const DIAGNOSTIC_MODALITIES: DiagnosticModalitySpec[] = [
  {
    id: "ngs_long_read",
    name: "Centralized NGS / Long-Read",
    primaryTarget: "Whole Genome, Methylome, Structural Variants",
    analyticalSensitivity: "Single-molecule resolution",
    turnaroundHours: { min: 24, max: 72 },
    infrastructure: "high",
    keyLimitations:
      "High cost, complex library preparation, centralized turnaround delay",
  },
  {
    id: "crispr_cas12_detectr",
    name: "CRISPR-Cas12 (DETECTR)",
    primaryTarget: "ds/ssDNA, Viral/Bacterial DNA",
    analyticalSensitivity: "Attomolar to Femtomolar (with RPA)",
    turnaroundHours: { min: 0.25, max: 0.75 },
    infrastructure: "low",
    keyLimitations:
      "Potential aerosol contamination during pre-amplification steps",
  },
  {
    id: "crispr_cas13_sherlock",
    name: "CRISPR-Cas13 (SHERLOCK)",
    primaryTarget: "ssRNA, Pathogen RNA, Transcripts",
    analyticalSensitivity: "Attomolar to Femtomolar (with RPA)",
    turnaroundHours: { min: 0.25, max: 0.75 },
    infrastructure: "low",
    keyLimitations:
      "Enzyme stability dependencies, requirement for ultra-pure enzymes",
  },
  {
    id: "liquid_biopsy",
    name: "Liquid Biopsy (ctDNA / Exosomes)",
    primaryTarget: "Somatic mutations, ctDNA AF, Exosomal RNA",
    analyticalSensitivity: "Femtomolar (low-frequency variant alleles)",
    turnaroundHours: { min: 72, max: 168 },
    infrastructure: "moderate",
    keyLimitations:
      "Dilution effects in early-stage disease, low absolute signal-to-noise",
  },
];

export const LIFECYCLE_LABELS: Record<LifecycleStage, string> = {
  intake: "Clinical Intake",
  sensing: "Multi-Omic Sensing",
  risk: "Trans-Ancestry Risk",
  twin: "Digital Twin",
  therapy: "Adaptive Therapeutics",
  reimbursement: "Value-Based Reimbursement",
  closed_loop: "Closed-Loop Feedback",
};

export const GA4GH_STANDARDS = [
  {
    id: "phenopackets",
    domain: "Phenotypic Data Structuring",
    objective: "Standardizes clinical phenotypic descriptions",
    security: "Uniform JSON schema for phenotype-to-genotype mapping",
  },
  {
    id: "beacon_v2",
    domain: "Federated Data Discovery",
    objective: "Query presence of genomic variants across remote biobanks",
    security: "Aggregate statistical thresholding against re-identification",
  },
  {
    id: "crypt4gh",
    domain: "Cryptographic File Storage",
    objective: "Secure containerized storage and streaming of genomic data",
    security: "File-level public key encryption",
  },
  {
    id: "duo",
    domain: "Automated Consent Authorization",
    objective: "Match data requests against patient consent terms",
    security: "Machine-readable consent tags",
  },
  {
    id: "passports",
    domain: "Identity & Access Authorization",
    objective: "Authenticate identity and access across federated environments",
    security: "Standards-based security tokens / SSO",
  },
  {
    id: "htsget",
    domain: "High-Throughput Sequence Access",
    objective: "Bandwidth-efficient streaming of genomic slices (BAM/CRAM/VCF)",
    security: "Token-authorized slice retrieval",
  },
] as const;
