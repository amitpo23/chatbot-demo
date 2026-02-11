import type { NextApiRequest, NextApiResponse } from "next";
import { verifySlackSignature } from "../../../lib/slack-verify";
import { isDuplicate } from "../../../lib/slack-dedup";

/**
 * Slack Events API handler.
 * Acknowledges events within 3 seconds and fires off async processing
 * to /api/slack/respond for RAG-based answers.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rawBody =
    typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  const timestamp = req.headers["x-slack-request-timestamp"] as string;
  const signature = req.headers["x-slack-signature"] as string;

  if (!process.env.SLACK_SIGNING_SECRET) {
    res.status(500).json({ error: "SLACK_SIGNING_SECRET not configured" });
    return;
  }

  const isValid = verifySlackSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    timestamp: timestamp || "",
    body: rawBody,
    signature: signature || "",
  });

  if (!isValid) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

  // Handle Slack URL verification challenge
  if (body.type === "url_verification") {
    res.status(200).json({ challenge: body.challenge });
    return;
  }

  // Handle event callbacks
  if (body.type === "event_callback") {
    const event = body.event;
    const eventId = body.event_id;

    // Deduplicate retried events
    if (isDuplicate(eventId)) {
      res.status(200).json({ ok: true });
      return;
    }

    // Ignore bot messages to avoid loops
    if (event.bot_id || event.subtype === "bot_message") {
      res.status(200).json({ ok: true });
      return;
    }

    // Handle app_mention and direct message events
    if (event.type === "app_mention" || event.type === "message") {
      const question = (event.text || "")
        .replace(/<@[A-Z0-9]+>/g, "")
        .trim();

      if (!question) {
        res.status(200).json({ ok: true });
        return;
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      // Fire and forget — don't await, so we ack within 3 seconds
      fetch(`${appUrl}/api/slack/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          channel_id: event.channel,
          thread_ts: event.thread_ts || event.ts,
          user_id: event.user,
        }),
      }).catch((err) => {
        console.error("Failed to trigger /api/slack/respond:", err);
      });
    }
  }

  res.status(200).json({ ok: true });
}
