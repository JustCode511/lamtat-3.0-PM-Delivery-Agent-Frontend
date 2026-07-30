import { useState, useEffect, useRef } from "react";
import { getProjects, getDashboard, getActivity } from "../api/client.js";

/* ─── helpers ────────────────────────────────────────────────── */

const HEALTH_KEY = {
  AT_RISK:         "at_risk",
  NEEDS_ATTENTION: "on_track",
  HEALTHY:         "on_track",
};

const STATUS = {
  AT_RISK: {
    label:      "At Risk",
    textColor:  "var(--text-danger)",
    bgColor:    "var(--bg-danger-pill)",
    border:     "var(--border-danger)",
    cardBorder: "var(--text-danger)",
  },
  NEEDS_ATTENTION: {
    label:      "Watch",
    textColor:  "var(--text-warning)",
    bgColor:    "var(--bg-warning)",
    border:     "var(--border-warning)",
    cardBorder: "var(--text-warning)",
  },
  HEALTHY: {
    label:      "On Track",
    textColor:  "var(--text-success)",
    bgColor:    "var(--bg-success)",
    border:     "var(--border-success)",
    cardBorder: "var(--text-success)",
  },
};

function progressColor(pct) {
  if (pct === 0)  return "#f87171";
  if (pct <= 25)  return "#f97316";
  if (pct < 76)   return "#22d3ee";
  return "#34d399";
}

function getInsight(p) {
  const done = p.done ?? 0;
  const total = p.total ?? 0;
  if (p.health === "AT_RISK" && p.overdue_count > 0 && done === 0)
    return `${p.overdue_count} task${p.overdue_count > 1 ? "s" : ""} overdue with 0 done. Escalate blockers now.`;
  if (p.health === "AT_RISK" && p.overdue_count > 0)
    return `${p.overdue_count} overdue task${p.overdue_count > 1 ? "s" : ""}. Reassign or unblock to recover delivery.`;
  if (p.health === "AT_RISK")
    return "Project is behind schedule. Review critical path with the team today.";
  if (p.health === "NEEDS_ATTENTION" && p.overdue_count > 0)
    return `${p.overdue_count} task${p.overdue_count > 1 ? "s" : ""} slipping. Address before the next sprint boundary.`;
  if (p.health === "NEEDS_ATTENTION")
    return "Progressing but below target pace. Revisit milestone targets.";
  return `${done} of ${total} tasks complete — project is healthy. Keep the momentum.`;
}

function elapsed(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min === 1) return "1 min ago";
  return `${min} min ago`;
}

/* ─── main component ─────────────────────────────────────────── */

