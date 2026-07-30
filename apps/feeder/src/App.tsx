import { useEffect, useState } from "react";
import type { Question, Session } from "@thomas/shared";
import { STAGE_LABELS, STAGE_ORDER } from "@thomas/shared";
import { api } from "./api";
import "./app.css";

const CUSTOM = "__custom__";

export default function App() {
  const [idea, setIdea] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [overrideRec, setOverrideRec] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!session) return;
    const t = setInterval(async () => {
      try {
        const fresh = await api.getSession(session.id);
        setSession(fresh);
      } catch {
        /* ignore poll errors */
      }
    }, 4000);
    return () => clearInterval(t);
  }, [session?.id]);

  function resetChoice() {
    setSelected(null);
    setCustomText("");
    setOverrideRec(false);
  }

  function resolvedAnswer(): string {
    if (!selected) return "";
    if (selected === CUSTOM) return customText.trim();
    return selected;
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const uploadIds: string[] = [];
      for (const f of files) {
        const up = await api.upload(f);
        uploadIds.push(up.id);
      }
      const s = await api.createSession(idea, uploadIds);
      setSession(s);
      resetChoice();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitChoice(question: Question) {
    if (!session) return;
    const answer = resolvedAnswer();
    if (!answer) {
      setError("Pick an option, Isaac.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const s = await api.answer(session.id, [
        {
          questionId: question.id,
          answer,
          overrideRecommendation: overrideRec,
        },
      ]);
      setSession(s);
      resetChoice();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pickAndSubmit(question: Question, option: string) {
    if (busy) return;
    setSelected(option);
    // Non-custom options submit immediately for a lighter feel.
    if (option === CUSTOM) return;
    setBusy(true);
    setError(null);
    try {
      const s = await api.answer(session!.id, [
        {
          questionId: question.id,
          answer: option,
          overrideRecommendation: overrideRec,
        },
      ]);
      setSession(s);
      resetChoice();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const stageIdx = session ? STAGE_ORDER.indexOf(session.currentStage) : -1;
  const currentQuestion = session?.pendingQuestions[0];
  const stageRec = session?.stages.find((s) => s.id === session.currentStage);
  const verdict = stageRec?.latestVerdict;

  return (
    <div className="shell">
      <header className="hero">
        <p className="eyebrow">Process development agent</p>
        <h1>Thomas</h1>
        <p className="tag">I think it through. You pick. One short choice at a time.</p>
      </header>

      {!session ? (
        <section className="panel intake">
          <label htmlFor="idea">Idea</label>
          <textarea
            id="idea"
            rows={5}
            placeholder="Describe the problem or idea. Attachments welcome."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
          <label className="file-label">
            Attachments
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </label>
          {files.length > 0 && (
            <ul className="file-list">
              {files.map((f) => (
                <li key={f.name}>
                  {f.name} ({Math.round(f.size / 1024)} KB)
                </li>
              ))}
            </ul>
          )}
          <button disabled={busy || !idea.trim()} onClick={start}>
            {busy ? "Handing to Thomas…" : "Begin with Thomas"}
          </button>
        </section>
      ) : (
        <div className="workspace">
          <aside className="panel progress-rail">
            <p className="progress-label">
              Step {Math.max(1, stageIdx + 1)} of {STAGE_ORDER.length}
            </p>
            <div className="progress-dots" aria-label="Pipeline progress">
              {STAGE_ORDER.map((id, i) => {
                const rec = session.stages.find((s) => s.id === id);
                const cls =
                  i === stageIdx ? "current" : rec?.status === "complete" || rec?.status === "skipped" ? "done" : "";
                return (
                  <span
                    key={id}
                    className={`dot ${cls}`}
                    title={STAGE_LABELS[id]}
                  />
                );
              })}
            </div>
            <p className="progress-stage">{STAGE_LABELS[session.currentStage]}</p>
            <div className="artifacts">
              {session.artifacts.whiteboardUrl && (
                <a href={session.artifacts.whiteboardUrl} target="_blank" rel="noreferrer">
                  Whiteboard
                </a>
              )}
              {session.artifacts.designMapUrl && (
                <a href={session.artifacts.designMapUrl} target="_blank" rel="noreferrer">
                  Design map
                </a>
              )}
            </div>
          </aside>

          <main className="panel main">
            <div className="idea-chip">
              <strong>Idea</strong>
              <p>{session.idea}</p>
            </div>

            {busy && (
              <p className="thinking" aria-live="polite">
                Thomas is thinking…
              </p>
            )}

            {!busy && currentQuestion && (
              <section className="focus-card">
                <p className="focus-stage">{STAGE_LABELS[session.currentStage]}</p>
                {verdict && <p className="verdict">{verdict}</p>}
                <h2 className="focus-prompt">{currentQuestion.prompt}</h2>
                <div className="choice-grid" role="radiogroup" aria-label={currentQuestion.prompt}>
                  {(currentQuestion.options?.length
                    ? currentQuestion.options
                    : ["Accept my recommendation", "I will change it"]
                  ).map((opt) => {
                    const isRec = opt === currentQuestion.recommendedOption;
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={busy}
                        className={`choice${selected === opt ? " selected" : ""}${isRec ? " recommended" : ""}`}
                        onClick={() => pickAndSubmit(currentQuestion, opt)}
                      >
                        <span>{opt}</span>
                        {isRec && <em>Thomas recommends</em>}
                      </button>
                    );
                  })}
                  {currentQuestion.allowCustom !== false && (
                    <button
                      type="button"
                      disabled={busy}
                      className={`choice ghost-choice${selected === CUSTOM ? " selected" : ""}`}
                      onClick={() => setSelected(CUSTOM)}
                    >
                      Other
                    </button>
                  )}
                </div>

                {selected === CUSTOM && (
                  <div className="custom-block">
                    <textarea
                      rows={2}
                      placeholder="Your answer…"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                    />
                    <button
                      disabled={busy || !customText.trim()}
                      onClick={() => submitChoice(currentQuestion)}
                    >
                      Submit
                    </button>
                  </div>
                )}

                <label className="override">
                  <input
                    type="checkbox"
                    checked={overrideRec}
                    onChange={(e) => setOverrideRec(e.target.checked)}
                  />
                  Override recommendation
                </label>
              </section>
            )}

            {!busy && !currentQuestion && session.status === "active" && (
              <p className="thinking">Thomas is thinking…</p>
            )}

            {session.status === "complete" && (
              <p className="complete">Done. Visuals remain available for revision.</p>
            )}

            <details
              className="history"
              open={historyOpen}
              onToggle={(e) => setHistoryOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary>History</summary>
              <div className="messages">
                {session.messages.map((m) => (
                  <article key={m.id} className={`msg ${m.role} ${m.tone}`}>
                    <header>
                      <span>{m.role === "thomas" ? "Thomas" : "You"}</span>
                      {m.tone === "pointed" && <em>pointed</em>}
                    </header>
                    <p>{m.content}</p>
                  </article>
                ))}
              </div>
            </details>
          </main>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
