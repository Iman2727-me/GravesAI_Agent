import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Patient } from "../lib/api";

const BLURBS: Record<string, string> = {
  "pt-isaac": "That’s you (demo) — college, mild BP, mood, campus lifestyle.",
  "pt-amara-okonkwo": "Best full medical story — cancer path ready.",
  "pt-li-wei": "More about metabolism and everyday risk.",
  "pt-sofia-mendez": "Just starting — good for a quick check.",
};

export default function PickPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .patients()
      .then(setPatients)
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <main>
      <section className="section" style={{ marginTop: "0.25rem" }}>
        <h2>Pick a person</h2>
        <p className="lede">Tap one name. We’ll walk through their story together.</p>
        {error && <p className="error">{error}</p>}
        <div className="stack">
          {patients.map((p) => (
            <Link
              key={p.id}
              className="panel interactive person-pick"
              to={`/story/${p.id}`}
            >
              <strong className="person-name">{p.displayName}</strong>
              <p className="muted">
                {BLURBS[p.id] ?? "Tap to see how Continuum helps them."}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
