# AI Delivery Intelligence — Frontend

React + Vite SPA for the AI agent platform. Four modules, each with a live dashboard
and a Claude-style chat console side by side:

- **PM Delivery** — project health, risks, leadership reports, PowerPoint export
- **Talent Management** — skills, capacity, matching
- **Cloud FinOps** — live AWS cost visibility, anomalies, rightsizing
- **Code Generation** — (dashboard on the way)

> Connected to the live backend by default (`USE_MOCK_FALLBACK = false` in
> `src/api/client.js`). Set it to `true` for a backend-free demo with sample data.

---

## What's here
- **Login / Register** (`src/pages/Login.jsx`)
- **Home deck** — four module cards (`src/pages/Home.jsx`)
- **Module view** — dashboard + chat, two columns (`src/pages/ModuleView.jsx`)
- **ChatPanel** — reusable chat console for every module (`src/components/ChatPanel.jsx`)
- **PMDashboard / TalentDashboard / FinOpsDashboard** — per-module dashboards
- **API client** — every backend call in one place (`src/api/client.js`)

---

## Key features

**Chat console (`ChatPanel.jsx`)**
- **Streaming-style responses without a streaming backend.** For PM it calls
  `chatWithPolling()`: fires `/pm/chat/async`, polls for the result, shows an
  **animated "thinking" panel** with live progress ("Analysing risks…", "Drafting the
  report…"), then **types the answer out as formatted markdown**, then swaps in the rich
  card. Never times out, even for 40-second all-projects reports.
- **Rich cards** — Mermaid **pie/bar charts** (black text, bright slices, clean white
  card), markdown tables, an **Approve & Send to Leadership** panel for reports, and a
  **Download PowerPoint** card for decks.
- **Conversation history sidebar (fullscreen)** — grouped by recency
  (**Recent · Last week · Last month · Older**), each group **collapsible**, with an
  **in-app delete modal** (no native browser prompt) that also removes it server-side.
- **Personalised greeting** on a new chat ("Good morning/afternoon/evening {name}"),
  and **smooth stick-to-bottom** scrolling that settles on the end of the reply.

**Dashboards**
- **PMDashboard** — portfolio stat row, filterable project cards, drill-in with AI risk
  resolutions, and a **Recent Activity** feed (recency-grouped + collapsible). The column
  scrolls, so 4+ projects never clip the stats or the activity feed.
- **FinOpsDashboard** — live cost summary, by-service breakdown, daily-spend trend,
  anomaly & rightsizing tabs (reads AWS Cost Explorer via the backend).

---

## Setup
```bash
npm install
npm run dev          # http://localhost:5173
```
Node is the only requirement (works the same on Windows and Mac).

**Local backend:** Vite proxies `/api/*` to `http://localhost:8000` (see
`vite.config.js`). In production, CloudFront routes `/api/*` to API Gateway, so the
frontend always talks to a same-origin `/api` — no CORS, no config per environment.

---

## Backend contract (`src/api/client.js`)

| Frontend call | Method | Notes |
|---|---|---|
| `/auth/login`, `/auth/register` | POST `{username, password}` | → `{token, username}` |
| `/pm/projects`, `/pm/dashboard/:key`, `/pm/activity` | GET | dashboard data |
| `/pm/chat/async` | POST `{session_id, message, job_id}` | returns immediately (`pending`) |
| `/pm/chat/result/:job_id` | GET | poll → `{status, reply, ui_hint, reportable}` |
| `/pm/conversations`, `/pm/conversations/:id` | GET | history list / replay |
| `/pm/conversations/:id` | DELETE | delete a conversation (ownership-scoped) |
| `/pm/send-to-leadership` | POST | HITL approve → post report to Slack |
| `/export/ppt[?project_key=KEY]` | GET | streams the `.pptx` (fetched with auth) |
| `/finops/*`, `/talent/*` | GET/POST | FinOps & Talent modules |

`health` values: `HEALTHY`, `NEEDS_ATTENTION`, `AT_RISK`.

---

## Build & deploy (AWS)
```bash
npm run build                                   # → dist/
aws s3 sync dist/ s3://<bucket>/ --delete \
  --cache-control "public,max-age=31536000,immutable" --exclude index.html
aws s3 cp dist/index.html s3://<bucket>/index.html \
  --cache-control "no-cache, must-revalidate" --content-type text/html
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```
Hashed assets are cached forever; **`index.html` is `no-cache`** so every deploy is
picked up on the next load without a hard refresh. Served via CloudFront over a private
S3 bucket (Origin Access Control) with HTTPS.

---

## Design
"Command deck" aesthetic — deep slate, electric-cyan/violet accents, Space Grotesk
display type, monospace for data. Each module has its own accent color. Light & dark
themes (toggle in the header).

## Structure
```
src/
├── pages/       Login, Home, ModuleView
├── components/  ChatPanel · PMDashboard · TalentDashboard · FinOpsDashboard
│                FinOpsServicesPanel · CopilotPanel
├── api/         client.js (backend contract + chatWithPolling)
├── context/     AuthContext, ThemeContext
├── modules.js   the modules, one source of truth
└── styles.css   design tokens (light + dark)
```
