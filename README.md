# CodeQuest — project-first programming workspace

CodeQuest is a focused EdTech prototype for learning programming by solving a real problem from daily life. It combines a React/Vite workspace, Monaco Editor, browser-based Python execution through the official Pyodide CDN, a FastAPI backend, and a QAI coach powered by the Gemini API when configured.

> **Release status:** polished development package / production-oriented prototype. Do not expose it publicly as-is. Before public production, add server-side authenticated authorization for every user-owned endpoint, CSRF/session strategy as appropriate, rate limiting and quotas, stronger request validation, observability, backups, and a sandboxed C compiler service. The browser-side Python runtime is not a secure server-side execution sandbox for untrusted hosted applications.

## Product flow

1. Landing page → sign in → choose Python or C.
2. 15-day target and 30-day active QAI context notice.
3. Project setup and Socratic QAI brainstorming.
4. Confirm the real-life project → open the three-panel workspace.
5. Each concept follows Step 1 (syntax), Step 2 (variation), Step 3 (integrate into the persistent project file).
6. The editor snapshot, project requirements, lesson step and chat history are autosaved to the FastAPI context endpoint.

The initial lesson map is a small scaffold, not a complete dynamically generated curriculum yet. QAI discovery is conversational, but lesson generation from finalized requirements remains a future implementation step.

## Stack

- Frontend: React 19, Vite 7, `@vitejs/plugin-react` 5, Monaco Editor.
- Python runtime: Pyodide 0.26.4 from `https://cdn.jsdelivr.net/pyodide/v0.26.4/full/` (loaded from `frontend/index.html`, not bundled by Vite).
- Backend: FastAPI, SQLAlchemy, SQLite, HTTPX, python-dotenv.
- AI: Gemini API called server-side. API key is never a frontend variable.

## Run locally (Linux Mint)

### 1. Backend

```bash
cd CodeQuest/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
xed .env
```

Set `GEMINI_API_KEY` in `backend/.env` if you want the Gemini coach. Keep this file private and do not paste it into chats. Confirm that the configured model is available to your Google AI Studio project; model availability and API free quota depend on Google's current account/project policy.

```bash
uvicorn app:app --reload --port 8000
```

Check `http://localhost:8000/health` and `http://localhost:8000/docs`.

### 2. Frontend (a second terminal)

```bash
cd CodeQuest/frontend
npm install
cp .env.example .env
npm run dev
```

Open the URL Vite prints, normally `http://localhost:5173`. Set `VITE_API_URL` in `frontend/.env` only if the API base URL differs. Do not put secrets in any `VITE_*` variable.

### Python runtime requirements

Python execution requires an internet connection for the first Pyodide CDN load. `input()` uses a browser prompt; it is intentionally a simple MVP input bridge, not a full terminal stdin emulator.

### C language

The UI can show C syntax highlighting and a `main.c` filename, but this ZIP does **not** include a C compiler service connection. C execution remains disabled until a trusted runner is connected. The source projects inspected for this integration include Judge0 and Piston-based execution designs; do not run arbitrary learner code directly in the FastAPI process.

## Backend endpoints

- `GET /health`
- `POST /auth/register`, `POST /auth/login`
- `GET /missions`
- `GET /progress/{user_id}`, `POST /progress`
- `GET /context/{user_id}`, `POST /context`
- `POST /coach`

`/context` stores a compact JSON state in SQLite. On retrieval after its 30-day expiry, the active QAI context is reset. The learner should separately export/commit their project code if they want a permanent copy.

## Context schema

The canonical example and JSON Schema are in `docs/project-context.schema.json`. A typical record looks like this:

```json
{
  "schema_version": 1,
  "user_id": 12,
  "language": "Python",
  "project": {
    "title": "Family Phone Selector",
    "idea": "Compare phone options against a family's requirements",
    "requirements": ["budget", "RAM", "storage", "processor", "display"],
    "target_users": "My father",
    "constraints": ["Free tools", "CLI first"],
    "finalized": true
  },
  "journey": {
    "started_at": "2026-10-20T12:00:00Z",
    "expires_at": "2026-11-19T12:00:00Z",
    "current_day": 1,
    "lesson_id": "lesson-1",
    "lesson_step": 1,
    "completed_lessons": [],
    "status": "active"
  },
  "workspace": {
    "persistent_file_name": "phone_selector.py",
    "code_snapshot": "# Start here\\n",
    "last_output": "",
    "last_run_status": "idle",
    "updated_at": "2026-10-20T12:01:00Z"
  },
  "chat_history": [],
  "usage": {"coach_requests_today": 0, "last_request_date": "2026-10-20"}
}
```

The backend enforces a maximum 30-day context window from `journey.started_at`. This is an expiry/reset mechanism, not a promise that every previous AI message is retained by the model; relevant state must be sent to QAI in each request.

## Architecture review of the supplied source bundles

The uploaded `CQ.zip` contained these source projects. This package uses them as architectural references rather than copying their entire codebases into one runtime:

- **AI_Tutor** — FastAPI learning flows, Monaco UI, Judge0 execution, Ollama-oriented local AI. Strongest reference for learning/test-case orchestration; Judge0/Ollama/PostgreSQL are additional service dependencies.
- **CodeTutor** — separate backend/frontend and Piston-based execution architecture. Useful reference for a dedicated runner service; it is not directly compatible with this package's FastAPI API without an adapter.
- **ai-code-editor** — React/Vite/Monaco plus Express and Docker runner containers. Strong multi-file/run-console reference, but Docker socket access is powerful and must not be exposed to a public deployment without isolation.
- **code_visualizer** — browser-side Pyodide/WebAssembly approach. This is the closest reference for Python-in-browser, but Pyodide should be loaded as a CDN script here to avoid the Vite `.asm.js` dynamic import problem.
- **CodeQuest_AllInOne** — the earlier merged starting point. Its FastAPI auth/progress and React/Monaco interface are preserved and extended in this package.

The current package intentionally keeps one FastAPI backend and one React frontend. It does not blindly merge multiple competing auth, database, or runner implementations.

## Free-tier and latency controls

- Keep the Gemini API key server-side.
- Current `/coach` requests cap output at 250 tokens and use a 60-second request timeout with minimal thinking configuration.
- Keep QAI replies short and include only the current project brief, lesson, code/output, and a small recent-chat window.
- Cache static lesson content locally; do not call the LLM to explain fixed syntax that can be shown deterministically.
- Add server-side per-user/per-day quotas before public release. The current `usage` field is context metadata, not an enforced security quota.
- A Gemini subscription does not necessarily include free or unlimited API calls; check the active project's quota and billing settings.

## Known limitations before production

1. C execution needs a real sandboxed compiler/runner adapter; only syntax highlighting is available in this package.
2. The initial lesson sequence is a fixed scaffold. Dynamic minimal syllabus generation based on confirmed project requirements is not yet implemented.
3. Context/progress endpoints currently identify a user by numeric ID but do not yet enforce a signed authenticated session/token. Do not deploy publicly until ownership authorization is added.
4. Authentication now hashes new passwords with PBKDF2 and upgrades legacy SHA-256 hashes on successful login, but rate limiting and a proper session/token lifecycle are still required.
5. Pyodide loads from a CDN and `input()` uses `window.prompt`; offline-first asset caching and a proper stdin terminal bridge are future work.
6. Run production dependency audits and a real frontend build in the target environment before release.
