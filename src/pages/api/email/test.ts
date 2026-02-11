import type { NextApiRequest, NextApiResponse } from "next";
import { sendNotificationEmail } from "../../../lib/mailer";

/**
 * Tests the Gmail configuration by sending a test email.
 * POST /api/email/test — sends a test email
 * GET /api/email/test — returns current email config status (no secrets)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    res.status(200).json({
      gmailConfigured: Boolean(
        process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
      ),
      gmailUser: process.env.GMAIL_USER
        ? `${process.env.GMAIL_USER.substring(0, 3)}***`
        : null,
      escalationEmails: process.env.ESCALATION_EMAILS || process.env.GMAIL_USER || null,
    });
    return;
  }

  if (req.method === "POST") {
    const { to } = req.body || {};

    const success = await sendNotificationEmail({
      to,
      subject: "[Medici CS Bot] Test Email",
      body: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #7480e8;">Email Configuration Test</h2>
          <p>This is a test email from the KNOWAA Global Bot admin dashboard.</p>
          <p>If you received this email, your Gmail integration is working correctly.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 16px 0;" />
          <p style="font-size: 13px; color: #888;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
    });

    if (success) {
      res.status(200).json({ success: true, message: "Test email sent" });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to send. Check GMAIL_USER and GMAIL_APP_PASSWORD env vars.",
      });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
