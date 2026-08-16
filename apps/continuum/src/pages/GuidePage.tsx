import { Link } from "react-router-dom";

const STEPS = [
  {
    title: "Open the cohort",
    body: "Tap Cohort. You’ll see three seeded patients (Amara, Li Wei, Sofía) plus any you admit. Start with Amara Okonkwo — she has the richest data path.",
    to: "/cohort",
    cta: "Go to cohort",
  },
  {
    title: "1 · Order a diagnostic assay",
    body: "On the patient page, pick an intent (baseline genome, DETECTR pathogen DNA, SHERLOCK RNA, or MRD monitor) and tap Order assay. Complete it when ready. This is the multi-omic sensing layer.",
  },
  {
    title: "2 · Read trans-ancestry risk",
    body: "Scroll to Trans-ancestry risk. Continuum computes a portable PRS using ancestry-specific effect sizes and fine-mapping weights blended by the patient’s admixture — not a Europe-only score.",
  },
  {
    title: "3 · Run the digital twin",
    body: "Tap Re-run 90-day twin. The chart is a stochastic simulation of inflammation, metabolic load, immune activation, tumor burden, and exposome drivers. Use onset % and response % as planning signals.",
  },
  {
    title: "4 · Design therapy",
    body: "Tap Design neoantigen therapy. Continuum ranks MHC-binding peptides, then gates them through an organoid stress check (PERK-CHOP / IRE1-XBP1s). Proceed / revise / halt is the manufacturing gate.",
  },
  {
    title: "5 · Value-based contract",
    body: "Open an OBRSA, then Evaluate milestones. Payment follows molecular outcomes (ctDNA negativity, remission, biomarker recovery). Missed milestones accrue manufacturer rebates.",
    to: "/contracts",
    cta: "View contracts",
  },
  {
    title: "Federated discovery (optional)",
    body: "On Federated, query alleles across TRE nodes. Low-count hits are suppressed on purpose — that is Beacon privacy thresholding against membership inference.",
    to: "/federated",
    cta: "Open federated",
  },
];

export default function GuidePage() {
  return (
    <main>
      <section className="section" style={{ marginTop: "0.35rem" }}>
        <h2>How to use Continuum</h2>
        <p className="lede">
          Follow the patient lifecycle top to bottom. Every button runs a real engine —
          not a mock demo.
        </p>

        <div className="stack">
          {STEPS.map((step, i) => (
            <div className="guide-step" key={step.title}>
              <div className="step-num">Step {i + 1}</div>
              <h3>{step.title}</h3>
              <p className="muted">{step.body}</p>
              {step.to && step.cta && (
                <div className="row" style={{ marginTop: "0.45rem" }}>
                  <Link className="btn" to={step.to}>
                    {step.cta}
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="panel" style={{ marginTop: "1.5rem" }}>
          <strong>Fast path (2 minutes)</strong>
          <p className="muted" style={{ marginTop: "0.4rem" }}>
            Cohort → Amara Okonkwo → Order assay (MRD monitor) → Re-run twin → Design
            therapy → Evaluate contract.
          </p>
          <div className="row" style={{ marginTop: "0.75rem" }}>
            <Link className="btn" to="/patients/pt-amara-okonkwo">
              Open Amara’s dossier
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
