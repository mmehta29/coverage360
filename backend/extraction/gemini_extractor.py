"""
Gemini-powered extraction: PDF text → normalized ExtractedPolicy JSON.
"""
import hashlib
import json
import re
from pathlib import Path

import google.generativeai as genai
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
    IMPORTANT: Create ONE rule per (drug + indication) combination. If a drug has 5 indications, create 5 rules.
    For MDL/formulary-style documents with no per-indication criteria, create one rule per drug with indication_name = null.
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
    IMPORTANT: Extract this whenever the policy groups competing drugs into tiers (preferred vs non-preferred).
    This captures the drug's competitive position within its therapeutic category — critical for rebate economics.
    {
      "molecule": "string — the active molecule/ingredient class (e.g. 'bevacizumab', 'trastuzumab', 'botulinum_toxin_a')",
      "category_label": "string — as named in the document (e.g. 'Bevacizumab-Containing Agents')",
      "drug_brand_name": "string",
      "drug_generic_name": "string or null",
      "tier": "one of: preferred | non_preferred | not_covered",
      "tier_position": number or null — position within the tier (1st, 2nd, etc.),
      "total_in_tier": number or null — total drugs in this tier,
      "is_exclusive_preferred": true or false — is this the ONLY preferred drug?,
      "step_therapy_required": true or false — must try preferred before non-preferred?,
      "notes": "string or null"
    }
  ]
}

EXTRACTION RULES:
1. Extract ALL drugs mentioned in the policy, including biosimilars.
2. For prior auth criteria, capture the exact clinical thresholds (e.g. "≥15 headache days/month" → metric: "headache_days_per_month", operator: ">=", value: 15).
3. For step therapy, list the drugs that must be tried/failed before this drug is covered.
4. If the document is a Medical Drug List (MDL/formulary), coverage_type = "formulary_entry" and create one rule per drug row with the tier/coverage level.
5. If the document groups drugs by preferred/non-preferred tier, populate drug_category_positions.
6. If a drug is "Not Covered", set coverage_status = "not_covered" and populate covered_alternatives if listed.
7. For ICD-10 codes that are exempt from PA requirements (common in MDL documents), use pa_exempt_icd10_codes.
8. If information is not present, use null — never invent or assume data.
9. Dates must be in YYYY-MM-DD format. If only month/year is given, use the first of the month.

DOCUMENT:
"""


def extract_text_from_pdf(pdf_path: str) -> tuple[str, str]:
    """Extract text from PDF and return (text, sha256_hash)."""
    import pypdf
    reader = pypdf.PdfReader(pdf_path)
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    full_text = "\n\n".join(pages)
    text_hash = hashlib.sha256(full_text.encode()).hexdigest()
    return full_text, text_hash


def extract_text_from_docx(docx_path: str) -> tuple[str, str]:
    """Extract text from DOCX and return (text, sha256_hash)."""
    import docx
    doc = docx.Document(docx_path)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    full_text = "\n".join(paragraphs)
    text_hash = hashlib.sha256(full_text.encode()).hexdigest()
    return full_text, text_hash


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
def call_gemini(text: str, api_key: str) -> str:
    """Call Gemini with the extraction prompt and return raw JSON string."""
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")
    prompt = EXTRACTION_PROMPT + text[:120000]  # stay within context limits
    response = model.generate_content(
        prompt,
        generation_config=genai.types.GenerationConfig(
            temperature=0,
            response_mime_type="application/json",
        ),
    )
    return response.text


def parse_gemini_response(raw_json: str) -> ExtractedPolicy:
    """Parse and validate Gemini's JSON output into our Pydantic model."""
    # Strip markdown code fences if present
    raw_json = re.sub(r"^```(?:json)?\s*", "", raw_json.strip())
    raw_json = re.sub(r"\s*```$", "", raw_json.strip())
    data = json.loads(raw_json)
    return ExtractedPolicy(**data)


def extract_policy(file_path: str, api_key: str) -> tuple[ExtractedPolicy, str, str]:
    """
    Main entry point: given a file path and Gemini API key,
    returns (ExtractedPolicy, raw_text, raw_text_hash).
    """
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        raw_text, text_hash = extract_text_from_pdf(file_path)
    elif suffix in (".docx", ".doc"):
        raw_text, text_hash = extract_text_from_docx(file_path)
    else:
        raise ValueError(f"Unsupported file type: {suffix}")

    raw_json = call_gemini(raw_text, api_key)
    policy = parse_gemini_response(raw_json)
    return policy, raw_text, text_hash
