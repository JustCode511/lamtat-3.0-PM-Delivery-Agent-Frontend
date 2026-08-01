import { useState, useEffect, useCallback } from "react";
import { getFinopsCosts } from "../api/client.js";

const ACCENT = "#f97316";

function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Right-rail counterpart to the Agent Console chat panel for the FinOps
   module — lists every AWS service with usage in the window (cost or not),
   sourced independently from /finops/costs so this stays decoupled from
   FinOpsDashboard's own fetch, matching the rest of the app's per-component
   data-fetching convention. */
export default function FinOpsServicesPanel({ accentHex = ACCENT }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getFinopsCosts()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const costMap = Object.fromEntries((data?.by_service || []).map(sv => [sv.service, sv]));
  const services = data?.active_services || [];

  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <span style={{ ...s.dot, background: accentHex }} />
        <span style={s.title}>Active AWS Services</span>
        <button
          style={{ ...s.refreshBtn, opacity: loading ? 0.5 : 1 }}
          onClick={load}
          disabled={loading}
          title="Refresh from live Cost Explorer"
        >
          ⟳
        </button>
      </div>

      <div style={s.body}>
        {loading ? (
          <SkeletonList />
        ) : error ? (
          <div style={s.errorText}>{error}</div>
        ) : !services.length ? (
          <div style={s.emptyText}>No AWS services show usage in this window.</div>
        ) : (
          <>
            <div style={s.subhead}>{services.length} service{services.length === 1 ? "" : "s"} · trailing 30 days</div>
            {services.map(name => {
              const costed = costMap[name];
              const hasCost = costed && costed.amount > 0;
              return (
                <div key={name} style={s.row}>
                  <span style={{ ...s.rowDot, background: hasCost ? accentHex : "var(--text-mute)" }} />
                  <span style={s.rowName} title={name}>{name}</span>
                  <span style={{ ...s.rowAmount, color: hasCost ? "var(--text)" : "var(--text-mute)" }}>
                    {costed ? money(costed.amount) : "$0.00"}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div style={s.foot}>
        Live AWS Cost Explorer data · <a href="#" onClick={e => { e.preventDefault(); load(); }} style={{ color: accentHex }}>refresh</a>
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 34, borderRadius: 8, marginBottom: 8, opacity: 1 - i * 0.07 }} />
      ))}
    </>
  );
}

const s = {
  wrap: {
    display: "flex", flexDirection: "column", height: "100%",
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", overflow: "hidden",
  },
  head: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "13px 16px", borderBottom: "1px solid var(--border)",
    background: "var(--surface-2)", flexShrink: 0,
  },
  dot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  title: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text)", letterSpacing: "0.01em" },
  refreshBtn: {
    marginLeft: "auto", background: "none", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", width: 26, height: 26, display: "flex",
    alignItems: "center", justifyContent: "center", color: "var(--text-dim)",
    cursor: "pointer", fontSize: 13,
  },
  body: { flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column" },
  subhead: { fontSize: 11, color: "var(--text-mute)", marginBottom: 10 },
  row: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 10px", borderRadius: "var(--radius)",
    background: "var(--surface-2)", marginBottom: 6,
  },
  rowDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  rowName: { fontSize: 12, color: "var(--text-dim)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  rowAmount: { fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600, flexShrink: 0 },
  errorText: { fontSize: 12, color: "var(--text-danger)", padding: "8px 0" },
  emptyText: { fontSize: 12, color: "var(--text-mute)", padding: "8px 0" },
  foot: { padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--text-mute)", flexShrink: 0 },
};
