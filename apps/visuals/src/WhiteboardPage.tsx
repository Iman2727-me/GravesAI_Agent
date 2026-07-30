import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { ProcessWhiteboard, WhiteboardNode } from "@thomas/shared";
import { api } from "./api";

export default function WhiteboardPage() {
  const { processId = "" } = useParams();
  const [board, setBoard] = useState<ProcessWhiteboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    api
      .getWhiteboard(processId)
      .then(setBoard)
      .catch((e) => setError((e as Error).message));
  }, [processId]);

  const selectedNode = useMemo(
    () => board?.nodes.find((n) => n.id === selected) ?? null,
    [board, selected],
  );

  function updateNode(id: string, patch: Partial<WhiteboardNode>) {
    if (!board) return;
    setBoard({
      ...board,
      nodes: board.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    });
  }

  function addNode() {
    if (!board) return;
    const id = `n${Date.now()}`;
    const node: WhiteboardNode = {
      id,
      label: "New piece",
      description: "",
      notes: "",
      status: "pending",
      x: 120 + board.nodes.length * 24,
      y: 200,
    };
    const edges = [...board.edges];
    if (board.nodes.length) {
      edges.push({
        id: `e${Date.now()}`,
        from: board.nodes[board.nodes.length - 1]!.id,
        to: id,
      });
    }
    setBoard({ ...board, nodes: [...board.nodes, node], edges });
    setSelected(id);
  }

  function removeSelected() {
    if (!board || !selected) return;
    setBoard({
      ...board,
      nodes: board.nodes.filter((n) => n.id !== selected),
      edges: board.edges.filter((e) => e.from !== selected && e.to !== selected),
    });
    setSelected(null);
  }

  async function save() {
    if (!board) return;
    setBusy(true);
    try {
      const next = await api.patchWhiteboard(processId, {
        title: board.title,
        nodes: board.nodes,
        edges: board.edges,
      });
      setBoard(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revise() {
    if (!board) return;
    setBusy(true);
    try {
      await api.reviseWhiteboard(processId, {
        title: board.title,
        nodes: board.nodes,
        edges: board.edges,
      });
      const next = await api.getWhiteboard(processId);
      setBoard(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragId || !board) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const loc = pt.matrixTransform(ctm.inverse());
    updateNode(dragId, { x: loc.x - 70, y: loc.y - 28 });
  }

  if (error) return <p className="error-banner">{error}</p>;
  if (!board) return <p className="loading">Loading whiteboard…</p>;

  return (
    <div className="visual-shell">
      <header className="visual-header">
        <div>
          <p className="eyebrow">Thomas · Process Whiteboard</p>
          <input
            className="title-input"
            value={board.title}
            onChange={(e) => setBoard({ ...board, title: e.target.value })}
          />
        </div>
        <div className="toolbar">
          <button type="button" onClick={addNode}>
            Add piece
          </button>
          <button type="button" className="ghost" disabled={!selected} onClick={removeSelected}>
            Remove
          </button>
          <button type="button" className="ghost" disabled={busy} onClick={save}>
            Save
          </button>
          <button type="button" disabled={busy} onClick={revise}>
            Ask Thomas to revise
          </button>
        </div>
      </header>

      <div className="board-layout">
        <svg
          className="canvas"
          viewBox="0 0 1000 520"
          onPointerMove={onPointerMove}
          onPointerUp={() => setDragId(null)}
          onPointerLeave={() => setDragId(null)}
        >
          {board.edges.map((e) => {
            const from = board.nodes.find((n) => n.id === e.from);
            const to = board.nodes.find((n) => n.id === e.to);
            if (!from || !to) return null;
            return (
              <line
                key={e.id}
                x1={from.x + 70}
                y1={from.y + 28}
                x2={to.x + 70}
                y2={to.y + 28}
                className="edge"
              />
            );
          })}
          {board.nodes.map((n) => (
            <g
              key={n.id}
              transform={`translate(${n.x}, ${n.y})`}
              className={`node ${selected === n.id ? "selected" : ""}`}
              onPointerDown={(ev) => {
                ev.currentTarget.setPointerCapture(ev.pointerId);
                setDragId(n.id);
                setSelected(n.id);
              }}
            >
              <rect width="140" height="56" rx="2" />
              <text x="12" y="24" className="node-label">
                {n.label.slice(0, 18)}
              </text>
              <text x="12" y="42" className="node-status">
                {n.status ?? "pending"}
              </text>
            </g>
          ))}
        </svg>

        <aside className="inspector">
          <h2>Piece</h2>
          {selectedNode ? (
            <div className="inspector-form">
              <label>
                Label
                <input
                  value={selectedNode.label}
                  onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                />
              </label>
              <label>
                Description
                <textarea
                  rows={3}
                  value={selectedNode.description ?? ""}
                  onChange={(e) =>
                    updateNode(selectedNode.id, { description: e.target.value })
                  }
                />
              </label>
              <label>
                Notes
                <textarea
                  rows={3}
                  value={selectedNode.notes ?? ""}
                  onChange={(e) => updateNode(selectedNode.id, { notes: e.target.value })}
                />
              </label>
              <label>
                Status
                <select
                  value={selectedNode.status ?? "pending"}
                  onChange={(e) =>
                    updateNode(selectedNode.id, {
                      status: e.target.value as WhiteboardNode["status"],
                    })
                  }
                >
                  <option value="pending">pending</option>
                  <option value="active">active</option>
                  <option value="done">done</option>
                </select>
              </label>
            </div>
          ) : (
            <p className="muted">Select a piece to edit.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
