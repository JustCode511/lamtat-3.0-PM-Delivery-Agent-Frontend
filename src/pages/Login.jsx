import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { login, register } from "../api/client.js";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!username || !password) { setError("Enter a username and password."); return; }
    setBusy(true);
    try {
      const fn = mode === "login" ? login : register;
      const data = await fn(username, password);
      signIn(data.token || "session", data.username || username);
      navigate("/");
    } catch (err) {
      const status = err?.status;
      if (mode === "login") {
        // Login only validates credentials — never surface the registration policy here.
        setError(status === 401 || status === 422
          ? "Invalid username or password."
          : "Something went wrong. Please try again.");
      } else {
        if (status === 409) setError("That username is already taken.");
        else if (status === 422) setError("Your password should be at least 6 characters, and username at least 3.");
        else setError("Could not create account.");
      }
    } finally {
      setBusy(false);
    }
  }

  function focusBorder(e)  { e.target.style.borderColor = "rgba(34,211,238,0.55)"; e.target.style.boxShadow = "0 0 0 3px rgba(34,211,238,0.08)"; }
  function blurBorder(e)   { e.target.style.borderColor = "rgba(58,67,86,0.7)";    e.target.style.boxShadow = "none"; }

  return (
    <div style={s.page}>
      {/* Ambient radial glows */}
      <div style={s.glowA} />
      <div style={s.glowB} />

      {/* Glass card */}
      <div style={s.card} className="fade-up">
        {/* Brand */}
        <div style={s.brand}>
          <span style={s.mark}>◆</span>
          <span style={s.brandName}>AI Delivery Intelligence</span>
        </div>

        {/* Hero text */}
        <div style={s.hero}>
          <h1 style={s.title}>
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p style={s.sub}>AI-powered project delivery intelligence.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Username</label>
            <input
              style={s.input}
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="your.name"
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input
              style={s.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {error && (
            <div style={s.error} className="fade-up">
              <span style={s.errorIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </span>
              <span style={s.errorText}>{error}</span>
            </div>
          )}

          <button style={{ ...s.btn, opacity: busy ? 0.6 : 1 }} type="submit" disabled={busy}>
            {busy ? "Authenticating…" : mode === "login" ? "Sign in →" : "Create account →"}
          </button>
        </form>

        <div style={s.switchRow}>
          <span>{mode === "login" ? "No account?" : "Have an account?"}</span>
          {" "}
          <button
            style={s.switchBtn}
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
              setUsername("");
              setPassword("");
            }}
          >
            {mode === "login" ? "Create one" : "Sign in"}
          </button>
        </div>
      </div>

      <div style={s.footWrap}>
        <p style={s.footnote} className="mono">Project Delivery Intelligence, powered by AI</p>
        <p style={s.footMeta} className="mono">Accenture × AWS · AABG-FY26</p>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "20px",
    padding: "24px",
    position: "relative",
    overflow: "hidden",
  },
  glowA: {
    position: "fixed", top: "-25%", left: "-15%",
    width: "65vw", height: "65vh",
    background: "radial-gradient(ellipse, rgba(34,211,238,0.1) 0%, transparent 70%)",
    pointerEvents: "none", zIndex: 0,
  },
  glowB: {
    position: "fixed", bottom: "-25%", right: "-10%",
    width: "55vw", height: "55vh",
    background: "radial-gradient(ellipse, rgba(167,139,250,0.1) 0%, transparent 70%)",
    pointerEvents: "none", zIndex: 0,
  },
  card: {
    position: "relative", zIndex: 1,
    width: "100%", maxWidth: "420px",
    background: "rgba(22,27,38,0.85)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: "1px solid rgba(58,67,86,0.7)",
    borderRadius: "20px",
    padding: "40px 36px",
    boxShadow: "0 8px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.06)",
  },
  brand: {
    display: "flex", alignItems: "center", gap: "10px",
    marginBottom: "32px",
  },
  mark: {
    fontSize: "20px",
    background: "linear-gradient(135deg, #22d3ee, #a78bfa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  brandName: {
    fontFamily: "var(--font-display)", fontWeight: 700,
    fontSize: "14px", letterSpacing: "0.03em", color: "var(--text-dim)",
  },
  hero: { marginBottom: "28px" },
  title: {
    fontSize: "32px", fontFamily: "var(--font-display)", fontWeight: 700,
    marginBottom: "6px", letterSpacing: "-0.02em",
    background: "linear-gradient(135deg, #e6edf3 20%, #9aa5b4 100%)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  sub: { fontSize: "14px", color: "var(--text-mute)", lineHeight: 1.5 },
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  field: { display: "flex", flexDirection: "column", gap: "7px" },
  label: {
    fontSize: "11px", fontWeight: 700, color: "var(--text-mute)",
    letterSpacing: "0.06em", textTransform: "uppercase",
  },
  input: {
    background: "rgba(13,17,23,0.8)",
    border: "1px solid rgba(58,67,86,0.7)",
    borderRadius: "8px",
    padding: "12px 14px",
    outline: "none",
    fontSize: "14px",
    color: "var(--text)",
    fontFamily: "var(--font-body)",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  error: {
    display: "flex", alignItems: "flex-start", gap: "10px",
    background: "rgba(248,113,113,0.09)",
    border: "1px solid rgba(248,113,113,0.28)",
    borderRadius: "10px",
    padding: "11px 13px",
  },
  errorIcon: {
    flexShrink: 0, marginTop: "1px",
    color: "#f87171", display: "flex", alignItems: "center",
  },
  errorText: {
    flex: 1, fontSize: "13px", lineHeight: 1.5,
    color: "#fca5a5", fontWeight: 500,
  },
  btn: {
    background: "linear-gradient(135deg, #22d3ee 0%, #0ea5e9 100%)",
    color: "#06222b", fontWeight: 700,
    padding: "13px", borderRadius: "8px",
    fontSize: "14px", fontFamily: "var(--font-body)",
    cursor: "pointer", border: "none", marginTop: "4px",
    letterSpacing: "0.01em",
    boxShadow: "0 4px 20px rgba(34,211,238,0.25)",
    transition: "filter 0.15s, transform 0.07s",
  },
  switchRow: {
    marginTop: "22px", fontSize: "13px",
    color: "var(--text-mute)", textAlign: "center",
  },
  switchBtn: {
    color: "var(--signal)", fontWeight: 600,
    background: "none", border: "none", cursor: "pointer",
    fontFamily: "var(--font-body)", fontSize: "13px",
  },
  footWrap: {
    position: "relative", zIndex: 1,
    display: "flex", flexDirection: "column", alignItems: "center", gap: "5px",
  },
  footnote: {
    fontSize: "11px", color: "var(--text-mute)", textAlign: "center",
  },
  footMeta: {
    fontSize: "10px", color: "var(--text-mute)", opacity: 0.65,
    letterSpacing: "0.09em", textAlign: "center",
  },
};
