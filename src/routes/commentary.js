import { Router } from "express";
import { createCommentarySchema } from "../validation/commentary.js";
import { matchIdParamSchema } from "../validation/matches.js";
import { commentary } from "../db/schema.js";
import { db } from "../db/db.js";

const MAX_LIMIT = 100;

export const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.get("/", async (req, res) => {
  const paramsResult = matchIdParamSchema.safeParse(req.params);

  if (!paramsResult.success) {
    return res.status(400).json({
      error: "Invalid match ID",
      details: paramsResult.error.issues,
    });
  }

  const queryResult = listCommentaryQuerySchema.safeParse(req.query);

  if (!queryResult.success) {
    return res.status(400).json({
      error: "Invalid query parameters",
      details: queryResult.error.issues,
    });
  }

  try {
    const { id: matchId } = paramsResult.data;
    const { limit = 10 } = queryResult.data;

    const safeLimit = Math.min(limit, MAX_LIMIT);

    const results = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, matchId))
      .orderBy(desc(commentary.createdAt))
      .limit(safeLimit);

    res.status(200).json({ data: results });
  } catch (e) {
    console.error("Failed to get commentary", e);
    res.status(500).json({ error: "Failed to get commentary" });
  }
});

commentaryRouter.post("/", async (req, res) => {
  // Validate match ID param
  const paramsResult = matchIdParamSchema.safeParse(req.params);

  if (!paramsResult.success) {
    return res.status(400).json({
      error: "Invalid match ID",
      details: paramsResult.error.issues,
    });
  }

  // Validate request body
  const bodyResult = createCommentarySchema.safeParse(req.body);
  if (!bodyResult.success) {
    return res.status(400).json({
      error: "Invalid commentary payload",
      details: bodyResult.error.issues,
    });
  }

  try {
    const { minute, ...rest } = bodyResult.data;
    const [result] = await db
      .insert(commentary)
      .values({
        matchId: paramsResult.data.id,
        minute,
        ...rest,
      })
      .returning();

    if (res.app.locals.broadcastCommentary) {
      res.app.locals.broadcastCommentary(result.matchId, result);
    }

    return res.status(201).json({ data: result });
  } catch (err) {
    console.error("Failed to create commentary", err);
    return res.status(500).json({ error: "Failed to create commentary" });
  }
});
