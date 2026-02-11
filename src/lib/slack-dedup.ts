/**
 * Simple in-memory event deduplication for Slack event retries.
 * Tracks event IDs for 5 minutes to prevent duplicate processing.
 */
const seen = new Map<string, number>();

const EXPIRY_MS = 5 * 60 * 1000;

const isDuplicate = (eventId: string): boolean => {
  const now = Date.now();

  // Clean expired entries
  seen.forEach((timestamp, key) => {
    if (now - timestamp > EXPIRY_MS) {
      seen.delete(key);
    }
  });

  if (seen.has(eventId)) {
    return true;
  }

  seen.set(eventId, now);
  return false;
};

export { isDuplicate };
