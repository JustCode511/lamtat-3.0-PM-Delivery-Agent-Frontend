/* ============================================================
   API client — every backend call lives here.

   During local dev, requests go to "/api/..." which Vite proxies
   to your backend (http://localhost:8000). See vite.config.js.

   IMPORTANT: These endpoints are the CONTRACT your backend must provide.
   If your backend routes differ, change them here in one place.
   Until the backend is wired up, calls fall back to mock data so the
   UI is fully clickable immediately.
   ============================================================ */

const BASE = "/api";

const USE_MOCK_FALLBACK = false;

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      // Surface the backend's error detail (e.g. "Username already exists")
      // so the UI can show something useful instead of a bare status code.
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (typeof body?.detail === "string") message = body.detail;
      } catch { /* non-JSON error body — keep the status message */ }
      const e = new Error(message);
      e.status = res.status;
      throw e;
    }
    return await res.json();
  } catch (err) {
    if (USE_MOCK_FALLBACK) return mockFor(path, options);
    throw err;
  }
}

/* ---------- Auth ---------- */
export async function login(username, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function register(username, password) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// Revoke the current token server-side so it can't be reused after sign-out.
export async function logout() {
  return request("/auth/logout", { method: "POST" });
}

/* ---------- PM module ---------- */
export async function getProjects() {
  return request("/pm/projects");
}

/* ---------- HITL — send report to leadership channel ---------- */
export async function sendToLeadership(reportText) {
  return request("/pm/send-to-leadership", {
    method: "POST",
    body: JSON.stringify({ report_text: reportText }),
  });
}

export async function getDashboard(projectKey) {
  return request(`/pm/dashboard/${projectKey}`);
}

export async function getActivity(limit = 25) {
  return request(`/pm/activity?limit=${limit}`);
}

/* ---------- Conversation history (Claude-style sidebar) ---------- */
export async function getConversations() {
  return request("/pm/conversations");
}

export async function getConversation(sessionId) {
  return request(`/pm/conversations/${encodeURIComponent(sessionId)}`);
}

// Permanently delete a conversation (also removes it from the backend table).
export async function deleteConversation(sessionId) {
  return request(`/pm/conversations/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
}

/* ---------- Chat (works for any module) ---------- */
export async function sendChat(module, sessionId, message) {
  return request(`/${module}/chat`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, message }),
  });
}

/**
 * Streaming version of sendChat — the PM backend supports SSE.
 * Calls onDelta(text, intent) for each chunk, onDone(intent, fullText) when complete.
 * Falls back to sendChat for non-streaming modules.
 */
export async function streamChat(module, sessionId, message, onDelta, onDone) {
  const streamPath = `${BASE}/${module}/chat/stream`;
  let res;
  try {
    res = await fetch(streamPath, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ session_id: sessionId, message }),
    });
  } catch {
    // Network error — fall back to non-streaming
    const data = await sendChat(module, sessionId, message);
    onDone(data.ui_hint || "default", data.reply || "", false);
    return;
  }

  if (!res.ok || !res.body) {
    // Endpoint doesn't exist or errored — fall back
    const data = await sendChat(module, sessionId, message);
    onDone(data.ui_hint || "default", data.reply || "", false);
    return;
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buffer = "";
  let intent = "default";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop(); // keep the incomplete trailing chunk
    for (const part of parts) {
      if (!part.startsWith("data: ")) continue;
      try {
        const ev = JSON.parse(part.slice(6));
        if (ev.type === "start") intent = ev.intent || "default";
        if (ev.type === "delta") onDelta(ev.delta || "", intent);
        if (ev.type === "done") { onDone(ev.intent || intent, ev.full || "", ev.reportable || false); return; }
      } catch { /* malformed chunk — skip */ }
    }
  }
}

/**
 * Async chat with polling — the robust path for the PM module.
 *
 * A leadership report can take ~35s, but API Gateway hard-caps the client
 * response at 30s (and Lambda Function URLs are blocked on this account). So we
 * fire the work at /pm/chat/async (which may 504 at 30s — we ignore that), and
 * poll /pm/chat/result/{job_id} until the still-running Lambda saves the result.
 * While waiting we show live progress; when done we "type" the report out for a
 * streaming feel. Never times out the UI.
 *
 *   onProgress(text) — replace the bubble text (progress lines, then typing)
 *   onDone(intent, fullText, reportable) — finalize with the rich card
 */
export async function chatWithPolling(module, sessionId, message, { onThinking, onType, onDone }) {
  const jobId =
    (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Kick off the work. It may 504 at 30s for long reports — that's expected;
  // the Lambda keeps running and the result arrives via polling below.
  fetch(`${BASE}/${module}/chat/async`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ session_id: sessionId, message, job_id: jobId }),
  }).catch(() => {});

  // Progress labels for the animated "thinking" state (kept reassuring for the
  // longer all-projects reports so it never looks stuck).
  const steps = [
    "🔍 Understanding your request…",
    "📇 Pulling live Jira data…",
    "📊 Analysing status & risks…",
    "✍️ Drafting the report…",
    "🧮 Formatting charts & tables…",
    "📋 Compiling every project…",
    "🔎 Cross-checking the details…",
    "⏳ Almost there — finalising…",
  ];
  const t0 = Date.now();
  let result = null;

  // ~250 × 1.2s ≈ 300s ceiling — matches the Lambda's 5-min timeout so even a
  // detailed all-projects report is polled to completion.
  for (let i = 0; i < 250; i++) {
    await new Promise((r) => setTimeout(r, 1200));
    const idx = Math.min(steps.length - 1, Math.floor((Date.now() - t0) / 9000));
    onThinking?.(steps[idx]);
    try {
      const job = await fetch(`${BASE}/${module}/chat/result/${jobId}`, {
        headers: authHeaders(),
      }).then((r) => r.json());
      if (job?.status === "done" || job?.status === "error") { result = job; break; }
    } catch { /* transient — keep polling */ }
  }

  if (!result || result.status === "error") {
    onDone?.("default", "Something went wrong reaching the agent. Please try again.", false);
    return;
  }

  // Client-side "typing" — reveal the report progressively as FORMATTED markdown
  // for a streaming feel. Chart source (```mermaid …```) is swapped for a
  // placeholder mid-stream; the real chart renders when onDone swaps in the card.
  const full = result.reply || "";
  const typingText = full
    .replace(/```mermaid[\s\S]*?```/g, "\n📊 *building chart…*\n")
    .replace(/```[\s\S]*?```/g, "");
  // Fewer re-renders for long reports (each tick re-parses the growing markdown)
  // so the type-out stays smooth; still lively for short replies.
  const STEPS = Math.min(40, Math.max(16, Math.ceil(typingText.length / 200)));
  const chunk = Math.max(1, Math.ceil(typingText.length / STEPS));
  for (let n = chunk; n < typingText.length; n += chunk) {
    onType?.(typingText.slice(0, n));
    await new Promise((r) => setTimeout(r, 22));
  }
  onDone?.(result.ui_hint || "default", full, !!result.reportable);
}

/* ---------- Talent Management ---------- */
export async function getTalentDashboard() {
  return request("/talent/dashboard");
}

export async function getTalentEmployees(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""))
  ).toString();
  return request(`/talent/employees${qs ? `?${qs}` : ""}`);
}

export async function getTalentEmployee(id) {
  return request(`/talent/employees/${id}`);
}

export async function getTalentProjects() {
  return request("/talent/projects");
}

export async function getTalentSkills() {
  return request("/talent/skills");
}

export async function getTalentMatrix(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  ).toString();
  return request(`/talent/matrix${qs ? `?${qs}` : ""}`);
}

export async function triggerTalentSync() {
  return request("/talent/sync", { method: "POST" });
}

/* ---------- Cloud FinOps ---------- */
export async function getFinopsDashboard() {
  return request("/finops/dashboard");
}

export async function getFinopsCosts(days = 30) {
  return request(`/finops/costs?days=${days}`);
}

export async function getFinopsAnomalies() {
  return request("/finops/anomalies");
}

export async function getFinopsRightsizing() {
  return request("/finops/rightsizing");
}

export async function getFinopsBudget() {
  return request("/finops/budget");
}

export async function setFinopsBudget(targetMonthlyBudget) {
  return request("/finops/budget", {
    method: "POST",
    body: JSON.stringify({ target_monthly_budget: targetMonthlyBudget }),
  });
}

export async function sendFinopsSlackDigest() {
  return request("/finops/slack-digest", { method: "POST", body: JSON.stringify({}) });
}

export async function getFinopsLiveDataSetting() {
  return request("/finops/settings/live-data");
}

export async function setFinopsLiveDataSetting(liveDataEnabled) {
  return request("/finops/settings/live-data", {
    method: "POST",
    body: JSON.stringify({ live_data_enabled: liveDataEnabled }),
  });
}

/* ============================================================
   Mock fallback data — lets the UI run before the backend is ready.
   Delete or set USE_MOCK_FALLBACK=false once endpoints are live.
   ============================================================ */
function mockFor(path, options) {
  if (path.startsWith("/auth")) {
    return { token: "mock-jwt-token", username: "demo" };
  }
  if (path === "/pm/projects") {
    return {
      projects: [
        { key: "SCRUM", name: "aabg-hackathon-fy26", health: "NEEDS_ATTENTION", completion_pct: 40, overdue_count: 2 },
        { key: "ATHENA", name: "Athena AI Assistant Platform", health: "HEALTHY", completion_pct: 62, overdue_count: 0 },
        { key: "PHOENIX", name: "Phoenix Platform Rebuild", health: "AT_RISK", completion_pct: 0, overdue_count: 6 },
      ],
    };
  }
  if (path.startsWith("/pm/dashboard")) {
    return {
      project_name: "Phoenix Platform Rebuild",
      health: "AT_RISK",
      completion_pct: 0,
      total: 8,
      done: 0,
      overdue_count: 6,
      unassigned_count: 4,
      critical_risks: [
        {
          key: "PHX-2", summary: "Rebuild authentication service",
          priority: "Highest", days_overdue: 14, unassigned: true,
          root_cause: "Unassigned for 2 weeks; blocks 3 downstream integration items.",
          fix: "Assign to a senior backend engineer today. Split into OAuth setup + token migration to parallelize. Escalate the slip to steering.",
          effort: "~1 sprint if split",
        },
        {
          key: "PHX-8", summary: "Security audit and penetration testing",
          priority: "Highest", days_overdue: 7, unassigned: true,
          root_cause: "No owner; external vendor lead times risk further delay.",
          fix: "Engage the security team now or book an external pen-test vendor (1–2 wk lead). Run in parallel with remaining dev, not at the end.",
          effort: "~1 week vendor lead + 3 days",
        },
      ],
    };
  }
  if (path.endsWith("/chat")) {
    const body = JSON.parse(options.body || "{}");
    return {
      reply: `**(demo mode)** You said: _${body.message}_\n\nOnce the backend is connected, the real agent will respond here with live Jira data and AI analysis.`,
    };
  }
  return {};
}
