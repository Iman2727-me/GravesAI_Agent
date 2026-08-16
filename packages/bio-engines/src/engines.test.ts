import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeLiquidBiopsy,
  computeTransAncestryPrs,
  createDefaultObrsa,
  evaluateObrsaContract,
  federatedBeaconQuery,
  rankNeoantigens,
  riskIndex,
  simulateDigitalTwin,
  validateOrganoid,
} from "./index.js";
import type { VariantLocus } from "@graves/upm-shared";

describe("trans-ancestry PRS", () => {
  it("computes weighted multi-ancestry score", () => {
    const panel: VariantLocus[] = [
      {
        id: "rs1",
        chromosome: "1",
        position: 100,
        riskAllele: "A",
        betaByAncestry: { EUR: 0.2, AFR: 0.15 },
        weightByAncestry: { EUR: 0.8, AFR: 0.7 },
      },
      {
        id: "rs2",
        chromosome: "2",
        position: 200,
        riskAllele: "G",
        betaByAncestry: { EUR: 0.1, AFR: 0.12 },
        weightByAncestry: { EUR: 0.6, AFR: 0.9 },
      },
    ];
    const result = computeTransAncestryPrs(
      [
        { locusId: "rs1", dosage: 2 },
        { locusId: "rs2", dosage: 1 },
      ],
      panel,
      [
        { label: "EUR", proportion: 0.4 },
        { label: "AFR", proportion: 0.6 },
      ],
      0,
      0.5,
    );
    assert.equal(result.contributingLoci, 2);
    assert.ok(result.score > 0);
    assert.ok(result.ancestryAdjusted);
  });
});

describe("digital twin", () => {
  it("integrates SDE trajectory with bounded state", () => {
    const sim = simulateDigitalTwin({
      initial: {
        inflammation: 0.4,
        metabolicLoad: 0.35,
        immuneActivation: 0.5,
        tumorBurden: 0.3,
        epigeneticAgeAccel: 0.25,
        microbiomeDysbiosis: 0.3,
      },
      params: {
        recoveryRate: 0.2,
        metabolicSensitivity: 0.4,
        immuneResponsiveness: 0.6,
        noiseScale: 0.5,
      },
      exposome: {
        airQualityIndex: 80,
        dietaryInflammatoryIndex: 0.3,
        toxinLoad: 0.2,
        pathogenPressure: 0.1,
      },
      horizonDays: 30,
      seed: 7,
    });
    assert.ok(sim.trajectory.length > 5);
    assert.ok(sim.onsetProbability90d >= 0 && sim.onsetProbability90d <= 1);
    const last = sim.trajectory[sim.trajectory.length - 1]!;
    assert.ok(riskIndex(last.state) >= 0 && riskIndex(last.state) <= 1);
  });
});

describe("liquid biopsy", () => {
  it("detects rising MRD", () => {
    const trend = analyzeLiquidBiopsy([
      { sampledAt: "2026-01-01", alleleFraction: 0.001, variantId: "EGFR" },
      { sampledAt: "2026-02-01", alleleFraction: 0.004, variantId: "EGFR" },
      { sampledAt: "2026-03-01", alleleFraction: 0.012, variantId: "EGFR" },
    ]);
    assert.equal(trend.mrdStatus, "rising");
    assert.ok(trend.slopePerDay > 0);
  });
});

describe("neoantigen + organoid", () => {
  it("ranks peptides and validates organoid gate", () => {
    const ranked = rankNeoantigens([
      {
        sequence: "YLQPRTFLL",
        mutationLabel: "S968F",
        hlaAllele: "HLA-A*02:01",
        sourceGene: "EGFR",
      },
      {
        sequence: "GPGPGPGPG",
        mutationLabel: "benign",
        hlaAllele: "HLA-A*02:01",
        sourceGene: "TTN",
      },
    ]);
    assert.equal(ranked[0]!.rank, 1);
    assert.ok(ranked[0]!.presentationScore >= ranked[1]!.presentationScore);
    const organoid = validateOrganoid({
      targetId: "neo-1",
      potency: 0.8,
      offTarget: 0.15,
      barrierStress: 0.2,
    });
    assert.ok(["proceed", "revise", "halt"].includes(organoid.recommendation));
  });
});

describe("OBRSA", () => {
  it("accrues rebate when milestones missed", () => {
    const base = createDefaultObrsa({
      id: "c1",
      patientId: "p1",
      therapyLabel: "NeoAg-mRNA",
      listPriceUsd: 100000,
    });
    const evaluated = evaluateObrsaContract(base, {
      liquidBiopsy: {
        observations: [],
        slopePerDay: 0.05,
        mrdStatus: "rising",
        doublingDays: 14,
        clearanceProbability: 0.1,
      },
      completeRemission: false,
      biomarkerRecovery: 0.2,
    });
    assert.ok(evaluated.accruedRebateUsd > 0);
    assert.equal(evaluated.status, "breached");
  });
});

describe("federated beacon", () => {
  it("suppresses low-count alleles", () => {
    const res = federatedBeaconQuery(
      {
        assemblyId: "GRCh38",
        chromosome: "7",
        start: 55249071,
        referenceBases: "G",
        alternateBases: "A",
      },
      [
        {
          chromosome: "7",
          position: 55249071,
          referenceBases: "G",
          alternateBases: "A",
          alleleCount: 2,
          sampleCount: 100,
          nodeId: "tre-us-east",
        },
      ],
    );
    assert.equal(res.exists, null);
    assert.ok(res.privacyApplied);
  });
});
