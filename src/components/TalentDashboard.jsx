import { useState, useEffect, useCallback } from "react";
import { getTalentDashboard, getTalentMatrix, triggerTalentSync } from "../api/client.js";

const ACCENT = "#a78bfa";

const LEVEL_STYLE = {
  primary:   { bg: "#a78bfa22", color: "#a78bfa", label: "●" },
  secondary: { bg: "#a78bfa0d", color: "#6d5fa8", label: "◌" },
};

const STATUS_COLOR = {
  available:  "var(--ok)",
  allocated:  "var(--signal)",
  bench:      "var(--warn)",
  on_leave:   "var(--text-mute)",
};

export default function TalentDashboard({ accentHex = ACCENT }) {
  const [tab, setTab]         = useState("overview");
  const [stats, setStats]     = useState(null);
  const [matrix, setMatrix]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [error, setError]     = useState(null);
  const [deptFilter, setDeptFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([getTalentDashboard(), getTalentMatrix()])
      .then(([s, m]) => { setStats(s); setMatrix(m); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await triggerTalentSync();
      setSyncMsg(r.synced
        ? `Synced from Jira — ${r.employees_matched} matched, ${r.allocations_created} allocations rebuilt.`
        : `Sync skipped: ${r.reason}`);
      loadData();
    } catch (e) {
      setSyncMsg(`Sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <Skeleton accentHex={accentHex} />;
  if (error)   return <ErrorState message={error} />;

  const filteredMatrix = matrix ? {
    ...matrix,
    employees: matrix.employees.filter(e =>
      (!deptFilter || e.department === deptFilter) &&
      (!skillFilter || e.skills[skillFilter] != null)
    ),
    skills: matrix.skills,
  } : null;

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.head}>
        <div style={s.headLeft}>
          <span style={{ ...s.badge, color: accentHex, borderColor: accentHex + "45", background: accentHex + "10" }} className="mono">TM</span>
          <h2 style={s.title}>Talent Management</h2>
          {stats?.overallocated_count > 0 && (
            <span style={s.alertPill}>⚠ {stats.overallocated_count} overallocated</span>
          )}
        </div>
        <button
          style={{ ...s.syncBtn, opacity: syncing ? 0.6 : 1 }}
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? "Syncing…" : "⟳ Sync Jira"}
        </button>
      </div>

      {syncMsg && (
        <div style={s.syncBanner}>{syncMsg}</div>
      )}

      {/* Tabs */}
      <div style={s.tabs}>
        {["overview", "skill-matrix"].map(t => (
          <button
            key={t}
            style={{ ...s.tab, ...(tab === t ? { ...s.tabActive, borderBottomColor: accentHex, color: accentHex } : {}) }}
            onClick={() => setTab(t)}
          >
            {t === "overview" ? "Overview" : "Skill Matrix"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={s.content}>
        {tab === "overview" && stats && <OverviewTab stats={stats} accentHex={accentHex} />}
        {tab === "skill-matrix" && filteredMatrix && (
          <SkillMatrixTab
            matrix={filteredMatrix}
            accentHex={accentHex}
            deptFilter={deptFilter}
            setDeptFilter={setDeptFilter}
            skillFilter={skillFilter}
            setSkillFilter={setSkillFilter}
          />
        )}
      </div>
    </div>
  );
}

/* ── Overview tab ──────────────────────────────────────────────────────────── */

function OverviewTab({ stats, accentHex }) {
  const utilColor =
    stats.avg_utilization >= 90 ? "var(--risk)" :
    stats.avg_utilization >= 70 ? "var(--warn)" : "var(--ok)";

  const cards = [
    { label: "Total",         value: stats.total_employees,      sub: "in account",                color: accentHex,       icon: "👥" },
    { label: "Available",     value: stats.available_employees,  sub: "ready to staff",            color: "var(--ok)",     icon: "✓"  },
    { label: "Allocated",     value: stats.allocated_employees,  sub: "on active projects",        color: "var(--signal)", icon: "◈"  },
    { label: "On Bench",      value: stats.bench_count,          sub: stats.bench_count > 2 ? "needs attention" : "bench clear", color: stats.bench_count > 2 ? "var(--risk)" : "var(--warn)", icon: "⏳", alert: stats.bench_count > 2 },
    { label: "Avg Utilization", value: `${stats.avg_utilization}%`, sub: stats.avg_utilization < 60 ? "under-utilized" : stats.avg_utilization > 90 ? "near capacity" : "healthy", color: utilColor, icon: "◎" },
    { label: "Capacity Left", value: `${stats.capacity_remaining_hours}h`, sub: "weekly across account", color: "var(--ok)", icon: "⚡" },
    { label: "Free in 30d",   value: stats.free_in_30_days,      sub: "rolling off soon",          color: stats.free_in_30_days > 0 ? "var(--warn)" : "var(--text-dim)", icon: "📅" },
    { label: "Skill Coverage",value: `${stats.skill_coverage_pct}%`, sub: "of project requirements", color: stats.skill_coverage_pct >= 90 ? "var(--ok)" : "var(--warn)", icon: "◆" },
  ];

  return (
    <>
      <div style={s.grid}>
        {cards.map(c => <StatCard key={c.label} {...c} />)}
      </div>
      {stats.bench_count > 0 && (
        <div style={s.notice}>
          <span style={{ color: "var(--warn)", marginRight: 8 }}>⚠</span>
          <span>
            <strong style={{ color: "var(--text)" }}>{stats.bench_count} on bench.</strong>
            {" "}{stats.free_in_30_days > 0
              ? `${stats.free_in_30_days} more rolling off within 30 days. Review open project requirements.`
              : "No upcoming project endings — consider proactive staffing now."}
          </span>
        </div>
      )}
    </>
  );
}

/* ── Skill Matrix tab ──────────────────────────────────────────────────────── */

function SkillMatrixTab({ matrix, accentHex, deptFilter, setDeptFilter, skillFilter, setSkillFilter }) {
  const categories = matrix.skill_categories || {};

  // Group skills by category for header grouping
  const catGroups = {};
  for (const skill of matrix.skills) {
    const cat = categories[skill] || "Other";
    if (!catGroups[cat]) catGroups[cat] = [];
    catGroups[cat].push(skill);
  }
  const orderedCats = ["Frontend", "Backend", "Data", "Cloud", "AI/ML", "Security", "Quality", "Management", "Other"]
    .filter(c => catGroups[c]?.length > 0);

  return (
    <div style={s.matrixWrap}>
      {/* Filters */}
      <div style={s.filterRow}>
        <select
          style={s.select}
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
        >
          <option value="">All Departments</option>
          {matrix.departments?.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          style={s.select}
          value={skillFilter}
          onChange={e => setSkillFilter(e.target.value)}
        >
          <option value="">All Skills</option>
          {matrix.skills.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={s.filterHint}>
          {matrix.employees.length} people · {matrix.skills.length} skills
        </span>
        <span style={s.legend}>
          <span style={{ color: "#a78bfa" }}>● Primary</span>
          <span style={{ color: "#6d5fa8", marginLeft: 10 }}>◌ Secondary</span>
        </span>
      </div>

      {/* Scrollable matrix */}
      <div style={s.tableOuter}>
        <table style={s.table}>
          <thead>
            {/* Category row */}
            <tr>
              <th style={{ ...s.th, ...s.stickyCol, minWidth: 160 }} rowSpan={2}>Employee</th>
              <th style={{ ...s.th, minWidth: 60 }} rowSpan={2}>Status</th>
              {orderedCats.map(cat => (
                <th
                  key={cat}
                  style={{ ...s.th, ...s.catHeader, color: accentHex + "cc" }}
                  colSpan={catGroups[cat].length}
                >
                  {cat}
                </th>
              ))}
            </tr>
            {/* Skill name row */}
            <tr>
              {orderedCats.flatMap(cat =>
                catGroups[cat].map(skill => (
                  <th key={skill} style={s.skillTh} title={skill}>
                    <span style={s.skillLabel}>{skill}</span>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {matrix.employees.map((emp, ri) => (
              <tr key={emp.id} style={{ background: ri % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                <td style={{ ...s.td, ...s.stickyCol }}>
                  <div style={s.empName}>{emp.name}</div>
                  <div style={s.empSub}>{emp.designation}</div>
                </td>
                <td style={s.td}>
                  <span style={{ ...s.statusDot, color: STATUS_COLOR[emp.status] || "var(--text-mute)" }}>
                    {emp.status === "available" ? "✓" : emp.status === "bench" ? "⏳" : emp.status === "on_leave" ? "—" : "◈"}
                  </span>
                </td>
                {orderedCats.flatMap(cat =>
                  catGroups[cat].map(skill => {
                    const level = emp.skills[skill];
                    const ls    = LEVEL_STYLE[level];
                    return (
                      <td key={skill} style={{ ...s.td, ...s.cell }}>
                        {ls && (
                          <span
                            title={`${emp.name} — ${skill} (${level})`}
                            style={{ ...s.skillDot, background: ls.bg, color: ls.color }}
                          >
                            {ls.label}
                          </span>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────────────────── */

function StatCard({ label, value, sub, color, icon, alert }) {
  return (
    <div style={{ ...s.card, borderColor: alert ? "rgba(248,113,113,0.25)" : "rgba(42,49,64,0.7)" }}>
      <div style={s.cardTop}>
        <span style={{ ...s.iconWrap, background: color + "15" }}>{icon}</span>
        {alert && <span style={s.alertDot} />}
      </div>
      <div style={{ ...s.cardValue, color }}>{value}</div>
      <div style={s.cardLabel}>{label}</div>
      <div style={s.cardSub}>{sub}</div>
    </div>
  );
}

function Skeleton({ accentHex }) {
  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <div style={s.headLeft}>
          <span style={{ ...s.badge, color: accentHex, borderColor: accentHex + "45", background: accentHex + "10" }} className="mono">TM</span>
          <h2 style={s.title}>Talent Management</h2>
        </div>
      </div>
      <div style={s.grid}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ ...s.card, minHeight: 100 }}>
            <div style={{ width: "60%", height: 28, borderRadius: 6, background: "rgba(255,255,255,0.05)", marginBottom: 10 }} />
            <div style={{ width: "80%", height: 12, borderRadius: 4, background: "rgba(255,255,255,0.04)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
      <span style={{ fontSize: 32, color: "var(--warn)" }}>⚠</span>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>Could not load talent data</p>
      <p style={{ fontSize: 13, color: "var(--text-danger)", fontFamily: "var(--font-mono)" }}>{message}</p>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */

const s = {
  wrap:    { display: "flex", flexDirection: "column", height: "100%", gap: 16, minHeight: 0 },
  head:    { display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
  headLeft:{ display: "flex", alignItems: "center", gap: 10 },
  badge:   { fontSize: 11, fontWeight: 700, border: "1px solid", borderRadius: 5, padding: "2px 8px", letterSpacing: "0.05em" },
  title:   { fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" },
  alertPill: { fontSize: 11, fontWeight: 700, color: "var(--text-danger)", background: "var(--bg-danger-pill)", border: "1px solid var(--border-danger)", borderRadius: 20, padding: "3px 10px" },
  syncBtn: { fontSize: 12, fontWeight: 600, color: "var(--signal)", background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.25)", borderRadius: "var(--radius)", padding: "6px 14px", cursor: "pointer", transition: "all 0.15s" },
  syncBanner: { fontSize: 12, color: "var(--ok)", background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "var(--radius)", padding: "8px 12px", flexShrink: 0 },
  tabs:    { display: "flex", gap: 0, borderBottom: "1px solid var(--border)", flexShrink: 0 },
  tab:     { background: "none", border: "none", borderBottom: "2px solid transparent", padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-mute)", cursor: "pointer", transition: "all 0.15s" },
  tabActive: { color: ACCENT, borderBottomColor: ACCENT },
  content: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 },

  // Overview
  grid:    { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 },
  card:    { background: "rgba(29,35,48,0.8)", border: "1px solid", borderRadius: "var(--radius-lg)", padding: "14px", display: "flex", flexDirection: "column", gap: 4 },
  cardTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  iconWrap:{ width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 },
  alertDot:{ width: 7, height: 7, borderRadius: "50%", background: "var(--risk)", boxShadow: "0 0 6px var(--risk)" },
  cardValue: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", lineHeight: 1 },
  cardLabel: { fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginTop: 5 },
  cardSub:   { fontSize: 11, color: "var(--text-mute)" },
  notice:  { background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, color: "var(--text-dim)", lineHeight: 1.55 },

  // Matrix
  matrixWrap: { display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0, overflow: "hidden" },
  filterRow:  { display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" },
  select:     { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text-dim)", fontSize: 12, padding: "5px 10px", cursor: "pointer" },
  filterHint: { fontSize: 11, color: "var(--text-mute)", marginLeft: "auto" },
  legend:     { fontSize: 11, fontWeight: 600, display: "flex", gap: 4 },
  tableOuter: { flex: 1, overflow: "auto", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" },
  table:      { borderCollapse: "collapse", width: "max-content", minWidth: "100%" },
  th:         { background: "var(--surface)", color: "var(--text-mute)", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", padding: "8px 6px", textAlign: "center", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 2 },
  catHeader:  { fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", borderLeft: "1px solid var(--border)", paddingBottom: 4 },
  skillTh:    { background: "var(--surface)", padding: "4px 3px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0 },
  skillLabel: { display: "inline-block", transform: "rotate(-45deg)", transformOrigin: "bottom left", whiteSpace: "nowrap", fontSize: 9, color: "var(--text-mute)", marginLeft: 8, marginBottom: 2 },
  stickyCol:  { position: "sticky", left: 0, zIndex: 3, background: "var(--surface)" },
  td:         { padding: "6px 4px", borderBottom: "1px solid rgba(42,49,64,0.4)", verticalAlign: "middle" },
  empName:    { fontSize: 12, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" },
  empSub:     { fontSize: 10, color: "var(--text-mute)", whiteSpace: "nowrap" },
  statusDot:  { fontSize: 13, display: "block", textAlign: "center" },
  cell:       { textAlign: "center", minWidth: 28, maxWidth: 36 },
  skillDot:   { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 4, fontSize: 13, fontWeight: 700 },
};
