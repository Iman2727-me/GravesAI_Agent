import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  type Contract,
  type Dossier,
  type TherapyPlan,
  type TwinResult,
} from "../lib/api";
import TwinChart from "../components/TwinChart";

type StepId = "check" | "risk" | "tomorrow" | "medicine" | "pay" | "done";

const STEPS: Array<{ id: StepId; title: string; kid: string }> = [
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
    title: "Medicine",
    kid: "Then we build a medicine made just for them.",
  },
  {
    id: "pay",
    title: "Pay",
    kid: "Last: we only pay full price if the medicine really helps.",
  },
];

function riskWords(percentile: number): { label: string; tone: "ok" | "warn" | "bad" } {
  if (percentile >= 80) return { label: "Higher than most people", tone: "bad" };
  if (percentile >= 40) return { label: "About in the middle", tone: "warn" };
  return { label: "Lower than most people", tone: "ok" };
}

function mrdWords(status: string): string {
  if (status === "negative") return "The warning signal in the blood looks quiet.";
  if (status === "rising") return "The warning signal in the blood is getting louder.";
  if (status === "low") return "There’s a tiny warning signal left.";
  return "There’s still a warning signal in the blood.";
}

function organoidWords(rec: string): { label: string; tone: "ok" | "warn" | "bad" } {
  if (rec === "proceed") return { label: "Looks safe enough to try", tone: "ok" };
  if (rec === "revise") return { label: "Needs a tweak first", tone: "warn" };
  return { label: "Not safe — stop", tone: "bad" };
}

