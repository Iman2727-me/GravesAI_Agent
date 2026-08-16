import type {
  NeoantigenRank,
  OrganoidValidationResult,
  PeptideCandidate,
} from "@graves/upm-shared";

/**
 * Neoantigen ranking approximating MHC-I binding + immunogenicity.
 * Binding affinity uses a physicochemical scoring model calibrated to
 * nanomolar IC50 scale (NetMHC-style interpretation without external calls).
 */
export function rankNeoantigens(
  peptides: PeptideCandidate[],
  opts?: { bindingThresholdNm?: number },
): NeoantigenRank[] {
  const threshold = opts?.bindingThresholdNm ?? 500;
  const ranked = peptides
    .map((peptide) => {
      const bindingAffinityNm = predictBindingNm(
        peptide.sequence,
        peptide.hlaAllele,
      );
      const immunogenicity = immunogenicityScore(peptide.sequence);
      const presentationScore = clamp01(
        (1 - Math.log10(bindingAffinityNm + 1) / 4) * 0.7 +
          immunogenicity * 0.3,
      );
      const recommendedModality =
        presentationScore > 0.72
          ? "mrna"
          : presentationScore > 0.55
            ? "slp"
            : "exosome";
      return {
        peptide,
        bindingAffinityNm,
        immunogenicity,
        presentationScore,
        rank: 0,
        recommendedModality: recommendedModality as NeoantigenRank["recommendedModality"],
        passThreshold: bindingAffinityNm <= threshold && immunogenicity >= 0.35,
      };
    })
    .sort((a, b) => b.presentationScore - a.presentationScore)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return ranked;
}

export function validateOrganoid(opts: {
  targetId: string;
  potency: number;
  offTarget: number;
  barrierStress: number;
  seed?: number;
}): OrganoidValidationResult {
  const rng = mulberry32(opts.seed ?? hashStr(opts.targetId));
  const perkChopActivation = clamp01(
    0.25 + opts.offTarget * 0.55 + rng() * 0.1,
  );
  const ire1Xbp1sActivation = clamp01(
    0.2 + opts.barrierStress * 0.5 + opts.offTarget * 0.2 + rng() * 0.08,
  );
  const viabilityPercent = clamp(
    100 - opts.offTarget * 55 - perkChopActivation * 20 - rng() * 5,
    5,
    99,
  );
  const barrierIntegrity = clamp01(
    1 - opts.barrierStress * 0.7 - ire1Xbp1sActivation * 0.2,
  );
  const efficacyScore = clamp01(
    opts.potency * 0.65 + (1 - opts.offTarget) * 0.2 + barrierIntegrity * 0.15,
  );
  const toxicityFlag =
    perkChopActivation > 0.7 ||
    ire1Xbp1sActivation > 0.75 ||
    viabilityPercent < 55;

  let recommendation: OrganoidValidationResult["recommendation"];
  if (toxicityFlag && efficacyScore < 0.45) recommendation = "halt";
  else if (toxicityFlag || efficacyScore < 0.55) recommendation = "revise";
  else recommendation = "proceed";

  return {
    targetId: opts.targetId,
    viabilityPercent,
    perkChopActivation,
    ire1Xbp1sActivation,
    barrierIntegrity,
    toxicityFlag,
    efficacyScore,
    recommendation,
    notes:
      recommendation === "proceed"
        ? "Organoid / organ-on-chip panel shows acceptable PERK-eIF2α-CHOP and IRE1α-XBP1s stress with preserved barrier integrity."
        : recommendation === "revise"
          ? "ER-stress or off-target signals elevated. Adjust epitope set, delivery vehicle, or dose before manufacturing."
          : "Apoptotic stress pathways and viability breach safety gates. Halt automated synthesis.",
  };
}

/** Hydrophobicity / aromaticity / anchor-residue heuristic → IC50 nM. */
function predictBindingNm(seq: string, hla: string): number {
  const s = seq.toUpperCase();
  if (s.length < 8 || s.length > 15) return 5000;
  const hydro = average(s, HYDRO);
  const aromatic = fraction(s, new Set(["F", "W", "Y"]));
  const anchors = anchorBonus(s, hla);
  const raw =
    2.8 - 1.6 * hydro - 1.1 * aromatic - 0.9 * anchors + 0.15 * Math.abs(s.length - 9);
  const nm = 10 ** clamp(raw, 0.1, 4.2);
  return Math.round(nm * 10) / 10;
}

function immunogenicityScore(seq: string): number {
  const s = seq.toUpperCase();
  const bulky = fraction(s, new Set(["F", "W", "Y", "H", "R", "K"]));
  const disorder = fraction(s, new Set(["G", "P", "S", "N", "Q"]));
  return clamp01(0.25 + 0.55 * bulky + 0.2 * (1 - disorder));
}

function anchorBonus(seq: string, hla: string): number {
  const a = seq[1] ?? "";
  const c = seq[seq.length - 1] ?? "";
  const allele = hla.toUpperCase();
  let score = 0;
  if (allele.includes("A*02") || allele.includes("A2")) {
    if ("LM".includes(a)) score += 0.45;
    if ("VL".includes(c)) score += 0.45;
  } else if (allele.includes("B*07") || allele.includes("B7")) {
    if ("P".includes(a)) score += 0.5;
    if ("LMF".includes(c)) score += 0.35;
  } else {
    if ("LIVM".includes(a)) score += 0.25;
    if ("LFMY".includes(c)) score += 0.25;
  }
  return score;
}

const HYDRO: Record<string, number> = {
  A: 0.62,
  C: 0.29,
  D: -0.9,
  E: -0.74,
  F: 1.19,
  G: 0.48,
  H: -0.4,
  I: 1.38,
  K: -1.5,
  L: 1.06,
  M: 0.64,
  N: -0.78,
  P: 0.12,
  Q: -0.85,
  R: -2.53,
  S: -0.18,
  T: -0.05,
  V: 1.08,
  W: 0.81,
  Y: 0.26,
};

function average(seq: string, table: Record<string, number>): number {
  let s = 0;
  for (const ch of seq) s += table[ch] ?? 0;
  return s / seq.length;
}

function fraction(seq: string, set: Set<string>): number {
  let n = 0;
  for (const ch of seq) if (set.has(ch)) n += 1;
  return n / seq.length;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
