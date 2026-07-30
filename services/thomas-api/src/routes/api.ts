import { Router } from "express";
import type { PipelineService } from "../pipeline/pipeline.js";
import type { Adapters } from "../adapters/index.js";
import { env } from "../config.js";

export function createSessionRouter(pipeline: PipelineService, adapters: Adapters) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      name: "thomas-api",
      mode: env.mode,
      message: "Thomas is standing by, sir.",
    });
  });

  router.post("/sessions", async (req, res) => {
    try {
      const idea = String(req.body?.idea ?? "").trim();
      if (!idea) {
        res.status(400).json({ error: "idea is required" });
        return;
      }
      const uploadIds = Array.isArray(req.body?.uploadIds) ? req.body.uploadIds.map(String) : [];
      const session = await pipeline.createSession(idea, uploadIds);
      res.status(201).json(session);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get("/sessions", async (_req, res) => {
    const sessions = await adapters.store.listSessions();
    res.json(sessions);
  });

  router.get("/sessions/:id", async (req, res) => {
    const session = await pipeline.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(session);
  });

  router.post("/sessions/:id/answers", async (req, res) => {
    try {
      const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
      const session = await pipeline.answer(req.params.id, answers);
      res.json(session);
    } catch (e) {
      const msg = (e as Error).message;
      res.status(msg === "Session not found" ? 404 : 500).json({ error: msg });
    }
  });

  router.post("/sessions/:id/advance", async (req, res) => {
    try {
      const session = await pipeline.advance(req.params.id);
      res.json(session);
    } catch (e) {
      const msg = (e as Error).message;
      res.status(msg === "Session not found" ? 404 : 500).json({ error: msg });
    }
  });

  router.get("/processes/whiteboard/:processId", async (req, res) => {
    const board = await adapters.store.getWhiteboard(req.params.processId);
    if (!board) {
      res.status(404).json({ error: "Whiteboard not found" });
      return;
    }
    res.json(board);
  });

  router.patch("/processes/whiteboard/:processId", async (req, res) => {
    const board = await adapters.store.getWhiteboard(req.params.processId);
    if (!board) {
      res.status(404).json({ error: "Whiteboard not found" });
      return;
    }
    const next = {
      ...board,
      title: req.body?.title ?? board.title,
      nodes: req.body?.nodes ?? board.nodes,
      edges: req.body?.edges ?? board.edges,
      updatedAt: new Date().toISOString(),
    };
    await adapters.store.saveWhiteboard(next);
    res.json(next);
  });

  router.post("/processes/whiteboard/:processId/revise", async (req, res) => {
    try {
      if (req.body?.nodes || req.body?.edges || req.body?.title) {
        const board = await adapters.store.getWhiteboard(req.params.processId);
        if (!board) {
          res.status(404).json({ error: "Whiteboard not found" });
          return;
        }
        await adapters.store.saveWhiteboard({
          ...board,
          title: req.body.title ?? board.title,
          nodes: req.body.nodes ?? board.nodes,
          edges: req.body.edges ?? board.edges,
          updatedAt: new Date().toISOString(),
        });
      }
      const session = await pipeline.reviseFromWhiteboard(req.params.processId);
      res.json(session);
    } catch (e) {
      res.status(404).json({ error: (e as Error).message });
    }
  });

  router.get("/processes/design/:processId", async (req, res) => {
    const map = await adapters.store.getDesignMap(req.params.processId);
    if (!map) {
      res.status(404).json({ error: "Design map not found" });
      return;
    }
    res.json(map);
  });

  router.patch("/processes/design/:processId", async (req, res) => {
    const map = await adapters.store.getDesignMap(req.params.processId);
    if (!map) {
      res.status(404).json({ error: "Design map not found" });
      return;
    }
    const next = {
      ...map,
      ...req.body,
      processId: map.processId,
      sessionId: map.sessionId,
      updatedAt: new Date().toISOString(),
    };
    await adapters.store.saveDesignMap(next);
    res.json(next);
  });

  router.post("/processes/design/:processId/revise", async (req, res) => {
    try {
      if (req.body && Object.keys(req.body).length) {
        const map = await adapters.store.getDesignMap(req.params.processId);
        if (!map) {
          res.status(404).json({ error: "Design map not found" });
          return;
        }
        await adapters.store.saveDesignMap({
          ...map,
          ...req.body,
          processId: map.processId,
          sessionId: map.sessionId,
          updatedAt: new Date().toISOString(),
        });
      }
      const session = await pipeline.reviseFromDesignMap(req.params.processId);
      res.json(session);
    } catch (e) {
      res.status(404).json({ error: (e as Error).message });
    }
  });

  return router;
}
