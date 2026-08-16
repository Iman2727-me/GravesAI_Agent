import type {
  PatientRecord,
  TherapyPlan,
  ObrsaContract,
  VariantLocus,
} from "@graves/upm-shared";
import { DEFAULT_FEDERATED_NODES, createDefaultObrsa } from "@graves/bio-engines";
import type { LocalAlleleRecord } from "@graves/bio-engines";

export const REFERENCE_PANEL: VariantLocus[] = [
  {
    id: "rs429358",
    chromosome: "19",
    position: 44908684,
    riskAllele: "C",
    betaByAncestry: { EUR: 0.32, AFR: 0.28, EAS: 0.3, SAS: 0.29, AMR: 0.31 },
    weightByAncestry: { EUR: 0.92, AFR: 0.88, EAS: 0.9, SAS: 0.89, AMR: 0.91 },
  },
  {
    id: "rs7412",
    chromosome: "19",
    position: 44908822,
    riskAllele: "C",
    betaByAncestry: { EUR: 0.18, AFR: 0.14, EAS: 0.16, SAS: 0.15, AMR: 0.17 },
    weightByAncestry: { EUR: 0.85, AFR: 0.8, EAS: 0.82, SAS: 0.81, AMR: 0.84 },
  },
  {
    id: "rs2981582",
    chromosome: "10",
    position: 121577821,
    riskAllele: "T",
    betaByAncestry: { EUR: 0.12, AFR: 0.09, EAS: 0.11, SAS: 0.1, AMR: 0.11 },
    weightByAncestry: { EUR: 0.7, AFR: 0.65, EAS: 0.68, SAS: 0.66, AMR: 0.69 },
  },
  {
    id: "rs1042522",
    chromosome: "17",
    position: 7676154,
    riskAllele: "G",
    betaByAncestry: { EUR: 0.08, AFR: 0.11, EAS: 0.09, SAS: 0.1, AMR: 0.09 },
    weightByAncestry: { EUR: 0.6, AFR: 0.72, EAS: 0.63, SAS: 0.67, AMR: 0.64 },
  },
  {
    id: "rs1801282",
    chromosome: "3",
    position: 12351626,
    riskAllele: "C",
    betaByAncestry: { EUR: 0.15, AFR: 0.1, EAS: 0.13, SAS: 0.12, AMR: 0.14 },
    weightByAncestry: { EUR: 0.78, AFR: 0.7, EAS: 0.75, SAS: 0.73, AMR: 0.76 },
  },
  {
    id: "rs7903146",
    chromosome: "10",
    position: 112998590,
    riskAllele: "T",
    betaByAncestry: { EUR: 0.28, AFR: 0.22, EAS: 0.2, SAS: 0.25, AMR: 0.26 },
    weightByAncestry: { EUR: 0.95, AFR: 0.9, EAS: 0.88, SAS: 0.92, AMR: 0.93 },
  },
  {
    id: "rs13266634",
    chromosome: "8",
    position: 117172544,
    riskAllele: "C",
    betaByAncestry: { EUR: 0.11, AFR: 0.08, EAS: 0.14, SAS: 0.12, AMR: 0.1 },
    weightByAncestry: { EUR: 0.74, AFR: 0.68, EAS: 0.8, SAS: 0.76, AMR: 0.72 },
  },
  {
    id: "rs9939609",
    chromosome: "16",
    position: 53786615,
    riskAllele: "A",
    betaByAncestry: { EUR: 0.19, AFR: 0.12, EAS: 0.16, SAS: 0.15, AMR: 0.17 },
    weightByAncestry: { EUR: 0.88, AFR: 0.75, EAS: 0.82, SAS: 0.8, AMR: 0.84 },
  },
];

function iso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

