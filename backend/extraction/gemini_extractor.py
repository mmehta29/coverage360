"""
Hybrid extraction pipeline:
  - Rule-based parser (pdf_parser.py) handles: payer, dates, HCPCS, ICD-10 codes — free, instant
  - Claude handles: coverage rules, drug names, PA criteria, step therapy — only sees ~20K chars
"""
import json
import re

import anthropic
from tenacity import retry, stop_after_attempt, wait_exponential

from extraction.schema import ExtractedPolicy

EXTRACTION_PROMPT = """
You are an expert medical policy analyst. Extract structured coverage data from this health plan policy document.

Your output must be a single valid JSON object matching this exact schema. Do not include any text before or after the JSON.

SCHEMA:
{
  "policy_metadata": {
    "payer_name": "string — full legal name of the health plan (e.g. 'UnitedHealthcare', 'Blue Cross Blue Shield of North Carolina')",
    "payer_short_name": "string or null — common abbreviation (e.g. 'UHC', 'BCBS NC', 'Florida Blue')",
    "payer_type": "one of: commercial | medicare | medicaid | exchange | null",
    "plan_names": ["array of specific plan names mentioned, e.g. 'UHC Commercial'"],
    "policy_number": "string or null — the policy's official number/ID",
    "policy_title": "string — the full title of this policy",
    "policy_type": "one of: medical_benefit_drug_policy | medical_drug_list | coverage_guideline | preferred_drug_program",
    "effective_date": "YYYY-MM-DD or null",
    "reviewed_date": "YYYY-MM-DD or null",
    "revised_date": "YYYY-MM-DD or null",
    "lines_of_business": ["array: commercial, medicare, and/or medicaid"],
    "document_source": "user_upload"
  },

  "drugs": [
    {
      "brand_name": "string or null — the brand/trade name (e.g. 'Avastin')",
      "generic_name": "string — the generic/INN name (e.g. 'bevacizumab')",
      "biosimilar_suffix": "string or null — biosimilar modifier suffix (e.g. '-awwb', '-pvvr')",
      "reference_product": "string or null — if biosimilar, name of the reference biologic",
      "is_biosimilar": true or false,
      "drug_class": "string or null — therapeutic class (e.g. 'VEGF inhibitor', 'botulinum toxin', 'CD20 antibody')",
      "route_of_administration": "string or null — e.g. 'intravenous', 'subcutaneous', 'injection'",
      "hcpcs_codes": [{"code": "J0585", "description": "string", "unit": "string or null"}],
      "manufacturer": "string or null"
    }
  ],

  "coverage_rules": [
    {
      "drug_brand_name": "string or null",
      "drug_generic_name": "string — must match a drug in the drugs array",
      "hcpcs_code": "string or null",
      "indication_name": "string or null — the specific medical condition (e.g. 'Chronic Migraine', 'Metastatic Colorectal Cancer')",
      "icd10_codes": ["array of ICD-10 codes for this indication, e.g. 'G43.709'"],
      "coverage_status": "one of: covered | not_covered | preferred | non_preferred | preferred_specialty | non_specialty | unproven",
      "evidence_basis": "one of: fda_approved | nccn_category1 | nccn_category2a | off_label | unproven | null",
      "requires_prior_auth": true or false,
      "prior_auth_type": "one of: standard | specialty | medical_necessity | null",
      "coverage_type": "one of: pa_policy | formulary_entry | preferred_program",
      "pa_criteria": {
        "requires_pa": true or false,
        "top_level_logic": "ALL or ANY",
        "criteria": [
          {
            "type": "one of: diagnosis | clinical_threshold | age | specialist | documentation | other",
            "description": "string — exact text of the criterion",
            "metric": "string or null — e.g. 'headache_days_per_month'",
            "operator": "string or null — one of: >= | <= | = | > | <",
            "value": number or null,
            "unit": "string or null",
            "required": true or false
          }
        ],
        "step_therapy": [
          {
            "order": 1,
            "logic": "ONE_OF or ALL",
            "reason": "failure_or_intolerance or contraindication or failure",
            "required_agents": ["list of drug names that must be tried first"]
          }
        ],
        "documentation_required": ["list of required documentation strings"],
        "specialist_required": "string or null — e.g. 'neurologist', 'oncologist'",
        "approval_duration_days": number or null,
        "approval_duration_months": number or null,
        "reauth_required": true or false,
        "reauth_criteria_same_as_initial": true or false
      },
      "dosing": {
        "max_dose": "string or null",
        "dose_unit": "string or null",
        "max_frequency": "string or null — e.g. 'every 12 weeks'",
        "notes": "string or null"
      },
      "general_requirements": ["array of general requirement strings that apply across all indications"],
      "limitations": ["array of limitation strings"],
      "line_of_therapy": "one of: first_line | second_line | third_line | any | null",
      "combination_required": true or false,
      "combination_drugs": ["array of drugs this must be combined with"],
      "site_of_care_restriction": "string or null",
      "covered_alternatives": [{"drug_name": "string", "hcpcs_code": "string or null", "note": "string or null"}],
      "pa_exempt_icd10_codes": ["ICD-10 codes that are exempt from PA for this drug"]
    }
  ],

  "drug_category_positions": [
    {
      "molecule": "string — the active molecule/ingredient class (e.g. 'bevacizumab', 'trastuzumab')",
      "category_label": "string — as named in the document (e.g. 'Bevacizumab-Containing Agents')",
      "drug_brand_name": "string",
      "drug_generic_name": "string or null",
      "tier": "one of: preferred | non_preferred | not_covered",
      "tier_position": number or null,
      "total_in_tier": number or null,
      "is_exclusive_preferred": true or false,
      "step_therapy_required": true or false,
      "notes": "string or null"
    }
  ]
}

EXTRACTION RULES:
1. Extract ALL drugs mentioned in the policy, including biosimilars.
2. Create ONE coverage rule per (drug + indication) combination.
3. For prior auth criteria, capture exact clinical thresholds (e.g. ">=15 headache days/month" → metric: "headache_days_per_month", operator: ">=", value: 15).
4. For step therapy, list drugs that must be tried/failed before this drug is covered.
5. If the document is a Medical Drug List (MDL/formulary), coverage_type = "formulary_entry" and create one rule per drug with indication_name = null.
6. If the document groups drugs by preferred/non-preferred tier, populate drug_category_positions.
7. If a drug is "Not Covered", set coverage_status = "not_covered" and populate covered_alternatives if listed.
8. If information is not present, use null — never invent or assume data.
9. Dates must be in YYYY-MM-DD format. If only month/year is given, use the first of the month.

DOCUMENT:
"""


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=30, max=90))
def call_claude(text: str, api_key: str, pre_extracted: dict) -> str:
    """
    Call Claude with ONLY the trimmed relevant sections (~20K chars max).
    Pre-extracted fields (dates, payer, HCPCS codes) are injected as hints
    so Claude doesn't waste tokens re-deriving them.
    """
    client = anthropic.Anthropic(api_key=api_key)

    # Build context hints from rule-based extraction
    hints = f"""
PRE-EXTRACTED CONTEXT (already identified by rule-based parser — use these, don't re-derive):
- Payer: {pre_extracted.get('payer_name')} ({pre_extracted.get('payer_short_name')})
- Policy Number: {pre_extracted.get('policy_number')}
- Policy Type: {pre_extracted.get('policy_type')}
- Effective Date: {pre_extracted.get('effective_date')}
- HCPCS Codes found: {', '.join(c['code'] for c in pre_extracted.get('hcpcs_codes', [])[:20])}

YOUR JOB: Extract only the coverage_rules, drugs, and drug_category_positions from the RELEVANT SECTIONS below.
Focus on: drug names, indications, coverage status, PA criteria, step therapy requirements.
"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8000,
        messages=[
            {
                "role": "user",
                "content": EXTRACTION_PROMPT + hints + "\n\nRELEVANT SECTIONS:\n" + text,
            }
        ],
    )
    return message.content[0].text


def parse_claude_response(raw_json: str) -> dict:
    """
    Parse Claude's JSON output. Uses json-repair as fallback for truncated responses.
    Returns raw dict (not yet a Pydantic model — caller merges with pre-extracted data).
    """
    from json_repair import repair_json

    raw_json = re.sub(r"^```(?:json)?\s*", "", raw_json.strip())
    raw_json = re.sub(r"\s*```$", "", raw_json.strip())

    try:
        return json.loads(raw_json)
    except json.JSONDecodeError:
        repaired = repair_json(raw_json, return_objects=False)
        return json.loads(repaired)


def extract_policy(file_path: str, api_key: str) -> tuple[ExtractedPolicy, str, str]:
    """
    Hybrid pipeline:
      1. Rule-based parser  — extracts payer, dates, HCPCS, ICD-10 (free, instant)
      2. Claude             — only gets the trimmed relevant sections (~20K chars)
      3. Merge              — combine rule-based + Claude output into ExtractedPolicy
    """
    from ingestion.pdf_parser import parse_document

    # Step 1: Rule-based extraction (free)
    pre = parse_document(file_path)
    raw_text_hash = pre["raw_text_hash"]
    text_for_claude = pre["text_for_claude"]

    print(f"  Rule-based: {pre['payer_name']} | {len(pre['hcpcs_codes'])} HCPCS codes | "
          f"{len(pre['icd10_codes'])} ICD-10 codes | sending {len(text_for_claude):,} chars to Claude")

    # Step 2: Claude extracts coverage rules + drugs from trimmed text
    raw_json = call_claude(text_for_claude, api_key, pre)
    claude_data = parse_claude_response(raw_json)

    # Step 3: Merge — rule-based metadata overrides Claude's metadata
    # (rule-based is more reliable for structured fields like dates/payer name)
    if "policy_metadata" not in claude_data:
        claude_data["policy_metadata"] = {}

    meta = claude_data["policy_metadata"]
    meta["payer_name"] = pre["payer_name"] or meta.get("payer_name", "Unknown")
    meta["payer_short_name"] = pre["payer_short_name"] or meta.get("payer_short_name")
    meta["payer_type"] = pre["payer_type"] or meta.get("payer_type")
    meta["policy_number"] = pre["policy_number"] or meta.get("policy_number")
    meta["policy_type"] = pre["policy_type"] or meta.get("policy_type", "medical_benefit_drug_policy")
    if pre.get("effective_date"):
        meta["effective_date"] = pre["effective_date"]
    if pre.get("reviewed_date"):
        meta["reviewed_date"] = pre["reviewed_date"]
    if pre.get("revised_date"):
        meta["revised_date"] = pre["revised_date"]
    if not meta.get("policy_title"):
        meta["policy_title"] = "Untitled Policy"

    policy = ExtractedPolicy(**claude_data)
    return policy, text_for_claude, raw_text_hash