export default function StoryPage() {
  const { id = "" } = useParams();
  const [stepIndex, setStepIndex] = useState(0);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [twin, setTwin] = useState<TwinResult | null>(null);
  const [therapy, setTherapy] = useState<TherapyPlan | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState<Record<string, boolean>>({});

  async function refresh() {
    const d = await api.dossier(id);
    setDossier(d);
    setTwin(d.twin);
    setTherapy(d.therapies[0] ?? null);
    setContract(d.contracts[0] ?? null);
  }

  useEffect(() => {
    void refresh().catch((e) => setError((e as Error).message));
  }, [id]);

  const step = STEPS[stepIndex]!;
  const risk = useMemo(
    () => (dossier ? riskWords(dossier.prs.percentile) : null),
    [dossier],
  );

  async function runStep() {
    if (!dossier) return;
    setBusy(true);
    setError(null);
    try {
      if (step.id === "check") {
        const ordered = await api.orderAssay(dossier.patient.id, "mrd_monitor");
        await api.completeAssay(dossier.patient.id, ordered.assay.id);
        await api.setStage(dossier.patient.id, "sensing");
      } else if (step.id === "risk") {
        await api.prs(dossier.patient.id);
        await api.setStage(dossier.patient.id, "risk");
      } else if (step.id === "tomorrow") {
        const res = await api.twin(dossier.patient.id, 90);
        setTwin(res.simulation);
      } else if (step.id === "medicine") {
        const plan = await api.therapy(dossier.patient.id);
        setTherapy(plan);
      } else if (step.id === "pay") {
        let c = contract;
        if (!c) {
          c = await api.createContract(dossier.patient.id, {
            therapyLabel: "Custom medicine for this person",
            listPriceUsd: 285000,
          });
        }
        const lb = await api.liquidBiopsy(dossier.patient.id);
        c = await api.evaluateContract(c.id, {
          completeRemission: lb.mrdStatus === "negative",
          biomarkerRecovery: lb.clearanceProbability,
        });
        setContract(c);
      }
      await refresh();
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

  if (!dossier) {
    return (
      <main>
        <p className="muted">{error ?? "Loading…"}</p>
      </main>
    );
  }

  const patient = dossier.patient;
  const lb = dossier.liquidBiopsy;
  const activeTwin = twin ?? dossier.twin;
  const org = therapy ? organoidWords(therapy.organoid.recommendation) : null;

  if (done) {
    return (
      <main>
        <section className="section story-card">
          <h2>That’s the whole loop</h2>
          <p className="lede">
            We checked {patient.displayName}, measured risk, peeked ahead, built a
            medicine, and tied payment to results.
          </p>
          <div className="panel">
            <p>
              <strong>Risk:</strong> {risk?.label}
            </p>
            <p style={{ marginTop: "0.45rem" }}>
              <strong>Tomorrow:</strong> about{" "}
              {Math.round(activeTwin.onsetProbability90d * 100)}% chance things get
              harder soon
            </p>
            <p style={{ marginTop: "0.45rem" }}>
              <strong>Medicine:</strong> {org?.label ?? "Not made yet"}
            </p>
            <p style={{ marginTop: "0.45rem" }}>
              <strong>Payment:</strong>{" "}
              {contract
                ? contract.accruedRebateUsd > 0
                  ? `Maker owes $${contract.accruedRebateUsd.toLocaleString()} back`
                  : "No rebate yet — watching results"
                : "Not scored yet"}
            </p>
          </div>
          <div className="row" style={{ marginTop: "1rem" }}>
            <button
              className="btn"
              onClick={() => {
                setDone(false);
                setStepIndex(0);
                setRan({});
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
          <button className="btn big" disabled={busy} onClick={() => void runStep()}>
            {busy ? "Working…" : actionLabel(step.id)}
          </button>
        )}

        {ran[step.id] && step.id === "check" && (
          <div className="result-block">
            <p className="result-title">We checked their signals</p>
            <p className="muted">{mrdWords(lb.mrdStatus)}</p>
            <p className="mono muted" style={{ marginTop: "0.5rem" }}>
              Smart tools used: blood test + quick body check
            </p>
          </div>
        )}

        {ran[step.id] && step.id === "risk" && risk && (
          <div className="result-block">
            <p className="result-title">Their risk level</p>
            <div className={`pill ${risk.tone}`}>{risk.label}</div>
            <div className="risk-meter" aria-hidden>
              <span style={{ width: `${Math.min(100, dossier.prs.percentile)}%` }} />
            </div>
            <p className="muted">
              This uses their family background fairly — not a one-size-fits-all score.
            </p>
          </div>
        )}

        {ran[step.id] && step.id === "tomorrow" && (
          <div className="result-block">
            <p className="result-title">A peek at tomorrow</p>
            <TwinChart trajectory={activeTwin.trajectory} />
            <div className="grid-2" style={{ marginTop: "0.75rem" }}>
              <div className="panel">
                <div className="metric">
                  {Math.round(activeTwin.onsetProbability90d * 100)}%
                </div>
                <div className="metric-label">Chance things get harder</div>
              </div>
              <div className="panel">
                <div className="metric">
                  {Math.round(activeTwin.predictedResponseScore * 100)}%
                </div>
                <div className="metric-label">Chance a good medicine helps</div>
              </div>
            </div>
            <p className="muted" style={{ marginTop: "0.65rem" }}>
              {activeTwin.narrative}
            </p>
          </div>
        )}

        {ran[step.id] && step.id === "medicine" && therapy && org && (
          <div className="result-block">
            <p className="result-title">Custom medicine ready</p>
            <div className={`pill ${org.tone}`}>{org.label}</div>
            <p className="muted" style={{ marginTop: "0.55rem" }}>
              We picked the best tiny targets for their immune system, then safety-checked
              them.
            </p>
            <p className="mono muted" style={{ marginTop: "0.45rem" }}>
              Top target: {therapy.neoantigens[0]?.peptide.sequence ?? "—"} · delivery{" "}
              {therapy.deliveryModality}
            </p>
          </div>
        )}

        {ran[step.id] && step.id === "pay" && contract && (
          <div className="result-block">
            <p className="result-title">Did it earn full pay?</p>
            <div
              className={`pill ${
                contract.accruedRebateUsd > 0
                  ? "bad"
                  : contract.status === "completed"
                    ? "ok"
                    : "warn"
              }`}
            >
              {contract.accruedRebateUsd > 0
                ? "Not fully — money comes back"
                : "Watching results"}
            </div>
            <p className="muted" style={{ marginTop: "0.55rem" }}>
              List price ${contract.listPriceUsd.toLocaleString()}. If goals are missed,
              the maker returns ${contract.accruedRebateUsd.toLocaleString()}.
            </p>
          </div>
        )}

        {ran[step.id] && (
          <button className="btn big" style={{ marginTop: "1rem" }} onClick={next}>
            {stepIndex >= STEPS.length - 1 ? "See the whole story" : "Next step"}
          </button>
        )}
      </section>
    </main>
  );
}

function actionLabel(id: StepId): string {
  switch (id) {
    case "check":
      return "Check their body";
    case "risk":
      return "Measure their risk";
    case "tomorrow":
      return "Peek into tomorrow";
    case "medicine":
      return "Make their medicine";
    case "pay":
      return "Check if we should pay";
    default:
      return "Go";
  }
}
