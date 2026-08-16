import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Patient } from "../lib/api";

export default function CohortPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setPatients(await api.patients());
  }

  useEffect(() => {
    void load().catch((e) => setError((e as Error).message));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.createPatient({ displayName: name.trim() });
      setName("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <section className="section">
        <h2>Clinical cohort</h2>
        <p className="lede">
          Patients move through intake → sensing → trans-ancestry risk → digital twin →
          therapy → value-based reimbursement.
        </p>

        <form className="panel interactive row" onSubmit={onCreate}>
          <div className="field" style={{ flex: 1, minWidth: "220px" }}>
            <label htmlFor="name">Admit patient</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name"
            />
          </div>
          <button className="btn" disabled={busy || !name.trim()} type="submit">
            Create intake
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        <div className="stack" style={{ marginTop: "1.25rem" }}>
          {patients.map((p) => (
            <Link className="patient-link" key={p.id} to={`/patients/${p.id}`}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong>{p.displayName}</strong>
                  <div className="mono muted">
                    {p.mrn} · {p.birthYear}
                  </div>
                  <div className="mono muted">
                    {p.ancestry
                      .map((a) => `${a.label} ${(a.proportion * 100).toFixed(0)}%`)
                      .join(" / ")}
                  </div>
                </div>
                <span className="pill">{p.lifecycleStage.replaceAll("_", " ")}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
