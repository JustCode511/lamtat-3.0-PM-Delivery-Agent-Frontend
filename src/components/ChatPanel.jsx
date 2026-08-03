import { useState, useRef, useEffect, useCallback, useId } from "react";
import { streamChat, chatWithPolling, sendToLeadership, getConversations, getConversation, deleteConversation } from "../api/client.js";
import "./ChatPanel.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// Mermaid is lazy-loaded on first chart render to keep the initial bundle small
let _mermaidModule = null;
async function getMermaid() {
  if (!_mermaidModule) {
    _mermaidModule = import("mermaid").then(({ default: m }) => m);
  }
  return _mermaidModule;
}

// Base config applied on every render. Charts render on a clean WHITE card
// (see .mermaid-wrap), so text is near-black for strong contrast and the slice
// palette is bright & fully opaque (Mermaid's default 0.7 opacity washes it out).
const _INK = "#0f172a";       // near-black text
const _AXIS = "#475569";      // axis/line grey (still dark enough on white)
const _BASE_THEME_VARS = {
  background: "#ffffff",
  primaryColor: "#22d3ee",
  primaryTextColor: _INK,
  primaryBorderColor: "#0f172a",
  lineColor: _AXIS,
  secondaryColor: "#e2e8f0",
  tertiaryColor: "#f1f5f9",
  fontSize: "14px",
  // Bright, saturated slice palette
  pie1: "#06b6d4", pie2: "#8b5cf6", pie3: "#10b981",
  pie4: "#f97316", pie5: "#ef4444", pie6: "#f59e0b",
  pie7: "#3b82f6", pie8: "#ec4899",
  pieOpacity: "1",
  // Pie text → black, not grey; crisp dark slice borders
  pieTitleTextSize: "18px", pieTitleTextColor: _INK,
  pieSectionTextSize: "15px", pieSectionTextColor: "#ffffff",
  pieLegendTextSize: "14px", pieLegendTextColor: _INK,
  pieStrokeColor: "#0f172a", pieStrokeWidth: "2px",
  pieOuterStrokeColor: "#0f172a", pieOuterStrokeWidth: "2px",
  // Bar charts (xychart) — dark labels on the white card
  xyChart: {
    backgroundColor: "transparent",
    titleColor: _INK,
    xAxisLabelColor: _INK, xAxisTitleColor: _AXIS, xAxisTickColor: _AXIS, xAxisLineColor: _AXIS,
    yAxisLabelColor: _INK, yAxisTitleColor: _AXIS, yAxisTickColor: _AXIS, yAxisLineColor: _AXIS,
  },
};

// Colors cycled through for each xychart rendered in this session
const _XY_COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#f97316", "#f87171", "#fb923c", "#60a5fa"];
let _xyColorIdx = 0;

// Serialise all mermaid renders so m.initialize() + m.render() pairs never interleave
let _renderQueue = Promise.resolve();

// Strip half-unit decimal tick labels (0.5, 1.5 …) from xychart SVG output
function _fixIntegerTicks(svgStr) {
  return svgStr.replace(/(<text[^>]*>)\s*\d+\.5\s*(<\/text>)/g, "$1$2");
}

// ═══════════════════════════════════════════════════════════════════════
// PARSING UTILITIES
// ═══════════════════════════════════════════════════════════════════════

