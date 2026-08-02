import { useState, useEffect, useCallback } from "react";
import {
  getFinopsDashboard,
  setFinopsBudget,
  sendFinopsSlackDigest,
  getFinopsLiveDataSetting,
  setFinopsLiveDataSetting,
} from "../api/client.js";

const ACCENT = "#f97316";
const FINOPS_AGENT_URL = "https://ums5jgmfzv8odb8iklfgnix0.webapp.finops-agent.global.app.aws/";

const SEVERITY_COLOR = {
  critical: "var(--risk)",
  high: "var(--warn)",
  medium: "var(--signal)",
};

function money(n, opts = {}) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2, ...opts });
}

export default function FinOpsDashboard({ accentHex = ACCENT }) {
  const [tab, setTab]         = useState("overview");
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState(null);
  const [liveEnabled, setLiveEnabled] = useState(null);
  const [toggling, setToggling] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    getFinopsDashboard()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    getFinopsLiveDataSetting()
      .then(r => setLiveEnabled(r.live_data_enabled))
      .catch(() => {}); // header still renders fine without the toggle's state
  }, []);

  const handleDigest = async () => {
    setSending(true);
    setSendMsg(null);
    try {
      await sendFinopsSlackDigest();
      setSendMsg("Digest sent to Slack.");
    } catch (e) {
      setSendMsg(`Send failed: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleToggleLive = async () => {
    if (liveEnabled === null || toggling) return;
    setToggling(true);
    try {
      const r = await setFinopsLiveDataSetting(!liveEnabled);
      setLiveEnabled(r.live_data_enabled);
      loadData();
    } catch (e) {
      setSendMsg(`Couldn't switch data source: ${e.message}`);
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <Skeleton accentHex={accentHex} />;
  if (error)   return <ErrorState message={error} />;

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.head}>
        <div style={s.headLeft}>
          <div style={s.headLeftRow}>
            <span style={{ ...s.badge, color: accentHex, borderColor: accentHex + "45", background: accentHex + "10" }} className="mono">FO</span>
            <h2 style={s.title}>Cloud FinOps</h2>
            {stats.cost_summary.account_id && (
              <span style={s.acctChip} className="mono" title="AWS account ID">{stats.cost_summary.account_id}</span>
            )}
          </div>
          <span style={s.topSub}>AWS cost visibility · AI anomaly & rightsizing insights</span>
        </div>
        <div style={s.headActions}>
          <button
            style={{
              ...s.liveToggle,
              ...(liveEnabled ? s.liveToggleOn : s.liveToggleOff),
              opacity: liveEnabled === null || toggling ? 0.6 : 1,
            }}
            onClick={handleToggleLive}
            disabled={liveEnabled === null || toggling}
            title={liveEnabled ? "Hitting real AWS Cost Explorer — costs $0.01/request. Click to switch to mock data." : "Showing fabricated mock data — no AWS charges. Click to switch to live AWS data."}
          >
            <span style={{ ...s.liveDot, background: liveEnabled ? "var(--ok)" : "var(--text-mute)" }} />
            {toggling ? "Switching…" : liveEnabled ? "Live AWS" : "Mock data"}
          </button>
          <button
            style={{ ...s.digestBtn, opacity: sending ? 0.6 : 1 }}
            onClick={handleDigest}
            disabled={sending}
            title="Post this dashboard's summary to Slack"
          >
            {sending ? "Sending…" : "✉ Send Slack digest"}
          </button>
          <a
            href={FINOPS_AGENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...s.agentLink, color: accentHex, borderColor: accentHex + "45", background: accentHex + "10" }}
          >
            Open AWS FinOps Agent ↗
          </a>
        </div>
      </div>

      {sendMsg && <div style={s.sendBanner}>{sendMsg}</div>}

      {/* Tabs */}
      <div style={s.tabs}>
        {[
          ["overview", "Overview"],
          ["anomalies", `Anomalies${stats.anomalies.anomalies.length ? ` (${stats.anomalies.anomalies.length})` : ""}`],
          ["rightsizing", "Rightsizing"],
          ["budget", "Budget & Forecast"],
        ].map(([t, label]) => (
          <button
            key={t}
            style={{ ...s.tab, ...(tab === t ? { color: accentHex, borderBottom: `2px solid ${accentHex}` } : {}) }}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={s.content}>
        {tab === "overview" && <OverviewTab stats={stats} accentHex={accentHex} />}
        {tab === "anomalies" && <AnomaliesTab result={stats.anomalies} accentHex={accentHex} />}
        {tab === "rightsizing" && <RightsizingTab result={stats.rightsizing} accentHex={accentHex} />}
        {tab === "budget" && <BudgetTab budget={stats.budget} accentHex={accentHex} onSaved={loadData} />}
      </div>
    </div>
  );
}

/* ── Overview tab ──────────────────────────────────────────────────────────── */

function OverviewTab({ stats, accentHex }) {
  const cs = stats.cost_summary;
  const savings = stats.rightsizing.total_estimated_monthly_savings;

  const cards = [
    { label: "Month-to-date",     value: money(cs.total_mtd),  sub: "spend this month",           color: accentHex,       icon: "◈" },
    { label: "Trailing 30d",      value: money(cs.total_30d),  sub: `${money(cs.daily_avg)}/day avg`, color: "var(--signal)", icon: "◎" },
    { label: "Potential Savings", value: money(savings),       sub: savings > 0 ? "rightsizing opportunities" : "none identified", color: savings > 0 ? "var(--ok)" : "var(--text-dim)", icon: "⚡", alert: savings > 0 },
    { label: "Anomalies",         value: stats.anomalies.anomalies.length, sub: stats.anomalies.anomalies.length ? "need review" : "none flagged", color: stats.anomalies.anomalies.length ? "var(--risk)" : "var(--ok)", icon: "⚠", alert: stats.anomalies.anomalies.length > 0 },
    { label: "EC2 Instances",     value: stats.rightsizing.ec2_instance_count, sub: "in account/region", color: "var(--text-dim)", icon: "🖥" },
    { label: "Budget Status",     value: statusLabel(stats.budget.status), sub: stats.budget.target_monthly_budget ? `${money(stats.budget.target_monthly_budget)}/mo target` : "no target set", color: budgetColor(stats.budget.status), icon: "◆" },
  ];

  return (
    <>
      <div style={s.grid}>
        {cards.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      <DailyTrendPanel trend={cs.daily_trend} accentHex={accentHex} dataSource={cs.data_source} />
    </>
  );
}

function statusLabel(status) {
  return { on_track: "On track", at_risk: "At risk", over_budget: "Over budget", no_budget_set: "Not set" }[status] || status;
}
function budgetColor(status) {
  return { on_track: "var(--ok)", at_risk: "var(--warn)", over_budget: "var(--risk)", no_budget_set: "var(--text-dim)" }[status] || "var(--text-dim)";
}

function DailyTrendPanel({ trend, accentHex, dataSource }) {
  const max = Math.max(...trend.map(p => p.amount), 0.01);
  return (
    <div style={s.panel}>
      <div style={s.panelHead}>
        <span style={s.panelTitle}>Daily Spend Trend</span>
        <span style={s.panelSub}>{trend.length} days · {dataSource === "mock" ? "mock data" : "live Cost Explorer data"}</span>
      </div>
      <div style={s.barRow}>
        {trend.map(p => (
          <div key={p.date} style={s.barCol} title={`${p.date}: ${money(p.amount)}`}>
            <div style={{ ...s.bar, height: `${Math.max((p.amount / max) * 100, p.amount > 0 ? 4 : 1)}%`, background: accentHex + "cc" }} />
          </div>
        ))}
      </div>
      <div style={s.barAxis}>
        <span>{trend[0]?.date}</span>
        <span>{trend[trend.length - 1]?.date}</span>
      </div>
    </div>
  );
}

/* ── Anomalies tab ─────────────────────────────────────────────────────────── */

function AnomaliesTab({ result, accentHex }) {
  if (!result.anomalies.length) {
    return (
      <div style={s.noRisks}>
        <span style={{ fontSize: 18, marginRight: 8 }}>✓</span>
        {result.note || "No anomalies detected."}
        {!result.monitors_configured && (
          <div style={s.hintNote}>
            AWS Cost Anomaly Detection monitors aren't configured for this account — a statistical
            day-over-day check runs automatically in the meantime and will flag spikes here once there's
            enough spend variance to detect.
          </div>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {result.anomalies.map(a => <AnomalyCard key={a.id} anomaly={a} accentHex={accentHex} />)}
    </div>
  );
}

function AnomalyCard({ anomaly, accentHex }) {
  const color = SEVERITY_COLOR[anomaly.severity] || "var(--signal)";
  return (
    <div style={{ ...s.riskCard, borderLeftColor: color }}>
      <div style={s.riskTop}>
        <div>
          <span style={{ ...s.sevChip, color, borderColor: color + "45", background: color + "12" }}>{anomaly.severity.toUpperCase()}</span>
          <span style={s.riskScope}>{anomaly.scope}</span>
        </div>
        <span style={s.riskDate}>{anomaly.date}</span>
      </div>
      <div style={s.riskAmounts}>
        Actual <strong style={{ color: "var(--text)" }}>{money(anomaly.actual_amount)}</strong> vs expected{" "}
        <strong style={{ color: "var(--text)" }}>{money(anomaly.expected_amount)}</strong>
        {" "}({anomaly.delta_pct >= 0 ? "+" : ""}{anomaly.delta_pct.toFixed(1)}%)
      </div>
      <div style={s.aiBlock}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", fontFamily: "var(--font-display)", color: accentHex }}>
          {anomaly.source === "aws_anomaly_detection" ? "AWS ANOMALY DETECTION" : "STATISTICAL ANALYSIS"}
        </span>
        {[["Root cause", anomaly.root_cause], ["Recommended action", anomaly.recommended_action]].map(([lbl, txt]) => (
          <div key={lbl} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 6 }}>
            <span style={s.riskLbl}>{lbl}</span>
            <span style={s.riskTxt}>{txt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Rightsizing tab ───────────────────────────────────────────────────────── */

function RightsizingTab({ result, accentHex }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={s.savingsHero}>
        <div>
          <div style={s.savingsHeroLabel}>Total potential monthly savings</div>
          <div style={{ ...s.savingsHeroValue, color: "var(--ok)" }}>{money(result.total_estimated_monthly_savings)}</div>
        </div>
        <div style={s.enrollChip}>
          Compute Optimizer: <strong style={{ color: result.compute_optimizer_enrolled ? "var(--ok)" : "var(--warn)" }}>
            {result.compute_optimizer_enrolled ? "Enrolled" : "Not enrolled"}
          </strong>
        </div>
      </div>

      {result.note && <div style={s.hintNote}>{result.note}</div>}

      {!result.recommendations.length ? (
        <div style={s.noRisks}>
          <span style={{ fontSize: 18, marginRight: 8 }}>✓</span>
          No rightsizing opportunities found.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {result.recommendations.map(r => (
            <div key={r.resource_id + r.finding} style={s.rsCard}>
              <div style={s.rsTop}>
                <div>
                  <span style={s.rsType}>{r.resource_type}</span>
                  <span style={s.rsId}>{r.resource_id}</span>
                </div>
                <span style={{ ...s.savingsChip, color: r.estimated_monthly_savings > 0 ? "var(--ok)" : "var(--text-mute)" }}>
                  {r.estimated_monthly_savings > 0 ? `save ${money(r.estimated_monthly_savings)}/mo` : "review"}
                </span>
              </div>
              <div style={s.rsSpec}>
                <span style={{ color: "var(--text-dim)" }}>{r.current_spec}</span>
                <span style={{ color: "var(--text-mute)", margin: "0 6px" }}>→</span>
                <span style={{ color: accentHex, fontWeight: 700 }}>{r.recommended_spec}</span>
              </div>
              <div style={s.rsReason}>{r.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Budget tab ────────────────────────────────────────────────────────────── */

function BudgetTab({ budget, accentHex, onSaved }) {
  const [value, setValue] = useState(budget.target_monthly_budget ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const amount = parseFloat(value);
    if (Number.isNaN(amount) || amount < 0) return;
    setSaving(true);
    try {
      await setFinopsBudget(amount);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const pct = Math.min(budget.pct_used ?? 0, 100);
  const barColor = budgetColor(budget.status);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={s.panel}>
        <div style={s.panelHead}><span style={s.panelTitle}>Target Monthly Budget</span></div>
        <div style={s.budgetInputRow}>
          <span style={{ color: "var(--text-mute)" }}>$</span>
          <input
            type="number"
            min="0"
            step="10"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="e.g. 500"
            style={s.budgetInput}
          />
          <button style={{ ...s.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {budget.target_monthly_budget ? (
          <>
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: `${pct}%`, background: barColor }} />
            </div>
            <div style={s.progressLabels}>
              <span>{money(budget.mtd_spend)} spent ({pct.toFixed(1)}%)</span>
              <span>{money(budget.target_monthly_budget)} target</span>
            </div>
          </>
        ) : (
          <div style={s.emptyNote}>Set a target to track month-to-date spend and forecast against it.</div>
        )}
      </div>

      <div style={s.panel}>
        <div style={s.panelHead}>
          <span style={s.panelTitle}>Month-End Forecast</span>
          <span style={s.panelSub}>{budget.forecast_source === "aws_forecast" ? "AWS Cost Explorer forecast" : budget.forecast_source === "linear_projection" ? "linear projection (insufficient AWS forecast history)" : "unavailable"}</span>
        </div>
        {budget.forecast_month_end != null ? (
          <div style={s.forecastValue}>{money(budget.forecast_month_end)}</div>
        ) : (
          <div style={s.emptyNote}>Forecast unavailable.</div>
        )}
      </div>

      {budget.aws_budgets.length > 0 && (
        <div style={s.panel}>
          <div style={s.panelHead}><span style={s.panelTitle}>AWS Budgets (configured in console)</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {budget.aws_budgets.map(b => (
              <div key={b.name} style={s.serviceRow}>
                <span style={s.serviceName}>{b.name}</span>
                <span style={s.serviceAmount}>{money(b.actual_spend)} / {money(b.limit)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
          <div style={s.headLeftRow}>
            <span style={{ ...s.badge, color: accentHex, borderColor: accentHex + "45", background: accentHex + "10" }} className="mono">FO</span>
            <h2 style={s.title}>Cloud FinOps</h2>
          </div>
          <span style={s.skelLoadingNote}>Fetching FinOps data…</span>
        </div>
      </div>
      <div style={s.grid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ ...s.card, minHeight: 100 }}>
            <div className="skeleton" style={{ width: "40%", height: 22, marginBottom: 10 }} />
            <div className="skeleton" style={{ width: "70%", height: 12 }} />
          </div>
        ))}
      </div>
      <div style={s.panel}>
        <div className="skeleton" style={{ width: 140, height: 13, marginBottom: 14 }} />
        <div className="skeleton" style={{ width: "100%", height: 90 }} />
      </div>
      <div style={s.panel}>
        <div className="skeleton" style={{ width: 120, height: 13, marginBottom: 14 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ width: "100%", height: 20, marginBottom: 8 }} />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
      <span style={{ fontSize: 32, color: "var(--warn)" }}>⚠</span>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>Could not load FinOps data</p>
      <p style={{ fontSize: 13, color: "var(--text-danger)", fontFamily: "var(--font-mono)" }}>{message}</p>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */

const s = {
  wrap:    { display: "flex", flexDirection: "column", height: "100%", gap: 16, minHeight: 0, overflow: "auto" },
  head:    { display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, flexWrap: "wrap", gap: 10 },
  headLeft:{ display: "flex", flexDirection: "column", gap: 4 },
  headLeftRow: { display: "flex", alignItems: "center", gap: 10 },
  headActions: { display: "flex", alignItems: "center", gap: 8 },
  badge:   { fontSize: 11, fontWeight: 700, border: "1px solid", borderRadius: 5, padding: "2px 8px", letterSpacing: "0.05em" },
  title:   { fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" },
  topSub:  { fontSize: 11, color: "var(--text-mute)" },
  acctChip:{ fontSize: 11, color: "var(--text-mute)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 20, padding: "2px 10px" },
  skelLoadingNote: { fontSize: 11, color: "var(--text-mute)", fontStyle: "italic" },
  digestBtn: { fontSize: 12, fontWeight: 600, color: "var(--signal)", background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.25)", borderRadius: "var(--radius)", padding: "6px 14px", cursor: "pointer", transition: "all 0.15s" },
  liveToggle: { display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, borderRadius: "var(--radius)", padding: "6px 14px", cursor: "pointer", transition: "all 0.15s", border: "1px solid" },
  liveToggleOn: { color: "var(--ok)", background: "rgba(52,211,153,0.08)", borderColor: "rgba(52,211,153,0.25)" },
  liveToggleOff: { color: "var(--text-dim)", background: "var(--surface-2)", borderColor: "var(--border)" },
  liveDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  agentLink: { fontSize: 12, fontWeight: 700, border: "1px solid", borderRadius: "var(--radius)", padding: "6px 14px", textDecoration: "none", whiteSpace: "nowrap" },
  sendBanner: { fontSize: 12, color: "var(--ok)", background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "var(--radius)", padding: "8px 12px", flexShrink: 0 },

  tabs:    { display: "flex", gap: 0, borderBottom: "1px solid var(--border)", flexShrink: 0 },
  tab:     { background: "none", border: "none", borderBottom: "2px solid transparent", padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-mute)", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" },
  content: { flex: 1, display: "flex", flexDirection: "column", gap: 14, minHeight: 0 },

  grid:    { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 },
  card:    { background: "var(--surface-2)", border: "1px solid", borderRadius: "var(--radius-lg)", padding: "14px", display: "flex", flexDirection: "column", gap: 4 },
  cardTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  iconWrap:{ width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 },
  alertDot:{ width: 7, height: 7, borderRadius: "50%", background: "var(--risk)", boxShadow: "0 0 6px var(--risk)" },
  cardValue: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, letterSpacing: "-0.02em", lineHeight: 1 },
  cardLabel: { fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginTop: 5 },
  cardSub:   { fontSize: 11, color: "var(--text-mute)" },

  panel: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 },
  panelHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  panelTitle: { fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--text)" },
  panelSub: { fontSize: 11, color: "var(--text-mute)" },
  emptyNote: { fontSize: 12, color: "var(--text-mute)", padding: "8px 0" },

  barRow: { display: "flex", alignItems: "flex-end", gap: 2, height: 90 },
  barCol: { flex: 1, height: "100%", display: "flex", alignItems: "flex-end" },
  bar: { width: "100%", borderRadius: "2px 2px 0 0", minHeight: 1, transition: "height 0.2s" },
  barAxis: { display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-mute)", fontFamily: "var(--font-mono)" },

  serviceRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  serviceName: { fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  serviceAmount: { fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text)", fontWeight: 600, whiteSpace: "nowrap" },

  noRisks: { display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "16px 4px", color: "var(--text-dim)", fontSize: 13 },
  hintNote: { marginTop: 8, fontSize: 12, color: "var(--text-mute)", lineHeight: 1.6, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px" },

  riskCard: { background: "var(--surface-2)", border: "1px solid var(--border)", borderLeft: "3px solid", borderRadius: "var(--radius)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 },
  riskTop: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  sevChip: { fontSize: 10, fontWeight: 800, border: "1px solid", borderRadius: 20, padding: "2px 8px", letterSpacing: "0.05em", marginRight: 8 },
  riskScope: { fontSize: 13, fontWeight: 700, color: "var(--text)" },
  riskDate: { fontSize: 11, color: "var(--text-mute)", fontFamily: "var(--font-mono)" },
  riskAmounts: { fontSize: 12, color: "var(--text-dim)" },
  aiBlock: { background: "rgba(255,255,255,0.02)", borderRadius: "var(--radius)", padding: "8px 10px" },
  riskLbl: { fontSize: 11, fontWeight: 700, color: "var(--text-secondary, var(--text-mute))", textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0, minWidth: 110 },
  riskTxt: { fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 },

  savingsHero: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px 18px", flexWrap: "wrap", gap: 10 },
  savingsHeroLabel: { fontSize: 12, color: "var(--text-mute)", marginBottom: 4 },
  savingsHeroValue: { fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800 },
  enrollChip: { fontSize: 12, color: "var(--text-dim)" },

  rsCard: { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 },
  rsTop: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  rsType: { fontSize: 10, fontWeight: 700, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 8 },
  rsId: { fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text)", fontWeight: 600 },
  savingsChip: { fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" },
  rsSpec: { fontSize: 12 },
  rsReason: { fontSize: 12, color: "var(--text-mute)", lineHeight: 1.5 },

  budgetInputRow: { display: "flex", alignItems: "center", gap: 8 },
  budgetInput: { flex: 1, maxWidth: 160, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text)", fontSize: 13, padding: "6px 10px" },
  saveBtn: { fontSize: 12, fontWeight: 600, color: "var(--ok)", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: "var(--radius)", padding: "6px 14px", cursor: "pointer" },
  progressTrack: { height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginTop: 12 },
  progressFill: { height: "100%", borderRadius: 4, transition: "width 0.2s" },
  progressLabels: { display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-mute)", marginTop: 4 },
  forecastValue: { fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--text)" },
};
