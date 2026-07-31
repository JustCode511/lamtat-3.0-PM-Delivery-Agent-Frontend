import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { MODULE_LIST } from "../modules.js";

const ACCENT_HEX = { pm: "#A100FF", talent: "#c84bff", code: "#34d399", finops: "#f97316" };
const MODULE_NUM  = ["01", "02", "03", "04"];

// Up to two initials for the header avatar ("Parth Kansara" -> "PK", "chaithanya" -> "CH").
function initials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name).slice(0, 2).toUpperCase();
}

export default function Home() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const [hovered, setHovered] = useState(null);

  return (
    <div style={s.page}>
      {/* Ambient glows */}
      <div style={s.glowA} />
      <div style={s.glowB} />

      {/* Glass header */}
      <header style={s.header} className="glass">
        <div style={s.brand}>
          <span style={s.mark}>◆</span>
          <span style={s.brandName}>AI Delivery Intelligence</span>
        </div>
        <div style={s.headerRight}>
          <button onClick={toggleTheme} style={s.themeBtn} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <div style={s.userChip} title={user}>
            <div style={s.avatar}>{initials(user)}</div>
            <span style={s.userLabel} className="mono">{user}</span>
          </div>
          <button className="btn-ghost" onClick={() => { signOut(); navigate("/login"); }}>
            Sign out
          </button>
        </div>
      </header>

      <main style={s.main}>
        {/* Hero */}
        <div style={s.hero} className="fade-up">
          <div style={s.eyebrowRow}>
            <span style={s.eyebrowDot} />
            <p style={s.eyebrow} className="mono">AI DELIVERY INTELLIGENCE</p>
          </div>
          <h1 style={s.h1}>
            Every project.<br />
            <span className="text-gradient">Every risk. One answer.</span>
          </h1>
          <div style={s.lede}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {[
                { label: "PM",      color: "#A100FF" },
                { label: "Talent",  color: "#c84bff" },
                { label: "Code",    color: "#34d399" },
                { label: "FinOps",  color: "#f97316" },
              ].map(a => (
                <span key={a.label} style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                  color: a.color, background: a.color + "18",
                  border: `1px solid ${a.color}40`,
                  borderRadius: 6, padding: "3px 9px",
                  fontFamily: "var(--font-display)",
                }}>{a.label}</span>
              ))}
              <span style={{ color: "var(--text-dim)", fontSize: 14 }}>— four AI agents, one command center.</span>
            </div>
            <div style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: 1.65 }}>
              Ask anything in natural language and get answers backed by live data.
            </div>
          </div>
          <div style={s.chips}>
            {[
              { icon: "⚡", label: "Live Jira data" },
              { icon: "💬", label: "Natural language" },
              { icon: "📊", label: "Instant reports" },
              { icon: "⚠️", label: "Risk detection" },
              { icon: "📁", label: "PPT export" },
            ].map(c => (
              <span key={c.label} style={s.chip2}>
                <span style={{ fontSize: 13 }}>{c.icon}</span>
                {c.label}
              </span>
            ))}
          </div>
        </div>

        {/* Module cards */}
        <div style={s.grid}>
          {MODULE_LIST.map((m, i) => {
            const accent  = ACCENT_HEX[m.id] || "#22d3ee";
            const isHover = hovered === m.id;
            return (
              <button
                key={m.id}
                style={{
                  ...s.card,
                  borderColor: isHover ? accent + "55" : undefined,
                  boxShadow: isHover
                    ? `0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px ${accent}35, 0 0 60px ${accent}10`
                    : s.card.boxShadow,
                  transform: isHover ? "translateY(-5px) scale(1.01)" : "none",
                }}
                onClick={() => navigate(`/module/${m.id}`)}
                onMouseEnter={() => setHovered(m.id)}
                onMouseLeave={() => setHovered(null)}
                className={`fade-up-${i + 1}`}
              >
                {/* Accent top stripe */}
                <div style={{
                  height: "3px",
                  background: isHover
                    ? `linear-gradient(90deg, ${accent}, ${accent}60, transparent)`
                    : `linear-gradient(90deg, ${accent}55, transparent)`,
                  transition: "background 0.25s ease",
                  borderRadius: "20px 20px 0 0",
                }} />

                <div style={s.inner}>
                  {/* Card header row */}
                  <div style={s.cardTop}>
                    <span style={{ ...s.num, color: accent + "70" }} className="mono">
                      {MODULE_NUM[i]}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      {m.id === "pm" && (
                        <span className="live-dot" style={{ background: accent }} />
                      )}
                      <span
                        style={{
                          ...s.chip,
                          color: accent,
                          borderColor: accent + "45",
                          background: accent + "12",
                        }}
                        className="mono"
                      >
                        {m.code}
                      </span>
                    </div>
                  </div>

                  <h3 style={s.title}>{m.name}</h3>
                  <p style={s.tagline}>{m.tagline}</p>
                  <p style={s.desc}>{m.description}</p>

                  {/* Footer CTA */}
                  <div style={s.foot}>
                    {m.hasProjects ? (
                      <span style={{ ...s.openLabel, color: accent }}>
                        Open module
                        <span style={{
                          display: "inline-block",
                          marginLeft: 5,
                          transform: isHover ? "translateX(5px)" : "none",
                          transition: "transform 0.2s ease",
                        }}>
                          →
                        </span>
                      </span>
                    ) : (
                      <span style={s.soonBadge}>Coming soon</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", position: "relative", overflow: "hidden" },
  glowA: {
    position: "fixed", top: "-30%", left: "-8%",
    width: "60vw", height: "65vh",
    background: "radial-gradient(ellipse, rgba(161,0,255,0.08) 0%, transparent 70%)",
    pointerEvents: "none", zIndex: 0,
  },
  glowB: {
    position: "fixed", bottom: "-25%", right: "-5%",
    width: "50vw", height: "55vh",
    background: "radial-gradient(ellipse, rgba(200,75,255,0.08) 0%, transparent 70%)",
    pointerEvents: "none", zIndex: 0,
  },
  header: {
    position: "sticky", top: 0, zIndex: 10,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 32px",
    borderBottom: "1px solid rgba(42,49,64,0.7)",
  },
  brand: { display: "flex", alignItems: "center", gap: "10px" },
  mark: {
    fontSize: "18px",
    background: "linear-gradient(135deg, #A100FF, #c84bff)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  brandName: {
    fontFamily: "var(--font-display)", fontWeight: 700,
    fontSize: "14px", letterSpacing: "0.03em", color: "var(--text-dim)",
  },
  headerRight: { display: "flex", alignItems: "center", gap: "14px" },
  userLabel: { fontSize: "12px", color: "var(--text-mute)" },
  userChip: { display: "flex", alignItems: "center", gap: "8px" },
  avatar: {
    width: "28px", height: "28px", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "11px", fontWeight: 800, fontFamily: "var(--font-display)",
    flexShrink: 0, letterSpacing: "0.02em",
    background: "#A100FF22", color: "#A100FF", border: "1px solid #A100FF55",
  },
  themeBtn: { fontSize: 16, background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius)", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-dim)", transition: "all 0.15s" },
  main: {
    position: "relative", zIndex: 1,
    maxWidth: "1080px", margin: "0 auto", padding: "72px 32px 56px",
  },
  hero: { marginBottom: "56px" },
  eyebrowRow: {
    display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px",
  },
  eyebrowDot: {
    width: "6px", height: "6px", borderRadius: "50%",
    background: "var(--signal)",
    boxShadow: "0 0 8px var(--signal)",
    flexShrink: 0,
    animation: "livePulse 2s ease-in-out infinite",
  },
  eyebrow: {
    fontSize: "11px", color: "var(--signal)", letterSpacing: "0.18em",
    opacity: 0.9, margin: 0,
  },
  h1: {
    fontSize: "60px", fontFamily: "var(--font-display)", fontWeight: 700,
    lineHeight: 1.04, letterSpacing: "-0.03em", marginBottom: "22px",
  },
  lede: {
    color: "var(--text-dim)", fontSize: "16px", maxWidth: "520px",
    lineHeight: 1.75, marginBottom: "28px",
  },
  chips: {
    display: "flex", flexWrap: "wrap", gap: "10px",
  },
  chip2: {
    display: "inline-flex", alignItems: "center", gap: "6px",
    fontSize: "12px", fontWeight: 600,
    color: "var(--text-dim)",
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: "20px",
    padding: "5px 12px",
    letterSpacing: "0.02em",
    backdropFilter: "blur(4px)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  card: {
    textAlign: "left",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    cursor: "pointer",
    display: "flex", flexDirection: "column", overflow: "hidden",
    transition: "transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease",
    boxShadow: "0 2px 16px rgba(0,0,0,0.35)",
    backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  },
  inner: { padding: "20px 22px 22px", display: "flex", flexDirection: "column", flex: 1 },
  cardTop: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: "16px",
  },
  num: { fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em" },
  chip: {
    fontSize: "11px", fontWeight: 700, border: "1px solid",
    borderRadius: "5px", padding: "2px 8px", letterSpacing: "0.05em",
  },
  title: {
    fontSize: "18px", fontFamily: "var(--font-display)", fontWeight: 700,
    letterSpacing: "-0.01em", marginBottom: "4px", color: "var(--text)",
  },
  tagline: { color: "var(--text-dim)", fontSize: "13px", marginBottom: "12px", lineHeight: 1.45 },
  desc: { color: "var(--text-mute)", fontSize: "13px", lineHeight: 1.65, marginBottom: "22px", flex: 1 },
  foot: { marginTop: "auto" },
  openLabel: { fontSize: "13px", fontWeight: 700, display: "inline-flex", alignItems: "center" },
  soonBadge: {
    fontSize: "10px", fontWeight: 700, color: "var(--text-mute)",
    background: "var(--surface-2)", border: "1px solid var(--border)",
    borderRadius: "4px", padding: "3px 8px",
    textTransform: "uppercase", letterSpacing: "0.06em",
  },
};
