import { Link } from "react-router-dom";
import { listPatients } from "../lib/localDemo";

const BLURBS: Record<string, string> = {
  "pt-isaac": "That’s you (demo) — college, mild BP, mood, campus lifestyle.",
  "pt-amara-okonkwo": "Full medical story — cancer path ready.",
  "pt-li-wei": "More about metabolism and everyday risk.",
};

export default function PickPage() {
  const patients = listPatients();

  return (
    <main>
      <section className="section" style={{ marginTop: "0.25rem" }}>
        <h2>Pick a person</h2>
        <p className="lede">Tap one name. We’ll walk through their story together.</p>
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