export function buildSeedPatients(): PatientRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: "pt-amara-okonkwo",
      mrn: "MRN-100241",
      displayName: "Amara Okonkwo",
      sex: "female",
      birthYear: 1979,
      ancestry: [
        { label: "AFR", proportion: 0.72 },
        { label: "EUR", proportion: 0.18 },
        { label: "AMR", proportion: 0.1 },
      ],
      hlaAlleles: ["HLA-A*02:01", "HLA-B*07:02", "HLA-C*07:02"],
      lifecycleStage: "therapy",
      genotype: [
        { locusId: "rs429358", dosage: 1 },
        { locusId: "rs7412", dosage: 2 },
        { locusId: "rs2981582", dosage: 1 },
        { locusId: "rs1042522", dosage: 1 },
        { locusId: "rs1801282", dosage: 0 },
        { locusId: "rs7903146", dosage: 2 },
        { locusId: "rs13266634", dosage: 1 },
        { locusId: "rs9939609", dosage: 1 },
      ],
      baselineState: {
        inflammation: 0.52,
        metabolicLoad: 0.48,
        immuneActivation: 0.44,
        tumorBurden: 0.38,
        epigeneticAgeAccel: 0.41,
        microbiomeDysbiosis: 0.36,
      },
      twinParams: {
        recoveryRate: 0.18,
        metabolicSensitivity: 0.55,
        immuneResponsiveness: 0.62,
        noiseScale: 0.55,
      },
      exposome: {
        airQualityIndex: 110,
        dietaryInflammatoryIndex: 0.42,
        toxinLoad: 0.28,
        pathogenPressure: 0.15,
      },
      assays: [
        {
          id: "as-1",
          kind: "wgs",
          modality: "ngs_long_read",
          status: "complete",
          orderedAt: iso(40),
          completedAt: iso(37),
          summary: "Long-read WGS + methylome baseline established",
          metrics: { coverage: 32, methylatedSites: 18422011 },
        },
        {
          id: "as-2",
          kind: "ctdna",
          modality: "liquid_biopsy",
          status: "complete",
          orderedAt: iso(12),
          completedAt: iso(8),
          summary: "Tumor-informed ctDNA panel",
          metrics: { alleleFraction: 0.0042 },
        },
        {
          id: "as-3",
          kind: "crispr_poc",
          modality: "crispr_cas12_detectr",
          status: "complete",
          orderedAt: iso(5),
          completedAt: iso(5),
          summary: "DETECTR negative for panel pathogens",
        },
      ],
      ctDna: [
        { sampledAt: iso(60), alleleFraction: 0.018, variantId: "TP53-R175H" },
        { sampledAt: iso(40), alleleFraction: 0.009, variantId: "TP53-R175H" },
        { sampledAt: iso(20), alleleFraction: 0.0042, variantId: "TP53-R175H" },
        { sampledAt: iso(8), alleleFraction: 0.0018, variantId: "TP53-R175H" },
      ],
      phenopacket: {
        id: "pxf-amara",
        subjectId: "pt-amara-okonkwo",
        phenotypicFeatures: [
          { typeId: "HP:0002664", label: "Neoplasm", severity: "moderate" },
          { typeId: "HP:0001824", label: "Weight loss", severity: "mild" },
        ],
        diseases: [
          { termId: "MONDO:0007254", label: "Breast carcinoma", onset: "2025-11-02" },
        ],
        interpretations: [
          { diagnosis: "HR+/HER2- breast carcinoma", progressStatus: "in progress" },
        ],
      },
      consent: [
        {
          code: "DUO:0000006",
          label: "Health/medical/biomedical research",
          allows: ["general_research", "disease_specific_research", "methods_development"],
        },
        {
          code: "DUO:0000011",
          label: "Population origins / ancestry research",
          allows: ["ancestry_research", "population_structure"],
        },
      ],
      createdAt: iso(45),
      updatedAt: now,
    },
    {
      id: "pt-li-wei",
      mrn: "MRN-100388",
      displayName: "Li Wei",
      sex: "male",
      birthYear: 1968,
      ancestry: [
        { label: "EAS", proportion: 0.9 },
        { label: "SAS", proportion: 0.1 },
      ],
      hlaAlleles: ["HLA-A*24:02", "HLA-B*40:01", "HLA-C*03:04"],
      lifecycleStage: "risk",
      genotype: [
        { locusId: "rs429358", dosage: 0 },
        { locusId: "rs7412", dosage: 1 },
        { locusId: "rs2981582", dosage: 0 },
        { locusId: "rs1042522", dosage: 2 },
        { locusId: "rs1801282", dosage: 1 },
        { locusId: "rs7903146", dosage: 1 },
        { locusId: "rs13266634", dosage: 2 },
        { locusId: "rs9939609", dosage: 0 },
      ],
      baselineState: {
        inflammation: 0.33,
        metabolicLoad: 0.58,
        immuneActivation: 0.4,
        tumorBurden: 0.12,
        epigeneticAgeAccel: 0.36,
        microbiomeDysbiosis: 0.29,
      },
      twinParams: {
        recoveryRate: 0.22,
        metabolicSensitivity: 0.7,
        immuneResponsiveness: 0.5,
        noiseScale: 0.45,
      },
      exposome: {
        airQualityIndex: 155,
        dietaryInflammatoryIndex: 0.35,
        toxinLoad: 0.4,
        pathogenPressure: 0.08,
      },
      assays: [
        {
          id: "as-4",
          kind: "wgs",
          modality: "ngs_long_read",
          status: "complete",
          orderedAt: iso(20),
          completedAt: iso(17),
          summary: "Baseline genome complete",
        },
        {
          id: "as-5",
          kind: "metabolome",
          modality: "composite",
          status: "in_progress",
          orderedAt: iso(3),
          summary: "Exposome / MiMeDB-linked metabolome panel",
        },
      ],
      ctDna: [],
      phenopacket: {
        id: "pxf-li",
        subjectId: "pt-li-wei",
        phenotypicFeatures: [
          { typeId: "HP:0000819", label: "Diabetes mellitus", severity: "moderate" },
          { typeId: "HP:0000822", label: "Hypertension", severity: "mild" },
        ],
        diseases: [
          { termId: "MONDO:0005148", label: "Type 2 diabetes mellitus", onset: "2019-04-12" },
        ],
      },
      consent: [
        {
          code: "DUO:0000006",
          label: "Health/medical/biomedical research",
          allows: ["general_research", "disease_specific_research"],
        },
      ],
      createdAt: iso(22),
      updatedAt: now,
    },
    {
      id: "pt-sofia-mendez",
      mrn: "MRN-100512",
      displayName: "Sofía Méndez",
      sex: "female",
      birthYear: 1991,
      ancestry: [
        { label: "AMR", proportion: 0.55 },
        { label: "EUR", proportion: 0.3 },
        { label: "AFR", proportion: 0.15 },
      ],
      hlaAlleles: ["HLA-A*02:01", "HLA-B*35:01", "HLA-C*04:01"],
      lifecycleStage: "sensing",
      genotype: [
        { locusId: "rs429358", dosage: 0 },
        { locusId: "rs7412", dosage: 1 },
        { locusId: "rs2981582", dosage: 2 },
        { locusId: "rs1042522", dosage: 0 },
        { locusId: "rs1801282", dosage: 1 },
        { locusId: "rs7903146", dosage: 0 },
        { locusId: "rs13266634", dosage: 1 },
        { locusId: "rs9939609", dosage: 2 },
      ],
      baselineState: {
        inflammation: 0.28,
        metabolicLoad: 0.3,
        immuneActivation: 0.35,
        tumorBurden: 0.05,
        epigeneticAgeAccel: 0.2,
        microbiomeDysbiosis: 0.22,
      },
      twinParams: {
        recoveryRate: 0.28,
        metabolicSensitivity: 0.35,
        immuneResponsiveness: 0.7,
        noiseScale: 0.4,
      },
      exposome: {
        airQualityIndex: 65,
        dietaryInflammatoryIndex: 0.22,
        toxinLoad: 0.12,
        pathogenPressure: 0.2,
      },
      assays: [
        {
          id: "as-6",
          kind: "wgs",
          modality: "ngs_long_read",
          status: "ordered",
          orderedAt: iso(1),
          summary: "Intake long-read sequencing queued",
        },
        {
          id: "as-7",
          kind: "crispr_poc",
          modality: "crispr_cas13_sherlock",
          status: "complete",
          orderedAt: iso(1),
          completedAt: iso(1),
          summary: "SHERLOCK respiratory RNA panel — negative",
        },
      ],
      ctDna: [],
      phenopacket: {
        id: "pxf-sofia",
        subjectId: "pt-sofia-mendez",
        phenotypicFeatures: [
          { typeId: "HP:0002090", label: "Pneumonia", severity: "mild", onset: iso(2) },
        ],
        diseases: [],
      },
      consent: [
        {
          code: "DUO:0000006",
          label: "Health/medical/biomedical research",
          allows: ["general_research"],
        },
      ],
      createdAt: iso(2),
      updatedAt: now,
    },
  ];
}

