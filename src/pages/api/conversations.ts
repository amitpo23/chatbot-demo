import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../lib/supabase";

/**
 * Admin endpoint to view conversation sessions and messages.
 * GET /api/conversations — list all sessions with message counts
 * GET /api/conversations?sessionId=xxx — get messages for a session
 * DELETE /api/conversations?sessionId=xxx — delete a session
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!supabase) {
    res.status(200).json({
      configured: false,
      message: "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      sessions: [],
    });
    return;
  }

  try {
    if (req.method === "GET") {
      const { sessionId } = req.query;

      if (sessionId) {
        const { data: messages, error } = await supabase
          .from("knowaa_messages")
          .select("content, speaker, created_at")
          .eq("session_id", sessionId as string)
          .order("created_at", { ascending: true })
          .limit(200);

        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }

        res.status(200).json({ configured: true, sessionId, messages: messages || [] });
        return;
      }

      // List all sessions via the summary view
      const { data: sessions, error } = await supabase
        .from("knowaa_session_summary")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({
        configured: true,
        sessions: sessions || [],
      });
      return;
    }

    if (req.method === "DELETE") {
      const { sessionId } = req.query;
      if (sessionId) {
        const { error } = await supabase
          .from("knowaa_sessions")
          .delete()
          .eq("id", sessionId as string);

        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }

        res.status(200).json({ success: true });
        return;
      }
      res.status(400).json({ error: "sessionId required for delete" });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({
      error: `Database error: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}
