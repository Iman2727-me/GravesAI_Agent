import type {
  BeaconQuery,
  BeaconResponse,
  DuoConsentTag,
  FederatedNode,
} from "@graves/upm-shared";

export interface LocalAlleleRecord {
  chromosome: string;
  position: number;
  referenceBases: string;
  alternateBases: string;
  alleleCount: number;
  sampleCount: number;
  nodeId: string;
}

/**
 * GA4GH Beacon v2–style federated discovery with aggregate thresholding
 * to mitigate membership-inference (Beacon) attacks.
 */
export function federatedBeaconQuery(
  query: BeaconQuery,
  alleles: LocalAlleleRecord[],
  opts?: { minAlleleCount?: number; minDatasets?: number },
): BeaconResponse {
  const minAlleleCount = opts?.minAlleleCount ?? 5;
  const minDatasets = opts?.minDatasets ?? 2;

  const hits = alleles.filter(
    (a) =>
      a.chromosome.replace(/^chr/i, "") ===
        query.chromosome.replace(/^chr/i, "") &&
      a.position === query.start &&
      a.referenceBases.toUpperCase() === query.referenceBases.toUpperCase() &&
      a.alternateBases.toUpperCase() === query.alternateBases.toUpperCase(),
  );

  const datasetCount = new Set(hits.map((h) => h.nodeId)).size;
  const alleleCount = hits.reduce((s, h) => s + h.alleleCount, 0);
  const sampleCount = hits.reduce((s, h) => s + h.sampleCount, 0);

  if (hits.length === 0) {
    return {
      exists: false,
      alleleCount: 0,
      alleleFrequency: 0,
      datasetCount: 0,
      privacyApplied: true,
    };
  }

  if (alleleCount < minAlleleCount || datasetCount < minDatasets) {
    return {
      exists: null,
      alleleCount: null,
      alleleFrequency: null,
      datasetCount,
      privacyApplied: true,
      suppressionReason:
        "Aggregate thresholding suppressed allele counts to mitigate Beacon membership-inference risk.",
    };
  }

  return {
    exists: true,
    alleleCount,
    alleleFrequency: sampleCount > 0 ? alleleCount / (2 * sampleCount) : null,
    datasetCount,
    privacyApplied: true,
  };
}

export function authorizeDuo(
  consent: DuoConsentTag[],
  requestedUses: string[],
): { allowed: boolean; matched: string[]; blocked: string[] } {
  const allowedSet = new Set(
    consent.flatMap((c) => c.allows.map((a) => a.toLowerCase())),
  );
  const matched: string[] = [];
  const blocked: string[] = [];
  for (const use of requestedUses) {
    if (allowedSet.has(use.toLowerCase()) || allowedSet.has("general_research")) {
      matched.push(use);
    } else {
      blocked.push(use);
    }
  }
  return { allowed: blocked.length === 0, matched, blocked };
}

export function federatedLearningRound(opts: {
  nodeGradients: number[][];
  learningRate?: number;
  globalWeights: number[];
}): { updatedWeights: number[]; participated: number } {
  const lr = opts.learningRate ?? 0.1;
  const n = opts.nodeGradients.length;
  if (n === 0) {
    return { updatedWeights: [...opts.globalWeights], participated: 0 };
  }
  const dim = opts.globalWeights.length;
  const avg = Array.from({ length: dim }, () => 0);
  for (const g of opts.nodeGradients) {
    for (let i = 0; i < dim; i++) avg[i]! += (g[i] ?? 0) / n;
  }
  const updatedWeights = opts.globalWeights.map(
    (w, i) => w - lr * (avg[i] ?? 0),
  );
  return { updatedWeights, participated: n };
}

export const DEFAULT_FEDERATED_NODES: FederatedNode[] = [
  {
    id: "tre-us-east",
    name: "US East Trusted Research Environment",
    jurisdiction: "US",
    standards: ["phenopackets", "beacon_v2", "duo", "passports", "htsget"],
    online: true,
    subjectCount: 12840,
  },
  {
    id: "fega-eu",
    name: "Federated EGA Node (EU)",
    jurisdiction: "EU",
    standards: ["phenopackets", "beacon_v2", "crypt4gh", "duo", "passports"],
    online: true,
    subjectCount: 22110,
  },
  {
    id: "biomedit-ch",
    name: "BioMedIT Switzerland",
    jurisdiction: "CH",
    standards: ["crypt4gh", "htsget", "duo", "passports"],
    online: true,
    subjectCount: 6430,
  },
  {
    id: "eosc-entrust",
    name: "EOSC-ENTRUST Partner Node",
    jurisdiction: "EU",
    standards: ["beacon_v2", "phenopackets", "passports"],
    online: false,
    subjectCount: 9100,
  },
];
