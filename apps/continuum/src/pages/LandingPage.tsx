import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type PlatformMeta, type Snapshot } from "../lib/api";

export default function LandingPage() {
  const [meta, setMeta] = useState<PlatformMeta | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    void Promise.all([api.meta(), api.snapshot()]).then(([m, s]) => {
      setMeta(m);
      setSnap(s);
    });
  }, []);

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <h1>Graves Continuum</h1>
          <p>
            The operating system for universal personalized medicine — continuous
            multi-omic sensing, trans-ancestry risk, biological digital twins,
            adaptive therapeutics, and outcomes-based reimbursement in one closed loop.
          </p>
          <div className="cta-row">
            <Link className="btn" to="/guide">
              How to use
            </Link>
            <Link className="btn secondary" to="/cohort">
              Open clinical cohort
            </Link>
          </div>
        </div>
      </section>

      <main>
        <section className="section">
          <h2>Live platform</h2>
          <p className="lede">
            Production Continuum stack with executable scientific engines — not
            slideware. Seeded patients exercise the full five-stage blueprint.
          </p>
          <div className="grid-3">
            <div className="panel">
              <div className="metric">{snap?.patients ?? "—"}</div>
              <div className="metric-label">Patients</div>
            </div>
            <div className="panel">
              <div className="metric">{snap?.federatedNodes ?? "—"}</div>
              <div className="metric-label">Online TRE nodes</div>
            </div>
            <div className="panel">
              <div className="metric">{snap?.assaysComplete ?? "—"}</div>
              <div className="metric-label">Assays complete</div>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Systemic implementation blueprint</h2>
          <p className="lede">
            Each stage is wired to real computational engines and clinical APIs.
          </p>
          <div className="blueprint">
            {(meta?.blueprint ?? []).map((step, i) => (
              <div className="blueprint-item" key={step}>
                <div className="step-num">0{i + 1}</div>
                <div>{step}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>Diagnostic layer</h2>
          <p className="lede">
            Modality routing mirrors the Continuum sensing table — long-read NGS,
            CRISPR DETECTR/SHERLOCK, and liquid biopsy — with infrastructure and
            turnaround constraints.
          </p>
          <div className="stack">
            {(meta?.modalities ?? []).map((m) => (
              <div key={m.id} className="panel">
                <strong>{m.name}</strong>
                <p className="muted" style={{ marginTop: "0.35rem" }}>
                  {m.primaryTarget} · {m.analyticalSensitivity}
                </p>
                <p className="mono muted" style={{ marginTop: "0.35rem" }}>
                  {m.turnaroundHours.min}–{m.turnaroundHours.max}h · infra{" "}
                  {m.infrastructure}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
