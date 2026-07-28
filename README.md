# Delivery Intelligence — Frontend

React UI for the four AI agent modules: PM Delivery, Talent Management,
Code Generation, and Cloud FinOps.

## What's here
- **Login / Register** page (`src/pages/Login.jsx`)
- **Home deck** with four module cards (`src/pages/Home.jsx`)
- **Module view** — dashboard + chat side by side (`src/pages/ModuleView.jsx`)
- **PM dashboard** — project list + drill-in with AI risk resolutions (`src/components/PMDashboard.jsx`)
- **Chat panel** — reusable across all modules (`src/components/ChatPanel.jsx`)
- **API client** — all backend calls in one place (`src/api/client.js`)

## Runs immediately in DEMO MODE
The API client (`src/api/client.js`) has `USE_MOCK_FALLBACK = true`, so the whole
app is clickable right now with sample data — even before the backend is connected.
Login accepts any credentials; the PM dashboard shows sample projects; chat echoes.

## Setup

```bash
npm install
npm run dev
```
Open http://localhost:5173

Works the same on Windows and Mac — only Node is required.

## Connecting your backend

1. Your backend should run on `http://localhost:8000` (Vite proxies `/api/*` to it —
   see `vite.config.js`). Change the target there if your port differs.

2. The frontend expects these endpoints (the CONTRACT). Adjust paths in
   `src/api/client.js` if yours differ:

   | Frontend call | Method | Expected response |
   |---|---|---|
   | `/auth/login` | POST `{username, password}` | `{token, username}` |
   | `/auth/register` | POST `{username, password}` | `{token, username}` |
   | `/pm/projects` | GET | `{projects: [{key, name, health, completion_pct, overdue_count}]}` |
   | `/pm/dashboard/:key` | GET | `{project_name, health, completion_pct, total, done, overdue_count, unassigned_count, critical_risks: [{key, summary, priority, days_overdue, unassigned, root_cause, fix, effort}]}` |
   | `/:module/chat` | POST `{session_id, message}` | `{reply}` |

   `health` is one of: `HEALTHY`, `NEEDS_ATTENTION`, `AT_RISK`.

3. Once your endpoints return real data, set `USE_MOCK_FALLBACK = false` in
   `src/api/client.js`. Now it uses your live backend.

## Design
"Command deck" aesthetic — deep slate, electric-cyan signal accent, Space Grotesk
display type, monospace for data. Each module has its own accent color.

## Structure
```
src/
├── pages/       Login, Home, ModuleView
├── components/  ChatPanel, PMDashboard
├── api/         client.js (backend contract)
├── context/     AuthContext (login state + token)
├── modules.js   the four modules, one source of truth
└── styles.css   design tokens
```
