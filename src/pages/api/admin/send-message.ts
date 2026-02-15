import type { NextApiRequest, NextApiResponse } from "next";
import * as Ably from "ably";
import { supabase } from "../../../lib/supabase";

const ably = new Ably.Realtime({ key: process.env.ABLY_API_KEY });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = req.headers["x-admin-secret"] as string;
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  if (!supabase) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const { sessionId, message } = req.body ?? {};

  if (
    !sessionId ||
    typeof sessionId !== "string" ||
    !message ||
    typeof message !== "string" ||
    message.trim().length === 0
  ) {
    return res.status(400).json({ error: "Missing sessionId or message" });
  }

  try {
    const { data: session, error: sessionError } = await supabase
      .from("knowaa_sessions")
      .select("user_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const { error: insertError } = await supabase
      .from("knowaa_messages")
      .insert({
        session_id: sessionId,
        speaker: "agent",
        content: message.trim(),
      });

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    await supabase
      .from("knowaa_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    const channel = ably.channels.get(session.user_id);
    channel.publish({
      data: {
        event: "agentMessage",
        message: message.trim(),
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({
      error: `Server error: ${error instanceof Error ? error.message : "Unknown"}`,
    });
  }
}
