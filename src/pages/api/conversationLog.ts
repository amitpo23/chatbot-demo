import { supabase } from "../../lib/supabase";

type ConversationLogEntry = {
  content: string;
  created_at: string;
  speaker: string;
};

class ConversationLog {
  private sessionId: string | null = null;

  constructor(
    public userId: string,
    public source: string = "web",
    public sourceMeta: Record<string, string> = {},
  ) {}

  /**
   * Get or create a session for this userId + source combination.
   * Web: one session per userId (userId is already per-tab-session).
   * Slack: one session per (channel_id, thread_ts) pair.
   */
  private async getOrCreateSession(): Promise<string | null> {
    if (this.sessionId) return this.sessionId;
    if (!supabase) return null;

    try {
      if (this.source === "slack") {
        const channelId = this.sourceMeta.channel_id || "";
        const threadTs = this.sourceMeta.thread_ts || "";

        const { data: existing } = await supabase
          .from("knowaa_sessions")
          .select("id")
          .eq("source", "slack")
          .contains("source_meta", { channel_id: channelId, thread_ts: threadTs })
          .limit(1)
          .single();

        if (existing) {
          this.sessionId = existing.id;
          await supabase
            .from("knowaa_sessions")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          return this.sessionId;
        }
      } else {
        const { data: existing } = await supabase
          .from("knowaa_sessions")
          .select("id")
          .eq("user_id", this.userId)
          .eq("source", this.source)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (existing) {
          this.sessionId = existing.id;
          await supabase
            .from("knowaa_sessions")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          return this.sessionId;
        }
      }

      // Create new session
      const { data: newSession, error } = await supabase
        .from("knowaa_sessions")
        .insert({
          user_id: this.userId,
          source: this.source,
          source_meta: this.sourceMeta,
        })
        .select("id")
        .single();

      if (error || !newSession) {
        console.error("Error creating session:", error);
        return null;
      }

      this.sessionId = newSession.id;
      return this.sessionId;
    } catch (e) {
      console.error("Error in getOrCreateSession:", e);
      return null;
    }
  }

  public async addEntry({ entry, speaker }: { entry: string; speaker: string }) {
    if (!supabase) return;
    try {
      const sessionId = await this.getOrCreateSession();
      if (!sessionId) return;

      await supabase.from("knowaa_messages").insert({
        session_id: sessionId,
        speaker,
        content: entry,
      });
    } catch (e) {
      console.error(`Error adding entry: ${e}`);
    }
  }

  public async getConversation({ limit }: { limit: number }): Promise<string[]> {
    if (!supabase) return [];
    try {
      const sessionId = await this.getOrCreateSession();
      if (!sessionId) return [];

      const { data, error } = await supabase
        .from("knowaa_messages")
        .select("content, speaker, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error || !data) return [];

      return (data as ConversationLogEntry[])
        .map((entry) => `${entry.speaker.toUpperCase()}: ${entry.content}`)
        .reverse();
    } catch (e) {
      console.error(`Error getting conversation: ${e}`);
      return [];
    }
  }

  public async clearConversation() {
    if (!supabase) return;
    try {
      const { data: sessions } = await supabase
        .from("knowaa_sessions")
        .select("id")
        .eq("user_id", this.userId);

      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map((s: { id: string }) => s.id);
        await supabase.from("knowaa_sessions").delete().in("id", sessionIds);
      }
    } catch (e) {
      console.error(`Error clearing conversation: ${e}`);
    }
  }
}

export { ConversationLog };
