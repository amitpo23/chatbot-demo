import Head from "next/head";
import { useState, useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { useChannel } from "@ably-labs/react-hooks";
import { Types } from "ably";

type ConversationEntry = {
  message: string;
  speaker: "bot" | "user" | "agent";
  date: Date;
  id?: string;
};

const updateChatbotMessage = (
  conversation: ConversationEntry[],
  message: Types.Message
): ConversationEntry[] => {
  const interactionId = message.data.interactionId;

  const updatedConversation = conversation.reduce(
    (acc: ConversationEntry[], e: ConversationEntry) => [
      ...acc,
      e.id === interactionId
        ? { ...e, message: e.message + message.data.token }
        : e,
    ],
    []
  );

  return conversation.some((e) => e.id === interactionId)
    ? updatedConversation
    : [
        ...updatedConversation,
        {
          id: interactionId,
          message: message.data.token,
          speaker: "bot" as const,
          date: new Date(),
        },
      ];
};

const WELCOME_MESSAGES = [
  "A client needs a last-minute hotel in Miami — how do I check availability?",
  "How do I modify or cancel an existing booking?",
  "My client has a complaint during their stay — what's the escalation process?",
  "How do I search and book hotels through your platform?",
];

export default function Home() {
  const [text, setText] = useState("");
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [botIsTyping, setBotIsTyping] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const userId = useMemo(() => {
    if (typeof window === "undefined") return "ssr-placeholder";
    const key = "knowaa-session-id";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = "knowaa-" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      sessionStorage.setItem(key, id);
    }
    return id;
  }, []);

  useChannel(userId, (message) => {
    switch (message.data.event) {
      case "response":
        setBotIsTyping(true);
        setConversation((state) => updateChatbotMessage(state, message));
        break;
      case "status":
        setStatusMessage(message.data.message);
        break;
      case "agentMessage":
        setConversation((state) => [
          ...state,
          {
            message: message.data.message,
            speaker: "agent" as const,
            date: new Date(),
          },
        ]);
        setBotIsTyping(false);
        setStatusMessage("");
        break;
      case "responseEnd":
      default:
        setBotIsTyping(false);
        setStatusMessage("");
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, botIsTyping]);

  const submit = async (overrideText?: string) => {
    const prompt = overrideText || text;
    if (!prompt.trim()) return;

    setConversation((state) => [
      ...state,
      { message: prompt, speaker: "user", date: new Date() },
    ]);
    setText("");
    setBotIsTyping(true);
    setStatusMessage("Searching knowledge base...");

    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, userId }),
      });
    } catch (error) {
      console.error("Error submitting message:", error);
      setBotIsTyping(false);
      setStatusMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const isEmpty = conversation.length === 0;

  return (
    <>
      <Head>
        <title>KNOWAA Global — Travel Partner Support</title>
        <meta
          name="description"
          content="KNOWAA Global Travel Network — B2B partner support assistant"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fjalla+One&family=Roboto:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div style={st.page}>
        {/* Header */}
        <header style={st.header}>
          <div style={st.headerInner}>
            <div
              role="button"
              tabIndex={0}
              style={st.logoRow}
              onClick={() => {
                setConversation([]);
                setBotIsTyping(false);
                setStatusMessage("");
                setText("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setConversation([]);
                  setBotIsTyping(false);
                  setStatusMessage("");
                  setText("");
                }
              }}
            >
              <img src="/knowaa-logo.png" alt="KNOWAA Global" style={st.logoImg} />
            </div>
            <div style={st.headerRight}>
              <span style={st.onlineBadge}>Online</span>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div style={st.chatArea}>
          <div style={st.chatInner}>
            {isEmpty ? (
              <div style={st.welcome}>
                <div style={st.welcomeIcon}>
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#7480e8"
                    strokeWidth="1.5"
                    aria-labelledby="chat-icon-title"
                  >
                    <title id="chat-icon-title">Chat</title>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h2 style={st.welcomeTitle}>How can I help you today?</h2>
                <p style={st.welcomeText}>
                  I&apos;m the KNOWAA Global travel assistant. I can help with
                  Miami &amp; Bahamas accommodations, experiences, partnerships,
                  and more.
                </p>
                <div style={st.suggestions}>
                  {WELCOME_MESSAGES.map((msg) => (
                    <button
                      key={msg}
                      type="button"
                      style={st.suggestionBtn}
                      onClick={() => submit(msg)}
                      onMouseEnter={(e) => {
                        const btn = e.currentTarget;
                        btn.style.borderColor = "#7480e8";
                        btn.style.backgroundColor = "#eef0fc";
                      }}
                      onMouseLeave={(e) => {
                        const btn = e.currentTarget;
                        btn.style.borderColor = "#e0e0e0";
                        btn.style.backgroundColor = "white";
                      }}
                    >
                      {msg}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={st.messages}>
                {conversation.map((entry, index) => (
                  <div
                    key={index}
                    style={
                      entry.speaker === "user"
                        ? st.messageRowUser
                        : st.messageRowBot
                    }
                  >
                    {entry.speaker === "bot" && (
                      <div style={st.avatar}>K</div>
                    )}
                    {entry.speaker === "agent" && (
                      <div style={st.avatarAgent}>A</div>
                    )}
                    <div
                      style={
                        entry.speaker === "user"
                          ? st.bubbleUser
                          : entry.speaker === "agent"
                          ? st.bubbleAgent
                          : st.bubbleBot
                      }
                    >
                      {entry.speaker === "agent" && (
                        <p style={st.agentLabel}>KNOWAA Agent</p>
                      )}
                      {entry.speaker === "user" ? (
                        <p style={{ margin: 0 }}>{entry.message}</p>
                      ) : (
                        <div className="markdown-body">
                          <ReactMarkdown>{entry.message}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {botIsTyping &&
                  conversation.length > 0 &&
                  conversation[conversation.length - 1]?.speaker !== "bot" && (
                    <div style={st.messageRowBot}>
                      <div style={st.avatar}>K</div>
                      <div style={st.bubbleBot}>
                        <div style={st.typingDots}>
                          <span style={st.dot} />
                          <span
                            style={{ ...st.dot, animationDelay: "0.2s" }}
                          />
                          <span
                            style={{ ...st.dot, animationDelay: "0.4s" }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                {statusMessage && (
                  <div style={st.statusBar}>{statusMessage}</div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div style={st.inputArea}>
          <div style={st.inputInner}>
            <div style={st.inputBox}>
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message..."
                rows={1}
                style={st.textarea}
                disabled={botIsTyping}
              />
              <button
                type="button"
                onClick={() => submit()}
                disabled={botIsTyping || !text.trim()}
                style={{
                  ...st.sendBtn,
                  opacity: botIsTyping || !text.trim() ? 0.4 : 1,
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  aria-labelledby="send-icon-title"
                >
                  <title id="send-icon-title">Send message</title>
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p style={st.disclaimer}>
              KNOWAA Global AI assistant. Responses are based on our knowledge
              base.
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          background: #f9fafb;
        }
        @keyframes bounce {
          0%,
          60%,
          100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-4px);
          }
        }
        .markdown-body p {
          margin: 0 0 8px 0;
        }
        .markdown-body p:last-child {
          margin: 0;
        }
        .markdown-body ul,
        .markdown-body ol {
          margin: 4px 0 8px 20px;
        }
        .markdown-body a {
          color: #2563eb;
          text-decoration: underline;
        }
        .markdown-body code {
          background: #f1f5f9;
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 0.85em;
        }
        .markdown-body pre {
          background: #f1f5f9;
          padding: 12px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 8px 0;
        }
        .markdown-body h1,
        .markdown-body h2,
        .markdown-body h3 {
          margin: 12px 0 6px;
        }
      `}</style>
    </>
  );
}

const st: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily: "'Roboto', 'Segoe UI', system-ui, sans-serif",
    color: "#1a1a2e",
  },
  header: {
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "white",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerInner: {
    maxWidth: 800,
    margin: "0 auto",
    padding: "10px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoRow: { display: "flex", alignItems: "center", gap: 12, cursor: "pointer" },
  logoImg: {
    height: 40,
    width: "auto",
  },
  headerRight: { display: "flex", alignItems: "center", gap: 8 },
  onlineBadge: {
    fontSize: 12,
    color: "#16a34a",
    fontWeight: 500,
    padding: "2px 8px",
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    border: "1px solid #bbf7d0",
  },
  chatArea: { flex: 1, overflow: "auto", backgroundColor: "#f9fafb" },
  chatInner: {
    maxWidth: 800,
    margin: "0 auto",
    padding: "20px 20px 0",
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
  },
  welcome: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as const,
    padding: "40px 20px",
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#eef0fc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 700,
    fontFamily: "'Fjalla One', sans-serif",
    color: "#7480e8",
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 15,
    color: "#6b7280",
    maxWidth: 400,
    lineHeight: "1.5",
    marginBottom: 28,
  },
  suggestions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    maxWidth: 520,
    width: "100%",
  },
  suggestionBtn: {
    padding: "14px 16px",
    border: "1px solid #e0e0e0",
    borderRadius: 12,
    backgroundColor: "white",
    cursor: "pointer",
    fontSize: 14,
    color: "#374151",
    textAlign: "left" as const,
    lineHeight: "1.4",
    transition: "all 0.15s",
  },
  messages: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    paddingBottom: 20,
  },
  messageRowUser: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "4px 0",
  },
  messageRowBot: {
    display: "flex",
    justifyContent: "flex-start",
    gap: 10,
    padding: "4px 0",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#7480e8",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
    marginTop: 2,
  },
  bubbleUser: {
    maxWidth: "75%",
    padding: "10px 16px",
    borderRadius: "18px 18px 4px 18px",
    backgroundColor: "#7480e8",
    color: "white",
    fontSize: 14,
    lineHeight: "1.5",
  },
  bubbleBot: {
    maxWidth: "80%",
    padding: "10px 16px",
    borderRadius: "18px 18px 18px 4px",
    backgroundColor: "white",
    border: "1px solid #e5e7eb",
    fontSize: 14,
    lineHeight: "1.5",
    color: "#1f2937",
  },
  avatarAgent: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#e65100",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
    marginTop: 2,
  },
  bubbleAgent: {
    maxWidth: "80%",
    padding: "10px 16px",
    borderRadius: "18px 18px 18px 4px",
    backgroundColor: "#fff3e0",
    border: "1px solid #ffcc80",
    fontSize: 14,
    lineHeight: "1.5",
    color: "#1f2937",
  },
  agentLabel: {
    margin: "0 0 4px 0",
    fontSize: 11,
    fontWeight: 700,
    color: "#e65100",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  typingDots: { display: "flex", gap: 4, padding: "4px 0" },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    backgroundColor: "#9ca3af",
    animation: "bounce 1.4s infinite ease-in-out",
  },
  statusBar: {
    textAlign: "center" as const,
    fontSize: 12,
    color: "#9ca3af",
    padding: "8px 0",
  },
  inputArea: {
    borderTop: "1px solid #e5e7eb",
    backgroundColor: "white",
    padding: "12px 0 16px",
  },
  inputInner: { maxWidth: 800, margin: "0 auto", padding: "0 20px" },
  inputBox: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    padding: "8px 8px 8px 16px",
    border: "1px solid #d1d5db",
    borderRadius: 16,
    backgroundColor: "#f9fafb",
  },
  textarea: {
    flex: 1,
    border: "none",
    outline: "none",
    resize: "none" as const,
    fontSize: 14,
    lineHeight: "1.5",
    backgroundColor: "transparent",
    fontFamily: "inherit",
    padding: "4px 0",
    minHeight: 24,
    maxHeight: 120,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#7480e8",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "opacity 0.15s",
  },
  disclaimer: {
    textAlign: "center" as const,
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 8,
  },
};
