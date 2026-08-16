import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { PatientRecord, PrsResult, TwinSimulationResult } from "@graves/upm-shared";
import TwinChart from "../components/TwinChart";
import {
  getPatient,
  runCheck,
  runRisk,
  runTreatment,
  runTwin,
  type TreatmentPlan,
} from "../lib/localDemo";

type StepId = "check" | "risk" | "tomorrow" | "medicine" | "done";

const STEPS: Array<{ id: Exclude<StepId, "done">; title: string; kid: string }> = [
  {
    id: "check",
    title: "Check",
    kid: "First we look at what’s going on in their body.",
  },
  {
    id: "risk",
    title: "Risk",
    kid: "Next we ask: are they more likely to get sick than most people?",
  },
  {
    id: "tomorrow",
    title: "Tomorrow",
    kid: "Then we peek ahead — what might happen in the next few months?",
  },
  {
    id: "medicine",
    title: "Treatment plan",
    kid: "Last we build a plan and pick the clearest treatment option.",
  },
];

function riskWords(percentile: number): { label: string; tone: "ok" | "warn" | "bad" } {
  if (percentile >= 80) return { label: "Higher than most people", tone: "bad" };
  if (percentile >= 40) return { label: "About in the middle", tone: "warn" };
  return { label: "Lower than most people", tone: "ok" };
}

