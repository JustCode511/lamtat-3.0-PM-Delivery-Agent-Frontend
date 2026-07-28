import { useState, useRef, useEffect, useCallback } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import "./copilot-dark.css";
import "./ChatPanel.css";
import { MessageRenderer } from "./ChatPanel.jsx";

// The backend embeds {intent:xxx} at the start of every streamed reply
// so we can dispatch the right rich component without any extra state wiring.
function parseIntentPrefix(raw) {
  if (!raw) return { intent: "default", text: "" };
  const m = raw.match(/^\{intent:([^}]+)\}\n?([\s\S]*)/);
  if (m) return { intent: m[1].trim(), text: m[2] };
  return { intent: "default", text: raw };
}

// Custom Messages renderer — complete control over the message list
function PanelMessages({ messages, inProgress, accent }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, inProgress]);

  return (
    <div className="chat-scroll ck-scroll">
      {messages.map((msg, i) => {
        const key = msg.id || i;

        if (msg.role === "user") {
          const text =
            typeof msg.content === "string"
              ? msg.content
              : Array.isArray(msg.content)
              ? msg.content.filter((p) => p.type === "text").map((p) => p.text).join("")
              : "";
          return (
            <div key={key} className="msg-row user">
              <div className="user-bubble" style={{ background: accent, color: "#06222b" }}>
                {text}
              </div>
            </div>
          );
        }

        if (msg.role === "assistant") {
          const raw = typeof msg.content === "string" ? msg.content : "";
          const { intent, text } = parseIntentPrefix(raw);
          return (
            <div key={key} className="msg-row assistant">
              <div className="assistant-bubble">
                <div className="agent-avatar" style={{ background: accent + "22", color: accent }}>
                  AI
                </div>
                <div className="agent-content">
                  <MessageRenderer msg={{ text, ui_hint: intent }} />
                </div>
              </div>
            </div>
          );
        }

        return null;
      })}

      {inProgress && (
        <div className="msg-row assistant">
          <div className="assistant-bubble">
            <div className="agent-avatar" style={{ background: accent + "22", color: accent }}>
              AI
            </div>
            <div className="agent-content">
              <div className="thinking-indicator">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

// Inner panel — lives inside the CopilotKit provider
function CopilotPanelInner({ accent, greeting }) {
  const [fullscreen, setFullscreen] = useState(false);

  // Memoised with accent dependency so the Messages component is stable
  const Messages = useCallback(
    (props) => <PanelMessages {...props} accent={accent} />,
    [accent]
  );

  return (
    <div className={`chat-wrap${fullscreen ? " chat-fullscreen" : ""}`}>
      {/* Custom header — identical look to the existing ChatPanel */}
      <div className="chat-head">
        <span className="chat-dot" style={{ background: accent }} />
        <span className="chat-title">Agent Console</span>
        <div className="chat-head-right">
          <button
            className="chat-expand-btn"
            onClick={() => setFullscreen((f) => !f)}
            title={fullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
          >
            {fullscreen ? "⊠" : "⊞"}
          </button>
        </div>
      </div>

      {/* CopilotChat owns input + streaming + message state */}
      <CopilotChat
        Messages={Messages}
        className="ck-chat"
        labels={{
          initial: greeting,
          placeholder: "Ask about projects, risks, milestones, or create issues…",
        }}
      />
    </div>
  );
}

export default function CopilotPanel({ accent = "#22d3ee", greeting }) {
  const token =
    typeof localStorage !== "undefined" ? localStorage.getItem("token") || "" : "";

  return (
    <CopilotKit runtimeUrl="/copilotkit" headers={{ "X-API-Key": token }}>
      <CopilotPanelInner accent={accent} greeting={greeting} />
    </CopilotKit>
  );
}
