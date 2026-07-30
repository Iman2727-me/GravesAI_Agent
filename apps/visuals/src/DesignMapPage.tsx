import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { DesignDecision, SolutionDesignMap } from "@thomas/shared";
import { api } from "./api";

export default function DesignMapPage() {
  const { processId = "" } = useParams();
  const [map, setMap] = useState<SolutionDesignMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [baseline, setBaseline] = useState<SolutionDesignMap | null>(null);

  useEffect(() => {
    api
      .getDesign(processId)
      .then((m) => {
        setMap(m);
        setBaseline(m);
      })
      .catch((e) => setError((e as Error).message));
  }, [processId]);

  function conflicts(): string[] {
    if (!map || !baseline) return [];
    const notes: string[] = [];
    if (map.solutionType !== baseline.solutionType && map.stackDecisions.length) {
      notes.push("Solution type changed — stack decisions may be inconsistent.");
    }
    if (map.riskMvpChoice !== baseline.riskMvpChoice) {
      notes.push("Risk/MVP choice changed — ops cost assumptions may need revisiting.");
    }
    if (map.opsCostSummary !== baseline.opsCostSummary && map.architectureBlocks.length) {
      notes.push("Ops cost edited — architecture blocks may imply a different run-rate.");
    }
    return notes;
  }

  function updateDecision(listKey: "stackDecisions" | "majorDecisions", id: string, value: string) {
    if (!map) return;
    setMap({
      ...map,
      [listKey]: map[listKey].map((d: DesignDecision) =>
        d.id === id ? { ...d, value } : d,
      ),
    });
  }

  async function save() {
    if (!map) return;
    setBusy(true);
    try {
      const next = await api.patchDesign(processId, map);
      setMap(next);
      setBaseline(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revise() {
    if (!map) return;
    setBusy(true);
    try {
      await api.reviseDesign(processId, map);
      const next = await api.getDesign(processId);
      setMap(next);
      setBaseline(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function exportJson() {
    if (!map) return;
    const blob = new Blob([JSON.stringify(map, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thomas-design-${processId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportSvg() {
    if (!map) return;
    const lines = [
      map.problemStatement,
      `Type: ${map.solutionType}`,
      `Risk/MVP: ${map.riskMvpChoice}`,
      `Ops: ${map.opsCostSummary}`,
      ...map.architectureBlocks.map((b) => `${b.name}: ${b.detail}`),
    ];
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${120 + lines.length * 28}">
  <rect width="100%" height="100%" fill="#121a22"/>
  <text x="32" y="48" fill="#5ec2c7" font-family="Georgia, serif" font-size="28">Solution Design Map</text>
  ${lines
    .map(
      (l, i) =>
        `<text x="32" y="${90 + i * 28}" fill="#e7eef5" font-family="IBM Plex Sans, sans-serif" font-size="14">${escapeXml(l.slice(0, 110))}</text>`,
    )
    .join("\n  ")}
</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thomas-design-${processId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) return <p className="error-banner">{error}</p>;
  if (!map) return <p className="loading">Loading design map…</p>;

  const conflictNotes = conflicts();

  return (
    <div className="visual-shell">
      <header className="visual-header">
        <div>
          <p className="eyebrow">Thomas · Solution Design Map</p>
          <h1>Final design decisions</h1>
        </div>
        <div className="toolbar">
          <button type="button" className="ghost" onClick={exportJson}>
            Export JSON
          </button>
          <button type="button" className="ghost" onClick={exportSvg}>
            Export SVG
          </button>
          <button type="button" className="ghost" disabled={busy} onClick={save}>
            Save
          </button>
          <button type="button" disabled={busy} onClick={revise}>
            Ask Thomas to revise
          </button>
        </div>
      </header>

      {conflictNotes.length > 0 && (
        <div className="conflicts">
          {conflictNotes.map((c) => (
            <p key={c}>{c}</p>
          ))}
        </div>
      )}

      <div className="design-grid">
        <label>
          Problem statement
          <textarea
            rows={3}
            value={map.problemStatement}
            onChange={(e) => setMap({ ...map, problemStatement: e.target.value })}
          />
        </label>
        <label>
          Solution type
          <input
            value={map.solutionType}
            onChange={(e) => setMap({ ...map, solutionType: e.target.value })}
          />
        </label>
        <label>
          Risk / MVP choice
          <input
            value={map.riskMvpChoice}
            onChange={(e) => setMap({ ...map, riskMvpChoice: e.target.value })}
          />
        </label>
        <label>
          Regulations (semicolon-separated)
          <input
            value={map.regulations.join("; ")}
            onChange={(e) =>
              setMap({
                ...map,
                regulations: e.target.value.split(";").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </label>
        <label className="wide">
          Ops cost summary
          <textarea
            rows={2}
            value={map.opsCostSummary}
            onChange={(e) => setMap({ ...map, opsCostSummary: e.target.value })}
          />
        </label>
        <label className="wide">
          Consolidations (one per line)
          <textarea
            rows={3}
            value={map.consolidations.join("\n")}
            onChange={(e) =>
              setMap({
                ...map,
                consolidations: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </label>
      </div>

      <section className="blocks">
        <h2>Architecture blocks</h2>
        <div className="block-row">
          {map.architectureBlocks.map((b, i) => (
            <article key={b.id}>
              <input
                value={b.name}
                onChange={(e) => {
                  const architectureBlocks = map.architectureBlocks.slice();
                  architectureBlocks[i] = { ...b, name: e.target.value };
                  setMap({ ...map, architectureBlocks });
                }}
              />
              <textarea
                rows={3}
                value={b.detail}
                onChange={(e) => {
                  const architectureBlocks = map.architectureBlocks.slice();
                  architectureBlocks[i] = { ...b, detail: e.target.value };
                  setMap({ ...map, architectureBlocks });
                }}
              />
            </article>
          ))}
        </div>
      </section>

      <section className="blocks">
        <h2>Stack decisions</h2>
        {map.stackDecisions.map((d) => (
          <label key={d.id} className="decision">
            <span>{d.label}</span>
            <input
              value={d.value}
              onChange={(e) => updateDecision("stackDecisions", d.id, e.target.value)}
            />
            {d.alternatives && (
              <small>Alternatives: {d.alternatives.join(" · ")}</small>
            )}
          </label>
        ))}
      </section>

      <section className="blocks">
        <h2>Major decisions</h2>
        {map.majorDecisions.map((d) => (
          <label key={d.id} className="decision">
            <span>{d.label}</span>
            <textarea
              rows={2}
              value={d.value}
              onChange={(e) => updateDecision("majorDecisions", d.id, e.target.value)}
            />
          </label>
        ))}
      </section>
    </div>
  );
}

function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
