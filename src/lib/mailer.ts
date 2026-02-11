import nodemailer from "nodemailer";

type EscalationEmail = {
  question: string;
  context?: string;
  source: "slack" | "web" | "admin";
  userId?: string;
  channelId?: string;
  threadTs?: string;
  detectedSkills?: string[];
};

/**
 * Creates a nodemailer transporter configured for Gmail.
 * Uses App Password authentication (not OAuth).
 */
const createTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

/**
 * Sends an escalation email when the bot cannot answer a question.
 */
const sendEscalationEmail = async (data: EscalationEmail): Promise<boolean> => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn("Gmail not configured — skipping escalation email");
    return false;
  }

  const recipients =
    process.env.ESCALATION_EMAILS || process.env.GMAIL_USER;

  const sourceLabel =
    data.source === "slack"
      ? "Slack"
      : data.source === "web"
        ? "Web Chat"
        : "Admin";

  const skillsLine =
    data.detectedSkills && data.detectedSkills.length > 0
      ? `Detected Skills: ${data.detectedSkills.join(", ")}`
      : "No specific skills detected";

  const subject = `[KNOWAA Global Bot] Escalation — ${sourceLabel}`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #7480e8; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">KNOWAA Global — Escalation</h2>
      </div>
      <div style="padding: 24px; background: #f8f9fa; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #555; width: 120px;">Source:</td>
            <td style="padding: 8px 0;">${sourceLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #555;">User ID:</td>
            <td style="padding: 8px 0;">${data.userId || "Unknown"}</td>
          </tr>
          ${data.channelId ? `<tr><td style="padding: 8px 0; font-weight: 600; color: #555;">Slack Channel:</td><td style="padding: 8px 0;">${data.channelId}</td></tr>` : ""}
          ${data.threadTs ? `<tr><td style="padding: 8px 0; font-weight: 600; color: #555;">Thread:</td><td style="padding: 8px 0;">${data.threadTs}</td></tr>` : ""}
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #555;">Skills:</td>
            <td style="padding: 8px 0;">${skillsLine}</td>
          </tr>
        </table>

        <div style="margin-top: 16px; padding: 16px; background: white; border-radius: 6px; border: 1px solid #e0e0e0;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #7480e8;">Customer Question:</h3>
          <p style="margin: 0; font-size: 15px; line-height: 1.5;">${data.question}</p>
        </div>

        ${data.context ? `<div style="margin-top: 12px; padding: 16px; background: white; border-radius: 6px; border: 1px solid #e0e0e0;"><h3 style="margin: 0 0 8px 0; font-size: 14px; color: #888;">KB Context Found:</h3><p style="margin: 0; font-size: 13px; color: #666; line-height: 1.4;">${data.context.substring(0, 500)}${data.context.length > 500 ? "..." : ""}</p></div>` : ""}

        <p style="margin-top: 20px; font-size: 13px; color: #888;">
          This is an automated escalation from the KNOWAA Global CS Bot.
          The bot could not answer this question from the knowledge base.
        </p>
      </div>
    </div>
  `;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"KNOWAA Global Bot" <${process.env.GMAIL_USER}>`,
      to: recipients,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("Failed to send escalation email:", error);
    return false;
  }
};

/**
 * Sends a general notification email (for admin use).
 */
const sendNotificationEmail = async ({
  to,
  subject,
  body,
}: {
  to?: string;
  subject: string;
  body: string;
}): Promise<boolean> => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn("Gmail not configured — skipping notification email");
    return false;
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"KNOWAA Global Bot" <${process.env.GMAIL_USER}>`,
      to: to || process.env.ESCALATION_EMAILS || process.env.GMAIL_USER,
      subject,
      html: body,
    });
    return true;
  } catch (error) {
    console.error("Failed to send notification email:", error);
    return false;
  }
};

export { sendEscalationEmail, sendNotificationEmail };
export type { EscalationEmail };
