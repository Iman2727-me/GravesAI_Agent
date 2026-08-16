import type {
  AncestryAdmixture,
  AncestryLabel,
  GenotypeCall,
  PrsResult,
  VariantLocus,
} from "@graves/upm-shared";

/**
 * Trans-ancestry polygenic risk score:
 *   PRS_i = Σ_j Σ_k w_jk · β_jk · X_ij
 *
 * where X_ij ∈ {0,1,2} is risk-allele dosage, β_jk is ancestry-specific
 * effect size, and w_jk is the Bayesian fine-mapping posterior weight.
 *
 * Individual admixture proportions blend ancestry-specific contributions
 * so portable scores maintain cross-population performance parity.
 */
export function computeTransAncestryPrs(
  genotype: GenotypeCall[],
  panel: VariantLocus[],
  ancestry: AncestryAdmixture[],
  referenceMean = 0,
  referenceSd = 1,
): PrsResult {
  const dosageByLocus = new Map(genotype.map((g) => [g.locusId, g.dosage]));
  const ancestryWeights = normalizeAncestry(ancestry);
  const byAncestryContribution: Partial<Record<AncestryLabel, number>> = {};
  let score = 0;
  let contributingLoci = 0;

  for (const locus of panel) {
    const dosage = dosageByLocus.get(locus.id);
    if (dosage === undefined) continue;
    contributingLoci += 1;

    for (const [label, proportion] of ancestryWeights.entries()) {
      if (proportion <= 0) continue;
      const beta = locus.betaByAncestry[label] ?? locus.betaByAncestry.EUR ?? 0;
      const weight =
        locus.weightByAncestry[label] ?? locus.weightByAncestry.EUR ?? 0;
      const contribution = proportion * weight * beta * dosage;
      score += contribution;
      byAncestryContribution[label] =
        (byAncestryContribution[label] ?? 0) + contribution;
    }
  }

  const sd = referenceSd > 0 ? referenceSd : 1;
  const zScore = (score - referenceMean) / sd;
  const percentile = normalCdf(zScore) * 100;

  return {
    score,
    zScore,
    percentile,
    ancestryAdjusted: ancestryWeights.size > 0,
    contributingLoci,
    byAncestryContribution,
    interpretation: interpretPrs(percentile),
    equitableParityNote:
      "Score uses multi-ancestry β and fine-mapping weights blended by individual admixture to reduce single-ancestry LD portability decay.",
  };
}

export function normalizeAncestry(
  ancestry: AncestryAdmixture[],
): Map<AncestryLabel, number> {
  const map = new Map<AncestryLabel, number>();
  const total = ancestry.reduce((s, a) => s + Math.max(0, a.proportion), 0);
  if (total <= 0) {
    map.set("EUR", 1);
    return map;
  }
  for (const a of ancestry) {
    map.set(a.label, Math.max(0, a.proportion) / total);
  }
  return map;
}

function interpretPrs(percentile: number): string {
  if (percentile >= 95) {
    return "Very high polygenic burden relative to the reference panel (≥95th percentile). Prioritize intensified surveillance and preventative pathways.";
  }
  if (percentile >= 80) {
    return "Elevated polygenic risk (80–95th percentile). Consider enhanced monitoring and lifestyle / pharmacoprevention counseling.";
  }
  if (percentile >= 20) {
    return "Intermediate polygenic risk. Integrate with clinical, exposome, and twin-simulation context before escalating care.";
  }
  return "Lower polygenic burden (<20th percentile). Residual risk may still arise from rare variants, somatic events, or environmental load.";
}

/** Standard normal CDF via Abramowitz–Stegun approximation. */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}
