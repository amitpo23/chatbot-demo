-- Supabase PostgreSQL schema for KNOWAA chatbot conversations

CREATE TABLE IF NOT EXISTS knowaa_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'web',
  source_meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowaa_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES knowaa_sessions(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL CHECK (speaker IN ('user', 'ai')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowaa_sessions_user_id ON knowaa_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_knowaa_sessions_source ON knowaa_sessions(source);
CREATE INDEX IF NOT EXISTS idx_knowaa_sessions_updated ON knowaa_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowaa_messages_session ON knowaa_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_knowaa_messages_created ON knowaa_messages(created_at);

-- View for admin dashboard
CREATE OR REPLACE VIEW knowaa_session_summary AS
SELECT
  s.id,
  s.user_id,
  s.source,
  s.source_meta,
  s.created_at,
  s.updated_at,
  COUNT(m.id)::int AS message_count
FROM knowaa_sessions s
LEFT JOIN knowaa_messages m ON m.session_id = s.id
GROUP BY s.id, s.user_id, s.source, s.source_meta, s.created_at, s.updated_at;

-- Enable RLS (service role bypasses it)
ALTER TABLE knowaa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowaa_messages ENABLE ROW LEVEL SECURITY;