export function buildSeedTherapies(): TherapyPlan[] {
  return [];
}

export function buildSeedContracts(patients: PatientRecord[]): ObrsaContract[] {
  const amara = patients.find((p) => p.id === "pt-amara-okonkwo");
  if (!amara) return [];
  return [
    createDefaultObrsa({
      id: "obrsa-amara-1",
      patientId: amara.id,
      therapyLabel: "Personalized neoantigen mRNA + ICI",
      listPriceUsd: 285000,
    }),
  ];
}

export function buildSeedAlleles(): LocalAlleleRecord[] {
  return [
    {
      chromosome: "7",
      position: 55249071,
      referenceBases: "G",
      alternateBases: "A",
      alleleCount: 42,
      sampleCount: 6400,
      nodeId: "tre-us-east",
    },
    {
      chromosome: "7",
      position: 55249071,
      referenceBases: "G",
      alternateBases: "A",
      alleleCount: 38,
      sampleCount: 11000,
      nodeId: "fega-eu",
    },
    {
      chromosome: "17",
      position: 7676154,
      referenceBases: "C",
      alternateBases: "G",
      alleleCount: 3,
      sampleCount: 3200,
      nodeId: "biomedit-ch",
    },
    {
      chromosome: "19",
      position: 44908684,
      referenceBases: "T",
      alternateBases: "C",
      alleleCount: 210,
      sampleCount: 6400,
      nodeId: "tre-us-east",
    },
    {
      chromosome: "19",
      position: 44908684,
      referenceBases: "T",
      alternateBases: "C",
      alleleCount: 188,
      sampleCount: 11000,
      nodeId: "fega-eu",
    },
  ];
}

export { DEFAULT_FEDERATED_NODES };
