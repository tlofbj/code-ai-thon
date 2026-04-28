# DonateMatch

DonateMatch is a Vue + Express + SQLite app that connects people who want to donate supplies with people requesting supplies.

The app supports:
- Submitting donation items
- Submitting requested items
- Automatic matching suggestions
- Accept/reject offer flow
- Contact handoff after acceptance
- Basic multilingual homepage labels

## Tech Stack

- Frontend: Vue 3, Vue Router, Vite
- Backend: Node.js, Express
- Database: SQLite
- AI integration: Groq chat completions API (optional but enabled when configured)

## Repository Layout

- `src/`: Vue frontend
- `server.js`: Express API, SQLite schema/migrations, matching logic, static frontend hosting
- `vite.config.js`: Vite dev server + API proxy config
- `uploads/`: uploaded assets (currently tracked media files exist in repo)
- `dist/`: production frontend build output

## How It Works

1. User submits donation or request items.
2. Browser requests geolocation and stores coordinates as `lat,lng`.
3. Backend saves entries and evaluates potential matches.
4. Matching uses:
   - lexical fallback matching, and
   - optional Groq-based semantic scoring (`GROQ_API_KEY` required).
5. Top offer is shown to the submitter.
6. User accepts or rejects:
   - accept: matched donation/request rows are fulfilled and removed; donor phone is returned.
   - reject: next best pending valid offer (if available) is returned.

## API Overview

Base path: `/api`

- `GET /api/health`: service + DB health, API version, counts
- `POST /api/auth/login`: creates/fetches user by phone (demo login)
- `GET /api/donations`: list donations
- `POST /api/donations`: create donation rows and attempt match
- `GET /api/requests`: list requests
- `POST /api/requests`: create request rows and attempt match
- `POST /api/offers/:offerId/respond`: accept/reject offer
- `POST /api/data/remove-donations-by-phone`: remove donations for a phone number

## Local Development

### Prerequisites

- Node.js 18+ recommended
- npm

### 1) Install dependencies

```bash
npm install
```

### 2) Create `.env`

```env
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.1-8b-instant
# Optional:
# SQLITE_PATH=/absolute/path/to/donatematch.db
```

### 3) Run backend

```bash
npm run server
```

### 4) Run frontend (separate terminal)

```bash
npm run dev
```

Frontend defaults to `http://localhost:5173` and proxies `/api` to `http://localhost:5001`.

## Production Build

```bash
npm run build
npm run server
```

When `dist/` exists, `server.js` serves the built frontend and API from the same service.

## Deploying to Render

Recommended: single Render Web Service (Node) for both frontend and backend.

- Build command: `npm ci && npm run build`
- Start command: `npm run server`
- Health check path: `/api/health`

Environment variables:
- `GROQ_API_KEY`: required for AI scoring/distance estimation features
- `GROQ_MODEL`: optional
- `SQLITE_PATH`: set to a persistent disk path, for example `/var/data/donatematch.db`
- `NODE_ENV=production` (recommended)

If using SQLite in Render, attach a persistent disk (for example mounted at `/var/data`) so data survives restarts/redeploys.

## Data, Privacy, and Safety Notes

- App stores phone numbers in SQLite to identify users and share contact on accepted matches.
- App stores location coordinates to estimate distance between potential matches.
- Deletion endpoint currently removes donations by phone and expires related pending offers.
- Rotate secrets immediately if an API key is ever committed or exposed.

## AI Usage Record

This section records how AI is used in this project, both in the running product and during development.

### Runtime AI use (application behavior)

#### Provider and model

- Provider: Groq API (`https://api.groq.com/openai/v1/chat/completions`)
- Default model: `llama-3.1-8b-instant`
- Configurable via environment variable: `GROQ_MODEL`

#### Where AI is used

In `server.js`:
- `scoreItemMatchWithLlm(...)`
  - Determines whether two item descriptions are compatible.
  - Returns structured JSON with `isMatch`, `score`, and `reasoning`.
- `estimateDistanceKm(...)`
  - If direct coordinate parsing is unavailable, AI estimates travel distance in kilometers from text locations.

#### Fallback behavior

- If `GROQ_API_KEY` is not set or AI response is invalid:
  - Lexical matching fallback is used for item compatibility.
  - Distance falls back to `9999` when it cannot be determined.

#### Data shared with AI provider

- Item names/descriptions for compatibility scoring
- Location strings for distance estimation

No raw database dump is sent. Requests are prompt-scoped to matching tasks.

### Development-time AI use

This repository has been developed with AI coding assistance (Cursor agent workflows).

Recorded assistance includes:
- code scaffolding and iterative feature implementation
- deployment guidance (Render setup)
- documentation authoring (README and AI usage documentation)
- git workflow help (sync/rebase/push troubleshooting)

### Human responsibility and review

- Human maintainers remain responsible for:
  - code review
  - data/privacy decisions
  - security of environment variables and secrets
  - release/deployment approvals
- AI outputs should be treated as suggestions and verified before production use.

### AI usage documentation changelog

- 2026-04-27: Initial AI usage record created and merged into `README.md`.

## Troubleshooting

- "Could not reach `/api` from 5173":
  - confirm backend is running: `npm run server`
- Backend/API version warning on homepage:
  - restart backend and refresh frontend
- Offers not appearing:
  - ensure location permission is granted
  - ensure `GROQ_API_KEY` is set (or rely on lexical fallback)
- SQLite mismatch/confusion:
  - set explicit `SQLITE_PATH` and check `/api/health` response

## License

This project includes a `LICENSE` file at repository root.
