import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ObrsaContract,
  PatientRecord,
  TherapyPlan,
  VariantLocus,
} from "@graves/upm-shared";
import type { FederatedNode } from "@graves/upm-shared";
import type { LocalAlleleRecord } from "@graves/bio-engines";
import {
  REFERENCE_PANEL,
  buildSeedAlleles,
  buildSeedContracts,
  buildSeedPatients,
  DEFAULT_FEDERATED_NODES,
} from "../seed/data.js";

export interface ContinuumDb {
  patients: PatientRecord[];
  therapies: TherapyPlan[];
  contracts: ObrsaContract[];
  alleles: LocalAlleleRecord[];
  nodes: FederatedNode[];
  panel: VariantLocus[];
  twinRuns: number;
}

export class FileStore {
  private db: ContinuumDb | null = null;

  constructor(private readonly dataDir: string) {}

  async init(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    const file = this.filePath();
    try {
      const raw = await readFile(file, "utf8");
      this.db = JSON.parse(raw) as ContinuumDb;
    } catch {
      const patients = buildSeedPatients();
      this.db = {
        patients,
        therapies: [],
        contracts: buildSeedContracts(patients),
        alleles: buildSeedAlleles(),
        nodes: DEFAULT_FEDERATED_NODES,
        panel: REFERENCE_PANEL,
        twinRuns: 0,
      };
      await this.persist();
    }
  }

  private filePath(): string {
    return path.join(this.dataDir, "continuum-db.json");
  }

  private async persist(): Promise<void> {
    if (!this.db) throw new Error("Store not initialized");
    await writeFile(this.filePath(), JSON.stringify(this.db, null, 2), "utf8");
  }

  private ensure(): ContinuumDb {
    if (!this.db) throw new Error("Store not initialized");
    return this.db;
  }

  snapshot() {
    const db = this.ensure();
    return {
      patients: db.patients.length,
      federatedNodes: db.nodes.filter((n) => n.online).length,
      activeContracts: db.contracts.filter((c) => c.status === "active").length,
      assaysComplete: db.patients.reduce(
        (n, p) => n + p.assays.filter((a) => a.status === "complete").length,
        0,
      ),
      twinSimulations: db.twinRuns,
    };
  }

  listPatients(): PatientRecord[] {
    return this.ensure().patients;
  }

  getPatient(id: string): PatientRecord | undefined {
    return this.ensure().patients.find((p) => p.id === id);
  }

  async savePatient(patient: PatientRecord): Promise<PatientRecord> {
    const db = this.ensure();
    const idx = db.patients.findIndex((p) => p.id === patient.id);
    if (idx >= 0) db.patients[idx] = patient;
    else db.patients.push(patient);
    await this.persist();
    return patient;
  }

  panel(): VariantLocus[] {
    return this.ensure().panel;
  }

  nodes(): FederatedNode[] {
    return this.ensure().nodes;
  }

  alleles(): LocalAlleleRecord[] {
    return this.ensure().alleles;
  }

  listTherapies(patientId?: string): TherapyPlan[] {
    const all = this.ensure().therapies;
    return patientId ? all.filter((t) => t.patientId === patientId) : all;
  }

  async saveTherapy(plan: TherapyPlan): Promise<TherapyPlan> {
    const db = this.ensure();
    const idx = db.therapies.findIndex((t) => t.id === plan.id);
    if (idx >= 0) db.therapies[idx] = plan;
    else db.therapies.push(plan);
    await this.persist();
    return plan;
  }

  listContracts(patientId?: string): ObrsaContract[] {
    const all = this.ensure().contracts;
    return patientId ? all.filter((c) => c.patientId === patientId) : all;
  }

  getContract(id: string): ObrsaContract | undefined {
    return this.ensure().contracts.find((c) => c.id === id);
  }

  async saveContract(contract: ObrsaContract): Promise<ObrsaContract> {
    const db = this.ensure();
    const idx = db.contracts.findIndex((c) => c.id === contract.id);
    if (idx >= 0) db.contracts[idx] = contract;
    else db.contracts.push(contract);
    await this.persist();
    return contract;
  }

  async incrementTwinRuns(): Promise<void> {
    this.ensure().twinRuns += 1;
    await this.persist();
  }
}
