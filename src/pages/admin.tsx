import { useState, useEffect, useCallback, useRef } from "react";
import type { GetServerSideProps } from "next";
import Head from "next/head";

type IndexStats = {
  totalVectorCount?: number;
  namespaces?: Record<string, { vectorCount: number }>;
};

type SkillInfo = {
  id: string;
  name: string;
  nameHe: string;
  description: string;
  triggerKeywords: string[];
  requiresBookingRef: boolean;
  escalationThreshold: string;
};

type AdminProps = {
  authorized: boolean;
};

export const getServerSideProps: GetServerSideProps<AdminProps> = async (
  context
) => {
  const secret = context.query.secret as string;
  const authorized = secret === process.env.ADMIN_SECRET;
  return { props: { authorized } };
};

export default function AdminPage({ authorized }: AdminProps) {
  // URL Ingestion
  const [url, setUrl] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [crawlStatus, setCrawlStatus] = useState("");

  // File Upload
  const [fileStatus, setFileStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Knowledge Base
  const [stats, setStats] = useState<IndexStats | null>(null);

  // Skills
  const [skillsList, setSkillsList] = useState<SkillInfo[]>([]);
  const [skillTestQuery, setSkillTestQuery] = useState("");
  const [detectedSkills, setDetectedSkills] = useState<
    { id: string; name: string; nameHe: string }[]
  >([]);

  // Test Chat
  const [testQuestion, setTestQuestion] = useState("");
  const [testAnswer, setTestAnswer] = useState("");
  const [testLoading, setTestLoading] = useState(false);

  // Quick Knowledge Add
  const [quickText, setQuickText] = useState("");
  const [quickSource, setQuickSource] = useState("");
  const [quickStatus, setQuickStatus] = useState("");

  // Conversations (session-based)
  const [sessions, setSessions] = useState<
    {
      id: string;
      user_id: string;
      source: string;
      source_meta: Record<string, string>;
      created_at: string;
      updated_at: string;
      message_count: number;
    }[]
  >([]);
  const [convDbConfigured, setConvDbConfigured] = useState(true);
  const [convDbMessage, setConvDbMessage] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedMessages, setSelectedMessages] = useState<
    { content: string; speaker: string; created_at: string }[]
  >([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [agentMessage, setAgentMessage] = useState("");
  const [agentSending, setAgentSending] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState("knowledge");

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/ingest/stats");
      const data = await res.json();
      setStats(data);
    } catch {
      setStats(null);
    }
  }, []);

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills");
      const data = await res.json();
      setSkillsList(data.skills || []);
    } catch {
      setSkillsList([]);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      setConvDbConfigured(data.configured !== false);
      setConvDbMessage(data.message || "");
      setSessions(data.sessions || []);
    } catch {
      setConvDbConfigured(false);
      setConvDbMessage("Failed to fetch conversations");
      setSessions([]);
    }
  }, []);

  const fetchSessionMessages = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setAgentMessage("");
    try {
      const res = await fetch(
        `/api/conversations?sessionId=${encodeURIComponent(sessionId)}`
      );
      const data = await res.json();
      setSelectedMessages(data.messages || []);
      setSelectedUserId(data.userId || "");
    } catch {
      setSelectedMessages([]);
      setSelectedUserId("");
    }
  };

  const clearSession = async (sessionId: string) => {
    if (!window.confirm("Delete this session and all its messages?")) return;
    await fetch(
      `/api/conversations?sessionId=${encodeURIComponent(sessionId)}`,
      { method: "DELETE" }
    );
    setSelectedSessionId("");
    setSelectedMessages([]);
    fetchConversations();
  };

  const sendAgentMessage = async () => {
    if (!agentMessage.trim() || !selectedSessionId || agentSending) return;
    setAgentSending(true);
    try {
      const secret =
        new URLSearchParams(window.location.search).get("secret") || "";
      const res = await fetch("/api/admin/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          message: agentMessage.trim(),
        }),
      });
      if (res.ok) {
        setSelectedMessages((prev) => [
          ...prev,
          {
            content: agentMessage.trim(),
            speaker: "agent",
            created_at: new Date().toISOString(),
          },
        ]);
        setAgentMessage("");
      }
    } catch (err) {
      console.error("Failed to send agent message:", err);
    }
    setAgentSending(false);
  };

  // Auto-refresh messages for selected session every 5s
  useEffect(() => {
    if (!selectedSessionId || activeTab !== "conversations") return;
    const interval = setInterval(() => {
      fetchSessionMessages(selectedSessionId);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedSessionId, activeTab]);

  useEffect(() => {
    if (authorized) {
      fetchStats();
      fetchSkills();
      fetchConversations();
    }
  }, [authorized, fetchStats, fetchSkills, fetchConversations]);

  if (!authorized) {
    return (
      <div style={styles.container}>
        <Head>
          <title>Admin — KNOWAA Global</title>
        </Head>
        <h1 style={styles.title}>Access Denied</h1>
        <p>Invalid or missing admin secret.</p>
      </div>
    );
  }

  const handleCrawlUrl = async () => {
    if (!url.trim()) return;
    setCrawlStatus("Crawling...");
    try {
      const res = await fetch(
        `/api/crawl?urls=${encodeURIComponent(url.trim())}&limit=100`
      );
      const data = await res.json();
      setCrawlStatus(`Done: ${data.message}`);
      setUrl("");
      fetchStats();
    } catch (err) {
      setCrawlStatus(`Error: ${err}`);
    }
  };

  const handleBulkCrawl = async () => {
    const urls = bulkUrls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) return;
    setCrawlStatus(`Crawling ${urls.length} URLs...`);
    try {
      const res = await fetch(
        `/api/crawl?urls=${encodeURIComponent(urls.join(","))}&limit=100`
      );
      const data = await res.json();
      setCrawlStatus(`Done: ${data.message}`);
      setBulkUrls("");
      fetchStats();
    } catch (err) {
      setCrawlStatus(`Error: ${err}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileStatus(`Uploading ${file.name}...`);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/ingest/file", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setFileStatus(
          `Ingested "${data.filename}" — ${data.chunks} chunks created`
        );
      } else {
        setFileStatus(`Error: ${data.error}`);
      }
      fetchStats();
    } catch (err) {
      setFileStatus(`Error: ${err}`);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClearAll = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete ALL vectors from the knowledge base? This cannot be undone."
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/ingest/stats", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchStats();
      }
    } catch (err) {
      console.error("Clear failed:", err);
    }
  };

  const handleQuickKnowledge = async () => {
    if (!quickText.trim()) return;
    setQuickStatus("Ingesting...");
    try {
      const blob = new Blob([quickText], { type: "text/plain" });
      const file = new File([blob], quickSource.trim() || "manual-entry.txt", {
        type: "text/plain",
      });
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ingest/file", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setQuickStatus(`Ingested — ${data.chunks} chunks created`);
        setQuickText("");
        setQuickSource("");
        fetchStats();
      } else {
        setQuickStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setQuickStatus(`Error: ${err}`);
    }
  };

  const handleSkillTest = async () => {
    if (!skillTestQuery.trim()) return;
    try {
      const res = await fetch(
        `/api/skills?q=${encodeURIComponent(skillTestQuery)}`
      );
      const data = await res.json();
      setDetectedSkills(data.detectedSkills || []);
    } catch {
      setDetectedSkills([]);
    }
  };

  const handleTestChat = async () => {
    if (!testQuestion.trim()) return;
    setTestLoading(true);
    setTestAnswer("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: testQuestion,
          userId: "admin-test",
        }),
      });
      const data = await res.json();
      setTestAnswer(
        data.message || "Response sent via Ably. Check the main chat UI."
      );
    } catch (err) {
      setTestAnswer(`Error: ${err}`);
    }
    setTestLoading(false);
  };

  const tabs = [
    { id: "knowledge", label: "Knowledge Base" },
    { id: "skills", label: `Skills (${skillsList.length})` },
    { id: "conversations", label: `Conversations (${sessions.length})` },
    { id: "test", label: "Test Chat" },
  ];

  return (
    <div style={styles.container}>
      <Head>
        <title>Admin — KNOWAA Global CS Bot</title>
      </Head>

      <h1 style={styles.title}>KNOWAA Global — Admin Dashboard</h1>

      {/* Tab Navigation */}
      <div style={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={
              activeTab === tab.id ? styles.tabActive : styles.tab
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* === KNOWLEDGE BASE TAB === */}
      {activeTab === "knowledge" && (
        <>
          {/* Stats Overview */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Knowledge Base Overview</h2>
            <div style={styles.statsRow}>
              <span style={styles.statBadge}>
                {stats?.totalVectorCount ?? "..."} vectors
              </span>
              <button
                type="button"
                onClick={fetchStats}
                style={styles.buttonSmall}
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                style={styles.buttonDanger}
              >
                Clear All
              </button>
            </div>
            {stats?.namespaces && (
              <div style={styles.namespacesBox}>
                {Object.entries(stats.namespaces).map(([ns, data]) => (
                  <div key={ns || "default"}>
                    <strong>{ns || "(default)"}</strong>: {data.vectorCount}{" "}
                    vectors
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Quick Knowledge Entry */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Quick Knowledge Entry</h2>
            <p style={styles.hint}>
              Paste text directly into the knowledge base (policies, FAQs,
              procedures, etc.)
            </p>
            <input
              type="text"
              placeholder="Source name (e.g., cancellation-policy.txt)"
              value={quickSource}
              onChange={(e) => setQuickSource(e.target.value)}
              style={{ ...styles.input, marginBottom: "0.5rem" }}
            />
            <textarea
              placeholder="Paste knowledge content here..."
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              rows={8}
              style={styles.textarea}
            />
            <button
              type="button"
              onClick={handleQuickKnowledge}
              style={styles.button}
            >
              Add to Knowledge Base
            </button>
            {quickStatus && <p style={styles.status}>{quickStatus}</p>}
          </section>

          {/* URL Ingestion */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>URL Ingestion</h2>
            <div style={styles.row}>
              <input
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={styles.input}
              />
              <button
                type="button"
                onClick={handleCrawlUrl}
                style={styles.button}
              >
                Crawl &amp; Ingest
              </button>
            </div>
            <textarea
              placeholder="Bulk URLs (one per line)"
              value={bulkUrls}
              onChange={(e) => setBulkUrls(e.target.value)}
              rows={4}
              style={styles.textarea}
            />
            <button
              type="button"
              onClick={handleBulkCrawl}
              style={styles.button}
            >
              Bulk Ingest
            </button>
            {crawlStatus && <p style={styles.status}>{crawlStatus}</p>}
          </section>

          {/* File Upload */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>File Upload</h2>
            <p style={styles.hint}>Accepted: .pdf, .docx, .txt, .md</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={handleFileUpload}
              style={styles.fileInput}
            />
            {fileStatus && <p style={styles.status}>{fileStatus}</p>}
          </section>
        </>
      )}

      {/* === SKILLS TAB === */}
      {activeTab === "skills" && (
        <>
          {/* Skill Tester */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Skill Detection Tester</h2>
            <p style={styles.hint}>
              Test which skills would activate for a given question
            </p>
            <div style={styles.row}>
              <input
                type="text"
                placeholder="Type a sample question..."
                value={skillTestQuery}
                onChange={(e) => setSkillTestQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSkillTest();
                }}
                style={styles.input}
              />
              <button
                type="button"
                onClick={handleSkillTest}
                style={styles.button}
              >
                Detect
              </button>
            </div>
            {detectedSkills.length > 0 && (
              <div style={styles.skillDetected}>
                <strong>Detected skills:</strong>
                <div style={styles.skillTagsRow}>
                  {detectedSkills.map((s) => (
                    <span key={s.id} style={styles.skillTag}>
                      {s.name} / {s.nameHe}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {detectedSkills.length === 0 && skillTestQuery && (
              <p style={styles.hint}>
                No skills detected. The bot will use general knowledge base
                context.
              </p>
            )}
          </section>

          {/* All Skills */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>
              All Active Skills ({skillsList.length})
            </h2>
            <div style={styles.skillsGrid}>
              {skillsList.map((skill) => (
                <div key={skill.id} style={styles.skillCard}>
                  <div style={styles.skillCardHeader}>
                    <strong>{skill.name}</strong>
                    <span style={styles.skillCardHe}>{skill.nameHe}</span>
                  </div>
                  <p style={styles.skillCardDesc}>{skill.description}</p>
                  <div style={styles.skillCardMeta}>
                    {skill.requiresBookingRef && (
                      <span style={styles.badgeBlue}>Needs Booking Ref</span>
                    )}
                    {skill.escalationThreshold === "always" && (
                      <span style={styles.badgeRed}>Always Escalates</span>
                    )}
                  </div>
                  <div style={styles.skillKeywords}>
                    {skill.triggerKeywords.map((kw) => (
                      <span key={kw} style={styles.keywordTag}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* === CONVERSATIONS TAB === */}
      {activeTab === "conversations" && (
        <>
          {!convDbConfigured ? (
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>Conversations</h2>
              <p style={styles.hint}>
                {convDbMessage || "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."}
              </p>
            </section>
          ) : (
            <>
              <section style={styles.section}>
                <div style={styles.statsRow}>
                  <h2 style={styles.sectionTitle}>Chat Sessions</h2>
                  <button
                    type="button"
                    onClick={fetchConversations}
                    style={styles.buttonSmall}
                  >
                    Refresh
                  </button>
                </div>
                {sessions.length === 0 ? (
                  <p style={styles.hint}>No conversations yet.</p>
                ) : (
                  <div style={{ marginTop: "0.5rem" }}>
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        style={{
                          ...styles.convUserRow,
                          backgroundColor:
                            selectedSessionId === session.id
                              ? "#eef0fc"
                              : "#fff",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            fetchSessionMessages(session.id)
                          }
                          style={styles.convUserBtn}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span style={{
                              padding: "0.1rem 0.4rem",
                              backgroundColor: session.source === "slack" ? "#4A154B" : "#7480e8",
                              color: "white",
                              borderRadius: 3,
                              fontSize: "0.7rem",
                              fontWeight: 600,
                            }}>
                              {session.source}
                            </span>
                            <strong style={{ fontSize: "0.85rem" }}>
                              {session.user_id.length > 24
                                ? session.user_id.substring(0, 24) + "..."
                                : session.user_id}
                            </strong>
                          </span>
                          <span style={styles.convUserMeta}>
                            {session.message_count} messages | Last:{" "}
                            {new Date(session.updated_at).toLocaleString()}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => clearSession(session.id)}
                          style={styles.buttonDanger}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {selectedSessionId && (
                <section style={styles.section}>
                  <h2 style={styles.sectionTitle}>
                    Session Messages
                  </h2>
                  {selectedMessages.length === 0 ? (
                    <p style={styles.hint}>No messages found.</p>
                  ) : (
                    <div style={styles.convMessages}>
                      {selectedMessages.map((msg, i) => (
                        <div
                          key={i}
                          style={
                            msg.speaker === "user"
                              ? styles.convMsgUser
                              : msg.speaker === "agent"
                              ? styles.convMsgAgent
                              : styles.convMsgBot
                          }
                        >
                          <div style={styles.convMsgHeader}>
                            <strong>
                              {msg.speaker === "user"
                                ? "User"
                                : msg.speaker === "agent"
                                ? "Agent"
                                : "Bot"}
                            </strong>
                            <span style={styles.convMsgTime}>
                              {new Date(
                                msg.created_at
                              ).toLocaleString()}
                            </span>
                          </div>
                          <p style={{ margin: 0, whiteSpace: "pre-wrap" as const }}>
                            {msg.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={styles.agentInputArea}>
                    <div style={styles.row}>
                      <input
                        type="text"
                        placeholder="Type a message as agent..."
                        value={agentMessage}
                        onChange={(e) => setAgentMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") sendAgentMessage();
                        }}
                        style={styles.input}
                        disabled={agentSending}
                      />
                      <button
                        type="button"
                        onClick={sendAgentMessage}
                        disabled={agentSending || !agentMessage.trim()}
                        style={{
                          ...styles.buttonAgent,
                          opacity: agentSending || !agentMessage.trim() ? 0.5 : 1,
                        }}
                      >
                        {agentSending ? "Sending..." : "Send as Agent"}
                      </button>
                    </div>
                    {selectedUserId && (
                      <p style={styles.hint}>
                        Replying to channel: {selectedUserId}
                      </p>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {/* === TEST CHAT TAB === */}
      {activeTab === "test" && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Test Chat</h2>
          <p style={styles.hint}>
            Note: The existing chat uses Ably for streaming. The response will be
            sent via Ably to the &quot;admin-test&quot; channel.
          </p>
          <div style={styles.row}>
            <input
              type="text"
              placeholder="Ask a test question..."
              value={testQuestion}
              onChange={(e) => setTestQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTestChat();
              }}
              style={styles.input}
            />
            <button
              type="button"
              onClick={handleTestChat}
              disabled={testLoading}
              style={styles.button}
            >
              {testLoading ? "Thinking..." : "Send"}
            </button>
          </div>
          {testAnswer && <p style={styles.answer}>{testAnswer}</p>}
        </section>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "2rem",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: "#1a1a2e",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: 700,
    marginBottom: "1rem",
    borderBottom: "2px solid #e0e0e0",
    paddingBottom: "0.5rem",
  },
  tabBar: {
    display: "flex",
    gap: "0.25rem",
    marginBottom: "1.5rem",
    borderBottom: "2px solid #e0e0e0",
    paddingBottom: 0,
  },
  tab: {
    padding: "0.6rem 1.2rem",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "0.95rem",
    color: "#666",
    borderBottom: "2px solid transparent",
    marginBottom: "-2px",
  },
  tabActive: {
    padding: "0.6rem 1.2rem",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "0.95rem",
    color: "#7480e8",
    fontWeight: 600,
    borderBottom: "2px solid #7480e8",
    marginBottom: "-2px",
  },
  section: {
    marginBottom: "1.5rem",
    padding: "1.5rem",
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    border: "1px solid #e0e0e0",
  },
  sectionTitle: {
    fontSize: "1.15rem",
    fontWeight: 600,
    marginBottom: "0.75rem",
    color: "#7480e8",
  },
  row: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "0.75rem",
  },
  input: {
    flex: 1,
    padding: "0.5rem 0.75rem",
    border: "1px solid #ccc",
    borderRadius: 4,
    fontSize: "0.95rem",
  },
  textarea: {
    width: "100%",
    padding: "0.5rem 0.75rem",
    border: "1px solid #ccc",
    borderRadius: 4,
    fontSize: "0.95rem",
    marginBottom: "0.5rem",
    resize: "vertical" as const,
    boxSizing: "border-box" as const,
  },
  button: {
    padding: "0.5rem 1rem",
    backgroundColor: "#7480e8",
    color: "white",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: "0.95rem",
    whiteSpace: "nowrap" as const,
  },
  buttonSmall: {
    padding: "0.3rem 0.75rem",
    backgroundColor: "#7480e8",
    color: "white",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  buttonDanger: {
    padding: "0.3rem 0.75rem",
    backgroundColor: "#c62828",
    color: "white",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  fileInput: {
    marginBottom: "0.5rem",
  },
  hint: {
    fontSize: "0.85rem",
    color: "#666",
    marginBottom: "0.5rem",
  },
  status: {
    marginTop: "0.5rem",
    padding: "0.5rem",
    backgroundColor: "#e8f5e9",
    borderRadius: 4,
    fontSize: "0.9rem",
  },
  statBadge: {
    padding: "0.3rem 0.75rem",
    backgroundColor: "#7480e8",
    color: "white",
    borderRadius: 12,
    fontSize: "0.9rem",
    fontWeight: 600,
  },
  statsRow: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  namespacesBox: {
    marginTop: "0.75rem",
    padding: "0.5rem",
    backgroundColor: "#fff",
    borderRadius: 4,
    border: "1px solid #e0e0e0",
    fontSize: "0.9rem",
  },
  answer: {
    marginTop: "0.5rem",
    padding: "0.75rem",
    backgroundColor: "#fff",
    borderRadius: 4,
    border: "1px solid #e0e0e0",
    whiteSpace: "pre-wrap" as const,
  },
  // Skills styles
  skillsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.75rem",
  },
  skillCard: {
    padding: "0.75rem",
    backgroundColor: "#fff",
    borderRadius: 6,
    border: "1px solid #e0e0e0",
  },
  skillCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.25rem",
  },
  skillCardHe: {
    fontSize: "0.85rem",
    color: "#888",
    direction: "rtl" as const,
  },
  skillCardDesc: {
    fontSize: "0.85rem",
    color: "#555",
    marginBottom: "0.4rem",
  },
  skillCardMeta: {
    display: "flex",
    gap: "0.3rem",
    marginBottom: "0.4rem",
  },
  badgeBlue: {
    padding: "0.15rem 0.4rem",
    backgroundColor: "#e3f2fd",
    color: "#1565c0",
    borderRadius: 3,
    fontSize: "0.75rem",
  },
  badgeRed: {
    padding: "0.15rem 0.4rem",
    backgroundColor: "#fce4ec",
    color: "#c62828",
    borderRadius: 3,
    fontSize: "0.75rem",
  },
  skillKeywords: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.2rem",
  },
  keywordTag: {
    padding: "0.1rem 0.35rem",
    backgroundColor: "#f0f0f0",
    borderRadius: 3,
    fontSize: "0.7rem",
    color: "#666",
  },
  skillDetected: {
    padding: "0.5rem",
    backgroundColor: "#e8f5e9",
    borderRadius: 4,
    marginTop: "0.5rem",
  },
  skillTagsRow: {
    display: "flex",
    gap: "0.4rem",
    marginTop: "0.3rem",
    flexWrap: "wrap" as const,
  },
  skillTag: {
    padding: "0.2rem 0.5rem",
    backgroundColor: "#7480e8",
    color: "white",
    borderRadius: 4,
    fontSize: "0.8rem",
  },
  // Conversations styles
  convUserRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.5rem 0.75rem",
    borderRadius: 6,
    border: "1px solid #e0e0e0",
    marginBottom: "0.4rem",
  },
  convUserBtn: {
    flex: 1,
    background: "none",
    border: "none",
    cursor: "pointer",
    textAlign: "left" as const,
    padding: 0,
    fontSize: "0.9rem",
  },
  convUserMeta: {
    display: "block",
    fontSize: "0.78rem",
    color: "#888",
    marginTop: "0.15rem",
  },
  convMessages: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
    maxHeight: 500,
    overflowY: "auto" as const,
  },
  convMsgUser: {
    padding: "0.5rem 0.75rem",
    backgroundColor: "#eef0fc",
    borderRadius: 6,
    border: "1px solid #d0d5f7",
  },
  convMsgBot: {
    padding: "0.5rem 0.75rem",
    backgroundColor: "#fff",
    borderRadius: 6,
    border: "1px solid #e0e0e0",
  },
  convMsgAgent: {
    padding: "0.5rem 0.75rem",
    backgroundColor: "#fff3e0",
    borderRadius: 6,
    border: "1px solid #ffcc80",
  },
  convMsgHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "0.3rem",
    fontSize: "0.8rem",
  },
  convMsgTime: {
    color: "#999",
    fontSize: "0.75rem",
  },
  agentInputArea: {
    marginTop: "0.75rem",
    padding: "0.75rem",
    backgroundColor: "#fff",
    borderRadius: 6,
    border: "1px solid #e0e0e0",
  },
  buttonAgent: {
    padding: "0.5rem 1rem",
    backgroundColor: "#e65100",
    color: "white",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: "0.95rem",
    whiteSpace: "nowrap" as const,
  },
};
