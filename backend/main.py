"""
Coverage360 — FastAPI backend entry point.
Endpoints:
  POST /ingest/upload           — upload a PDF/DOCX policy, extract + store it
  GET  /drugs                   — list all known drugs
  GET  /payers                  — list all payers
  GET  /policies                — list all policies
  GET  /policies/{id}           — get a single policy with its coverage rules
  GET  /search/drug/{name}      — Q1: which plans cover drug X?
  GET  /compare/{drug_name}     — Q2: side-by-side PA criteria across payers
  GET  /category/{molecule}     — rebate position (preferred 1-of-2 vs 1-of-3)
  GET  /diff/{policy_id}        — Q3: what changed in this policy?
  GET  /changes/recent          — all meaningful changes in last N days
  POST /chat                    — natural language Q&A
  GET  /health                  — health check
"""
import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR / ".env.local", override=True)

from extraction.gemini_extractor import extract_policy
from normalization.normalizer import normalize_and_store
from database.supabase_client import get_client
from search.rag import answer_question
from search.openfda import resolve_drug_name

app = FastAPI(title="Coverage360 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}


@app.get("/health")
def health():
    return {"status": "ok", "service": "coverage360-backend"}


# ── Ingestion ──────────────────────────────────────────────────────────────────

@app.post("/ingest/upload")
async def upload_policy(
    file: UploadFile = File(...),
    document_url: Optional[str] = Form(None),
):
    """Upload a PDF or DOCX policy. Extracts via Claude and stores in Supabase."""
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not set in .env")

    suffix = "." + file.filename.split(".")[-1].lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{suffix}'. Upload a PDF or DOCX.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        policy, _raw_text, text_hash = extract_policy(tmp_path, CLAUDE_API_KEY)

        # Check for duplicate
        client = get_client()
        existing = client.table("policies").select("id").eq("raw_text_hash", text_hash).execute()
        if existing.data:
            return {
                "status": "duplicate",
                "message": "This document has already been ingested.",
                "policy_id": existing.data[0]["id"],
            }

        result = normalize_and_store(policy, text_hash, document_url)
        return {
            "status": "success",
            "filename": file.filename,
            "policy_title": policy.policy_metadata.policy_title,
            "payer": policy.policy_metadata.payer_name,
            **result,
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
    finally:
        os.unlink(tmp_path)


@app.get("/drugs")
def list_drugs():
    """All unique drugs in the system."""
    client = get_client()
    return (
        client.table("drugs")
        .select("id, brand_name, generic_name, biosimilar_suffix, is_biosimilar, drug_class, hcpcs_codes")
        .order("generic_name")
        .execute()
    ).data


@app.get("/payers")
def list_payers():
    """All payers."""
    return get_client().table("payers").select("*").order("name").execute().data


@app.get("/policies")
def list_policies(payer_id: Optional[str] = None):
    """All policies, optionally filtered by payer."""
    client = get_client()
    q = client.table("policies").select(
        "id, policy_title, policy_type, policy_number, effective_date, "
        "revised_date, document_source, extracted_at, payers(name, short_name)"
    )
    if payer_id:
        q = q.eq("payer_id", payer_id)
    return q.order("extracted_at", desc=True).execute().data


@app.get("/policies/{policy_id}")
def get_policy(policy_id: str):
    client = get_client()
    policy = (
        client.table("policies")
        .select("*, payers(name, short_name, type)")
        .eq("id", policy_id)
        .single()
        .execute()
    )
    if not policy.data:
        raise HTTPException(status_code=404, detail="Policy not found")
    rules = client.table("coverage_rules").select("*").eq("policy_id", policy_id).execute()
    positions = client.table("drug_category_positions").select("*").eq("policy_id", policy_id).execute()
    return {
        **policy.data,
        "coverage_rules": rules.data,
        "drug_category_positions": positions.data,
    }


# ── Q1: Which plans cover Drug X? ─────────────────────────────────────────────

@app.get("/search/drug/{drug_name}")
def search_drug_coverage(drug_name: str):
    """
    Q1: Given a drug name (brand or generic), return coverage status across all payers.
    """
    client = get_client()
    resolved = resolve_drug_name(drug_name)
    terms = list({drug_name.lower(), resolved.lower()}) if resolved else [drug_name.lower()]

    seen, results = set(), []
    for term in terms:
        rows = (
            client.table("coverage_rules")
            .select(
                "indication_name, coverage_status, requires_prior_auth, prior_auth_type, "
                "step_therapy, hcpcs_code, drug_brand_name, drug_generic_name, "
                "policies(id, policy_title, effective_date, payers(name, short_name))"
            )
            .or_(f"drug_generic_name.ilike.%{term}%,drug_brand_name.ilike.%{term}%")
            .execute()
        ).data
        for r in rows:
            key = (r.get("drug_generic_name"), r.get("indication_name"),
                   (r.get("policies") or {}).get("id"))
            if key not in seen:
                seen.add(key)
                results.append(r)

    return {
        "drug_name": drug_name,
        "resolved_name": resolved,
        "total_results": len(results),
        "coverage": results,
    }


# ── Q2: Side-by-side comparison across payers ─────────────────────────────────

@app.get("/compare/{drug_name}")
def compare_drug_across_payers(drug_name: str, indication: Optional[str] = None):
    """
    Q2: Side-by-side comparison of PA criteria for a drug across all payers.
    """
    client = get_client()
    q = (
        client.table("coverage_rules")
        .select(
            "indication_name, coverage_status, evidence_basis, requires_prior_auth, "
            "prior_auth_type, pa_criteria, step_therapy, dosing, limitations, "
            "line_of_therapy, combination_required, combination_drugs, "
            "site_of_care_restriction, "
            "policies(id, policy_title, policy_number, effective_date, payers(name, short_name))"
        )
        .or_(f"drug_generic_name.ilike.%{drug_name}%,drug_brand_name.ilike.%{drug_name}%")
    )
    if indication:
        q = q.ilike("indication_name", f"%{indication}%")

    by_payer: dict[str, dict] = {}
    for row in q.execute().data:
        policy = row.get("policies") or {}
        payer = policy.get("payers") or {}
        payer_name = payer.get("name", "Unknown")
        if payer_name not in by_payer:
            by_payer[payer_name] = {
                "payer_name": payer_name,
                "payer_short_name": payer.get("short_name"),
                "policy_title": policy.get("policy_title"),
                "policy_number": policy.get("policy_number"),
                "effective_date": policy.get("effective_date"),
                "indications": [],
            }
        by_payer[payer_name]["indications"].append({
            "indication_name": row["indication_name"],
            "coverage_status": row["coverage_status"],
            "requires_prior_auth": row["requires_prior_auth"],
            "pa_criteria": row["pa_criteria"],
            "step_therapy": row["step_therapy"],
            "dosing": row["dosing"],
            "limitations": row["limitations"],
            "line_of_therapy": row["line_of_therapy"],
            "combination_required": row["combination_required"],
            "combination_drugs": row["combination_drugs"],
            "site_of_care_restriction": row["site_of_care_restriction"],
        })

    return {
        "drug_name": drug_name,
        "indication_filter": indication,
        "payer_count": len(by_payer),
        "comparison": list(by_payer.values()),
    }


# ── Rebate position (preferred 1-of-2 vs 1-of-3) ─────────────────────────────

@app.get("/category/{molecule}")
def get_category_positions(molecule: str):
    """
    Return a drug's competitive tier position within its category across all payers.
    Critical for rebate economics at Anton RX.
    """
    client = get_client()
    result = (
        client.table("drug_category_positions")
        .select(
            "molecule, category_label, drug_brand_name, drug_generic_name, "
            "tier, tier_position, total_in_tier, is_exclusive_preferred, "
            "step_therapy_required, notes, "
            "policies(payers(name, short_name), effective_date)"
        )
        .ilike("molecule", f"%{molecule}%")
        .execute()
    )
    return {"molecule": molecule, "positions": result.data}


# ── Q3: What changed? ──────────────────────────────────────────────────────────

@app.get("/diff/{policy_id}")
def get_policy_diff(policy_id: str):
    """Q3: Frontend-friendly latest vs previous policy diff."""
    client = get_client()
    versions = (
        client.table("policy_versions")
        .select("policy_id, version_number, raw_text_hash, snapshot_json, diff_summary, is_meaningful_change, snapshotted_at")
        .eq("policy_id", policy_id)
        .order("version_number", desc=True)
        .limit(2)
        .execute()
    ).data

    if not versions:
        raise HTTPException(status_code=404, detail="Policy diff not found")

    policy = (
        client.table("policies")
        .select("id, policy_title, policy_number, effective_date, payers(name, short_name)")
        .eq("id", policy_id)
        .single()
        .execute()
    ).data or {}

    latest = versions[0]
    previous = versions[1] if len(versions) > 1 else None
    diff_payload = _parse_json_field(latest.get("diff_summary"), {}) or {}

    return {
        "policy_id": policy_id,
        "policy_title": policy.get("policy_title"),
        "policy_number": policy.get("policy_number"),
        "payer_name": ((policy.get("payers") or {}).get("name")),
        "payer_short_name": ((policy.get("payers") or {}).get("short_name")),
        "latest_version": _serialize_policy_version(latest),
        "previous_version": _serialize_policy_version(previous) if previous else None,
        "is_meaningful_change": bool(latest.get("is_meaningful_change")),
        "summary": diff_payload.get("diff_summary") or "No summarized policy changes available yet.",
        "change_types": _normalize_change_types(diff_payload.get("change_types")),
        "changes": _build_change_items(diff_payload),
    }


@app.get("/changes/recent")
def recent_changes(days: int = 1):
    """All meaningful policy changes in the last N days."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    result = (
        get_client().table("policy_versions")
        .select(
            "version_number, diff_summary, is_meaningful_change, snapshotted_at, "
            "policies(id, policy_title, payers(name, short_name))"
        )
        .eq("is_meaningful_change", True)
        .gte("snapshotted_at", cutoff)
        .order("snapshotted_at", desc=True)
        .execute()
    )
    return {"days": days, "changes": result.data}


# ── Natural Language Q&A ───────────────────────────────────────────────────────

@app.post("/chat")
async def chat(body: dict):
    """
    Natural language Q&A over the policy database.
    Body: {"question": "Does Cigna cover Rituxan for lupus?"}
    """
    question = body.get("question", "").strip()
    if not question:
        raise HTTPException(400, "question is required")
    if not CLAUDE_API_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY not configured")
    return await answer_question(question, CLAUDE_API_KEY)


def _parse_json_field(value, fallback=None):
    if value in (None, ""):
        return fallback
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return fallback


def _serialize_policy_version(version: dict | None):
    if not version:
        return None
    snapshot = _parse_json_field(version.get("snapshot_json"), {}) or {}
    metadata = snapshot.get("policy_metadata", {})
    return {
        "version_number": version.get("version_number"),
        "snapshotted_at": version.get("snapshotted_at"),
        "effective_date": metadata.get("effective_date"),
        "reviewed_date": metadata.get("reviewed_date"),
        "revised_date": metadata.get("revised_date"),
        "coverage_rule_count": len(snapshot.get("coverage_rules", [])),
        "drug_count": len(snapshot.get("drugs", [])),
    }


def _normalize_change_types(change_types):
    if isinstance(change_types, list):
        return [str(change) for change in change_types]
    return []


def _build_change_items(diff_payload: dict):
    change_types = _normalize_change_types(diff_payload.get("change_types"))
    summary = diff_payload.get("diff_summary")
    items = []
    for change_type in change_types:
        items.append({
            "type": change_type,
            "label": _label_change_type(change_type),
        })
    if summary and not items:
        items.append({"type": "summary", "label": summary})
    return items


def _label_change_type(change_type: str) -> str:
    labels = {
        "step_therapy_added": "Step therapy added",
        "step_therapy_removed": "Step therapy removed",
        "step_therapy_changed": "Step therapy changed",
        "indication_added": "Coverage expanded to a new indication",
        "indication_removed": "An indication was removed",
        "indications_added": "Coverage expanded to additional indications",
        "indications_removed": "Coverage narrowed for one or more indications",
        "pa_criteria_tightened": "Prior auth criteria tightened",
        "pa_criteria_loosened": "Prior auth criteria loosened",
        "pa_criteria_changed": "Prior auth criteria changed",
        "coverage_status_changed": "Coverage status changed",
        "new_drug_added": "A new drug was added",
        "drug_removed": "A drug was removed",
        "drugs_changed": "Drug coverage lineup changed",
        "effective_date_updated": "Effective date updated",
        "cosmetic_edit": "Cosmetic edit only",
    }
    return labels.get(change_type, change_type.replace("_", " ").capitalize())
