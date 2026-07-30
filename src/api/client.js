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
  return token ? { "Authorization": `Bearer ${token}` } : {};
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
