"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { API_BASE } from "../../lib/constants";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "I am Janus. Ask me anything about the system — cycle decisions, agent scores, active constraints, or portfolio performance.",
};

export default function AgentChatDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const historyBeforeNewMessage = [...messages];

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          history: historyBeforeNewMessage,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error fetching response. Try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* Toggle button — matches sidebar nav icon style */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.background = "#161B22";
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.background = "transparent";
        }}
        style={{
          position: "fixed",
          bottom: 24,
          left: 8,
          zIndex: 100,
          width: 36,
          height: 36,
          borderRadius: 6,
          background: isOpen ? "#161B22" : "transparent",
          border: isOpen ? "1px solid #2D2415" : "1px solid transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
        }}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            stroke="#C9A84C"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </button>

      {/* Chat popup */}
      <div
        style={{
          position: "fixed",
          bottom: 64,
          left: 16,
          zIndex: 99,
          width: 320,
          height: 400,
          display: "flex",
          flexDirection: "column",
          background: "rgba(13, 17, 23, 0.95)",
          border: "1px solid #1C2128",
          borderRadius: 6,
          backdropFilter: "blur(8px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          transform: isOpen ? "translateY(0)" : "translateY(10px)",
          opacity: isOpen ? 1 : 0,
          transition: "transform 0.2s ease, opacity 0.2s ease",
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid #1C2128",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                fontWeight: 600,
                color: "#C9A84C",
              }}
            >
              JANUS
            </span>
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 11,
                color: "#4B5563",
              }}
            >
              {" · System Intelligence"}
            </span>
          </div>
          <button
            onClick={() => setMessages([INITIAL_MESSAGE])}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#8B949E"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#4B5563"; }}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: "#4B5563",
              padding: 0,
            }}
          >
            CLEAR
          </button>
        </div>

        {/* Messages area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {messages.map((msg, i) =>
            msg.role === "user" ? (
              <div
                key={i}
                style={{
                  alignSelf: "flex-end",
                  background: "#0F2A1A",
                  border: "1px solid #238636",
                  color: "#E6EDF3",
                  borderRadius: "3px 3px 0 3px",
                  padding: "6px 10px",
                  maxWidth: "85%",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {msg.content}
              </div>
            ) : (
              <div
                key={i}
                style={{
                  alignSelf: "flex-start",
                  background: "#0D1117",
                  border: "1px solid #1C2128",
                  color: "#E6EDF3",
                  borderRadius: "3px 3px 3px 0",
                  padding: "6px 10px",
                  maxWidth: "85%",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p style={{ margin: "0 0 6px 0", lineHeight: 1.5 }}>{children}</p>,
                    strong: ({ children }) => <strong style={{ color: "#C9A84C", fontWeight: 600 }}>{children}</strong>,
                    ol: ({ children }) => <ol style={{ paddingLeft: 16, margin: "4px 0" }}>{children}</ol>,
                    ul: ({ children }) => <ul style={{ paddingLeft: 16, margin: "4px 0" }}>{children}</ul>,
                    li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                    code: ({ children }) => <code style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#3FB950", background: "#0A1A0A", padding: "1px 4px", borderRadius: 2 }}>{children}</code>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            )
          )}

          {isLoading && (
            <div
              style={{
                alignSelf: "flex-start",
                color: "#4B5563",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                animation: "janus-pulse 2s ease-in-out infinite",
              }}
            >
              JANUS IS THINKING...
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            padding: 8,
            borderTop: "1px solid #1C2128",
            flexShrink: 0,
            display: "flex",
            gap: 6,
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Ask about cycles, agents..."
            style={{
              flex: 1,
              background: "#080A0C",
              border: "1px solid #1C2128",
              color: "#E6EDF3",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              padding: "6px 8px",
              borderRadius: 3,
              outline: "none",
              height: 30,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#C9A84C"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#1C2128"; }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            style={{
              background: "#130F00",
              border: "1px solid #C9A84C",
              color: "#C9A84C",
              padding: "0 10px",
              height: 30,
              borderRadius: 3,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              textTransform: "uppercase",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoading) e.currentTarget.style.background = "#1F1800";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#130F00";
            }}
          >
            SEND
          </button>
        </div>
      </div>
    </>
  );
}
