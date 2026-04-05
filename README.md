# Coverage360
### AI-Powered Medical Benefit Drug Policy Tracker
*Built for Anton Rx Challenge · Innovation Hacks 2.0*

---

## The Problem

Health plans govern medical benefit drugs through individual medical policies that vary by payer and change constantly. There is no centralized, standardized source for tracking which drugs are covered, what clinical criteria apply, or how policies differ across plans.

Today, a market access analyst answering one question like *"Which plans require step therapy before approving Rituximab?"* has to manually visit 10+ payer websites, download different-format PDFs, find the relevant section in each, and mentally normalize everything — a process that can take hours.

**Coverage360 eliminates that workflow.**

---

## What It Does

Coverage360 ingests, parses, and normalizes medical policy documents from multiple health plans into a searchable, comparable, and trackable interface — purpose-built for the market access analyst.

### Core Features

**Compare** — Side-by-side coverage criteria for a single drug across all payers. Type a drug name, get a normalized table: what Cigna requires, what UHC requires, what EmblemHealth requires — instantly.

**Policy Differ** — Upload or select two versions of a policy and get a semantic diff that separates meaningful clinical changes (new step therapy requirement, removed indication) from cosmetic edits (formatting tweaks, updated effective dates). No more reading both PDFs end-to-end.

**Alerts** — Automated policy change detection. When a payer updates a policy, the system flags it with a severity level and surfaces exactly what changed. Stay current without manually chasing every payer's website.

**Ask AI** — Natural language querying over the full policy database. Ask *"Does Cigna cover Rituxan for lupus?"* or *"What step therapy does UHC require for Humira?"* and get a fast, cited answer.

**Coverage Strategy** *(in development)* — Analyst-facing payer optimizer. Input a drug, condition, budget level, and preferences (avoid PA, avoid step therapy, prefer fast approval) and get payers ranked by coverage friendliness with a scoring breakdown. Includes a "willing to switch drugs" mode that surfaces alternative drugs in the same therapeutic class ranked by payer score.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, Tailwind CSS |
| Backend | Python (FastAPI) |
| AI / NLP | Claude API (Anthropic) |
| Policy Parsing | PDF extraction pipeline + Claude-powered normalization |
| Change Detection | Semantic differ + GitHub Actions for scheduled policy checks |
| Database | PostgreSQL |

---

## Project Structure

```
coverage360/
├── frontend/
│   ├── app/
│   │   ├── alerts/          # Alerts page
│   │   ├── compare/         # Cross-payer comparison view
│   │   └── ...
│   └── components/
│       ├── AlertsBell.jsx   # Real-time alerts indicator
│       ├── Sidebar.jsx
│       ├── Topbar.jsx
│       └── ...
├── backend/
│   ├── alert_pipeline/      # Policy change detection
│   ├── differ/              # Semantic policy diff engine
│   └── check_updates/       # Scheduled payer policy checker
└── .github/
    └── workflows/
        └── check_updates.yml  # Automated policy monitoring
```

---

## Payers Supported

| Payer | Format | Status |
|---|---|---|
| UnitedHealthcare | Individual PDFs | Ingested |
| Cigna | PDFs (A-Z index) | Ingested |
| EmblemHealth | Third-party portal | Ingested |
| UPMC Health Plan | Consolidated documents | Ingested |
| BCBS North Carolina | Search-style interface | Ingested |

---

## Key Data Fields Extracted

From each policy document, Coverage360 extracts and normalizes:

- Drug name (brand + generic) and HCPCS/J-code
- Drug category and therapeutic class
- Access status (preferred tier, exclusivity)
- Covered indications / diagnoses
- Prior authorization requirements and criteria
- Step therapy requirements (what must be tried first)
- Site-of-care restrictions
- Dosing and quantity limits
- Policy effective date and version

---

## Getting Started

```bash
# Clone the repo
git clone https://github.com/mmehta29/coverage360.git
cd coverage360

# Frontend
cd frontend
npm install
npm run dev

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
