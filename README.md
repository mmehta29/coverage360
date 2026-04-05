# Coverage360

Medical benefit drug policy tracking for market access teams.

Coverage360 ingests payer policy documents, normalizes the coverage rules into Supabase, and exposes a search and Q&A workflow for analysts who need quick answers on coverage status, prior auth, step therapy, policy deltas, and payer-by-payer comparisons.

## What It Does

- Uploads payer policy PDFs and DOCX files into an extraction pipeline.
- Normalizes policy metadata and coverage rules into Supabase.
- Lets analysts search drug coverage across payers.
- Surfaces a live heatmap, comparison view, and recent policy alerts.
- Supports grounded chat over ingested coverage data.
- Includes voice input for speech-to-text question capture.

## Stack

### Frontend
- Next.js 14
- React
- App Router API routes as the frontend-to-backend bridge

### Backend
- FastAPI
- Supabase
- Anthropic-backed RAG chat flow
- openFDA name resolution
- Document extraction + normalization pipeline

## Product Flow

1. A policy document is uploaded through the backend ingestion route.
2. The backend extracts structured metadata and coverage rules.
3. Normalized data is stored in Supabase.
4. The frontend calls backend-backed routes for:
   - search
   - payer comparison
   - alerts
   - heatmap aggregation
   - chat
5. Analysts review coverage and ask questions grounded in source policies.

## Repository Layout

```text
coverage360/
|- backend/                  FastAPI API, extraction, normalization, search
|- frontend/                 Next.js app and UI
|- supabase_schema.sql       Database schema
`- demo.html                 Standalone demo presentation
```

## Key Features

### Coverage Search
Search a drug and see payer-level coverage status, summary criteria, and effective dates.

### Compare View
Review side-by-side payer differences for the same drug.

### Alerts
Track recent policy changes without polling every second.

### Heatmap
Scan cross-payer coverage patterns across indexed drugs.

### Grounded Chat
Ask natural-language questions over ingested policy data and return source-backed answers.

## API Surface

Current backend routes in [backend/main.py](./backend/main.py):

- `GET /health`
- `POST /ingest/upload`
- `GET /drugs`
- `GET /payers`
- `GET /policies`
- `GET /policies/{id}`
- `GET /search/drug/{name}`
- `GET /compare/{drug_name}`
- `GET /category/{molecule}`
- `GET /diff/{policy_id}`
- `GET /changes/recent`
- `POST /chat`

## Local Setup

### 1. Backend

```powershell
cd backend
py -m pip install -r requirements.txt
py -m uvicorn main:app --reload
```

Backend env lives in `backend/.env` or `backend/.env.local`.

Example values:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
CLAUDE_API_KEY=your_anthropic_key
OPENFDA_BASE_URL=https://api.fda.gov/drug
```

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend env lives in `frontend/.env.local`.

Example values:

```env
BACKEND_URL=http://127.0.0.1:8000
ELEVENLABS_API_KEY=your_elevenlabs_key
```

Open `http://localhost:3000`.

## Current Notes

- The main dashboard is the most complete and cohesive UI surface.
- Some frontend routes still contain legacy or fallback behavior for local development.
- Chat is wired end-to-end but depends on a valid LLM API key and available quota.
- Voice input depends on a valid ElevenLabs API key for speech-to-text.
- Search, alerts, compare, and heatmap are intended to run against live backend data.

## Why This Exists

Policy review is slow, repetitive, and easy to get wrong when teams are working across dozens of payers and constantly changing medical benefit rules. Coverage360 is built to reduce that friction by turning raw policy PDFs into a searchable, analyst-friendly workflow.
