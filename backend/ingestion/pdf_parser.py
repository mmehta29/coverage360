"""
Rule-based PDF parser — extracts everything possible WITHOUT an LLM.
Claude only gets called for the parts that genuinely need intelligence (PA criteria).

What this extracts for free:
  - HCPCS codes + descriptions
  - ICD-10 codes
  - Payer name + type
  - Policy number + dates
  - Drug names (brand + generic) by matching known patterns
  - Coverage tiers (Preferred / Non-Preferred / Not Covered)
  - Relevant sections for Claude (trimmed to ~15K chars)
"""
import hashlib
import re
from pathlib import Path
from typing import Optional


# ── Known payer name patterns ──────────────────────────────────────────────────
PAYER_PATTERNS = [
    (r"UnitedHealthcare|UHC|United HealthCare", "UnitedHealthcare", "UHC", "commercial"),
    (r"Blue Cross.*North Carolina|BCBS NC|BCBSNC", "Blue Cross Blue Shield of North Carolina", "BCBS NC", "commercial"),
    (r"Florida Blue", "Florida Blue", "Florida Blue", "commercial"),
    (r"Cigna", "Cigna", "Cigna", "commercial"),
    (r"Priority Health", "Priority Health", "Priority Health", "commercial"),
    (r"EmblemHealth|Emblem Health", "EmblemHealth", "EmblemHealth", "commercial"),
    (r"Prime Therapeutics", "EmblemHealth", "EmblemHealth", "commercial"),
    (r"Aetna", "Aetna", "Aetna", "commercial"),
    (r"Humana", "Humana", "Humana", "commercial"),
    (r"UPMC", "UPMC Health Plan", "UPMC", "commercial"),
]

# ── Section header patterns — used to find and trim relevant content ───────────
RELEVANT_SECTION_PATTERNS = [
    r"coverage rationale",
    r"prior authorization",
    r"criteria",
    r"policy statement",
    r"position statement",
    r"coverage policy",
    r"indications?.*covered",
    r"medical necessity",
    r"step therapy",
    r"approval.*criteria",
]

# ── Sections to drop (background, references, legal boilerplate) ───────────────
SKIP_SECTION_PATTERNS = [
    r"^references?\s*$",
    r"^background\s*$",
    r"^clinical evidence\s*$",
    r"instructions for use",
    r"proprietary information",
    r"policy history",
    r"glossary",
]


def extract_text_from_file(file_path: str) -> tuple[str, str]:
    """Extract raw text and sha256 hash from PDF or DOCX."""
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        import pypdf
        reader = pypdf.PdfReader(file_path)
        pages = [p.extract_text() or "" for p in reader.pages]
        full_text = "\n\n".join(pages)
    elif suffix in (".docx", ".doc"):
        import docx
        doc = docx.Document(file_path)
        full_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    else:
        raise ValueError(f"Unsupported file type: {suffix}")

    text_hash = hashlib.sha256(full_text.encode()).hexdigest()
    return full_text, text_hash


def detect_payer(text: str) -> tuple[str, Optional[str], Optional[str]]:
    """Returns (payer_name, short_name, payer_type)."""
    # Search first 10K chars, then full text as fallback
    for search_window in [text[:10000], text]:
        for pattern, name, short, ptype in PAYER_PATTERNS:
            if re.search(pattern, search_window, re.IGNORECASE):
                return name, short, ptype
    # Fallback: grab first capitalized phrase near "Health Plan" or "Insurance"
    m = re.search(r"([A-Z][A-Za-z\s]+(?:Health Plan|Insurance|Blue|Health Care))", text[:2000])
    return (m.group(1).strip() if m else "Unknown Payer"), None, None


