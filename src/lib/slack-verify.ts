import crypto from "crypto";

/**
 * Verifies the authenticity of a Slack request using the signing secret.
 * Uses crypto.timingSafeEqual to prevent timing attacks.
 */
const verifySlackSignature = ({
  signingSecret,
  timestamp,
  body,
  signature,
}: {
  signingSecret: string;
  timestamp: string;
  body: string;
  signature: string;
}): boolean => {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (Number.parseInt(timestamp, 10) < fiveMinutesAgo) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(sigBasestring, "utf8")
    .digest("hex")}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(mySignature, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
};

export { verifySlackSignature };
