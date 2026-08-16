import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Contract, type Patient } from "../lib/api";

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [c, p] = await Promise.all([api.contracts(), api.patients()]);
    setContracts(c);
    setPatients(p);
  }

  useEffect(() => {
    void load().catch((e) => setError((e as Error).message));
  }, []);

  function patientName(id: string) {
    return patients.find((p) => p.id === id)?.displayName ?? id;
  }

  return (
    <main>
      <section className="section">
        <h2>Outcomes-based risk sharing</h2>
        <p className="lede">
          Manufacturer reimbursement is linked to molecular milestones — ctDNA
          negativity, complete remission, biomarker recovery — with tiered rebates when
          targets are missed.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="stack">
          {contracts.map((c) => (
            <div className="panel interactive" key={c.id}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <strong>{c.therapyLabel}</strong>
                  <div className="muted">
                    <Link to={`/patients/${c.patientId}`}>
                      {patientName(c.patientId)}
                    </Link>
                  </div>
                </div>
                <span
                  className={`pill ${
                    c.status === "completed"
                      ? "ok"
                      : c.status === "breached"
                        ? "bad"
                        : "warn"
                  }`}
                >
                  {c.status}
                </span>
              </div>
              <div className="grid-3" style={{ marginTop: "0.85rem" }}>
                <div>
                  <div className="metric">${(c.listPriceUsd / 1000).toFixed(0)}k</div>
                  <div className="metric-label">List price</div>
                </div>
                <div>
                  <div className="metric">
                    ${(c.accruedRebateUsd / 1000).toFixed(0)}k
                  </div>
                  <div className="metric-label">Accrued rebate</div>
                </div>
                <div>
                  <div className="metric">
                    ${(c.netLiabilityUsd / 1000).toFixed(0)}k
                  </div>
                  <div className="metric-label">Net liability</div>
                </div>
              </div>
              <table className="table" style={{ marginTop: "0.75rem" }}>
                <thead>
                  <tr>
                    <th>Milestone</th>
                    <th>Target</th>
                    <th>Observed</th>
                    <th>Met</th>
                  </tr>
                </thead>
                <tbody>
                  {c.milestones.map((m) => (
                    <tr key={m.id}>
                      <td>{m.label}</td>
                      <td className="mono">{m.targetValue}</td>
                      <td className="mono">
                        {m.observedValue == null ? "—" : m.observedValue.toFixed(2)}
                      </td>
                      <td>
                        {m.met == null ? "—" : m.met ? "yes" : "no"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                className="btn"
                style={{ marginTop: "0.75rem" }}
                disabled={busy === c.id}
                onClick={async () => {
                  setBusy(c.id);
                  setError(null);
                  try {
                    const lb = await api.liquidBiopsy(c.patientId);
                    await api.evaluateContract(c.id, {
                      completeRemission: lb.mrdStatus === "negative",
                      biomarkerRecovery: lb.clearanceProbability,
                    });
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === c.id ? "Evaluating…" : "Evaluate against real-world biomarkers"}
              </button>
            </div>
          ))}
          {contracts.length === 0 && (
            <p className="muted">No contracts yet. Open one from a patient dossier.</p>
          )}
        </div>
      </section>
    </main>
  );
}
