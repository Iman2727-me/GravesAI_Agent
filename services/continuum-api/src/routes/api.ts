import { Router } from "express";
import { nanoid } from "nanoid";
import {
  analyzeLiquidBiopsy,
  authorizeDuo,
  computeTransAncestryPrs,
  createDefaultObrsa,
  evaluateObrsaContract,
  federatedBeaconQuery,
  federatedLearningRound,
  rankNeoantigens,
  routeDiagnosticModality,
  simulateDigitalTwin,
  validateOrganoid,
} from "@graves/bio-engines";
import {
  DIAGNOSTIC_MODALITIES,
  GA4GH_STANDARDS,
  LIFECYCLE_LABELS,
  type AssayRecord,
  type LifecycleStage,
  type PatientRecord,
  type PeptideCandidate,
} from "@graves/upm-shared";
import type { FileStore } from "../store/fileStore.js";

export function createApiRouter(store: FileStore): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      name: "continuum-api",
      product: "Graves Continuum",
      version: "1.0.0",
    });
  });

  router.get("/meta", (_req, res) => {
    res.json({
      product: "Graves Continuum",
      tagline: "Universal Personalized Medicine Operating System",
      lifecycle: LIFECYCLE_LABELS,
      modalities: DIAGNOSTIC_MODALITIES,
      ga4gh: GA4GH_STANDARDS,
      blueprint: [
        "Continuous Multi-Omic Biosensing and Diagnostic Ingestion",
        "Federated Data Processing and Trans-Ancestry Risk Profiling",
        "Biological Digital Twin Simulation",
        "Preclinical Micro-Physiological Validation and Targeted Synthesis",
        "Value-Based Reimbursement and Closed-Loop Clinical Feedback",
      ],
    });
  });

  router.get("/snapshot", (_req, res) => {
    res.json(store.snapshot());
  });

  router.get("/patients", (_req, res) => {
    res.json(store.listPatients());
  });

  router.get("/patients/:id", (req, res) => {
    const patient = store.getPatient(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    res.json(patient);
  });

  router.post("/patients", async (req, res) => {
    try {
      const body = req.body ?? {};
      const id = `pt-${nanoid(8)}`;
      const now = new Date().toISOString();
      const patient: PatientRecord = {
        id,
        mrn: String(body.mrn ?? `MRN-${nanoid(6).toUpperCase()}`),
        displayName: String(body.displayName ?? "New Patient").trim(),
        sex: body.sex ?? "unknown",
        birthYear: Number(body.birthYear ?? 1985),
        ancestry: Array.isArray(body.ancestry)
          ? body.ancestry
          : [{ label: "EUR", proportion: 1 }],
        hlaAlleles: Array.isArray(body.hlaAlleles)
          ? body.hlaAlleles.map(String)
          : ["HLA-A*02:01"],
        lifecycleStage: "intake",
        genotype: Array.isArray(body.genotype) ? body.genotype : [],
        baselineState: body.baselineState ?? {
          inflammation: 0.3,
          metabolicLoad: 0.3,
          immuneActivation: 0.4,
          tumorBurden: 0.1,
          epigeneticAgeAccel: 0.2,
          microbiomeDysbiosis: 0.25,
        },
        twinParams: body.twinParams ?? {
          recoveryRate: 0.2,
          metabolicSensitivity: 0.4,
          immuneResponsiveness: 0.55,
          noiseScale: 0.5,
        },
        exposome: body.exposome ?? {
          airQualityIndex: 70,
          dietaryInflammatoryIndex: 0.25,
          toxinLoad: 0.15,
          pathogenPressure: 0.1,
        },
        assays: [],
        ctDna: [],
        phenopacket: {
          id: `pxf-${id}`,
          subjectId: id,
          phenotypicFeatures: body.phenotypicFeatures ?? [],
          diseases: body.diseases ?? [],
        },
        consent: body.consent ?? [
          {
            code: "DUO:0000006",
            label: "Health/medical/biomedical research",
            allows: ["general_research"],
          },
        ],
        createdAt: now,
        updatedAt: now,
      };
      await store.savePatient(patient);
      res.status(201).json(patient);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.patch("/patients/:id/stage", async (req, res) => {
    const patient = store.getPatient(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    const stage = req.body?.stage as LifecycleStage;
    if (!stage || !(stage in LIFECYCLE_LABELS)) {
      res.status(400).json({ error: "Invalid lifecycle stage" });
      return;
    }
    patient.lifecycleStage = stage;
    patient.updatedAt = new Date().toISOString();
    await store.savePatient(patient);
    res.json(patient);
  });

  router.post("/diagnostics/route", (req, res) => {
    const result = routeDiagnosticModality({
      intent: req.body?.intent ?? "baseline_genome",
      maxTurnaroundHours: req.body?.maxTurnaroundHours,
      maxInfrastructure: req.body?.maxInfrastructure,
      fieldDeployable: Boolean(req.body?.fieldDeployable),
    });
    res.json(result);
  });

  router.post("/patients/:id/assays", async (req, res) => {
    const patient = store.getPatient(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    const routing = routeDiagnosticModality({
      intent: req.body?.intent ?? "baseline_genome",
      fieldDeployable: Boolean(req.body?.fieldDeployable),
    });
    const assay: AssayRecord = {
      id: `as-${nanoid(6)}`,
      kind: routing.suggestedAssays[0] ?? "clinical",
      modality: routing.primary.id,
      status: "ordered",
      orderedAt: new Date().toISOString(),
      summary: routing.rationale,
    };
    patient.assays.unshift(assay);
    patient.lifecycleStage =
      patient.lifecycleStage === "intake" ? "sensing" : patient.lifecycleStage;
    patient.updatedAt = new Date().toISOString();
    await store.savePatient(patient);
    res.status(201).json({ assay, routing, patient });
  });

  router.post("/patients/:id/assays/:assayId/complete", async (req, res) => {
    const patient = store.getPatient(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    const assay = patient.assays.find((a) => a.id === req.params.assayId);
    if (!assay) {
      res.status(404).json({ error: "Assay not found" });
      return;
    }
    assay.status = "complete";
    assay.completedAt = new Date().toISOString();
    assay.metrics = req.body?.metrics ?? assay.metrics;
    assay.summary = req.body?.summary ?? assay.summary ?? "Assay complete";
    patient.updatedAt = new Date().toISOString();
    await store.savePatient(patient);
    res.json(patient);
  });

  router.get("/patients/:id/prs", (req, res) => {
    const patient = store.getPatient(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    const prs = computeTransAncestryPrs(
      patient.genotype,
      store.panel(),
      patient.ancestry,
      0.35,
      0.45,
    );
    res.json({ patientId: patient.id, panelSize: store.panel().length, prs });
  });

  router.get("/patients/:id/liquid-biopsy", (req, res) => {
    const patient = store.getPatient(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    res.json(analyzeLiquidBiopsy(patient.ctDna));
  });

  router.post("/patients/:id/ctdna", async (req, res) => {
    const patient = store.getPatient(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    const af = Number(req.body?.alleleFraction);
    if (!Number.isFinite(af) || af < 0) {
      res.status(400).json({ error: "alleleFraction required" });
      return;
    }
    patient.ctDna.push({
      sampledAt: String(req.body?.sampledAt ?? new Date().toISOString()),
      alleleFraction: af,
      variantId: String(req.body?.variantId ?? "tumor-informed"),
    });
    patient.updatedAt = new Date().toISOString();
    await store.savePatient(patient);
    res.json({ patient, trend: analyzeLiquidBiopsy(patient.ctDna) });
  });

  router.post("/patients/:id/twin", async (req, res) => {
    const patient = store.getPatient(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    const horizonDays = Number(req.body?.horizonDays ?? 90);
    const therapyEffect = req.body?.therapyEffect;
    const result = simulateDigitalTwin({
      initial: patient.baselineState,
      params: patient.twinParams,
      exposome: patient.exposome,
      horizonDays,
      seed: hashId(patient.id),
      therapyEffect,
    });
    patient.lifecycleStage = "twin";
    patient.updatedAt = new Date().toISOString();
    await store.savePatient(patient);
    await store.incrementTwinRuns();
    res.json({ patientId: patient.id, simulation: result });
  });

  router.post("/patients/:id/therapy", async (req, res) => {
    const patient = store.getPatient(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    const peptides: PeptideCandidate[] = Array.isArray(req.body?.peptides)
      ? req.body.peptides
      : defaultPeptides(patient);
    const neoantigens = rankNeoantigens(peptides);
    const top = neoantigens.filter((n) => n.passThreshold).slice(0, 5);
    const organoid = validateOrganoid({
      targetId: `${patient.id}-neo`,
      potency: top[0]?.presentationScore ?? 0.4,
      offTarget: 1 - (top[0]?.immunogenicity ?? 0.4),
      barrierStress: patient.baselineState.inflammation * 0.5,
      seed: hashId(patient.id + "-org"),
    });
    const plan = {
      id: `tx-${nanoid(8)}`,
      patientId: patient.id,
      neoantigens: top.length ? top : neoantigens.slice(0, 3),
      organoid,
      deliveryModality: (top[0]?.recommendedModality ?? "mrna") as
        | "mrna"
        | "slp"
        | "exosome",
      combineWithIci: true,
      status:
        organoid.recommendation === "proceed"
          ? ("validated" as const)
          : ("draft" as const),
      createdAt: new Date().toISOString(),
    };
    await store.saveTherapy(plan);
    patient.lifecycleStage = "therapy";
    patient.updatedAt = new Date().toISOString();
    await store.savePatient(patient);
    res.status(201).json(plan);
  });

  router.get("/patients/:id/therapies", (req, res) => {
    res.json(store.listTherapies(req.params.id));
  });

  router.get("/contracts", (req, res) => {
    const patientId =
      typeof req.query.patientId === "string" ? req.query.patientId : undefined;
    res.json(store.listContracts(patientId));
  });

  router.post("/patients/:id/contracts", async (req, res) => {
    const patient = store.getPatient(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    const contract = createDefaultObrsa({
      id: `obrsa-${nanoid(6)}`,
      patientId: patient.id,
      therapyLabel: String(req.body?.therapyLabel ?? "Personalized therapy"),
      listPriceUsd: Number(req.body?.listPriceUsd ?? 250000),
    });
    await store.saveContract(contract);
    patient.lifecycleStage = "reimbursement";
    patient.updatedAt = new Date().toISOString();
    await store.savePatient(patient);
    res.status(201).json(contract);
  });

  router.post("/contracts/:id/evaluate", async (req, res) => {
    const contract = store.getContract(req.params.id);
    if (!contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }
    const patient = store.getPatient(contract.patientId);
    const liquidBiopsy = patient
      ? analyzeLiquidBiopsy(patient.ctDna)
      : undefined;
    const evaluated = evaluateObrsaContract(contract, {
      liquidBiopsy,
      completeRemission: Boolean(req.body?.completeRemission),
      biomarkerRecovery:
        req.body?.biomarkerRecovery !== undefined
          ? Number(req.body.biomarkerRecovery)
          : liquidBiopsy
            ? liquidBiopsy.clearanceProbability
            : undefined,
      survivalMonths:
        req.body?.survivalMonths !== undefined
          ? Number(req.body.survivalMonths)
          : undefined,
    });
    await store.saveContract(evaluated);
    if (patient) {
      patient.lifecycleStage = "closed_loop";
      patient.updatedAt = new Date().toISOString();
      await store.savePatient(patient);
    }
    res.json(evaluated);
  });

  router.get("/federated/nodes", (_req, res) => {
    res.json(store.nodes());
  });

  router.post("/federated/beacon", (req, res) => {
    const q = req.body ?? {};
    if (!q.chromosome || !q.start || !q.referenceBases || !q.alternateBases) {
      res.status(400).json({
        error: "chromosome, start, referenceBases, alternateBases required",
      });
      return;
    }
    const result = federatedBeaconQuery(
      {
        assemblyId: q.assemblyId ?? "GRCh38",
        chromosome: String(q.chromosome),
        start: Number(q.start),
        referenceBases: String(q.referenceBases),
        alternateBases: String(q.alternateBases),
      },
      store.alleles(),
    );
    res.json(result);
  });

  router.post("/federated/consent-check", (req, res) => {
    const patient = store.getPatient(String(req.body?.patientId ?? ""));
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    const uses = Array.isArray(req.body?.uses) ? req.body.uses.map(String) : [];
    res.json(authorizeDuo(patient.consent, uses));
  });

  router.post("/federated/learning-round", (req, res) => {
    const globalWeights = Array.isArray(req.body?.globalWeights)
      ? req.body.globalWeights.map(Number)
      : [0.2, 0.15, 0.25, 0.1, 0.18, 0.12];
    const nodeGradients = Array.isArray(req.body?.nodeGradients)
      ? req.body.nodeGradients
      : store
          .nodes()
          .filter((n) => n.online)
          .map((_, i) =>
            globalWeights.map((w: number) => (Math.sin(i + w * 10) * 0.05)),
          );
    res.json(
      federatedLearningRound({
        globalWeights,
        nodeGradients,
        learningRate: Number(req.body?.learningRate ?? 0.1),
      }),
    );
  });

  router.get("/patients/:id/dossier", (req, res) => {
    const patient = store.getPatient(req.params.id);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    const prs = computeTransAncestryPrs(
      patient.genotype,
      store.panel(),
      patient.ancestry,
      0.35,
      0.45,
    );
    const liquidBiopsy = analyzeLiquidBiopsy(patient.ctDna);
    const twin = simulateDigitalTwin({
      initial: patient.baselineState,
      params: patient.twinParams,
      exposome: patient.exposome,
      horizonDays: 90,
      seed: hashId(patient.id),
    });
    const therapies = store.listTherapies(patient.id);
    const contracts = store.listContracts(patient.id);
    res.json({
      patient,
      prs,
      liquidBiopsy,
      twin,
      therapies,
      contracts,
      lifecycleLabel: LIFECYCLE_LABELS[patient.lifecycleStage],
    });
  });

  return router;
}

function defaultPeptides(patient: PatientRecord): PeptideCandidate[] {
  const hla = patient.hlaAlleles[0] ?? "HLA-A*02:01";
  return [
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
}

function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
