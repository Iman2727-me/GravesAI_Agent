import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  type Dossier,
  type TherapyPlan,
  type TwinResult,
} from "../lib/api";
import TwinChart from "../components/TwinChart";

const STAGES = [
  "intake",
  "sensing",
  "risk",
  "twin",
  "therapy",
  "reimbursement",
  "closed_loop",
];

export default function PatientPage() {
  const { id = "" } = useParams();
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [twin, setTwin] = useState<TwinResult | null>(null);
  const [therapy, setTherapy] = useState<TherapyPlan | null>(null);
  const [intent, setIntent] = useState("baseline_genome");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const d = await api.dossier(id);
    setDossier(d);
    setTwin(d.twin);
    setTherapy(d.therapies[0] ?? null);
  }

  useEffect(() => {
    void refresh().catch((e) => setError((e as Error).message));
  }, [id]);

  const ancestryBars = useMemo(() => dossier?.patient.ancestry ?? [], [dossier]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!dossier) {
    return (
      <main>
        <p className="muted">{error ?? "Loading dossier…"}</p>
      </main>
    );
  }

  const { patient, prs, liquidBiopsy, lifecycleLabel } = dossier;

  return (
    <main>
      <p className="muted">
        <Link to="/cohort">Cohort</Link> / {patient.displayName}
      </p>
      <section className="section" style={{ marginTop: "0.75rem" }}>
        <h2>{patient.displayName}</h2>
        <p className="lede">
          {patient.mrn} · {lifecycleLabel} · HLA {patient.hlaAlleles.join(", ")}
        </p>

        <div className="stage-rail">
          {STAGES.map((s) => (
            <span key={s} className={s === patient.lifecycleStage ? "on" : ""}>
              {s.replace("_", " ")}
            </span>
          ))}
        </div>

        {error && <p className="error">{error}</p>}

        <div className="grid-2">
          <div className="panel">
            <div className="metric-label">Phenotypes</div>
            <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem" }}>
              {patient.phenopacket.phenotypicFeatures.map((f) => (
                <li key={f.typeId}>
                  {f.label}{" "}
                  <span className="mono muted">
                    {f.typeId}
                    {f.severity ? ` · ${f.severity}` : ""}
                  </span>
                </li>
              ))}
              {patient.phenopacket.diseases.map((d) => (
                <li key={d.termId}>
                  {d.label} <span className="mono muted">{d.termId}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <div className="metric-label">Ancestry admixture</div>
            <div className="stack" style={{ marginTop: "0.65rem" }}>
              {ancestryBars.map((a) => (
                <div key={a.label}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="mono">{a.label}</span>
                    <span className="mono">{(a.proportion * 100).toFixed(0)}%</span>
                  </div>
                  <div className="spark">
                    <span style={{ width: `${a.proportion * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>1 · Multi-omic sensing</h2>
        <p className="lede">
          Route and order assays across long-read NGS, CRISPR POCT, and liquid biopsy.
        </p>
        <div className="panel interactive stack">
          <div className="row">
            <div className="field">
              <label htmlFor="intent">Diagnostic intent</label>
              <select
                id="intent"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
              >
                <option value="baseline_genome">Baseline genome / methylome</option>
                <option value="pathogen_dna">Pathogen DNA (DETECTR)</option>
                <option value="pathogen_rna">Pathogen RNA (SHERLOCK)</option>
                <option value="mrd_monitor">MRD / ctDNA monitor</option>
                <option value="field_poc">Field POCT</option>
              </select>
            </div>
            <button
              className="btn"
              disabled={busy !== null}
              onClick={() =>
                run("assay", async () => {
                  await api.orderAssay(patient.id, intent);
                })
              }
            >
              {busy === "assay" ? "Ordering…" : "Order assay"}
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Assay</th>
                <th>Modality</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {patient.assays.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.kind}
                    <div className="mono muted">{a.summary}</div>
                  </td>
                  <td className="mono">{a.modality}</td>
                  <td>
                    <span
                      className={`pill ${a.status === "complete" ? "ok" : "warn"}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td>
                    {a.status !== "complete" && (
                      <button
                        className="btn ghost"
                        disabled={busy !== null}
                        onClick={() =>
                          run("complete", async () => {
                            await api.completeAssay(patient.id, a.id);
                          })
                        }
                      >
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {liquidBiopsy.observations.length > 0 && (
            <div>
              <div className="metric-label">Liquid biopsy / MRD</div>
              <p style={{ marginTop: "0.35rem" }}>
                Status{" "}
                <span
                  className={`pill ${
                    liquidBiopsy.mrdStatus === "negative"
                      ? "ok"
                      : liquidBiopsy.mrdStatus === "rising"
                        ? "bad"
                        : "warn"
                  }`}
                >
                  {liquidBiopsy.mrdStatus}
                </span>{" "}
                · clearance {(liquidBiopsy.clearanceProbability * 100).toFixed(0)}% ·
                slope {liquidBiopsy.slopePerDay.toFixed(3)}/day
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <h2>2 · Trans-ancestry risk</h2>
        <p className="lede">{prs.equitableParityNote}</p>
        <div className="grid-3">
          <div className="panel">
            <div className="metric">{prs.percentile.toFixed(1)}</div>
            <div className="metric-label">Percentile</div>
          </div>
          <div className="panel">
            <div className="metric">{prs.zScore.toFixed(2)}</div>
            <div className="metric-label">Z-score</div>
          </div>
          <div className="panel">
            <div className="metric">{prs.contributingLoci}</div>
            <div className="metric-label">Loci</div>
          </div>
        </div>
        <p style={{ marginTop: "0.85rem" }}>{prs.interpretation}</p>
        <button
          className="btn ghost"
          style={{ marginTop: "0.75rem" }}
          disabled={busy !== null}
          onClick={() =>
            run("stage-risk", async () => {
              await api.setStage(patient.id, "risk");
            })
          }
        >
          Mark risk stage complete
        </button>
      </section>

      <section className="section">
        <h2>3 · Biological digital twin</h2>
        <p className="lede">{(twin ?? dossier.twin).narrative}</p>
        <div className="panel interactive">
          <TwinChart trajectory={(twin ?? dossier.twin).trajectory} />
          <div className="grid-2" style={{ marginTop: "0.85rem" }}>
            <div>
              <div className="metric">
                {(((twin ?? dossier.twin).onsetProbability90d) * 100).toFixed(0)}%
              </div>
              <div className="metric-label">90-day onset probability</div>
            </div>
            <div>
              <div className="metric">
                {(((twin ?? dossier.twin).predictedResponseScore) * 100).toFixed(0)}%
              </div>
              <div className="metric-label">Predicted therapy response</div>
            </div>
          </div>
          <button
            className="btn"
            style={{ marginTop: "0.85rem" }}
            disabled={busy !== null}
            onClick={() =>
              run("twin", async () => {
                const res = await api.twin(patient.id, 90);
                setTwin(res.simulation);
              })
            }
          >
            {busy === "twin" ? "Simulating…" : "Re-run 90-day twin"}
          </button>
        </div>
      </section>

      <section className="section">
        <h2>4 · Adaptive therapeutics</h2>
        <p className="lede">
          Neoantigen MHC ranking → organoid ER-stress validation → manufacturing gate.
        </p>
        <div className="panel interactive stack">
          <button
            className="btn"
            disabled={busy !== null}
            onClick={() =>
              run("therapy", async () => {
                const plan = await api.therapy(patient.id);
                setTherapy(plan);
              })
            }
          >
            {busy === "therapy" ? "Designing…" : "Design neoantigen therapy"}
          </button>
          {therapy && (
            <>
              <div className="row">
                <span className="pill">{therapy.status}</span>
                <span className="pill">{therapy.deliveryModality}</span>
                {therapy.combineWithIci && <span className="pill">+ ICI</span>}
                <span
                  className={`pill ${
                    therapy.organoid.recommendation === "proceed"
                      ? "ok"
                      : therapy.organoid.recommendation === "halt"
                        ? "bad"
                        : "warn"
                  }`}
                >
                  organoid {therapy.organoid.recommendation}
                </span>
              </div>
              <p className="muted">{therapy.organoid.notes}</p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Peptide</th>
                    <th>IC50 nM</th>
                    <th>Presentation</th>
                  </tr>
                </thead>
                <tbody>
                  {therapy.neoantigens.map((n) => (
                    <tr key={n.rank}>
                      <td>{n.rank}</td>
                      <td>
                        <span className="mono">{n.peptide.sequence}</span>
                        <div className="muted">
                          {n.peptide.sourceGene} · {n.peptide.mutationLabel}
                        </div>
                      </td>
                      <td className="mono">{n.bindingAffinityNm.toFixed(1)}</td>
                      <td className="mono">
                        {(n.presentationScore * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="grid-3">
                <div>
                  <div className="metric">
                    {therapy.organoid.viabilityPercent.toFixed(0)}%
                  </div>
                  <div className="metric-label">Organoid viability</div>
                </div>
                <div>
                  <div className="metric">
                    {(therapy.organoid.perkChopActivation * 100).toFixed(0)}%
                  </div>
                  <div className="metric-label">PERK-CHOP</div>
                </div>
                <div>
                  <div className="metric">
                    {(therapy.organoid.ire1Xbp1sActivation * 100).toFixed(0)}%
                  </div>
                  <div className="metric-label">IRE1-XBP1s</div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="section">
        <h2>5 · Value-based reimbursement</h2>
        <p className="lede">
          Outcomes-based risk-sharing agreements tied to ctDNA negativity and clinical
          milestones.
        </p>
        <div className="row">
          <button
            className="btn"
            disabled={busy !== null}
            onClick={() =>
              run("contract", async () => {
                await api.createContract(patient.id, {
                  therapyLabel: "Personalized neoantigen mRNA + ICI",
                  listPriceUsd: 285000,
                });
              })
            }
          >
            Open OBRSA contract
          </button>
          <Link className="btn ghost" to="/contracts">
            View all contracts
          </Link>
        </div>
        <div className="stack" style={{ marginTop: "1rem" }}>
          {dossier.contracts.map((c) => (
            <div className="panel" key={c.id}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{c.therapyLabel}</strong>
                <span className={`pill ${c.status === "breached" ? "bad" : "ok"}`}>
                  {c.status}
                </span>
              </div>
              <p className="mono muted" style={{ marginTop: "0.35rem" }}>
                List ${c.listPriceUsd.toLocaleString()} · rebate accrued $
                {c.accruedRebateUsd.toLocaleString()} · net $
                {c.netLiabilityUsd.toLocaleString()}
              </p>
              <button
                className="btn ghost"
                style={{ marginTop: "0.65rem" }}
                disabled={busy !== null}
                onClick={() =>
                  run("eval", async () => {
                    await api.evaluateContract(c.id, {
                      completeRemission: liquidBiopsy.mrdStatus === "negative",
                      biomarkerRecovery: liquidBiopsy.clearanceProbability,
                    });
                  })
                }
              >
                Evaluate milestones
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