def extract_policy_number(text: str) -> Optional[str]:
    """Extract policy/coverage ID number."""
    patterns = [
        r"Policy Number[:\s]+([A-Z0-9\-]+)",
        r"Coverage Policy Number[:\s]+([A-Z0-9\-]+)",
        r"Policy #[:\s]*([A-Z0-9\-]+)",
        r"\b([A-Z]{2}\d{4}[A-Z0-9]*)\b",  # e.g. IP0319, 2026D0017AN
    ]
    for p in patterns:
        m = re.search(p, text[:3000], re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


def extract_dates(text: str) -> dict:
    """Extract effective, reviewed, revised dates."""
    result = {}
    patterns = {
        "effective_date": [
            r"Effective Date[:\s]+(\w+ \d+,?\s*\d{4}|\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2})",
            r"Effective[:\s]+(\w+ \d{4}|\d{1,2}/\d{1,2}/\d{4})",
        ],
        "reviewed_date": [r"Reviewed?[:\s]+(\d{1,2}/\d{1,2}/\d{2,4})"],
        "revised_date": [r"Revised?[:\s]+(\d{1,2}/\d{1,2}/\d{2,4})"],
    }
    month_map = {
        "january": "01", "february": "02", "march": "03", "april": "04",
        "may": "05", "june": "06", "july": "07", "august": "08",
        "september": "09", "october": "10", "november": "11", "december": "12",
    }

    for field, pats in patterns.items():
        for pat in pats:
            m = re.search(pat, text[:4000], re.IGNORECASE)
            if m:
                raw = m.group(1).strip()
                # Normalize to YYYY-MM-DD
                # "January 2026" → 2026-01-01
                mo = re.match(r"(\w+)\s+(\d+),?\s*(\d{4})?", raw)
                if mo:
                    mon = month_map.get(mo.group(1).lower())
                    if mon:
                        year = mo.group(3) or mo.group(2)
                        day = mo.group(2) if mo.group(3) else "01"
                        result[field] = f"{year}-{mon}-{day.zfill(2)}"
                        break
                # "01/01/2026"
                mo2 = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", raw)
                if mo2:
                    result[field] = f"{mo2.group(3)}-{mo2.group(1).zfill(2)}-{mo2.group(2).zfill(2)}"
                    break
                # Already YYYY-MM-DD
                if re.match(r"\d{4}-\d{2}-\d{2}", raw):
                    result[field] = raw
                    break
    return result


def extract_hcpcs_codes(text: str) -> list[dict]:
    """Extract HCPCS J-codes and Q-codes with descriptions."""
    codes = []
    seen = set()
    # Pattern: J0585 Injection, onabotulinumtoxinA, 1 unit   Botox
    pattern = r"\b([JQC]\d{4})\b[^\n]*?([Ii]njection[^\n]{5,80})"
    for m in re.finditer(pattern, text):
        code = m.group(1)
        desc = m.group(2).strip()[:120]
        if code not in seen:
            seen.add(code)
            codes.append({"code": code, "description": desc, "unit": None})
    # Also grab standalone codes
    for m in re.finditer(r"\b([JQC]\d{4})\b", text):
        code = m.group(1)
        if code not in seen:
            seen.add(code)
            codes.append({"code": code, "description": None, "unit": None})
    return codes


def extract_icd10_codes(text: str) -> list[str]:
    """Extract ICD-10 diagnosis codes."""
    # ICD-10 pattern: letter + 2 digits + optional decimal + up to 4 more chars
    codes = re.findall(r"\b([A-Z]\d{2}\.?[0-9A-Z]{0,4})\b", text)
    # Filter out false positives (policy numbers, etc.) — ICD-10s are short
    valid = [c for c in codes if re.match(r"^[A-Z]\d{2}", c) and len(c) <= 8]
    return list(dict.fromkeys(valid))  # deduplicate, preserve order


def detect_policy_type(text: str) -> str:
    """Infer policy type from document content."""
    text_lower = text[:3000].lower()
    if any(x in text_lower for x in ["medical drug list", "drug list", "coverage level", "hcpcs/cpt"]):
        return "medical_drug_list"
    if any(x in text_lower for x in ["preferred injectable", "preferred biologic", "preferred program"]):
        return "preferred_drug_program"
    if any(x in text_lower for x in ["medical coverage guideline", "mcg"]):
        return "coverage_guideline"
    return "medical_benefit_drug_policy"


def trim_to_relevant_sections(text: str, max_chars: int = 20000) -> str:
    """
    Return only the clinically relevant sections of a document.
    Drops background, references, and boilerplate.
    Limits to max_chars to control Claude costs.
    """
    lines = text.split("\n")
    relevant_lines = []
    in_skip_section = False
    chars = 0

    for line in lines:
        line_lower = line.strip().lower()

        # Check if this line starts a section to skip
        if any(re.match(p, line_lower) for p in SKIP_SECTION_PATTERNS):
            in_skip_section = True
            continue

        # Check if this line starts a relevant section (re-enable)
        if any(re.search(p, line_lower) for p in RELEVANT_SECTION_PATTERNS):
            in_skip_section = False

        if not in_skip_section:
            relevant_lines.append(line)
            chars += len(line)
            if chars >= max_chars:
                break

    return "\n".join(relevant_lines)


def parse_document(file_path: str) -> dict:
    """
    Full rule-based parse. Returns a dict with everything extractable without LLM.
    Also returns 'text_for_claude' — the trimmed section to send to Claude.
    """
    full_text, text_hash = extract_text_from_file(file_path)

    payer_name, payer_short, payer_type = detect_payer(full_text)
    dates = extract_dates(full_text)

    return {
        # Metadata (rule-based, free)
        "payer_name": payer_name,
        "payer_short_name": payer_short,
        "payer_type": payer_type,
        "policy_number": extract_policy_number(full_text),
        "policy_type": detect_policy_type(full_text),
        "effective_date": dates.get("effective_date"),
        "reviewed_date": dates.get("reviewed_date"),
        "revised_date": dates.get("revised_date"),
        "hcpcs_codes": extract_hcpcs_codes(full_text),
        "icd10_codes": extract_icd10_codes(full_text),

        # For deduplication
        "raw_text_hash": text_hash,

        # Trimmed text for Claude — only the relevant sections, max 20K chars
        # Claude only needs this to extract PA criteria + indications
        "text_for_claude": trim_to_relevant_sections(full_text, max_chars=20000),
        "full_text_length": len(full_text),
    }
