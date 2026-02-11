import type { NextApiRequest, NextApiResponse } from "next";
import * as pg from "pg";
import { Sequelize } from "sequelize-cockroachdb";

/**
 * Admin endpoint to view conversation history.
 * GET /api/conversations — list all conversations (grouped by user)
 * GET /api/conversations?userId=xxx — get conversation for specific user
 * DELETE /api/conversations?userId=xxx — clear conversation for specific user
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!process.env.DATABASE_URL) {
    res.status(200).json({
      configured: false,
      message: "DATABASE_URL not configured. Conversation history requires CockroachDB.",
      conversations: [],
    });
    return;
  }

  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    logging: false,
    dialectModule: pg,
  });

  try {
    if (req.method === "GET") {
      const { userId } = req.query;

      if (userId) {
        const result = await sequelize.query(
          `SELECT entry, speaker, created_at FROM conversations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
          { bind: [userId] }
        );
        res.status(200).json({
          configured: true,
          userId,
          messages: result[0],
        });
        return;
      }

      // List all unique users with their message counts and last activity
      const result = await sequelize.query(
        `SELECT user_id, COUNT(*) as message_count, MAX(created_at) as last_active
         FROM conversations
         GROUP BY user_id
         ORDER BY last_active DESC
         LIMIT 50`
      );
      res.status(200).json({
        configured: true,
        users: result[0],
      });
      return;
    }

    if (req.method === "DELETE") {
      const { userId } = req.query;
      if (userId) {
        await sequelize.query(
          `DELETE FROM conversations WHERE user_id = $1`,
          { bind: [userId] }
        );
        res.status(200).json({ success: true });
        return;
      }
      res.status(400).json({ error: "userId required for delete" });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(200).json({
      configured: false,
      message: `Database error: ${error instanceof Error ? error.message : "Unknown error"}`,
      conversations: [],
    });
  } finally {
    await sequelize.close();
  }
}
