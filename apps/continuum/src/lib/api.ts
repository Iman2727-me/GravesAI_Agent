const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean; name: string }>("/api/health"),
  meta: () => request<PlatformMeta>("/api/meta"),
  snapshot: () => request<Snapshot>("/api/snapshot"),
  patients: () => request<Patient[]>("/api/patients"),
  patient: (id: string) => request<Patient>(`/api/patients/${id}`),
  dossier: (id: string) => request<Dossier>(`/api/patients/${id}/dossier`),
  createPatient: (body: Partial<Patient>) =>
    request<Patient>("/api/patients", { method: "POST", body: JSON.stringify(body) }),
  setStage: (id: string, stage: string) =>
    request<Patient>(`/api/patients/${id}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    }),
  routeDiagnostic: (body: Record<string, unknown>) =>
    request<DiagnosticRoute>("/api/diagnostics/route", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  orderAssay: (id: string, intent: string) =>
    request<{ assay: Assay; routing: DiagnosticRoute; patient: Patient }>(
      `/api/patients/${id}/assays`,
      { method: "POST", body: JSON.stringify({ intent }) },
    ),
  completeAssay: (id: string, assayId: string) =>
    request<Patient>(`/api/patients/${id}/assays/${assayId}/complete`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  prs: (id: string) => request<{ prs: PrsResult }>(`/api/patients/${id}/prs`),
  twin: (id: string, horizonDays = 90) =>
    request<{ simulation: TwinResult }>(`/api/patients/${id}/twin`, {
      method: "POST",
      body: JSON.stringify({ horizonDays }),
    }),
  therapy: (id: string) =>
    request<TherapyPlan>(`/api/patients/${id}/therapy`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  therapies: (id: string) => request<TherapyPlan[]>(`/api/patients/${id}/therapies`),
  contracts: (patientId?: string) =>
    request<Contract[]>(
      patientId ? `/api/contracts?patientId=${patientId}` : "/api/contracts",
    ),
  createContract: (id: string, body: Record<string, unknown>) =>
    request<Contract>(`/api/patients/${id}/contracts`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  evaluateContract: (id: string, body: Record<string, unknown>) =>
    request<Contract>(`/api/contracts/${id}/evaluate`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  nodes: () => request<FederatedNode[]>("/api/federated/nodes"),
  beacon: (body: Record<string, unknown>) =>
    request<BeaconResponse>("/api/federated/beacon", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  liquidBiopsy: (id: string) => request<LiquidBiopsy>(`/api/patients/${id}/liquid-biopsy`),
};

export interface PlatformMeta {
  product: string;
  tagline: string;
  blueprint: string[];
  modalities: Array<{
    id: string;
    name: string;
    primaryTarget: string;
    analyticalSensitivity: string;
    turnaroundHours: { min: number; max: number };
    infrastructure: string;
    keyLimitations: string;
  }>;
  ga4gh: Array<{ id: string; domain: string; objective: string; security: string }>;
  lifecycle: Record<string, string>;
}

export interface Snapshot {
  patients: number;
  federatedNodes: number;
  activeContracts: number;
  assaysComplete: number;
  twinSimulations: number;
}

export interface Patient {
  id: string;
  mrn: string;
  displayName: string;
  sex: string;
  birthYear: number;
  ancestry: Array<{ label: string; proportion: number }>;
  hlaAlleles: string[];
  lifecycleStage: string;
  assays: Assay[];
  ctDna: Array<{ sampledAt: string; alleleFraction: number; variantId: string }>;
  phenopacket: {
    phenotypicFeatures: Array<{ typeId: string; label: string; severity?: string }>;
    diseases: Array<{ termId: string; label: string }>;
  };
  baselineState: Record<string, number>;
  exposome: Record<string, number>;
}

export interface Assay {
  id: string;
  kind: string;
  modality: string;
  status: string;
  orderedAt: string;
  completedAt?: string;
  summary?: string;
}

export interface PrsResult {
  score: number;
  zScore: number;
  percentile: number;
  contributingLoci: number;
  interpretation: string;
  equitableParityNote: string;
  byAncestryContribution: Record<string, number>;
}

export interface TwinResult {
  horizonDays: number;
  onsetProbability90d: number;
  predictedResponseScore: number;
  narrative: string;
  trajectory: Array<{ tDays: number; riskIndex: number; state: Record<string, number> }>;
}

export interface DiagnosticRoute {
  primary: { id: string; name: string; turnaroundHours: { min: number; max: number } };
  rationale: string;
  suggestedAssays: string[];
}

export interface TherapyPlan {
  id: string;
  status: string;
  deliveryModality: string;
  combineWithIci: boolean;
  neoantigens: Array<{
    rank: number;
    bindingAffinityNm: number;
    immunogenicity: number;
    presentationScore: number;
    peptide: { sequence: string; mutationLabel: string; sourceGene: string; hlaAllele: string };
  }>;
  organoid: {
    recommendation: string;
    viabilityPercent: number;
    perkChopActivation: number;
    ire1Xbp1sActivation: number;
    efficacyScore: number;
    toxicityFlag: boolean;
    notes: string;
  };
}

export interface Contract {
  id: string;
  patientId: string;
  therapyLabel: string;
  listPriceUsd: number;
  accruedRebateUsd: number;
  netLiabilityUsd: number;
  paidToDateUsd: number;
  status: string;
  milestones: Array<{
    id: string;
    label: string;
    metric: string;
    targetValue: number;
    observedValue: number | null;
    met: boolean | null;
  }>;
}

export interface FederatedNode {
  id: string;
  name: string;
  jurisdiction: string;
  standards: string[];
  online: boolean;
  subjectCount: number;
}

export interface BeaconResponse {
  exists: boolean | null;
  alleleCount: number | null;
  alleleFrequency: number | null;
  datasetCount: number;
  privacyApplied: boolean;
  suppressionReason?: string;
}

export interface LiquidBiopsy {
  mrdStatus: string;
  slopePerDay: number;
  doublingDays: number | null;
  clearanceProbability: number;
  observations: Array<{ sampledAt: string; alleleFraction: number; variantId: string }>;
}

export interface Dossier {
  patient: Patient;
  prs: PrsResult;
  liquidBiopsy: LiquidBiopsy;
  twin: TwinResult;
  therapies: TherapyPlan[];
  contracts: Contract[];
  lifecycleLabel: string;
}
