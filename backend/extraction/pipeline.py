"""
Unified extraction pipeline — single entry point for all document types (PDF, DOCX).

Flow:
  1. pdf_parser.py  → rule-based extraction (payer, dates, HCPCS, ICD-10) — FREE
  2. gemini_extractor.py → single Claude call (~20K chars max) — PAID
  3. Merge → combine rule-based + Claude output into ExtractedPolicy

Cost savings: ~3x reduction in Claude API calls compared to chunked pipeline.
"""

from extraction.schema import ExtractedPolicy
from ingestion.pdf_parser import parse_document
from extraction.gemini_extractor import call_claude, parse_claude_response


def extract_policy_unified(file_path: str, api_key: str) -> tuple[ExtractedPolicy, str, str]:
    """
    Unified pipeline for all document types (PDF, DOCX).

    Returns:
        tuple: (ExtractedPolicy, text_for_claude, raw_text_hash)
    """
    # Step 1: Rule-based extraction (free, instant)
    print("[PIPELINE] Running rule-based extraction...")
    pre = parse_document(file_path)
    raw_text_hash = pre["raw_text_hash"]
    text_for_claude = pre["text_for_claude"]

    print(f"[PIPELINE] Rule-based results: {pre['payer_name']} | "
          f"{len(pre['hcpcs_codes'])} HCPCS codes | "
          f"{len(pre['icd10_codes'])} ICD-10 codes | "
          f"sending {len(text_for_claude):,} chars to Claude")

    # Step 2: Single Claude call for coverage rules + drugs (paid)
    print("[PIPELINE] Calling Claude for extraction...")
    raw_json = call_claude(text_for_claude, api_key, pre)
    claude_data = parse_claude_response(raw_json)

    # Step 3: Merge — rule-based metadata overrides Claude's metadata
    # (rule-based is more reliable for structured fields like dates/payer name)
    merged = merge_with_preextracted(claude_data, pre)

    print(f"[PIPELINE] Extracted {len(merged.get('drugs', []))} drugs, "
          f"{len(merged.get('coverage_rules', []))} coverage rules")

    policy = ExtractedPolicy(**merged)
    return policy, text_for_claude, raw_text_hash


def merge_with_preextracted(claude_data: dict, pre: dict) -> dict:
    """
    Merge Claude's extraction with rule-based pre-extracted data.
    Rule-based fields override Claude's when available (more reliable).
    """
    if "policy_metadata" not in claude_data:
        claude_data["policy_metadata"] = {}

    meta = claude_data["policy_metadata"]

    # Override with rule-based metadata (more reliable for structured fields)
    meta["payer_name"] = pre["payer_name"] or meta.get("payer_name", "Unknown")
    meta["payer_short_name"] = pre["payer_short_name"] or meta.get("payer_short_name")
    meta["payer_type"] = pre["payer_type"] or meta.get("payer_type")
    meta["policy_number"] = pre["policy_number"] or meta.get("policy_number")
    meta["policy_type"] = pre["policy_type"] or meta.get("policy_type", "medical_benefit_drug_policy")

    # Dates: prefer rule-based extraction
    if pre.get("effective_date"):
        meta["effective_date"] = pre["effective_date"]
    if pre.get("reviewed_date"):
        meta["reviewed_date"] = pre["reviewed_date"]
    if pre.get("revised_date"):
        meta["revised_date"] = pre["revised_date"]

    # Default title if missing
    if not meta.get("policy_title"):
        meta["policy_title"] = "Untitled Policy"

    # Ensure required arrays exist
    if "drugs" not in claude_data:
        claude_data["drugs"] = []
    if "coverage_rules" not in claude_data:
        claude_data["coverage_rules"] = []
    if "drug_category_positions" not in claude_data:
        claude_data["drug_category_positions"] = []

    return claude_data


# Deprecated function — kept for 1 week rollback period, then remove
def _extract_policy_chunked_deprecated(file_path: str, api_key: str) -> tuple[ExtractedPolicy, str, str]:
    """
    DEPRECATED: Old chunked pipeline that made 3 Claude calls per document.
    Replaced by extract_policy_unified() which uses a single Claude call.
    Will be removed after 2026-04-11.
    """
    raise NotImplementedError(
        "Chunked pipeline is deprecated. Use extract_policy_unified() instead."
    )
