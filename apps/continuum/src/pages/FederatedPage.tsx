import { FormEvent, useEffect, useState } from "react";
import {
  api,
  type BeaconResponse,
  type FederatedNode,
  type PlatformMeta,
} from "../lib/api";

export default function FederatedPage() {
  const [nodes, setNodes] = useState<FederatedNode[]>([]);
  const [meta, setMeta] = useState<PlatformMeta | null>(null);
  const [result, setResult] = useState<BeaconResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    chromosome: "7",
    start: "55249071",
    referenceBases: "G",
    alternateBases: "A",
  });

  useEffect(() => {
    void Promise.all([api.nodes(), api.meta()]).then(([n, m]) => {
      setNodes(n);
      setMeta(m);
    });
  }, []);

  async function onBeacon(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.beacon({
        assemblyId: "GRCh38",
        chromosome: form.chromosome,
        start: Number(form.start),
        referenceBases: form.referenceBases,
        alternateBases: form.alternateBases,
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main>
      <section className="section">
        <h2>Federated governance</h2>
        <p className="lede">
          GA4GH-aligned Trusted Research Environments. Beacon queries apply aggregate
          thresholding so low-count alleles cannot be used for membership inference.
        </p>

        <div className="stack">
          {nodes.map((n) => (
            <div className="panel" key={n.id}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{n.name}</strong>
                <span className={`pill ${n.online ? "ok" : "warn"}`}>
                  {n.online ? "online" : "offline"}
                </span>
              </div>
              <p className="mono muted" style={{ marginTop: "0.35rem" }}>
                {n.jurisdiction} · {n.subjectCount.toLocaleString()} subjects ·{" "}
                {n.standards.join(", ")}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Beacon v2 query</h2>
        <form className="panel interactive stack" onSubmit={onBeacon}>
          <div className="grid-2">
            <div className="field">
              <label>Chromosome</label>
              <input
                value={form.chromosome}
                onChange={(e) => setForm({ ...form, chromosome: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Position</label>
              <input
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Reference</label>
              <input
                value={form.referenceBases}
                onChange={(e) =>
                  setForm({ ...form, referenceBases: e.target.value.toUpperCase() })
                }
              />
            </div>
            <div className="field">
              <label>Alternate</label>
              <input
                value={form.alternateBases}
                onChange={(e) =>
                  setForm({ ...form, alternateBases: e.target.value.toUpperCase() })
                }
              />
            </div>
          </div>
          <button className="btn" type="submit">
            Query federated alleles
          </button>
          {error && <p className="error">{error}</p>}
          {result && (
            <div>
              <p>
                Exists:{" "}
                <span className="mono">
                  {result.exists === null ? "suppressed" : String(result.exists)}
                </span>
                {" · "}
                AC{" "}
                <span className="mono">
                  {result.alleleCount ?? "—"}
                </span>
                {" · "}
                AF{" "}
                <span className="mono">
                  {result.alleleFrequency != null
                    ? result.alleleFrequency.toFixed(4)
                    : "—"}
                </span>
                {" · "}
                datasets <span className="mono">{result.datasetCount}</span>
              </p>
              {result.suppressionReason && (
                <p className="muted" style={{ marginTop: "0.35rem" }}>
                  {result.suppressionReason}
                </p>
              )}
            </div>
          )}
        </form>
      </section>

      <section className="section">
        <h2>GA4GH standards</h2>
        <div className="stack">
          {(meta?.ga4gh ?? []).map((s) => (
            <div className="blueprint-item" key={s.id}>
              <div className="step-num">{s.id}</div>
              <div>
                <strong>{s.domain}</strong>
                <p className="muted">{s.objective}</p>
                <p className="mono muted">{s.security}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
