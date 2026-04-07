# Coverage360
### AI-Powered Medical Benefit Drug Policy Tracker
*Built for Anton Rx Challenge · Innovation Hacks 2.0*

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Claude AI](https://img.shields.io/badge/Claude-Anthropic-D97757?logo=anthropic)](https://anthropic.com)

---

## 🎯 The Problem

Health plans govern medical benefit drugs through individual policies that vary by payer and change constantly. There is no centralized, standardized source for tracking which drugs are covered, what clinical criteria apply, or how policies differ across plans.

Today, a market access analyst answering one question like *"Which plans require step therapy before approving Rituximab?"* has to:

- 📄 Manually visit 10+ payer websites
- 🔍 Download different-format PDFs and locate the relevant section in each
- 🧠 Mentally normalize everything across formats
- ⏰ Spend hours on a task that should take seconds

**Coverage360 eliminates that entire workflow.**

---

## 💡 Our Solution

Coverage360 ingests, parses, and normalizes medical policy documents from multiple health plans into a searchable, comparable, and trackable interface — purpose-built for the market access analyst.

| Feature | Description |
|---|---|
| **Compare** | Side-by-side coverage criteria for a single drug across all payers |
| **Policy Differ** | Semantic diff that separates meaningful clinical changes from cosmetic edits |
| **Alerts** | Automated policy change detection with severity levels |
| **Ask AI** | Natural language querying over the full policy database |
| **Coverage Strategy** | Analyst-facing payer optimizer with drug-switching mode *(in development)* |

---

## ✨ Key Features

### 📊 Cross-Payer Comparison

Type a drug name, get a normalized table instantly:

```
┌─────────────────────────────────────────────────────────────┐
│  💊 Rituximab                                               │
│    ├── Cigna       → Step therapy required (MTX first)      │
│    ├── UHC         → PA required, no step therapy           │
│    ├── EmblemHealth → Covered, quantity limit applies       │
│    └── UPMC        → Restricted to oncology indications     │
└─────────────────────────────────────────────────────────────┘
```

### 🔍 Intelligent Policy Differ

Upload or select two versions of a policy and get a semantic diff that separates what actually matters:

| Change Type | Example |
|---|---|
| 🔴 **Clinical** | New step therapy requirement added |
| 🟠 **Coverage** | Indication removed from covered list |
| 🟡 **Criteria** | PA criteria updated |
| 🟢 **Cosmetic** | Formatting tweak, updated effective date |

### 🔔 Automated Alerts

- Policy change detection via scheduled GitHub Actions
- Severity-ranked flagging for every payer update
- Exact diff surfaced — no need to re-read the full PDF

### 🤖 Ask AI

Natural language queries over the full policy database, powered by Claude:

> *"Does Cigna cover Rituxan for lupus?"*
> *"What step therapy does UHC require for Humira?"*

Fast, cited answers with traceability back to source policy documents.

### 🏆 Coverage Strategy *(in development)*

Input a drug, condition, budget, and preferences (avoid PA, avoid step therapy, prefer fast approval) and get:

- Payers ranked by coverage friendliness with scoring breakdown
- "Willing to switch drugs" mode surfacing alternatives in the same therapeutic class

---

## 🏗️ Architecture

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

## 🗂️ Data Extracted Per Policy

From each document, Coverage360 normalizes:

- Drug name (brand + generic) and HCPCS/J-code
- Drug category and therapeutic class
- Access status (preferred tier, exclusivity)
- Covered indications and diagnoses
- Prior authorization requirements and criteria
- Step therapy requirements
- Site-of-care restrictions
- Dosing and quantity limits
- Policy effective date and version

---

## 🏥 Payers Supported

| Payer | Format | Status |
|---|---|---|
| UnitedHealthcare | Individual PDFs | Ingested |
| Cigna | PDFs (A-Z index) | Ingested |
| EmblemHealth | Third-party portal | Ingested |
| UPMC Health Plan | Consolidated documents | Ingested |
| BCBS North Carolina | Search-style interface | Ingested |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js, React, Tailwind CSS |
| **Backend** | Python, FastAPI |
| **AI / NLP** | Claude API (Anthropic) |
| **Policy Parsing** | PDF extraction pipeline + Claude-powered normalization |
| **Change Detection** | Semantic differ + GitHub Actions |
| **Database** | PostgreSQL, Supabase |

---

## 🚀 Getting Started

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
---

## 👥 Team

Built with ❤️ for Anton Rx Challenge · Innovation Hacks 2.0

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