function clean(str) { return (str || "").replace(/[*_`]/g, "").trim(); }

// Compact relative time for the history sidebar ("just now", "5m ago", …)
// Personalised, time-of-day greeting shown on a fresh chat (Claude/ChatGPT style).
function buildGreeting(username) {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const name = username ? ` ${username}` : "";
  const openers = [
    "What can I help you deliver today?",
    "Which project should we dig into?",
    "Status, risks, or a leadership report — where do we start?",
    "Ready when you are. What would you like to look at?",
    "How can I help move your projects forward today?",
  ];
  const opener = openers[Math.floor(Math.random() * openers.length)];
  return `**${part}${name}** 👋\n\n${opener}`;
}

// Group conversations into recency buckets for the sidebar (newest first within each).
const RECENCY_ORDER = ["Recents", "Last week", "Last month", "Older"];
function groupByRecency(convos) {
  const now = Date.now();
  const DAY = 86400000;
  const buckets = { "Recents": [], "Last week": [], "Last month": [], "Older": [] };
  for (const c of convos) {
    const t = c.updated_at ? new Date(c.updated_at).getTime() : 0;
    const age = now - t;
    if (age < DAY) buckets["Recents"].push(c);
    else if (age < 7 * DAY) buckets["Last week"].push(c);
    else if (age < 30 * DAY) buckets["Last month"].push(c);
    else buckets["Older"].push(c);
  }
  return RECENCY_ORDER.map(label => ({ label, items: buckets[label] })).filter(g => g.items.length);
}

function relTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function parseHealthColor(health) {
  const h = (health || "").toLowerCase();
  if (h.startsWith("red") || h.includes("high") || h.includes("critical") || h.includes("at risk") || h.includes("significant"))
    return { color: "#ef4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.3)", label: "AT RISK",
             badgeBg: "#dc2626", badgeColor: "#fff" };
  if (h.startsWith("yellow") || h.includes("medium") || h.includes("attention") || h.includes("watch") || h.includes("moderate") || h.includes("stable"))
    return { color: "#f97316", bg: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.3)", label: "WATCH",
             badgeBg: "#ea6c00", badgeColor: "#fff" };
  if (h.startsWith("green") || h.includes("on track") || h.includes("healthy"))
    return { color: "#34d399", bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.3)", label: "ON TRACK",
             badgeBg: "#059669", badgeColor: "#fff" };
  return { color: "#34d399", bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.3)", label: "ON TRACK",
           badgeBg: "#059669", badgeColor: "#fff" };
}

function extractIssueKey(text) { const m = text.match(/\b([A-Z][A-Z0-9]+-\d+)\b/); return m ? m[1] : null; }
function extractJiraUrl(text)   { const m = text.match(/https?:\/\/[^\s)<>]+atlassian\.net\/browse\/[^\s)<>]+/); return m ? m[0] : null; }

function getPriorityColor(p) {
  const s = (p || "").toLowerCase();
  if (s === "highest") return "#ef4444";
  if (s === "high")    return "#f97316";
  if (s === "medium")  return "#f97316";
  if (s === "low")     return "#22d3ee";
  return "#9aa5b4";
}

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const PROJECT_ACCENTS = ["#22d3ee","#a78bfa","#34d399","#f97316","#f87171","#fb923c","#60a5fa"];

const AGENT_TIPS = [
  { icon: "📊", prompt: "Generate a status report for AABG", hint: "Full breakdown — progress, risks, next steps, all in one card" },
  { icon: "⚠️", prompt: "What's at risk in AABGFY26?", hint: "Surface overdue items, blockers, and mitigation actions instantly" },
  { icon: "🎯", prompt: "Show me all user stories", hint: "Browse the complete backlog with priorities and owners" },
  { icon: "🔧", prompt: "Create a Jira issue for [description]", hint: "Log work directly from chat — no need to open Jira" },
  { icon: "📅", prompt: "Which milestones are overdue?", hint: "Delivery health check — see exactly what has slipped and by how long" },
  { icon: "📣", prompt: "Send a Slack update about the Phoenix project", hint: "Notify your team instantly from the agent console" },
  { icon: "📁", prompt: "Generate a PPT for all projects", hint: "One-click stakeholder presentation from live Jira data" },
  { icon: "🌐", prompt: "What is the overall portfolio health?", hint: "Cross-project view — catch risks before they escalate" },
  { icon: "👤", prompt: "Who is unassigned on critical tasks?", hint: "Spot resource gaps before they become delivery blockers" },
  { icon: "🚀", prompt: "What should be prioritized this sprint?", hint: "AI-driven recommendations based on current project state" },
];

function ThinkingPanel({ accent, label }) {
  const [idx,    setIdx]    = useState(() => Math.floor(Math.random() * AGENT_TIPS.length));
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => { setIdx(i => (i + 1) % AGENT_TIPS.length); setFading(false); }, 380);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  const tip = AGENT_TIPS[idx];
  return (
    <div className="thinking-panel">
      <div className="thinking-dots">
        <span className="dot" /><span className="dot" /><span className="dot" />
        <span className="thinking-label">{label || "Agent is working…"}</span>
      </div>
      <div className={`thinking-tip-card${fading ? " fading" : ""}`}>
        <span className="tip-icon">{tip.icon}</span>
        <div className="tip-body">
          <div className="tip-eyebrow">While you wait — try this next</div>
          <div className="tip-prompt" style={{ color: accent ?? "#22d3ee" }}>
            &ldquo;{tip.prompt}&rdquo;
          </div>
          <div className="tip-hint">{tip.hint}</div>
        </div>
      </div>
    </div>
  );
}

const INTENT_LABELS = {
  query:                   { label: "PM Agent" },
  list_projects:           { label: "Projects" },
  list_issues:             { label: "Issue Chart" },
  flag_risks:              { label: "Risk Analysis" },
  create_issue:            { label: "Issue Created" },
  generate_status_report:  { label: "Status Report" },
  team_workload:           { label: "Team Workload" },
  compare_projects:        { label: "Comparison" },
  track_milestones:        { label: "Milestones" },
  send_slack_notification: { label: "Slack" },
  generate_ppt:            { label: "Report" },
  talent_report:           { label: "Talent Report" },
  draft_deliverables:      { label: "Deliverables" },
};

const STATUS_CFG = {
  "at risk":         { color: "#ef4444", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.3)",  label: "AT RISK",     badgeBg: "#dc2626", badgeColor: "#fff" },
  "at_risk":         { color: "#ef4444", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.3)",  label: "AT RISK",     badgeBg: "#dc2626", badgeColor: "#fff" },
  "needs attention": { color: "#f97316", bg: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.3)", label: "WATCH",       badgeBg: "#ea6c00", badgeColor: "#fff" },
  "on track":        { color: "#34d399", bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.3)", label: "ON TRACK",    badgeBg: "#059669", badgeColor: "#fff" },
  "healthy":         { color: "#34d399", bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.3)", label: "HEALTHY",     badgeBg: "#059669", badgeColor: "#fff" },
  "watch":           { color: "#f97316", bg: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.3)", label: "WATCH",       badgeBg: "#ea6c00", badgeColor: "#fff" },
};

function getStatusCfg(status) {
  const key = (status || "").toLowerCase();
  for (const [k, v] of Object.entries(STATUS_CFG)) { if (key.includes(k)) return v; }
  return { color: "#9aa5b4", bg: "rgba(154,165,180,0.10)", border: "rgba(154,165,180,0.3)", label: (status || "UNKNOWN").toUpperCase(), badgeBg: "#475569", badgeColor: "#fff" };
}

// ═══════════════════════════════════════════════════════════════════════
// RICH MARKDOWN — universal dynamic renderer for all agent responses
// ═══════════════════════════════════════════════════════════════════════

// ─── Mermaid chart component ────────────────────────────────────────────
function MermaidChart({ code }) {
  const [svg,     setSvg]  = useState(null);
  const [errored, setErr]  = useState(false);
  const uid = useId().replace(/:/g, "m");

  // Assign a unique bar color once per component mount (stable ref)
  const colorRef = useRef(null);
  if (colorRef.current === null) {
    colorRef.current = _XY_COLORS[_xyColorIdx++ % _XY_COLORS.length];
  }

  const isXy = /^\s*xychart-beta/m.test(code);

  useEffect(() => {
    let cancelled = false;
    setSvg(null); setErr(false);

    // Serialise renders: initialize with this chart's color, then render.
    // Queuing prevents two concurrent m.initialize() calls from racing.
    _renderQueue = _renderQueue.then(async () => {
      if (cancelled) return;
      try {
        const m = await getMermaid();
        m.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            ..._BASE_THEME_VARS,
            // Each xychart gets its own color; pie charts use pie1-8 from BASE
            xyChart: { ..._BASE_THEME_VARS.xyChart, plotColorPalette: colorRef.current },
          },
        });
        const { svg: out } = await m.render(uid, code);
        if (!cancelled) setSvg(isXy ? _fixIntegerTicks(out) : out);
      } catch {
        if (!cancelled) setErr(true);
      }
    });

    return () => { cancelled = true; };
  }, [uid, code, isXy]);

  if (errored) return <pre className="md-code-block"><code>{code}</code></pre>;
  if (!svg)    return <div className="mermaid-loading">Rendering chart…</div>;
  return <div className="mermaid-wrap" dangerouslySetInnerHTML={{ __html: svg }} />;
}

// ── Merge consecutive mermaid blocks into a single mermaid-row block ────────
// This lets us render them as a side-by-side flex row instead of stacked.
const _CHART_SEP = "---CHART---";
function preprocessMermaidGroups(text) {
  const BLOCK_RE = /```mermaid\n([\s\S]+?)```/g;
  const blocks = [];
  let m;
  while ((m = BLOCK_RE.exec(text)) !== null) {
    blocks.push({ start: m.index, end: m.index + m[0].length, code: m[1].trim() });
  }
  if (blocks.length < 2) return text;

  // Group blocks that are separated only by whitespace
  const runs = [];
  let run = [blocks[0]];
  for (let i = 1; i < blocks.length; i++) {
    const between = text.slice(blocks[i - 1].end, blocks[i].start);
    if (/^\s*$/.test(between)) { run.push(blocks[i]); }
    else { runs.push(run); run = [blocks[i]]; }
  }
  runs.push(run);

  // Replace every run of 2+ consecutive blocks with a mermaid-row block
  let result = text;
  let offset = 0;
  for (const grp of runs) {
    if (grp.length < 2) continue;
    const start = grp[0].start + offset;
    const end   = grp[grp.length - 1].end + offset;
    const replacement = "```mermaid-row\n" + grp.map(b => b.code).join("\n" + _CHART_SEP + "\n") + "\n```";
    result = result.slice(0, start) + replacement + result.slice(end);
    offset += replacement.length - (end - start);
  }
  return result;
}

const MD_COMPONENTS = {
  h1: ({ children }) => <div className="md-h1">{children}</div>,
  h2: ({ children }) => <div className="md-h2"><span className="md-h2-bar"/>{children}</div>,
  h3: ({ children }) => <div className="md-h3">{children}</div>,
  h4: ({ children }) => <div className="md-h4">{children}</div>,
  p:  ({ children }) => <p className="md-p">{children}</p>,
  strong: ({ children }) => <strong className="md-strong">{children}</strong>,
  em:     ({ children }) => <em className="md-em">{children}</em>,
  hr:     () => <div className="md-hr" />,
  blockquote: ({ children }) => <div className="md-blockquote">{children}</div>,
  ul: ({ children }) => <ul className="md-ul">{children}</ul>,
  ol: ({ children }) => <ol className="md-ol">{children}</ol>,
  li: ({ children }) => <li className="md-li"><span className="md-li-dot"/><span>{children}</span></li>,
  // v9: pre wraps code blocks; intercept mermaid before rendering as <pre>
  pre: ({ node, children }) => {
    const codeNode = node?.children?.[0];
    const cls = (codeNode?.properties?.className || []).join(" ");

    // Side-by-side row of charts
    if (/language-mermaid-row/.test(cls)) {
      const raw = codeNode?.children?.[0]?.value || "";
      const charts = raw.split(_CHART_SEP).map(c => c.trim()).filter(Boolean);
      return (
        <div className="mermaid-row">
          {charts.map((c, i) => (
            <div key={i} className="mermaid-row-cell">
              <MermaidChart code={c} />
            </div>
          ))}
        </div>
      );
    }

    if (/language-mermaid/.test(cls)) {
      const code = codeNode?.children?.[0]?.value || "";
      return <MermaidChart code={code.trim()} />;
    }
    return <pre className="md-code-block">{children}</pre>;
  },
  code: ({ className, children }) => /language-/.test(className || "")
    ? <code>{children}</code>
    : <code className="md-code-inline">{children}</code>,
  table:   ({ children }) => <div className="md-table-wrap"><table className="md-table">{children}</table></div>,
  thead:   ({ children }) => <thead className="md-thead">{children}</thead>,
  tbody:   ({ children }) => <tbody>{children}</tbody>,
  tr:      ({ children }) => <tr className="md-tr">{children}</tr>,
  th:      ({ children }) => <th className="md-th">{children}</th>,
  td:      ({ children }) => <td className="md-td">{children}</td>,
  a:       ({ href, children }) => <a className="inline-link" href={href} target="_blank" rel="noreferrer">{children}</a>,
};

function RichMarkdown({ text }) {
  const processed = preprocessMermaidGroups(text || "");
  return (
    <div className="rich-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
        {processed}
      </ReactMarkdown>
    </div>
  );
}

function DefaultMessage({ text }) {
  return <RichMarkdown text={text} />;
}

// ═══════════════════════════════════════════════════════════════════════
// PROJECT LIST
// ═══════════════════════════════════════════════════════════════════════

function ProjectListMessage({ text }) {
  return <RichMarkdown text={text} />;
}

// ═══════════════════════════════════════════════════════════════════════
// RISK REPORT
// ═══════════════════════════════════════════════════════════════════════

function RiskReportMessage({ text }) {
  return <RichMarkdown text={text} />;
}

// ═══════════════════════════════════════════════════════════════════════
// ISSUE CREATED
// ═══════════════════════════════════════════════════════════════════════

function IssueCreatedMessage({ text }) {
  const key  = extractIssueKey(text);
  const url  = extractJiraUrl(text);
  const sm   = text.match(/["""']([^"""']{3,120})["""']/);
  const typeM = text.match(/(?:type|issue type)[:\s]+([A-Za-z]+)/i);
  const prioM = text.match(/priority[:\s]+([A-Za-z]+)/i);
  return (
    <div className="msg-card success-card">
      <div className="success-header"><span className="success-check">✓</span><span>Issue Created Successfully</span></div>
      <div className="success-body">
        {key && <div className="created-key">{key}</div>}
        {sm  && <div className="created-summary">{sm[1]}</div>}
        {(typeM || prioM) && (
          <div className="created-meta">
            {typeM && <span className="chip">{typeM[1]}</span>}
            {prioM && <span className="chip" style={{ color: getPriorityColor(prioM[1]) }}>{prioM[1]}</span>}
          </div>
        )}
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="jira-link">Open in Jira →</a>
        ) : (!sm && <DefaultMessage text={text} />)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PORTFOLIO STATUS REPORT — multi-project
// ═══════════════════════════════════════════════════════════════════════

function PortfolioReportMessage({ text }) {
  return <RichMarkdown text={text} />;
}

// ═══════════════════════════════════════════════════════════════════════
// SINGLE-PROJECT STATUS REPORT — fully structured
// ═══════════════════════════════════════════════════════════════════════

function StatusReportMessage({ text }) {
  return <RichMarkdown text={text} />;
}

// ═══════════════════════════════════════════════════════════════════════
// MILESTONE — kanban columns
// ═══════════════════════════════════════════════════════════════════════

function MilestoneMessage({ text }) {
  return <RichMarkdown text={text} />;
}

// ═══════════════════════════════════════════════════════════════════════
// SLACK / PPT / DELIVERABLES
// ═══════════════════════════════════════════════════════════════════════

function SlackNotificationMessage({ text }) {
  return (
    <div className="msg-card slack-card">
      <div className="slack-header"><span>📨</span><span>Slack Notification Sent</span></div>
      <div className="slack-body"><DefaultMessage text={text} /></div>
    </div>
  );
}

function PPTMessage({ text }) {
  const [dlState, setDlState] = useState("idle"); // idle | loading | error

  // Extract URL from markdown [text](url) or plain URL, then rewrite to go
  // through the Vite/nginx proxy (/api/… → localhost:8000/…).
  const rawUrl = (text.match(/\((https?:\/\/[^)]+)\)/) || text.match(/https?:\/\/(\S+)/))?.[1]
              || text.match(/https?:\/\/\S+/)?.[0];

  // Always map to /api prefix so the proxy handles routing + CORS.
  // Plain localhost URLs: strip host, prepend /api.
  // Already-relative or external URLs: use as-is.
  const apiUrl = rawUrl
    ? /localhost/i.test(rawUrl)
      ? `/api${rawUrl.replace(/^https?:\/\/localhost(?::\d+)?/, "")}`
      : rawUrl
    : null;

  const projectM = (rawUrl || text).match(/project_key=([A-Z0-9]+)/i);
  const projectKey = projectM ? projectM[1] : null;
  const filename   = `PM-Report${projectKey ? `-${projectKey}` : ""}.pptx`;

  // Fetch with auth header, then trigger browser save-as
  async function handleDownload() {
    if (!apiUrl || dlState === "loading") return;
    setDlState("loading");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(apiUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      setDlState("idle");
    } catch {
      setDlState("error");
      setTimeout(() => setDlState("idle"), 3000);
    }
  }

  const sections = ["Executive Summary", "Project Status", "Risk Assessment", "Next Steps"];

  return (
    <div className="msg-card ppt-card">
      <div className="ppt-banner">
        <div className="ppt-banner-icon">📊</div>
        <div className="ppt-banner-text">
          <div className="ppt-banner-title">Presentation Ready</div>
          {projectKey && <div className="ppt-banner-sub">Project · {projectKey}</div>}
        </div>
        <div className="ppt-banner-badge">PPTX</div>
      </div>
      <div className="ppt-body">
        <div className="ppt-includes-label">Includes</div>
        <div className="ppt-sections">
          {sections.map(s => (
            <div key={s} className="ppt-section-chip">
              <span className="ppt-chip-dot" />
              {s}
            </div>
          ))}
        </div>
        {apiUrl ? (
          <button
            className={`ppt-download-btn${dlState === "loading" ? " ppt-dl-loading" : dlState === "error" ? " ppt-dl-error" : ""}`}
            onClick={handleDownload}
            disabled={dlState === "loading"}
          >
            <span className="ppt-dl-arrow">
              {dlState === "loading" ? "⏳" : dlState === "error" ? "✕" : "↓"}
            </span>
            <span>
              {dlState === "loading" ? "Preparing download…" : dlState === "error" ? "Download failed — retry" : "Download PowerPoint"}
            </span>
            {dlState === "idle" && <span className="ppt-dl-ext">.pptx</span>}
          </button>
        ) : (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
            No download link found in agent response.
          </p>
        )}
      </div>
    </div>
  );
}

function DeliverablesMessage({ text }) {
  return <RichMarkdown text={text} />;
}

// ═══════════════════════════════════════════════════════════════════════
// TALENT REPORT MESSAGE — PPTX / XLSX / DOCX downloads
// Mirrors PPTMessage's fetch-with-auth pattern so the file is delivered
// as a Blob (no browser-tab redirect that would strip the Bearer token).
// ═══════════════════════════════════════════════════════════════════════

function TalentReportMessage({ text }) {
  const [dlState, setDlState] = useState({}); // { pptx: "loading" | "error" }

  const formats = [
    { key: "pptx", label: "PowerPoint", ext: ".pptx", icon: "📊", url: "/api/talent/export/ppt",  filename: "Talent_Report.pptx" },
    { key: "xlsx", label: "Excel",      ext: ".xlsx", icon: "📗", url: "/api/talent/export/xlsx", filename: "Talent_Report.xlsx" },
    { key: "docx", label: "Word",       ext: ".docx", icon: "📄", url: "/api/talent/export/docx", filename: "Talent_Report.docx" },
  ];

  async function handleDownload(fmt) {
    if (dlState[fmt.key] === "loading") return;
    setDlState(s => ({ ...s, [fmt.key]: "loading" }));
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(fmt.url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fmt.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      setDlState(s => ({ ...s, [fmt.key]: "idle" }));
    } catch {
      setDlState(s => ({ ...s, [fmt.key]: "error" }));
      setTimeout(() => setDlState(s => ({ ...s, [fmt.key]: "idle" })), 3000);
    }
  }

  const sections = ["Team Overview", "Availability", "Skill Coverage", "Active Projects", "Rolling Off 30d"];

  return (
    <div className="msg-card ppt-card">
      <div className="ppt-banner">
        <div className="ppt-banner-icon">👥</div>
        <div className="ppt-banner-text">
          <div className="ppt-banner-title">Talent Report Ready</div>
          <div className="ppt-banner-sub">PPTX · Excel · Word</div>
        </div>
        <div className="ppt-banner-badge">3 formats</div>
      </div>
      <div className="ppt-body">
        <div className="ppt-includes-label">Includes</div>
        <div className="ppt-sections">
          {sections.map(s => (
            <div key={s} className="ppt-section-chip">
              <span className="ppt-chip-dot" />
              {s}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {formats.map(fmt => {
            const st = dlState[fmt.key] || "idle";
            return (
              <button
                key={fmt.key}
                className={`ppt-download-btn${st === "loading" ? " ppt-dl-loading" : st === "error" ? " ppt-dl-error" : ""}`}
                onClick={() => handleDownload(fmt)}
                disabled={st === "loading"}
              >
                <span className="ppt-dl-arrow">
                  {st === "loading" ? "⏳" : st === "error" ? "✕" : fmt.icon}
                </span>
                <span>
                  {st === "loading" ? `Preparing ${fmt.label}…`
                    : st === "error" ? `${fmt.label} failed — retry`
                    : `Download ${fmt.label}`}
                </span>
                {st === "idle" && <span className="ppt-dl-ext">{fmt.ext}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// COMPARE PROJECTS MESSAGE
// ═══════════════════════════════════════════════════════════════════════

function CompareProjectsMessage({ text }) {
  // Parse "## Project Comparison: Name A vs Name B"
  const titleM = text.match(/^##\s+Project Comparison:\s+(.+)/m);
  const title  = titleM ? titleM[1].trim() : "Project Comparison";

  // Parse markdown table: | Metric | COL_A | COL_B |
  const tableM = text.match(/\|[^\n]+\|\n\|[-| :]+\|\n((?:\|[^\n]+\|\n?)+)/);
  const headerRow = text.match(/\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
  const colA = headerRow ? clean(headerRow[2]) : "Project A";
  const colB = headerRow ? clean(headerRow[3]) : "Project B";

  const tableRows = [];
  if (tableM) {
    for (const row of tableM[1].trim().split("\n")) {
      const cells = row.split("|").map(c => c.trim()).filter(Boolean);
      if (cells.length >= 3) tableRows.push({ metric: cells[0], a: cells[1], b: cells[2] });
    }
  }

  // Detect status for colour coding
  function cellColor(val) {
    const v = val.toLowerCase();
    if (v.includes("on track") || v.includes("healthy")) return "#34d399";
    if (v.includes("at risk"))  return "#f87171";
    if (v.includes("attention") || v.includes("watch")) return "#f97316";
    return "var(--text-secondary, #9aa5b4)";
  }

  // Parse ### sections
  function parseSection(label) {
    const m = text.match(new RegExp(`###\\s+${label}[\\s\\S]*?\\n([\\s\\S]+?)(?=\\n###|$)`, "i"));
    return m ? m[1].trim() : "";
  }

  const whyA = parseSection(`Why ${colA}`);
  const whyB = parseSection(`Why ${colB}`);
  const diff  = parseSection("Key Differences");
  const actions = parseSection("Recommended Actions");

  function renderBullets(block) {
    if (!block) return null;
    return block.split("\n").filter(l => l.trim()).map((line, i) => {
      const t = line.replace(/^[-*•]\s+/, "").trim();
      const bm = t.match(/^\*\*([^:*]+):\*\*\s*(.*)/);
      return (
        <div key={i} style={{ display:"flex", gap:8, marginBottom:5 }}>
          <span style={{ color:"#22d3ee", flexShrink:0, marginTop:2 }}>›</span>
          <span style={{ fontSize:12, color:"#9aa5b4", lineHeight:1.55 }}>
            {bm ? <><strong style={{ color:"#e6edf3" }}>{bm[1]}:</strong> {bm[2]}</> : t}
          </span>
        </div>
      );
    });
  }

  function renderNumbered(block) {
    if (!block) return null;
    return block.split("\n").filter(l => /^\d+\./.test(l.trim())).map((line, i) => {
      const rest = line.replace(/^\d+\.\s+/, "");
      const bm   = rest.match(/^\*\*([^:*]+):\*\*\s*(.*)/);
      return (
        <div key={i} style={{ display:"flex", gap:10, marginBottom:7, alignItems:"flex-start" }}>
          <span style={{ fontSize:10, fontWeight:800, background:"rgba(34,211,238,0.12)",
            color:"#22d3ee", borderRadius:4, padding:"2px 6px", flexShrink:0 }}>{i+1}</span>
          <span style={{ fontSize:12, color:"#9aa5b4", lineHeight:1.55 }}>
            {bm ? <><strong style={{ color:"#e6edf3" }}>{bm[1]}:</strong> {bm[2]}</> : rest}
          </span>
        </div>
      );
    });
  }

  const statusA = tableRows.find(r => /status/i.test(r.metric))?.a || "";
  const statusB = tableRows.find(r => /status/i.test(r.metric))?.b || "";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, animation:"slideUp 0.3s ease" }}>
      {/* Header */}
      <div style={{ paddingBottom:10, borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ fontSize:14, fontWeight:700, color:"#e6edf3" }}>Project Comparison</div>
        <div style={{ fontSize:11, color:"#6b7688", marginTop:2 }}>{title}</div>
      </div>

      {/* Status badges */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {[{ key: colA, status: statusA }, { key: colB, status: statusB }].map(({ key, status }) => {
          const c = cellColor(status);
          return (
            <div key={key} style={{ background:"rgba(255,255,255,0.03)", border:`1px solid rgba(255,255,255,0.08)`,
              borderTop:`2px solid ${c}`, borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:11, fontWeight:800, color:"#6b7688", letterSpacing:"0.07em",
                textTransform:"uppercase", marginBottom:6 }}>{key}</div>
              {status && (
                <span style={{ fontSize:11, fontWeight:700, color:c,
                  background:c+"18", borderRadius:20, padding:"3px 10px" }}>{clean(status)}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      {tableRows.length > 0 && (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:10, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr",
            background:"rgba(255,255,255,0.04)", padding:"7px 14px",
            borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
            {["Metric", colA, colB].map(h => (
              <span key={h} style={{ fontSize:10, fontWeight:700, color:"#6b7688",
                textTransform:"uppercase", letterSpacing:"0.07em" }}>{h}</span>
            ))}
          </div>
          {tableRows.map((row, i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr",
              padding:"8px 14px", borderBottom: i < tableRows.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent" }}>
              <span style={{ fontSize:11, color:"#9aa5b4" }}>{row.metric}</span>
              <span style={{ fontSize:11, fontWeight:600, color: cellColor(row.a) }}>{clean(row.a)}</span>
              <span style={{ fontSize:11, fontWeight:600, color: cellColor(row.b) }}>{clean(row.b)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Why sections — two columns */}
      {(whyA || whyB) && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[{ key: colA, text: whyA, color:"#34d399" }, { key: colB, text: whyB, color:"#f87171" }].map(({ key, text: t, color }) => (
            <div key={key} style={{ background:"rgba(255,255,255,0.03)",
              border:`1px solid rgba(255,255,255,0.07)`, borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:10, fontWeight:800, color, textTransform:"uppercase",
                letterSpacing:"0.07em", marginBottom:9 }}>Why {key}</div>
              {renderBullets(t)}
            </div>
          ))}
        </div>
      )}

      {/* Key Differences */}
      {diff && (
        <div style={{ background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.18)",
          borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:10, fontWeight:800, color:"#a78bfa", textTransform:"uppercase",
            letterSpacing:"0.07em", marginBottom:8 }}>Key Differences</div>
          <p style={{ fontSize:12, color:"#9aa5b4", lineHeight:1.65, margin:0 }}>{clean(diff)}</p>
        </div>
      )}

      {/* Recommended Actions */}
      {actions && (
        <div style={{ background:"rgba(34,211,238,0.05)", border:"1px solid rgba(34,211,238,0.15)",
          borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:10, fontWeight:800, color:"#22d3ee", textTransform:"uppercase",
            letterSpacing:"0.07em", marginBottom:10 }}>Recommended Actions</div>
          {renderNumbered(actions)}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TEAM WORKLOAD MESSAGE
// ═══════════════════════════════════════════════════════════════════════

const TW_STATUS = {
  "✅": { label: "Done",        color: "#34d399", bg: "rgba(52,211,153,0.12)"  },
  "🔄": { label: "In Progress", color: "#22d3ee", bg: "rgba(34,211,238,0.12)"  },
  "🔍": { label: "In Review",   color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  "📋": { label: "To Do",       color: "#9aa5b4", bg: "rgba(154,165,180,0.10)" },
  "•":  { label: "",            color: "#9aa5b4", bg: "rgba(154,165,180,0.10)" },
};
const PRIO_COLOR = { Highest:"#f87171", High:"#fb923c", Medium:"#f97316", Low:"#22d3ee", Lowest:"#6b7688" };

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");
}

function TeamWorkloadMessage({ text }) {
  // Parse "## Team Assignments — ProjectName"
  const titleM = text.match(/^##\s+Team Assignments\s+[—–-]+\s+(.+)/m);
  const projectName = titleM ? titleM[1].trim() : "";
  const metaM = text.match(/\*\*(\d+) issues?\*\* across \*\*(\d+) team members?\*\*/);
  const totalIssues = metaM ? parseInt(metaM[1]) : 0;

  // Split into ### sections
  const memberBlocks = [];
  const parts = text.split(/(?=^### )/m);
  for (const part of parts) {
    if (!part.startsWith("###")) continue;
    const firstLine = part.split("\n")[0];
    const headerM = firstLine.match(/###\s+(?:⚠️\s*)?(.+?)\s+[—–-]+\s+(\d+)\s+tasks?/);
    if (!headerM) continue;
    const name      = headerM[1].trim();
    const taskCount = parseInt(headerM[2]);

    const progressM = part.match(/\*(\d+) completed,\s*(\d+) remaining\*/);
    const doneCount = progressM ? parseInt(progressM[1]) : 0;

    // Parse task lines: "- ICON **KEY** Summary _Status_ · `Priority`"
    const tasks = [];
    for (const line of part.split("\n")) {
      const m = line.match(/^-\s+([✅🔄🔍📋••])\s+\*\*([A-Z]+-\d+)\*\*\s+(.+)/u);
      if (!m) {
        // try without emoji (fallback)
        const m2 = line.match(/^-\s+\*\*([A-Z]+-\d+)\*\*\s+(.+)/);
        if (m2) {
          const rest = m2[2];
          const statusM2 = rest.match(/_([^_]+)_/);
          const prioM2   = rest.match(/`([^`]+)`/);
          tasks.push({ icon: "•", key: m2[1], summary: rest.replace(/_[^_]+_.*/, "").trim(), status: statusM2?.[1] || "", priority: prioM2?.[1] || "" });
        }
        continue;
      }
      const icon    = m[1];
      const key     = m[2];
      const rest    = m[3];
      const statusM = rest.match(/_([^_]+)_/);
      const prioM   = rest.match(/`([^`]+)`/);
      const summary = rest.replace(/_[^_]+_.*/, "").trim();
      tasks.push({ icon, key, summary, status: statusM?.[1] || "", priority: prioM?.[1] || "" });
    }

    memberBlocks.push({ name, taskCount, doneCount, tasks });
  }

  if (!memberBlocks.length) return <DefaultMessage text={text} />;

  const AVATAR_COLORS = ["#22d3ee","#a78bfa","#34d399","#f97316","#f87171","#60a5fa"];

  return (
    <div className="tw-wrap">
      {/* Header */}
      <div className="tw-header">
        <div>
          <div className="tw-title">Team Assignments</div>
          {projectName && <div className="tw-subtitle">{projectName}</div>}
        </div>
        {totalIssues > 0 && (
          <span className="tw-meta">{totalIssues} issues · {memberBlocks.length} members</span>
        )}
      </div>

      {/* Member cards */}
      <div className="tw-cards">
        {memberBlocks.map((member, mi) => {
          const pct = member.taskCount > 0 ? Math.round((member.doneCount / member.taskCount) * 100) : 0;
          const avatarColor = AVATAR_COLORS[mi % AVATAR_COLORS.length];
          return (
            <div key={mi} className="tw-card">
              {/* Card header */}
              <div className="tw-card-head">
                <div className="tw-avatar" style={{ background: avatarColor + "22", color: avatarColor, border: `1px solid ${avatarColor}40` }}>
                  {initials(member.name)}
                </div>
                <div className="tw-card-info">
                  <div className="tw-name">{member.name}</div>
                  <div className="tw-count">{member.taskCount} task{member.taskCount !== 1 ? "s" : ""}{member.doneCount > 0 ? ` · ${member.doneCount} done` : ""}</div>
                </div>
                <div className="tw-pct" style={{ color: pct >= 75 ? "#34d399" : pct >= 40 ? "#f97316" : "#f87171" }}>{pct}%</div>
              </div>

              {/* Progress bar */}
              <div className="tw-progress-track">
                <div className="tw-progress-fill" style={{ width: `${pct}%`, background: avatarColor }} />
              </div>

              {/* Tasks */}
              <div className="tw-tasks">
                {member.tasks.map((task, ti) => {
                  const sc = TW_STATUS[task.icon] || TW_STATUS["•"];
                  const pc = PRIO_COLOR[task.priority];
                  return (
                    <div key={ti} className="tw-task">
                      <span className="tw-task-key">{task.key}</span>
                      <span className="tw-task-summary">{task.summary}</span>
                      <div className="tw-task-tags">
                        {task.status && (
                          <span className="tw-tag" style={{ color: sc.color, background: sc.bg }}>{task.status}</span>
                        )}
                        {task.priority && task.priority !== "Medium" && (
                          <span className="tw-tag" style={{ color: pc || "#9aa5b4", background: (pc || "#9aa5b4") + "18" }}>{task.priority}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LEADERSHIP PROMPT — inline "Send to Leadership?" after risk/status replies
// ═══════════════════════════════════════════════════════════════════════

function LeadershipPrompt({ text, accent, onAction }) {
  const [state, setState] = useState("idle"); // idle | sending | done

  async function handleApprove() {
    setState("sending");
    try {
      await sendToLeadership(text);
      setState("done");
      onAction("✅ Thanks for approving! Report has been sent to the Leadership Slack channel.");
    } catch {
      setState("idle");
    }
  }

  function handleDismiss() {
    setState("done");
    onAction("Ok, dismissed.");
  }

  if (state === "done") return null;

  return (
    <div className="leadership-prompt" style={{ borderColor: accent + "40" }}>
      <span className="lp-label">Would you like to send this report to Leadership?</span>
      <div className="lp-actions">
        <button
          className="lp-btn lp-btn-reject"
          onClick={handleDismiss}
          disabled={state === "sending"}
        >
          Dismiss
        </button>
        <button
          className="lp-btn lp-btn-approve"
          onClick={handleApprove}
          disabled={state === "sending"}
        >
          {state === "sending" ? "Sending…" : "✓ Approve & Send"}
        </button>
      </div>
    </div>
  );
}

// DISPATCHER
// ═══════════════════════════════════════════════════════════════════════

function StreamingMessage({ text, accent }) {
  if (!text) return <ThinkingPanel accent={accent} />;
  // Render the report as FORMATTED markdown while it types in (headings, tables,
  // bold) — never raw source. Mermaid is shown as a placeholder mid-stream (the
  // real chart renders in the final card), so nothing half-parsed flashes.
  return (
    <div className="default-msg streaming-msg">
      <RichMarkdown text={text} />
    </div>
  );
}

function MessageRenderer({ msg, accent }) {
  const { text, ui_hint } = msg;
  if (ui_hint === "thinking")  return <ThinkingPanel accent={accent} label={text} />;
  if (ui_hint === "streaming") return <StreamingMessage text={text} accent={accent} />;
  switch (ui_hint) {
    // ── Active backend intents ──────────────────────────────────────────
    case "query":                   return <RichMarkdown text={text} />;
    case "out_of_scope":            return <RichMarkdown text={text} />;
    case "create_issue":            return <IssueCreatedMessage text={text} />;
    case "send_slack_notification": return <SlackNotificationMessage text={text} />;
    case "generate_ppt":            return <PPTMessage text={text} />;
    case "talent_report":           return <TalentReportMessage text={text} />;
    // ── Legacy / fallback ───────────────────────────────────────────────
    case "team_workload":           return <TeamWorkloadMessage text={text} />;
    case "compare_projects":        return <CompareProjectsMessage text={text} />;
    default:                        return <RichMarkdown text={text} />;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CHAT PANEL
// ═══════════════════════════════════════════════════════════════════════

// Named export so CopilotPanel can reuse the same rich message components
export { MessageRenderer };

export default function ChatPanel({ moduleId, accent, greeting }) {
  // Personalised welcome (falls back to the module's static greeting prop).
  const username = (typeof localStorage !== "undefined" && localStorage.getItem("username")) || "";
  const welcome = () => ({ role: "assistant", text: buildGreeting(username) || greeting, ui_hint: "default" });
  const [messages,    setMessages]    = useState(() => [welcome()]);
  const [input,       setInput]       = useState("");
  const [busy,        setBusy]        = useState(false);
  const [fullscreen,  setFullscreen]  = useState(false);
  const [sessionId,   setSessionId]   = useState(() => `${moduleId}-${Math.random().toString(36).slice(2, 10)}`);
  const [conversations, setConversations] = useState([]);
  const [loadingConvos, setLoadingConvos] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // {session_id, title} awaiting confirm
  const [collapsedGroups, setCollapsedGroups] = useState({}); // { "Last week": true } = collapsed
  const toggleGroup = (label) => setCollapsedGroups(c => ({ ...c, [label]: !c[label] }));
  const bottomRef    = useRef(null);
  const scrollRef    = useRef(null);
  const stickRef     = useRef(true);   // auto-follow the newest content?
  const textareaRef  = useRef(null);
  const histWrapRef  = useRef(null);

  // Pin to the newest content WITHOUT smooth animation — instant pin avoids the
  // shaking/fighting you get from many overlapping smooth scrolls during the
  // ~45 type-out updates. Only follows when the user is already at the bottom.
  const pinToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, []);

  // Close history dropdown on outside click
  useEffect(() => {
    if (!historyOpen) return;
    function handleClick(e) {
      if (histWrapRef.current && !histWrapRef.current.contains(e.target)) {
        setHistoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [historyOpen]);

  useEffect(() => { pinToBottom(); }, [messages, busy, pinToBottom]);

  // ── History sidebar ────────────────────────────────────────────────
  const refreshConversations = useCallback(async () => {
    setLoadingConvos(true);
    try {
      const data = await getConversations();
      // Only this module's chats (session ids are prefixed with the module id).
      const list = (data.conversations || []).filter(c => c.session_id.startsWith(`${moduleId}-`));
      setConversations(list);
    } catch { /* not logged in yet / no history — leave list empty */ }
    finally { setLoadingConvos(false); }
  }, [moduleId]);

  function newChat() {
    setSessionId(`${moduleId}-${Math.random().toString(36).slice(2, 10)}`);
    setMessages([welcome()]);
  }

  async function loadConversation(sid) {
    if (sid === sessionId) return;
    try {
      const data = await getConversation(sid);
      const mapped = (data.messages || []).map(m => ({
        role: m.role, text: m.content, ui_hint: m.ui_hint || "default",
      }));
      setSessionId(sid);
      setMessages(mapped.length ? mapped : [welcome()]);
    } catch { /* couldn't load — leave current chat as-is */ }
  }

  // Open the in-app confirm modal (replaces the native browser confirm()).
  function askDelete(cv, e) {
    e?.stopPropagation();
    setPendingDelete({ session_id: cv.session_id, title: cv.title });
  }

  async function confirmDelete() {
    const sid = pendingDelete?.session_id;
    setPendingDelete(null);
    if (!sid) return;
    // Optimistic removal — drop it from the list immediately.
    setConversations(cs => cs.filter(c => c.session_id !== sid));
    try {
      await deleteConversation(sid);
    } catch { /* already gone / offline — the next refresh reconciles */ }
    // If we deleted the chat we're viewing, start a fresh one.
    if (sid === sessionId) newChat();
    refreshConversations();
  }

  // Esc closes the confirm modal.
  useEffect(() => {
    if (!pendingDelete) return;
    const onEsc = (e) => { if (e.key === "Escape") setPendingDelete(null); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [pendingDelete]);

  // Refresh the history list whenever the panel is expanded to fullscreen.
  useEffect(() => { if (fullscreen) refreshConversations(); }, [fullscreen, refreshConversations]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    stickRef.current = true;          // follow the new response to the bottom
    setInput("");
    // reset textarea height after clearing
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
    setMessages(m => [...m, { role: "user", text }]);
    setBusy(true);

    // Placeholder bubble — starts as an animated "thinking" panel, then becomes
    // the formatted streaming text, then the final rich card.
    const streamId = Symbol("stream");
    setMessages(m => [...m, { role: "assistant", text: "", ui_hint: "thinking", _id: streamId }]);

    // Animated thinking state with a live progress label.
    const setThinking = (label) =>
      setMessages(m => m.map(msg => msg._id === streamId ? { ...msg, text: label, ui_hint: "thinking" } : msg));
    // Formatted markdown reveal (typing).
    const setTyping = (txt) =>
      setMessages(m => m.map(msg => msg._id === streamId ? { ...msg, text: txt, ui_hint: "streaming" } : msg));
    // Swap for the final rich card.
    const finalize = (intent, full, reportable) =>
      setMessages(m => m.map(msg => msg._id === streamId
        ? { role: "assistant", text: full, ui_hint: intent || "default", reportable: !!reportable }
        : msg
      ));

    try {
      if (moduleId === "pm") {
        // Async + poll — beats API Gateway's 30s cap so long reports never fail.
        await chatWithPolling(moduleId, sessionId, text, {
          onThinking: setThinking,
          onType: setTyping,
          onDone: finalize,
        });
      } else {
        // Other modules keep the direct SSE stream (their replies are quick).
        await streamChat(
          moduleId,
          sessionId,
          text,
          (delta) => setMessages(m => m.map(msg => {
            if (msg._id !== streamId) return msg;
            // First delta switches out of the thinking panel into streaming text.
            const base = msg.ui_hint === "streaming" ? msg.text : "";
            return { ...msg, text: base + delta, ui_hint: "streaming" };
          })),
          finalize,
        );
      }
    } catch {
      setMessages(m =>
        m.map(msg => msg._id === streamId
          ? { role: "assistant", text: "Something went wrong reaching the agent. Please try again.", ui_hint: "default" }
          : msg
        )
      );
    } finally {
      setBusy(false);
      textareaRef.current?.focus();
      // The final card's chart (mermaid) lazy-renders after this, changing the
      // height — re-pin a few times so the view settles on the END of the report.
      [200, 700, 1500].forEach(d => setTimeout(pinToBottom, d));
      // A new/updated conversation may now exist — refresh the sidebar.
      refreshConversations();
    }
  }, [input, busy, moduleId, sessionId, refreshConversations]);

  function onKey(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }

  const charLeft = 2000 - input.length;

  return (
    <div className={`chat-wrap${fullscreen ? " chat-fullscreen" : ""}`}>
      {/* In-app delete confirmation (replaces the native browser confirm) */}
      {pendingDelete && (
        <div className="cd-overlay" onClick={() => setPendingDelete(null)}>
          <div className="cd-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="cd-title">Delete chat?</div>
            <div className="cd-body">
              <span className="cd-name">“{pendingDelete.title || "This conversation"}”</span> will be
              permanently deleted. This can’t be undone.
            </div>
            <div className="cd-actions">
              <button className="cd-btn cd-cancel" onClick={() => setPendingDelete(null)} autoFocus>Cancel</button>
              <button className="cd-btn cd-delete" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* History sidebar — only in fullscreen (Claude-style) */}
      {fullscreen && (
        <aside className="chat-history">
          <div className="ch-head">
            <span className="ch-title">Chats</span>
            <button className="ch-new" onClick={newChat} title="Start a new chat">+ New</button>
          </div>
          <div className="ch-list">
            {loadingConvos ? (
              <div className="ch-empty">Loading…</div>
            ) : conversations.length === 0 ? (
              <div className="ch-empty">No conversations yet</div>
            ) : (
              groupByRecency(conversations).map(group => {
                const isCollapsed = !!collapsedGroups[group.label];
                return (
                <div className="ch-group" key={group.label}>
                  <button
                    className="ch-group-label"
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={!isCollapsed}
                    title={isCollapsed ? "Expand" : "Collapse"}
                  >
                    <span className={`ch-group-chevron${isCollapsed ? " collapsed" : ""}`}>▾</span>
                    <span>{group.label}</span>
                    <span className="ch-group-count">{group.items.length}</span>
                  </button>
                  {!isCollapsed && group.items.map(cv => (
                    <div
                      key={cv.session_id}
                      className={`ch-item-row${cv.session_id === sessionId ? " active" : ""}`}
                      style={cv.session_id === sessionId ? { borderColor: accent + "66" } : undefined}
                    >
                      <button className="ch-item" onClick={() => loadConversation(cv.session_id)}>
                        <span className="ch-item-title">{cv.title}</span>
                        <span className="ch-item-time">{relTime(cv.updated_at)}</span>
                      </button>
                      <button
                        className="ch-item-del"
                        title="Delete conversation"
                        aria-label="Delete conversation"
                        onClick={(e) => askDelete(cv, e)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                );
              })
            )}
          </div>
        </aside>
      )}

      <div className="chat-main">
      {/* Header */}
      <div className="chat-head">
        <span className="chat-dot" style={{ background: accent }} />
        <span className="chat-title">Agent Console</span>
        <div className="chat-head-right">
          {/* History button + dropdown */}
          <div className="chat-hist-wrap" ref={histWrapRef}>
            <button
              className={`chat-expand-btn${historyOpen ? " chat-btn-active" : ""}`}
              onClick={() => {
                const next = !historyOpen;
                setHistoryOpen(next);
                if (next) refreshConversations();
              }}
              title="Conversation history"
              style={historyOpen ? { color: accent, background: accent + "18" } : undefined}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="6"/>
                <path d="M8 5v3l2 2"/>
              </svg>
            </button>
            {historyOpen && (
              <div className="chat-hist-dropdown">
                <div className="chd-header">
                  <span className="chd-title">History</span>
                  <button className="chd-new-btn" onClick={() => { newChat(); setHistoryOpen(false); }}>+ New chat</button>
                </div>
                {loadingConvos ? (
                  <div className="chd-empty">Loading…</div>
                ) : conversations.length === 0 ? (
                  <div className="chd-empty">No conversations yet</div>
                ) : (
                  <div className="chd-list">
                    {conversations.map(cv => (
                      <button
                        key={cv.session_id}
                        className={`chd-item${cv.session_id === sessionId ? " active" : ""}`}
                        onClick={() => { loadConversation(cv.session_id); setHistoryOpen(false); }}
                        style={cv.session_id === sessionId ? { borderLeftColor: accent } : undefined}
                      >
                        <div className="chd-item-title">{cv.title || "New chat"}</div>
                        <div className="chd-item-time">{relTime(cv.updated_at)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            className="chat-expand-btn"
            onClick={() => setFullscreen(f => !f)}
            title={fullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
          >
            {fullscreen ? (
              /* Minimize / compress icon */
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 2v4H2M10 14v-4h4M14 6h-4V2M2 10h4v4"/>
              </svg>
            ) : (
              /* Maximize / expand icon */
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M10 2h4v4M6 14H2v-4M14 10v4h-4M2 6V2h4"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        className="chat-scroll"
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current;
          if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
      >
        {messages.map((msg, i) => (
          <div key={i} className={`msg-row ${msg.role}`}>
            {msg.role === "user" ? (
              <div className="user-bubble" style={{ background: accent + "28", border: `1px solid ${accent}55`, color: "var(--text)" }}>{msg.text}</div>
            ) : (
              <div className="assistant-bubble">
                <div className="agent-avatar" style={{ background: accent + "22", color: accent }}>AI</div>
                <div className="agent-content">
                  <MessageRenderer msg={msg} accent={accent} />
                  {msg.reportable && (
                    <LeadershipPrompt
                      text={msg.text}
                      accent={accent}
                      onAction={(reply) =>
                        setMessages(m => [...m, { role: "assistant", text: reply, ui_hint: "default" }])
                      }
                    />
                  )}
                  {INTENT_LABELS[msg.ui_hint] && (
                    <div className="intent-label">
                      <span className="intent-dot" style={{ background: accent }} />
                      <span>{INTENT_LABELS[msg.ui_hint].label}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {busy && !messages.some(m => m.ui_hint === "streaming" || m.ui_hint === "thinking") && (
          <div className="msg-row assistant">
            <div className="assistant-bubble">
              <div className="agent-avatar" style={{ background: accent+"22", color: accent }}>AI</div>
              <div className="agent-content">
                <ThinkingPanel accent={accent} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-wrap">
        <div className="chat-input-box">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={input}
            onChange={e => {
              setInput(e.target.value);
              const ta = e.target;
              ta.style.height = "auto";
              ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
            }}
            onKeyDown={onKey}
            placeholder="Ask about projects, risks, milestones, or create issues…"
            rows={1}
            maxLength={2000}
          />
          <div className="chat-input-row">
            {/* Left toolbar icons */}
            <div className="chat-toolbar-left">
              <button className="toolbar-btn" title="Attach file">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
              <button className="toolbar-btn" title="Slash commands">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="16" y1="4" x2="8" y2="20"/>
                </svg>
              </button>
              <button className="toolbar-btn toolbar-btn-circle" title="Agent mode" style={{ color: accent }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>

            <div className="chat-toolbar-right">
              {charLeft < 200 && (
                <span className={`char-count mono${charLeft < 50 ? " warn" : ""}`}>{charLeft}</span>
              )}
              <button className="toolbar-btn" title="Insert code block">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                </svg>
              </button>
              <button
                className="send-btn"
                onClick={send}
                disabled={busy || !input.trim()}
                style={{ "--accent": accent }}
                title="Send message"
              >
              {busy ? <span className="send-busy" /> : (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M8 13V3M8 3L3.5 7.5M8 3L12.5 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
