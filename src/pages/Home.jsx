import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { MODULE_LIST } from "../modules.js";
import { alpha } from "../utils/color.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

const MODULE_NUM  = ["01", "02", "03", "04"];

export default function Home() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
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
          <span style={s.userLabel} className="mono">{user}</span>
          <ThemeToggle />
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
                { label: "PM",      color: "var(--signal)" },
                { label: "Talent",  color: "var(--talent)" },
                { label: "Code",    color: "var(--ok)" },
                { label: "FinOps",  color: "var(--warn)" },
              ].map(a => (
                <span key={a.label} style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                  color: a.color, background: alpha(a.color, 9),
                  border: `1px solid ${alpha(a.color, 25)}`,
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
            const accent  = m.accent || "var(--signal)";
            const isHover = hovered === m.id;
            return (
              <button
                key={m.id}
                style={{
                  ...s.card,
                  borderColor: isHover ? alpha(accent, 33) : "color-mix(in srgb, var(--border) 80%, transparent)",
                  boxShadow: isHover
                    ? `0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px ${alpha(accent, 21)}, 0 0 60px ${alpha(accent, 6)}`
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
                    ? `linear-gradient(90deg, ${accent}, ${alpha(accent, 38)}, transparent)`
                    : `linear-gradient(90deg, ${alpha(accent, 33)}, transparent)`,
                  transition: "background 0.25s ease",
                  borderRadius: "20px 20px 0 0",
                }} />

                <div style={s.inner}>
                  {/* Card header row */}
                  <div style={s.cardTop}>
                    <span style={{ ...s.num, color: alpha(accent, 44) }} className="mono">
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
                          borderColor: alpha(accent, 27),
                          background: alpha(accent, 7),
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
    background: "radial-gradient(ellipse, color-mix(in srgb, var(--signal) 8%, transparent) 0%, transparent 70%)",
    pointerEvents: "none", zIndex: 0,
  },
  glowB: {
    position: "fixed", bottom: "-25%", right: "-5%",
    width: "50vw", height: "55vh",
    background: "radial-gradient(ellipse, color-mix(in srgb, var(--talent) 8%, transparent) 0%, transparent 70%)",
    pointerEvents: "none", zIndex: 0,
  },
  header: {
    position: "sticky", top: 0, zIndex: 10,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 32px",
    borderBottom: "1px solid color-mix(in srgb, var(--border) 70%, transparent)",
  },
  brand: { display: "flex", alignItems: "center", gap: "10px" },
  mark: {
    fontSize: "18px",
    background: "linear-gradient(135deg, var(--signal), var(--talent))",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  brandName: {
    fontFamily: "var(--font-display)", fontWeight: 700,
    fontSize: "14px", letterSpacing: "0.03em", color: "var(--text-dim)",
  },
  headerRight: { display: "flex", alignItems: "center", gap: "14px" },
  userLabel: { fontSize: "12px", color: "var(--text-mute)" },
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
    color: "rgba(var(--overlay-rgb), 0.55)",
    background: "rgba(var(--overlay-rgb), 0.04)",
    border: "1px solid rgba(var(--overlay-rgb), 0.09)",
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
    background: "color-mix(in srgb, var(--surface) 90%, transparent)",
    border: "1px solid color-mix(in srgb, var(--border) 80%, transparent)",
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
