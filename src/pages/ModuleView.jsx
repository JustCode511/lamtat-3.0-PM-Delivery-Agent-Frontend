import { useParams, useNavigate, Navigate } from "react-router-dom";
import { MODULES } from "../modules.js";
import { useAuth } from "../context/AuthContext.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import PMDashboard from "../components/PMDashboard.jsx";

const ACCENT_HEX = { pm: "#22d3ee", talent: "#a78bfa", code: "#34d399", finops: "#fbbf24" };

// Up to two initials for the header avatar ("Parth Kansara" -> "PK", "chaithanya" -> "CH").
function initials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name).slice(0, 2).toUpperCase();
}

const GREETINGS = {
  pm:     "Hi — I'm your PM Delivery agent. Ask me about any project's status, risks, or how to resolve them. Try: \"What's at risk in AABGFY26?\"",
  talent: "Hi — I'm your Talent Management agent. Ask me about skills, capacity, and matching people to work.",
  code:   "Hi — I'm your Code Generation agent. Ask me to generate code, write docs, or run a first-pass review.",
  finops: "Hi — I'm your Cloud FinOps agent. Ask me about AWS costs, anomalies, or rightsizing.",
};

export default function ModuleView() {
  const { module } = useParams();
  const navigate   = useNavigate();
  const { user, signOut } = useAuth();
  const mod = MODULES[module];

  if (!mod) return <Navigate to="/" replace />;

  const accentHex = ACCENT_HEX[mod.id] || "#22d3ee";

  return (
    <div style={s.page}>
      {/* Glass header */}
      <header style={s.header} className="glass">
        <div style={s.left}>
          <button style={s.homeBtn} onClick={() => navigate("/")}>
            <span style={s.homeMark}>◆</span>
            <span>Home</span>
          </button>
          <span style={s.sep}>/</span>
          <span
            style={{ ...s.chip, color: accentHex, borderColor: accentHex + "45", background: accentHex + "10" }}
            className="mono"
          >
            {mod.code}
          </span>
          <span style={s.modName}>{mod.name}</span>
          {mod.id === "pm" && (
            <span className="live-dot" style={{ background: accentHex, marginLeft: 4 }} title="Live data" />
          )}
        </div>
        <div style={s.right}>
          <div style={s.userChip} title={user}>
            <div style={{ ...s.avatar, background: accentHex + "22", color: accentHex, border: `1px solid ${accentHex}55` }}>
              {initials(user)}
            </div>
            <span style={s.userLabel} className="mono">{user}</span>
          </div>
          <button className="btn-ghost" onClick={() => { signOut(); navigate("/login"); }}>
            Sign out
          </button>
        </div>
      </header>

      {/* Two-column body */}
      <div style={s.body}>
        <section style={s.dashCol}>
          {mod.hasProjects
            ? <PMDashboard accentHex={accentHex} />
            : <ComingSoon mod={mod} accentHex={accentHex} />}
        </section>
        <section style={s.chatCol}>
          <ChatPanel moduleId={mod.id} accent={accentHex} greeting={GREETINGS[mod.id]} />
        </section>
      </div>
    </div>
  );
}

function ComingSoon({ mod, accentHex }) {
  return (
    <div style={s.soon}>
      <div style={{ ...s.soonGlow, background: `radial-gradient(ellipse, ${accentHex}15 0%, transparent 70%)` }} />
      <span
        style={{ ...s.soonChip, color: accentHex, borderColor: accentHex + "45", background: accentHex + "10" }}
        className="mono"
      >
        {mod.code}
      </span>
      <h2 style={s.soonTitle}>{mod.name}</h2>
      <p style={s.soonDesc}>{mod.description}</p>
      <div style={s.soonNote}>
        The dashboard for this module is on the way.
        The <strong>chat on the right is live</strong> — try talking to the agent now.
      </div>
    </div>
  );
}

const s = {
  page: { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" },

  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 24px",
    borderBottom: "1px solid rgba(42,49,64,0.7)",
    flexShrink: 0, zIndex: 10,
  },
  left: { display: "flex", alignItems: "center", gap: "10px" },
  homeBtn: {
    display: "flex", alignItems: "center", gap: "7px",
    color: "var(--text-dim)", fontFamily: "var(--font-display)",
    fontWeight: 600, fontSize: "14px",
    transition: "color 0.15s",
    background: "none", border: "none", cursor: "pointer",
  },
  homeMark: {
    background: "linear-gradient(135deg, #22d3ee, #a78bfa)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    backgroundClip: "text", fontSize: "16px",
  },
  sep: { color: "var(--text-mute)", fontSize: "16px", fontWeight: 300 },
  chip: {
    fontSize: "11px", fontWeight: 700, border: "1px solid",
    borderRadius: "5px", padding: "2px 7px", letterSpacing: "0.05em",
  },
  modName: { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "14px", color: "var(--text)" },
  right: { display: "flex", alignItems: "center", gap: "12px" },
  userChip: { display: "flex", alignItems: "center", gap: "8px" },
  avatar: {
    width: "28px", height: "28px", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "11px", fontWeight: 800, fontFamily: "var(--font-display)",
    flexShrink: 0, letterSpacing: "0.02em",
  },
  userLabel: { fontSize: "12px", color: "var(--text-mute)" },

  body: {
    flex: 1, display: "grid",
    gridTemplateColumns: "1.85fr 1fr",
    gap: "14px", padding: "14px", minHeight: 0,
  },
  dashCol: {
    background: "rgba(22,27,38,0.8)",
    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(42,49,64,0.6)",
    borderRadius: "var(--radius-lg)",
    padding: "24px", minHeight: 0, overflow: "hidden",
    position: "relative",
  },
  chatCol: { minHeight: 0 },

  soon: {
    display: "flex", flexDirection: "column",
    height: "100%", justifyContent: "center",
    alignItems: "flex-start", maxWidth: "440px",
    position: "relative",
  },
  soonGlow: { position: "absolute", inset: "-40px", pointerEvents: "none", zIndex: 0 },
  soonChip: {
    fontSize: "12px", fontWeight: 700, border: "1px solid",
    borderRadius: "5px", padding: "3px 9px", marginBottom: "18px",
    position: "relative", zIndex: 1,
  },
  soonTitle: { fontSize: "26px", marginBottom: "10px", position: "relative", zIndex: 1 },
  soonDesc: {
    color: "var(--text-dim)", fontSize: "15px", lineHeight: 1.65,
    marginBottom: "22px", position: "relative", zIndex: 1,
  },
  soonNote: {
    background: "rgba(29,35,48,0.8)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "14px 16px",
    fontSize: "13px", color: "var(--text-mute)", lineHeight: 1.65,
    position: "relative", zIndex: 1,
  },
};
