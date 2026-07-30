import { useEffect, useState } from "react";
import type { Session } from "@thomas/shared";
import { STAGE_LABELS, STAGE_ORDER } from "@thomas/shared";
import { api } from "./api";
import "./app.css";

export default function App() {
  const [idea, setIdea] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [overrideRec, setOverrideRec] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setAnswers({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswers() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const payload = session.pendingQuestions
        .filter((q) => (answers[q.id] ?? "").trim())
        .map((q) => ({
          questionId: q.id,
          answer: answers[q.id]!.trim(),
          overrideRecommendation: overrideRec,
        }));
      if (!payload.length) {
        setError("Answer at least one question, Isaac — preferably the required ones.");
        return;
      }
      const s = await api.answer(session.id, payload);
      setSession(s);
      setAnswers({});
      setOverrideRec(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function advance() {
    if (!session) return;
    setBusy(true);
    try {
      const s = await api.advance(session.id);
      setSession(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const stageIdx = session ? STAGE_ORDER.indexOf(session.currentStage) : -1;

  return (
    <div className="shell">
      <header className="hero">
        <p className="eyebrow">Process development agent</p>
        <h1>Thomas</h1>
        <p className="tag">
          Feed an idea. I shall interrogate it properly in the background. Tommy, if you prefer.
        </p>
      </header>

      {!session ? (
        <section className="panel intake">
          <label htmlFor="idea">Idea</label>
          <textarea
            id="idea"
            rows={6}
            placeholder="Describe the problem or idea. Images, sheets, and other files welcome."
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
          <aside className="panel stages">
            <h2>Pipeline</h2>
            <ol>
              {STAGE_ORDER.map((id, i) => {
                const rec = session.stages.find((s) => s.id === id);
                return (
                  <li
                    key={id}
                    className={
                      i === stageIdx ? "current" : rec?.status === "complete" ? "done" : ""
                    }
                  >
                    <span>{STAGE_LABELS[id]}</span>
                    <small>{rec?.status ?? "pending"}</small>
                  </li>
                );
              })}
            </ol>
            <div className="artifacts">
              {session.artifacts.whiteboardUrl && (
                <a href={session.artifacts.whiteboardUrl} target="_blank" rel="noreferrer">
                  Open Process Whiteboard
                </a>
              )}
              {session.artifacts.designMapUrl && (
                <a href={session.artifacts.designMapUrl} target="_blank" rel="noreferrer">
                  Open Solution Design Map
                </a>
              )}
            </div>
            <p className="usage">
              Token estimate:{" "}
              {session.usage.reduce(
                (n, u) => n + u.estimatedInputTokens + u.estimatedOutputTokens,
                0,
              )}
            </p>
          </aside>

          <main className="panel main">
            <div className="idea-chip">
              <strong>Idea</strong>
              <p>{session.idea}</p>
            </div>

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

            {session.pendingQuestions.length > 0 && (
              <section className="questions">
                <h2>{STAGE_LABELS[session.currentStage]}</h2>
                {session.pendingQuestions.map((q) => (
                  <label key={q.id} className="q">
                    <span>
                      {q.prompt}
                      {q.required ? " *" : ""}
                    </span>
                    <textarea
                      rows={2}
                      value={answers[q.id] ?? ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                    />
                  </label>
                ))}
                <label className="override">
                  <input
                    type="checkbox"
                    checked={overrideRec}
                    onChange={(e) => setOverrideRec(e.target.checked)}
                  />
                  Override Thomas’s recommendation for this stage
                </label>
                <div className="actions">
                  <button disabled={busy} onClick={submitAnswers}>
                    Submit answers
                  </button>
                  <button className="ghost" disabled={busy} onClick={advance}>
                    Advance stage
                  </button>
                </div>
              </section>
            )}

            {session.status === "complete" && (
              <p className="complete">
                Pipeline complete. Visuals remain available for revision.
              </p>
            )}
          </main>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