export default function PMDashboard({ accentHex = "#22d3ee" }) {
  const [projects,   setProjects]   = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [detail,     setDetail]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState("all");
  const [syncLabel,  setSyncLabel]  = useState("just now");
  const syncedAt = useRef(null);

  useEffect(() => {
    getProjects().then(d => {
      setProjects(d.projects || []);
      setLoading(false);
      syncedAt.current = Date.now();
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (syncedAt.current)
        setSyncLabel(elapsed(Date.now() - syncedAt.current));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  function openProject(key) {
    setSelected(key);
    setDetail(null);
    getDashboard(key).then(setDetail);
  }

  /* ── loading ── */
  if (loading) return (
    <div style={s.wrap}>
      {[80, 120, 120, 120].map((h, i) => (
        <div key={i} className="skeleton" style={{ height: h, borderRadius: 12, marginBottom: 12 }} />
      ))}
    </div>
  );

  /* ── detail loading ── */
  if (selected && !detail) return (
    <div style={s.wrap}>
      <button style={s.back} onClick={() => { setSelected(null); setDetail(null); }}>← All projects</button>
      {[56, 80, 80, 80].map((h, i) => (
        <div key={i} className="skeleton" style={{ height: h, borderRadius: 12, marginBottom: 12 }} />
      ))}
    </div>
  );

  /* ── detail view ── */
  if (selected && detail)
    return <DetailView detail={detail} accentHex={accentHex} onBack={() => { setSelected(null); setDetail(null); }} />;

  /* ── portfolio stats ── */
  const atRisk   = projects.filter(p => p.health === "AT_RISK").length;
  const watching = projects.filter(p => p.health === "NEEDS_ATTENTION").length;
  const healthy  = projects.filter(p => p.health === "HEALTHY").length;
  const overdue  = projects.reduce((a, p) => a + (p.overdue_count || 0), 0);
  const avgPct   = projects.length
    ? Math.round(projects.reduce((a, p) => a + p.completion_pct, 0) / projects.length)
    : 0;

  const filtered = projects.filter(p =>
    filter === "all"     ? true :
    filter === "at_risk" ? p.health === "AT_RISK" :
    filter === "watch"   ? p.health === "NEEDS_ATTENTION" :
    /* on_track */         p.health === "HEALTHY"
  );

  return (
    <div style={s.overviewWrap}>

      {/* 1 ── TOP BAR */}
      <div style={s.topBar}>
        <div style={s.topLeft}>
          <h2 style={s.topTitle}>PM Delivery Agent</h2>
          <span style={s.topSub}>Live project health · AI risk analysis</span>
        </div>
        <div style={s.topRight}>
          <span style={s.syncLabel}>Last synced {syncLabel}</span>
          <span style={s.liveBadge}>
            <span className="live-dot" style={{ background: "var(--text-success)" }} />
            Live · Jira
          </span>
        </div>
      </div>

      {/* 2 ── HEALTH BANNER (when 1+ at risk) */}
      {atRisk > 0 && (
        <div style={s.banner}>
          <div style={s.bannerIcon}>⚠</div>
          <div>
            <p style={s.bannerHead}>
              Portfolio is critically behind — {atRisk} project{atRisk > 1 ? "s" : ""} at risk
            </p>
            <p style={s.bannerSub}>
              {atRisk} project{atRisk > 1 ? "s are" : " is"} behind schedule with {overdue} overdue task{overdue !== 1 ? "s" : ""}.
              Immediate escalation and resource reallocation recommended.
            </p>
          </div>
        </div>
      )}

      {/* 3 ── METRICS ROW */}
      <div style={s.metricsRow}>
        <MetCard label="Projects"      value={projects.length} color="var(--text)" />
        <MetCard label="At Risk"       value={atRisk}   color={atRisk   ? "var(--text-danger)"  : "var(--text-muted)"} />
        <MetCard label="Overdue Tasks" value={overdue}  color={overdue  ? "var(--text-danger)"  : "var(--text-muted)"} />
        <MetCard label="On Track"      value={healthy}  color={healthy  ? "var(--text-success)" : "var(--text-muted)"} />
        <MetCard label="Avg. Complete" value={`${avgPct}%`}
          color={avgPct >= 75 ? "var(--text-success)" : avgPct >= 40 ? "var(--text-warning)" : "var(--text-danger)"}
        />
      </div>

      {/* 4 ── SECTION HEADER + FILTERS */}
      <div style={s.sectionHead}>
        <span style={s.sectionLabel}>Projects</span>
        <div style={s.filterRow}>
          {[
            { key: "all",     label: "All",      badge: null },
            { key: "at_risk", label: "At Risk",  badge: atRisk   || null, badgeStyle: s.filterBadge },
            { key: "watch",   label: "Watch",    badge: watching || null, badgeStyle: s.filterBadgeWarn },
            { key: "on_track",label: "On Track", badge: null },
          ].map(f => (
            <button
              key={f.key}
              style={{
                ...s.filterTab,
                ...(filter === f.key ? s.filterTabActive : {}),
              }}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {f.badge != null && (
                <span style={f.badgeStyle}>{f.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 5 ── PROJECT CARDS */}
      {filtered.length === 0 ? (
        <div style={s.empty}>No projects match this filter.</div>
      ) : (
        <div style={s.cardGrid}>
          {filtered.map(p => (
            <ProjectCard
              key={p.key}
              project={p}
              accentHex={accentHex}
              onOpen={() => openProject(p.key)}
            />
          ))}
        </div>
      )}

      {/* 6 ── RECENT ACTIVITY */}
      <ActivityFeed />
    </div>
  );
}

/* ─── ProjectCard ─────────────────────────────────────────────── */

function ProjectCard({ project: p, accentHex, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const st  = STATUS[p.health] || STATUS.NEEDS_ATTENTION;
  const pct = p.completion_pct || 0;
  const pc  = progressColor(pct);

  return (
    <div
      style={{
        ...s.card,
        borderLeftColor: st.cardBorder,
        boxShadow: hovered
          ? `0 8px 28px rgba(0,0,0,0.45), 0 0 0 1px ${st.cardBorder}30`
          : s.card.boxShadow,
        transform: hovered ? "translateY(-3px)" : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* a ── top row */}
      <div style={s.cardTop}>
        <div style={s.cardTopLeft}>
          <span style={s.cardKey} className="mono">{p.key}</span>
          <span style={s.cardName}>{p.name}</span>
        </div>
        <span style={{ ...s.statusPill, color: st.textColor, background: st.bgColor, border: `1px solid ${st.border}` }}>
          {st.label}
        </span>
      </div>

      {/* b ── mini stats */}
      <div style={s.miniRow}>
        <MiniBox label="Done"    value={p.done ?? 0}         color="var(--text-success)" />
        <MiniBox label="Overdue" value={p.overdue_count ?? 0} color={(p.overdue_count ?? 0) ? "var(--text-danger)" : "var(--text-muted)"} />
        <MiniBox label="Total"   value={p.total ?? 0}        color="var(--text-secondary)" />
      </div>

      {/* c ── progress */}
      <div style={s.progressBlock}>
        <div style={s.progressTopRow}>
          <span style={s.progressLbl}>Completion</span>
          <span style={{ ...s.progressPct, color: pc }} className="mono">{pct}%</span>
        </div>
        <div style={s.trackWrap}>
          <div style={{
            ...s.trackFill,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${pc}, ${pc}90)`,
            boxShadow: pct > 0 ? `0 0 6px ${pc}60` : "none",
          }} />
        </div>
      </div>

      {/* d ── AI insight */}
      <div style={s.insight}>
        <span style={{ color: accentHex, fontSize: 13, flexShrink: 0 }}>✦</span>
        <p style={s.insightText}>{getInsight(p)}</p>
      </div>

      {/* e ── footer */}
      <div style={s.cardFoot}>
        {p.overdue_count > 0 ? (
          <span style={s.footRisk}>⚠ {p.overdue_count} overdue</span>
        ) : (
          <span style={s.footOk}>✓ No overdue tasks</span>
        )}
        <button style={{ ...s.footLink, color: accentHex }} onClick={onOpen}>
          Full analysis →
        </button>
      </div>
    </div>
  );
}

/* ─── sub-components ──────────────────────────────────────────── */

function MetCard({ label, value, color }) {
  return (
    <div style={s.metCard}>
      <span style={s.metLabel}>{label}</span>
      <span style={{ ...s.metValue, color }} className="mono">{value}</span>
    </div>
  );
}

function MiniBox({ label, value, color }) {
  return (
    <div style={s.miniBox}>
      <span style={{ ...s.miniVal, color }}>{value}</span>
      <span style={s.miniLbl}>{label}</span>
    </div>
  );
}

/* ─── ActivityFeed helpers ───────────────────────────────────────── */

const _EV = {
  created:          { color: "#34d399", label: "created"         },
  status_changed:   { color: "#22d3ee", label: "status changed"  },
  assignee_changed: { color: "#a78bfa", label: "assigned"        },
  priority_changed: { color: "#f97316", label: "priority"        },
  renamed:          { color: "#6b7688", label: "renamed"         },
  comment_risk:     { color: "#f87171", label: "⚠ risk comment"  },
};

const _AV_COLORS = ["#22d3ee","#a78bfa","#34d399","#f97316","#f87171","#fb923c","#60a5fa"];
function _avatarColor(name) {
  let h = 0;
  for (const c of (name || "")) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return _AV_COLORS[h % _AV_COLORS.length];
}
function _initials(name) {
  return (name || "?").split(" ").slice(0, 2).map(w => (w[0] || "").toUpperCase()).join("");
}
function _relTime(ts) {
  if (!ts) return "";
  try {
    const mins = Math.floor((Date.now() - new Date(ts)) / 60_000);
    if (mins < 1)  return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return ""; }
}
function _actionText(ev) {
  switch (ev.type) {
    case "created":          return `created ${(ev.issue_type || "issue").toLowerCase()}`;
    case "status_changed":   return `moved to ${ev.to_value || "—"}`;
    case "assignee_changed": return `assigned to ${ev.to_value || "Unassigned"}`;
    case "priority_changed": return `set priority → ${ev.to_value || "—"}`;
    case "renamed":          return "renamed issue";
    case "comment_risk":     return `flagged as ${(ev.to_value || "risk").replace("_", " ")}`;
    default:                 return "updated issue";
  }
}

function ActivityFeed() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  async function load() {
    try {
      const data = await getActivity(25);
      setEvents(data.events || []);
      setLastRefresh(Date.now());
    } catch { /* silently skip if endpoint unavailable */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 60 * 1000); // 5 hours; change to 30_000 for demo
    return () => clearInterval(id);
  }, []);

  const refreshLabel = lastRefresh ? `Updated ${_relTime(new Date(lastRefresh).toISOString())}` : "";

  return (
    <div style={s.activitySection}>
      <div style={s.sectionHead}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={s.sectionLabel}>Recent Activity</span>
          <span className="live-dot" style={{ background: "#34d399" }} />
        </div>
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          {refreshLabel}
        </span>
      </div>

      <div style={s.activityWrap}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div style={s.activityEmpty}>No recent activity in the last 7 days.</div>
        ) : (
          <div style={s.activityTimeline}>
            {events.map((ev, i) => {
              const cfg = _EV[ev.type] || { color: "#6b7688", label: ev.type };
              const avc = _avatarColor(ev.author);
              return (
                <div key={i} style={s.activityItem}>
                  <div style={{ ...s.activityDot, background: cfg.color }} />
                  <div style={{ ...s.activityAvatar, background: avc + "20", color: avc, border: `1px solid ${avc}40` }}>
                    {_initials(ev.author)}
                  </div>
                  <div style={s.activityContent}>
                    <div style={s.activityTopRow}>
                      <span style={s.activityAuthor}>{ev.author}</span>
                      <span style={{ ...s.activityChip, color: cfg.color, background: cfg.color + "15", border: `1px solid ${cfg.color}28` }}>
                        {cfg.label}
                      </span>
                      <span style={s.activityDesc}>{_actionText(ev)}</span>
                      <span style={s.activityTime}>{_relTime(ev.timestamp)}</span>
                    </div>
                    <div style={s.activityBotRow}>
                      <span style={{ ...s.activityKey, color: cfg.color, background: cfg.color + "10", border: `1px solid ${cfg.color}28` }}>
                        {ev.issue_key}
                      </span>
                      <span style={s.activitySummary}>{ev.issue_summary}</span>
                      {ev.project_key && (
                        <span style={s.activityProjectTag}>{ev.project_key}</span>
                      )}
                    </div>
                  {ev.type === "comment_risk" && ev.comment && (
                    <div style={s.activityCommentSnippet}>
                      "{ev.comment.slice(0, 120)}{ev.comment.length > 120 ? "…" : ""}"
                    </div>
                  )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── DetailView helpers ──────────────────────────────────────── */

const PRIORITY_COLORS = {
  Highest: "#f87171",
  High:    "#fb923c",
  Medium:  "#f97316",
  Low:     "#22d3ee",
  Lowest:  "#6b7688",
};

function getPriorityColor(p) {
  return PRIORITY_COLORS[p] || "var(--signal)";
}

const _STATUS_MAP = [
  [["done", "closed", "resolved", "complete", "finish"],    "#00C7BE"],
  [["in progress", "progress", "doing", "active", "wip"],   "#2684FF"],
  [["in review", "review", "peer review", "code review"],   "#8777D9"],
  [["to do", "todo", "not started", "open", "new", "backlog", "selected"], "#8993A4"],
  [["blocked", "impediment", "on hold", "hold", "stuck"],   "#FF5630"],
  [["testing", "qa", "qc", "verif", "uat"],                 "#FF7452"],
  [["deployed", "released", "shipped", "live"],             "#36B37E"],
  [["cancelled", "cancel", "won't fix", "invalid"],         "#6B778C"],
];
const _SC_FALLBACK = ["#4BADE8","#F79232","#E774BB","#57D9A3","#FFC400"];
function statusColor(name) {
  const lw = (name || "").toLowerCase();
  for (const [keys, color] of _STATUS_MAP) {
    if (keys.some(k => lw.includes(k))) return color;
  }
  return _SC_FALLBACK[lw.length % _SC_FALLBACK.length];
}

function DonutChart({ data, total }) {
  const size = 160, r = 56, cx = 80, cy = 80;
  const C = 2 * Math.PI * r;
  const GAP = 3;
  let cum = 0;
  const segs = (data || []).map(item => {
    const segLen = Math.max(0, (item.pct / 100) * C - GAP);
    const dashOffset = C - (cum / 100) * C;
    cum += item.pct;
    return { ...item, segLen, dashOffset, clr: statusColor(item.status) };
  });
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ transform:"rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1d2330" strokeWidth={22}/>
        {segs.map((seg, i) => seg.segLen > 0 && (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.clr} strokeWidth={22}
            strokeDasharray={`${seg.segLen} ${C}`}
            strokeDashoffset={seg.dashOffset}
            strokeLinecap="butt"/>
        ))}
      </svg>
      {/* center label */}
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
        <span style={{ fontSize:28, fontWeight:800, fontFamily:"var(--font-display)",
          color:"var(--text)", lineHeight:1 }}>{total || 0}</span>
        <span style={{ fontSize:10, color:"var(--text-muted)", marginTop:4,
          fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>Total</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ background:"var(--surface-1)", padding:"14px 10px",
      display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <span style={{ fontSize:26, fontWeight:800, fontFamily:"var(--font-display)", lineHeight:1, color }}
        className="mono">{value}</span>
      <span style={s.metLabel}>{label}</span>
    </div>
  );
}

/* ─── DetailView ──────────────────────────────────────────────── */

function DetailView({ detail, accentHex, onBack }) {
  const st  = STATUS[detail.health] || STATUS.NEEDS_ATTENTION;
  const pct = detail.completion_pct || 0;
  const pc  = progressColor(pct);

  const maxTeam = Math.max(...(detail.team_workload || []).map(m => m.count), 1);
  const maxType = Math.max(...(detail.type_breakdown || []).map(t => t.count), 1);
  const maxPrio = Math.max(...Object.values(detail.priority_breakdown || {}), 1);

  const insights = [
    detail.overdue_count > 0 &&
      `${detail.overdue_count} overdue task${detail.overdue_count > 1 ? "s" : ""} need immediate attention.`,
    detail.unassigned_count > 0 &&
      `${detail.unassigned_count} unassigned task${detail.unassigned_count > 1 ? "s" : ""} may cause delivery delays.`,
    (detail.in_progress_count || 0) > (detail.total || 0) * 0.5 && detail.total > 0 &&
      "Over half the tasks are in progress — watch for context switching.",
    pct < 30 && (detail.total || 0) > 5 &&
      "Low completion rate suggests possible scope creep or blockers.",
    pct >= 80 &&
      "Project is nearing completion — prepare final delivery checklist.",
    detail.health === "AT_RISK" &&
      "Escalate to stakeholders and replan the critical path.",
  ].filter(Boolean);

  return (
    <div style={s.wrap} className="fade-up">
      <button style={s.back} onClick={onBack}>← All projects</button>

      {/* ── HEADER */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            <span style={s.cardKey} className="mono">{detail.project_key || ""}</span>
            <span style={{ ...s.statusPill, color:st.textColor, background:st.bgColor, border:`1px solid ${st.border}` }}>
              {st.label}
            </span>
          </div>
          <h2 style={s.detailTitle}>{detail.project_name}</h2>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
          <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>Live · Jira</span>
          <span className="live-dot" style={{ background:"var(--text-success)" }}/>
        </div>
      </div>

      {/* ── SUMMARY STRIP */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:1,
        background:"var(--border)", borderRadius:12, overflow:"hidden", border:"1px solid var(--border)" }}>
        <SummaryCard label="Done"        value={detail.done || 0}             color={accentHex} />
        <SummaryCard label="In Progress" value={detail.in_progress_count || 0} color="var(--signal)" />
        <SummaryCard label="To Do"       value={detail.todo_count || 0}        color="var(--text-muted)" />
        <SummaryCard label="Overdue"     value={detail.overdue_count || 0}
          color={(detail.overdue_count || 0) ? "var(--text-danger)" : "var(--text-success)"} />
        <SummaryCard label="Unassigned"  value={detail.unassigned_count || 0}
          color={(detail.unassigned_count || 0) ? "var(--text-warning)" : "var(--text-success)"} />
      </div>

      {/* ── COMPLETION PROGRESS */}
      <div style={{ background:"var(--surface-1)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 16px" }}>
        <div style={s.progressTopRow}>
          <span style={{ fontSize:12, fontWeight:700, color:"var(--text-secondary)" }}>Overall Completion</span>
          <span style={{ fontSize:14, fontWeight:800, color:pc, fontFamily:"var(--font-mono)" }}>{pct}%</span>
        </div>
        <div style={{ ...s.trackWrap, height:8, marginTop:8 }}>
          <div style={{ ...s.trackFill, width:`${pct}%`,
            background:`linear-gradient(90deg, ${accentHex}, #a78bfa)`,
            boxShadow:`0 0 10px ${accentHex}45` }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
          <span style={{ fontSize:11, color:"var(--text-muted)" }} className="mono">{detail.done || 0} resolved</span>
          <span style={{ fontSize:11, color:"var(--text-muted)" }} className="mono">{detail.total || 0} total</span>
        </div>
      </div>

      {/* ── STATUS DONUT · PRIORITY BARS */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div style={s.panel}>
          <div>
            <div style={s.panelHead}>Status Overview</div>
            <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:3 }}>
              Snapshot of all work items by status
            </div>
          </div>
          {(detail.status_breakdown || []).length > 0 ? (
            <div style={{ display:"flex", gap:20, alignItems:"center" }}>
              <DonutChart data={detail.status_breakdown} total={detail.total} />
              <div style={{ display:"flex", flexDirection:"column", gap:10, flex:1, minWidth:0 }}>
                {detail.status_breakdown.map(item => (
                  <div key={item.status} style={{ display:"flex", alignItems:"center", gap:9 }}>
                    <span style={{ width:13, height:13, borderRadius:3, flexShrink:0,
                      background:statusColor(item.status) }}/>
                    <span style={{ fontSize:12, color:"var(--text-secondary)", flex:1,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {item.status}:
                    </span>
                    <span style={{ fontSize:13, fontWeight:700, color:"var(--text)",
                      fontFamily:"var(--font-mono)" }}>{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize:12, color:"var(--text-muted)" }}>No status data available.</div>
          )}
        </div>

        <div style={s.panel}>
          <div style={s.panelHead}>Priority Breakdown</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {Object.entries(detail.priority_breakdown || {}).map(([p, count]) => (
              <div key={p} style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:PRIORITY_COLORS[p] || "var(--text-secondary)" }}>{p}</span>
                  <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{count}</span>
                </div>
                <div style={{ height:5, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:3,
                    width: count > 0 ? `${Math.round((count / maxPrio) * 100)}%` : "0%",
                    background: PRIORITY_COLORS[p] || "var(--signal)",
                    transition:"width 0.7s cubic-bezier(0.34,1.56,0.64,1)" }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TEAM WORKLOAD · WORK TYPES */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div style={s.panel}>
          <div style={s.panelHead}>Team Workload</div>
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            {(detail.team_workload || []).slice(0, 8).map(m => (
              <div key={m.assignee} style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:11, color: m.assignee === "Unassigned"
                    ? "var(--text-muted)" : "var(--text-secondary)",
                    fontStyle: m.assignee === "Unassigned" ? "italic" : "normal",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"65%" }}>
                    {m.assignee}
                  </span>
                  <span style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
                    {m.count} · {m.pct}%
                  </span>
                </div>
                <div style={{ height:4, background:"var(--border)", borderRadius:2, overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:2,
                    width:`${Math.round((m.count / maxTeam) * 100)}%`,
                    background: m.assignee === "Unassigned" ? "var(--text-warning)" : "var(--signal)",
                    opacity: m.assignee === "Unassigned" ? 0.6 : 1,
                    transition:"width 0.7s cubic-bezier(0.34,1.56,0.64,1)" }}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={s.panel}>
          <div style={s.panelHead}>Work Types</div>
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            {(detail.type_breakdown || []).slice(0, 8).map(item => (
              <div key={item.type} style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:11, color:"var(--text-secondary)" }}>{item.type}</span>
                  <span style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
                    {item.count} · {item.pct}%
                  </span>
                </div>
                <div style={{ height:4, background:"var(--border)", borderRadius:2, overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:2,
                    width:`${Math.round((item.count / maxType) * 100)}%`,
                    background:"var(--talent)",
                    transition:"width 0.7s cubic-bezier(0.34,1.56,0.64,1)" }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI INSIGHTS */}
      {insights.length > 0 && (
        <div style={{ background:`${accentHex}08`, border:`1px solid ${accentHex}22`,
          borderRadius:12, padding:"14px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <span style={{ color:accentHex }}>◆</span>
            <span style={{ fontSize:11, fontWeight:800, letterSpacing:"0.1em", color:accentHex,
              fontFamily:"var(--font-display)" }}>AI INSIGHTS</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {insights.map((insight, i) => (
              <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                <span style={{ color:accentHex, fontSize:11, flexShrink:0, marginTop:2 }}>→</span>
                <span style={{ fontSize:12, color:"var(--text-secondary)", lineHeight:1.55 }}>{insight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CRITICAL RISKS */}
      <div style={s.sectionHead}>
        <span style={s.sectionLabel}>Critical Risks</span>
        <span style={{ fontSize:10, fontWeight:800, letterSpacing:"0.1em",
          color:accentHex, background:accentHex+"10", border:`1px solid ${accentHex}30`,
          borderRadius:20, padding:"3px 9px" }}>◆ AI resolution</span>
      </div>

      {(!detail.critical_risks || detail.critical_risks.length === 0) ? (
        <div style={s.noRisks}>
          <span style={{ fontSize:18, marginRight:8 }}>✓</span>
          No critical risks — project is in good shape.
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {detail.critical_risks.map(r => <RiskCard key={r.key} risk={r} accentHex={accentHex} />)}
        </div>
      )}
    </div>
  );
}

function RiskCard({ risk, accentHex }) {
  const pc = getPriorityColor(risk.priority);
  return (
    <div style={{ ...s.riskCard, borderLeftColor: pc }}>
      <div style={{ padding:"14px 14px 10px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6, flexWrap:"wrap" }}>
          <span style={{ fontFamily:"var(--font-mono)", fontSize:11, fontWeight:700,
            color:pc, background:pc+"18", border:`1px solid ${pc}40`,
            borderRadius:4, padding:"2px 7px" }}>{risk.key}</span>
          <span style={{ fontSize:11, color:pc, fontWeight:700 }}>{risk.priority}</span>
          {risk.days_overdue > 0 && (
            <span style={s.tag_overdue}>⏰ {risk.days_overdue}d overdue</span>
          )}
          {risk.unassigned && <span style={s.tag_unassigned}>Unassigned</span>}
        </div>
        <p style={{ fontSize:14, fontWeight:600, color:"var(--text)", lineHeight:1.45 }}>{risk.summary}</p>
      </div>
      <div style={{ borderTop:`1px solid ${accentHex}18`, background:`${accentHex}06`, padding:"11px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
          <span style={{ color:accentHex }}>◆</span>
          <span style={{ fontSize:10, fontWeight:800, letterSpacing:"0.1em",
            fontFamily:"var(--font-display)", color:accentHex }}>AI RESOLUTION</span>
        </div>
        {[["Root cause", risk.root_cause], ["Fix", risk.fix], ["Effort", risk.effort]].map(([lbl, txt]) => (
          <div key={lbl} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:5 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"var(--text-secondary)",
              textTransform:"uppercase", letterSpacing:"0.04em",
              flexShrink:0, paddingTop:2, minWidth:72 }}>{lbl}</span>
            <span style={{ fontSize:13, color:"var(--text)", lineHeight:1.55 }}>{txt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── styles ──────────────────────────────────────────────────── */

const s = {
  wrap: { height:"100%", overflowY:"auto", paddingRight:2, display:"flex", flexDirection:"column", gap:14 },
  // Overview root: a flex column that fills the dashboard column height so the
  // activity feed can flex to fit any screen — instead of a fixed-height box
  // that leaves a gap on large desktops and double-scrolls on laptops.
  overviewWrap: { height:"100%", paddingRight:2, display:"flex", flexDirection:"column", gap:14, minHeight:0 },

  /* top bar */
  topBar: { display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:8 },
  topLeft: { display:"flex", flexDirection:"column", gap:2 },
  topTitle: { fontSize:18, fontWeight:700, fontFamily:"var(--font-display)", letterSpacing:"-0.01em" },
  topSub: { fontSize:11, color:"var(--text-muted)" },
  topRight: { display:"flex", alignItems:"center", gap:10, flexShrink:0 },
  syncLabel: { fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" },
  liveBadge: {
    display:"flex", alignItems:"center", gap:6,
    fontSize:11, fontWeight:700, color:"var(--text-muted)",
    fontFamily:"var(--font-mono)", letterSpacing:"0.05em",
    background:"var(--surface-2)", border:"1px solid var(--border)",
    borderRadius:20, padding:"4px 10px",
  },

  /* health banner */
  banner: {
    display:"flex", alignItems:"flex-start", gap:12,
    background:"var(--bg-danger)", border:"1px solid var(--border-danger)",
    borderRadius:12, padding:"14px 16px",
  },
  bannerIcon: { fontSize:18, flexShrink:0, paddingTop:1, color:"var(--text-danger)" },
  bannerHead: { fontSize:14, fontWeight:700, color:"var(--text-danger)", marginBottom:4 },
  bannerSub:  { fontSize:12, color:"var(--text-secondary)", lineHeight:1.6 },

  /* metrics row */
  metricsRow: {
    display:"grid", gridTemplateColumns:"repeat(5,1fr)",
    gap:1, background:"var(--border)", borderRadius:12,
    overflow:"hidden", border:"1px solid var(--border)",
  },
  metCard: {
    background:"var(--surface-1)", padding:"14px 12px",
    display:"flex", flexDirection:"column", alignItems:"center", gap:5,
  },
  metLabel: { fontSize:9, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.09em" },
  metValue: { fontSize:24, fontWeight:800, fontFamily:"var(--font-display)", lineHeight:1 },

  /* section header */
  sectionHead: { display:"flex", alignItems:"center", justifyContent:"space-between" },
  sectionLabel: { fontSize:13, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.07em" },

  /* filter tabs */
  filterRow: { display:"flex", gap:4 },
  filterTab: {
    display:"flex", alignItems:"center", gap:6,
    fontSize:12, fontWeight:600, color:"var(--text-muted)",
    background:"transparent", border:"1px solid var(--border)",
    borderRadius:20, padding:"4px 12px", cursor:"pointer",
    transition:"all 0.15s",
  },
  filterTabActive: {
    color:"var(--text)", background:"var(--surface-2)",
    borderColor:"var(--border-strong)",
  },
  filterBadge: {
    fontSize:10, fontWeight:800,
    color:"var(--text-danger)", background:"var(--bg-danger-pill)",
    borderRadius:10, padding:"0 5px",
  },
  filterBadgeWarn: {
    fontSize:10, fontWeight:800,
    color:"var(--text-warning)", background:"var(--bg-warning)",
    borderRadius:10, padding:"0 5px",
  },

  empty: { color:"var(--text-muted)", fontSize:13, textAlign:"center", padding:"32px 0" },

  /* card grid */
  cardGrid: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 },
  card: {
    background:"var(--surface-1)", borderRadius:12,
    border:"1px solid var(--border)", borderLeft:"3px solid",
    display:"flex", flexDirection:"column", gap:12,
    padding:"14px 14px 12px",
    transition:"transform 0.2s ease, box-shadow 0.2s ease",
    boxShadow:"0 2px 10px rgba(0,0,0,0.3)",
    cursor:"default",
  },

  /* card — top row */
  cardTop: { display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 },
  cardTopLeft: { display:"flex", flexDirection:"column", gap:4, flex:1, minWidth:0 },
  cardKey: { fontSize:10, fontWeight:700, color:"var(--text-muted)", letterSpacing:"0.06em" },
  cardName: { fontSize:14, fontWeight:700, fontFamily:"var(--font-display)",
    color:"var(--text)", lineHeight:1.3, letterSpacing:"-0.01em" },
  statusPill: { fontSize:10, fontWeight:700, borderRadius:20,
    padding:"3px 9px", flexShrink:0, letterSpacing:"0.03em" },

  /* card — mini stats */
  miniRow: {
    display:"grid", gridTemplateColumns:"repeat(3,1fr)",
    background:"var(--surface-2)", borderRadius:8, overflow:"hidden",
    border:"1px solid var(--border)",
  },
  miniBox: {
    display:"flex", flexDirection:"column", alignItems:"center",
    padding:"8px 4px", gap:2,
    borderRight:"1px solid var(--border)",
  },
  miniVal: { fontSize:18, fontWeight:800, fontFamily:"var(--font-display)", lineHeight:1 },
  miniLbl: { fontSize:9, fontWeight:600, color:"var(--text-muted)", letterSpacing:"0.07em", textTransform:"uppercase" },

  /* card — progress */
  progressBlock: { display:"flex", flexDirection:"column", gap:6 },
  progressTopRow: { display:"flex", justifyContent:"space-between", alignItems:"center" },
  progressLbl: { fontSize:11, fontWeight:600, color:"var(--text-muted)" },
  progressPct: { fontSize:12, fontWeight:700 },
  trackWrap: { height:5, background:"var(--surface-2)", borderRadius:3, overflow:"hidden" },
  trackFill: { height:"100%", borderRadius:3, transition:"width 0.7s cubic-bezier(0.34,1.56,0.64,1)" },

  /* card — AI insight */
  insight: {
    display:"flex", alignItems:"flex-start", gap:8,
    background:"var(--surface-2)", border:"1px solid var(--border)",
    borderRadius:8, padding:"9px 10px",
  },
  insightText: { fontSize:11, color:"var(--text-secondary)", lineHeight:1.55, margin:0 },

  /* card — footer */
  cardFoot: {
    display:"flex", alignItems:"center", justifyContent:"space-between",
    borderTop:"1px solid var(--border)", paddingTop:10, marginTop:2,
  },
  footRisk: { fontSize:11, fontWeight:600, color:"var(--text-danger)" },
  footOk:   { fontSize:11, fontWeight:600, color:"var(--text-success)" },
  footLink: {
    fontSize:11, fontWeight:700, background:"none",
    border:"none", cursor:"pointer", fontFamily:"var(--font-body)",
    transition:"opacity 0.15s",
  },

  /* detail view */
  back: {
    color:"var(--signal)", fontSize:13, fontWeight:700, marginBottom:4,
    background:"none", border:"none", cursor:"pointer",
    fontFamily:"var(--font-body)", display:"flex", alignItems:"center", gap:5,
  },
  detailTitle: { fontSize:20, letterSpacing:"-0.015em", lineHeight:1.25, fontFamily:"var(--font-display)", fontWeight:700 },

  /* analytics panels */
  panel: {
    background:"var(--surface-1)", border:"1px solid var(--border)",
    borderRadius:12, padding:"14px 16px",
    display:"flex", flexDirection:"column", gap:12,
  },
  panelHead: {
    fontSize:11, fontWeight:700, color:"var(--text-secondary)",
    textTransform:"uppercase", letterSpacing:"0.08em",
  },

  noRisks: {
    display:"flex", alignItems:"center",
    background:"var(--bg-success)", border:"1px solid var(--border-success)",
    color:"var(--text-success)", padding:"14px 16px", borderRadius:10,
    fontSize:13, fontWeight:600,
  },
  riskCard: {
    background:"var(--surface-1)", border:"1px solid var(--border)",
    borderLeft:"3px solid", borderRadius:12, overflow:"hidden",
  },
  /* activity feed */
  activitySection: { display: "flex", flexDirection: "column", gap: 12, marginTop: 4, flex: 1, minHeight: 0 },
  activityWrap: {
    background: "var(--surface-1)", border: "1px solid var(--border)",
    borderRadius: 12, overflow: "hidden",
    flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
  },
  activityTimeline: {
    display: "flex", flexDirection: "column",
    flex: 1, minHeight: 0, overflowY: "auto",
  },
  activityEmpty: {
    padding: "20px 16px", fontSize: 12,
    color: "var(--text-muted)", textAlign: "center",
  },
  activityItem: {
    display: "flex", alignItems: "flex-start", gap: 10,
    padding: "11px 14px",
    borderBottom: "1px solid var(--border)",
    position: "relative",
  },
  activityDot: {
    width: 8, height: 8, borderRadius: "50%",
    flexShrink: 0, marginTop: 6,
  },
  activityAvatar: {
    width: 28, height: 28, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 10, fontWeight: 800,
    fontFamily: "var(--font-display)", flexShrink: 0,
  },
  activityContent: { flex: 1, minWidth: 0 },
  activityTopRow: {
    display: "flex", alignItems: "center", gap: 6,
    flexWrap: "wrap", marginBottom: 5,
  },
  activityAuthor: { fontSize: 12, fontWeight: 700, color: "var(--text)", flexShrink: 0 },
  activityChip: {
    fontSize: 9, fontWeight: 800, borderRadius: 10,
    padding: "1px 6px", letterSpacing: "0.05em",
    textTransform: "uppercase", flexShrink: 0,
  },
  activityDesc: { fontSize: 11, color: "var(--text-muted)", flex: 1 },
  activityTime: {
    fontSize: 10, color: "var(--text-muted)",
    fontFamily: "var(--font-mono)", marginLeft: "auto", flexShrink: 0,
  },
  activityBotRow: { display: "flex", alignItems: "center", gap: 6 },
  activityKey: {
    fontSize: 10, fontWeight: 700, borderRadius: 4,
    padding: "1px 5px", fontFamily: "var(--font-mono)", flexShrink: 0,
  },
  activitySummary: {
    fontSize: 11, color: "var(--text-secondary)",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
  },
  activityCommentSnippet: {
    fontSize: 11, color: "#f87171", fontStyle: "italic",
    marginTop: 5, paddingLeft: 8,
    borderLeft: "2px solid rgba(248,113,113,0.25)",
    lineHeight: 1.45,
  },
  activityProjectTag: {
    fontSize: 9, fontWeight: 800, letterSpacing: "0.05em",
    color: "var(--text-muted)", background: "var(--surface-2)",
    border: "1px solid var(--border)", borderRadius: 10, padding: "1px 7px",
    flexShrink: 0,
  },

  tag_overdue: {
    fontSize:11, fontWeight:600, color:"var(--text-danger)",
    background:"var(--bg-danger-pill)", border:"1px solid var(--border-danger)",
    borderRadius:4, padding:"1px 6px",
  },
  tag_unassigned: {
    fontSize:11, fontWeight:600, color:"var(--text-warning)",
    background:"var(--bg-warning)", border:"1px solid var(--border-warning)",
    borderRadius:4, padding:"1px 6px",
  },
};