export default function StoryPage() {
  const { id = "" } = useParams();
  const [stepIndex, setStepIndex] = useState(0);
  const [patient, setPatient] = useState<PatientRecord | null>(() => getPatient(id) ?? null);
  const [checkPlain, setCheckPlain] = useState<string | null>(null);
  const [prs, setPrs] = useState<PrsResult | null>(null);
  const [twin, setTwin] = useState<TwinSimulationResult | null>(null);
  const [plan, setPlan] = useState<TreatmentPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState<Record<string, boolean>>({});

  const step = STEPS[stepIndex]!;
  const risk = useMemo(() => (prs ? riskWords(prs.percentile) : null), [prs]);

  function runStep() {
    if (!patient) return;
    setBusy(true);
    setError(null);
    try {
      if (step.id === "check") {
        const res = runCheck(patient);
        setPatient(res.patient);
        setCheckPlain(res.plain);
      } else if (step.id === "risk") {
        setPrs(runRisk(patient));
      } else if (step.id === "tomorrow") {
        setTwin(runTwin(patient));
      } else if (step.id === "medicine") {
        setPlan(runTreatment(patient));
      }
      setRan((r) => ({ ...r, [step.id]: true }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (stepIndex >= STEPS.length - 1) {
      setDone(true);
      return;
    }
    setStepIndex((i) => i + 1);
  }

  if (!patient) {
    return (
      <main>
        <p className="error">Person not found.</p>
        <Link className="btn" to="/pick">
          Pick someone
        </Link>
      </main>
    );
  }

  if (done && plan) {
    const chosen = plan.options.find((o) => o.selected);
    return (
      <main>
        <section className="section story-card">
          <h2>That’s the plan</h2>
          <p className="lede">
            Here’s what Continuum figured out for {patient.displayName}.
          </p>
          <div className="panel">
            <p>
              <strong>Risk:</strong> {risk?.label ?? "—"}
            </p>
            <p style={{ marginTop: "0.45rem" }}>
              <strong>Tomorrow:</strong> about{" "}
              {twin ? Math.round(twin.onsetProbability90d * 100) : "—"}% chance things get
              harder soon
            </p>
            <p style={{ marginTop: "0.45rem" }}>
              <strong>Best treatment option:</strong> {chosen?.title ?? "—"}
            </p>
            <p className="muted" style={{ marginTop: "0.35rem" }}>
              {chosen?.plain}
            </p>
            <p style={{ marginTop: "0.45rem" }}>
              <strong>Safety check:</strong> {plan.safetyPlain}
            </p>
            <p style={{ marginTop: "0.45rem" }}>
              <strong>Immune booster:</strong>{" "}
              {plan.combineWithImmuneBooster ? "Yes — add it" : "No"}
            </p>
          </div>
          <div className="row" style={{ marginTop: "1rem" }}>
            <button
              className="btn"
              onClick={() => {
                setDone(false);
                setStepIndex(0);
                setRan({});
                setCheckPlain(null);
                setPrs(null);
                setTwin(null);
                setPlan(null);
                setPatient(getPatient(id) ?? null);
              }}
            >
              Watch again
            </button>
            <Link className="btn ghost" to="/pick">
              Pick someone else
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <p className="muted">
        <Link to="/pick">People</Link> / {patient.displayName}
      </p>

      <div className="story-progress" aria-label="Steps">
        {STEPS.map((s, i) => (
          <span
            key={s.id}
            className={
              i === stepIndex ? "on" : i < stepIndex || ran[s.id] ? "done" : ""
            }
          >
            {i + 1}
          </span>
        ))}
      </div>

      <section className="section story-card">
        <div className="step-num">
          Step {stepIndex + 1} of {STEPS.length}
        </div>
        <h2>{step.title}</h2>
        <p className="lede">{step.kid}</p>

        {error && <p className="error">{error}</p>}

        {!ran[step.id] && (
          <button className="btn big" disabled={busy} onClick={runStep}>
            {busy ? "Working…" : actionLabel(step.id)}
          </button>
        )}

        {ran[step.id] && step.id === "check" && (
          <div className="result-block">
            <p className="result-title">We checked their signals</p>
            <p className="muted">{checkPlain}</p>
          </div>
        )}

        {ran[step.id] && step.id === "risk" && risk && prs && (
          <div className="result-block">
            <p className="result-title">Their risk level</p>
            <div className={`pill ${risk.tone}`}>{risk.label}</div>
            <div className="risk-meter" aria-hidden>
              <span style={{ width: `${Math.min(100, prs.percentile)}%` }} />
            </div>
            <p className="muted">
              This uses their background fairly — not a one-size-fits-all score.
            </p>
          </div>
        )}

        {ran[step.id] && step.id === "tomorrow" && twin && (
          <div className="result-block">
            <p className="result-title">A peek at tomorrow</p>
            <TwinChart trajectory={twin.trajectory} />
            <div className="grid-2" style={{ marginTop: "0.75rem" }}>
              <div className="panel">
                <div className="metric">
                  {Math.round(twin.onsetProbability90d * 100)}%
                </div>
                <div className="metric-label">Chance things get harder</div>
              </div>
              <div className="panel">
                <div className="metric">
                  {Math.round(twin.predictedResponseScore * 100)}%
                </div>
                <div className="metric-label">Chance a good plan helps</div>
              </div>
            </div>
          </div>
        )}

        {ran[step.id] && step.id === "medicine" && plan && (
          <div className="result-block">
            <p className="result-title">Treatment options</p>
            <p className="muted">
              Continuum compared three ways to deliver a custom immune treatment. The
              highlighted one is the best fit.
            </p>
            <div className="stack" style={{ marginTop: "0.35rem" }}>
              {plan.options.map((opt) => (
                <div
                  key={opt.id}
                  className={`panel option-card ${opt.selected ? "selected" : ""}`}
                >
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <strong>{opt.title}</strong>
                    {opt.selected ? (
                      <span className="pill ok">Best fit</span>
                    ) : (
                      <span className="pill">Other option</span>
                    )}
                  </div>
                  <p className="muted" style={{ marginTop: "0.35rem" }}>
                    {opt.plain}
                  </p>
                </div>
              ))}
            </div>

            <div className="panel" style={{ marginTop: "0.35rem" }}>
              <strong>Also in the plan</strong>
              <p className="muted" style={{ marginTop: "0.35rem" }}>
                Immune booster (checkpoint helper):{" "}
                {plan.combineWithImmuneBooster ? "yes" : "no"}
              </p>
              <p className="muted" style={{ marginTop: "0.35rem" }}>
                Safety check:{" "}
                <span className={`pill ${plan.safetyTone}`}>{plan.safetyPlain}</span>
              </p>
              <p className="mono muted" style={{ marginTop: "0.45rem" }}>
                Top target: {plan.neoantigens[0]?.peptide.sequence ?? "—"} (
                {plan.neoantigens[0]?.peptide.sourceGene ?? "—"})
              </p>
            </div>
          </div>
        )}

        {ran[step.id] && (
          <button className="btn big" style={{ marginTop: "1rem" }} onClick={next}>
            {stepIndex >= STEPS.length - 1 ? "See the full plan" : "Next step"}
          </button>
        )}
      </section>
    </main>
  );
}

function actionLabel(id: string): string {
  switch (id) {
    case "check":
      return "Check their body";
    case "risk":
      return "Measure their risk";
    case "tomorrow":
      return "Peek into tomorrow";
    case "medicine":
      return "Build the treatment plan";
    default:
      return "Go";
  }
}
