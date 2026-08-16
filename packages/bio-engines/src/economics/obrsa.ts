import type { LiquidBiopsyTrend, ObrsaContract, ObrsaMilestone } from "@graves/upm-shared";

/**
 * Outcomes-Based Risk-Sharing Agreement (OBRSA) engine.
 * Manufacturer reimbursement is tied to molecular / clinical milestones;
 * missed milestones trigger tiered supplemental rebates to the payer.
 */
export function evaluateObrsaContract(
  contract: ObrsaContract,
  context: {
    liquidBiopsy?: LiquidBiopsyTrend;
    completeRemission?: boolean;
    biomarkerRecovery?: number;
    survivalMonths?: number;
  },
): ObrsaContract {
  const milestones: ObrsaMilestone[] = contract.milestones.map((m) => {
    let observed: number | null = m.observedValue;
    let met: boolean | null = m.met;

    switch (m.metric) {
      case "ctdna_negativity": {
        const status = context.liquidBiopsy?.mrdStatus;
        const clearance = context.liquidBiopsy?.clearanceProbability ?? 0;
        observed = status === "negative" ? 1 : clearance;
        met = status === "negative" || clearance >= m.targetValue;
        break;
      }
      case "complete_remission":
        observed = context.completeRemission ? 1 : 0;
        met = Boolean(context.completeRemission);
        break;
      case "biomarker_recovery":
        observed = context.biomarkerRecovery ?? observed;
        met =
          observed !== null ? observed >= m.targetValue : null;
        break;
      case "survival":
        observed = context.survivalMonths ?? observed;
        met =
          observed !== null ? observed >= m.targetValue : null;
        break;
    }
    return { ...m, observedValue: observed, met };
  });

  const evaluated = milestones.filter((m) => m.met !== null);
  const missed = evaluated.filter((m) => m.met === false).length;
  const rebateFraction = pickRebate(contract.rebateTiers, missed);
  const accruedRebateUsd = Math.round(contract.listPriceUsd * rebateFraction);
  const allMet =
    evaluated.length === milestones.length &&
    evaluated.every((m) => m.met === true);

  return {
    ...contract,
    milestones,
    accruedRebateUsd,
    netLiabilityUsd: contract.listPriceUsd - accruedRebateUsd,
    status: allMet
      ? "completed"
      : missed > 0 && evaluated.length === milestones.length
        ? "breached"
        : "active",
  };
}

function pickRebate(
  tiers: ObrsaContract["rebateTiers"],
  missed: number,
): number {
  const sorted = [...tiers].sort(
    (a, b) => a.missedMilestones - b.missedMilestones,
  );
  let fraction = 0;
  for (const tier of sorted) {
    if (missed >= tier.missedMilestones) fraction = tier.rebateFraction;
  }
  return fraction;
}

export function createDefaultObrsa(opts: {
  id: string;
  patientId: string;
  therapyLabel: string;
  listPriceUsd: number;
}): ObrsaContract {
  return {
    id: opts.id,
    patientId: opts.patientId,
    therapyLabel: opts.therapyLabel,
    listPriceUsd: opts.listPriceUsd,
    rebateTiers: [
      { missedMilestones: 1, rebateFraction: 0.2 },
      { missedMilestones: 2, rebateFraction: 0.45 },
      { missedMilestones: 3, rebateFraction: 0.75 },
    ],
    milestones: [
      {
        id: "m1",
        label: "ctDNA negativity at day 90",
        metric: "ctdna_negativity",
        targetValue: 0.8,
        observedValue: null,
        windowDays: 90,
        met: null,
      },
      {
        id: "m2",
        label: "Sustained complete remission",
        metric: "complete_remission",
        targetValue: 1,
        observedValue: null,
        windowDays: 180,
        met: null,
      },
      {
        id: "m3",
        label: "Functional biomarker recovery ≥0.7",
        metric: "biomarker_recovery",
        targetValue: 0.7,
        observedValue: null,
        windowDays: 120,
        met: null,
      },
    ],
    paidToDateUsd: opts.listPriceUsd * 0.4,
    accruedRebateUsd: 0,
    netLiabilityUsd: opts.listPriceUsd,
    status: "active",
  };
}
