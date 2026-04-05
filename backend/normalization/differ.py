"""
Intelligent policy diff engine.

Three-stage pipeline (each stage only runs if the previous found a change):
  1. Text similarity  — difflib, free. Skip everything if >97% similar (cosmetic).
  2. Structural diff  — Python dict comparison, free. Find exactly what changed.
  3. Claude diff      — only called when structural changes exist, ~500 tokens max.

This keeps costs near zero: Claude only runs when something actually changed clinically.
"""
import difflib
import json
from typing import Optional

import anthropic


# ── Stage 1: Text similarity ───────────────────────────────────────────────────

def compute_text_similarity(old_text: str, new_text: str) -> float:
    """
    Returns 0.0–1.0. >0.97 = cosmetic change, skip Claude entirely.
    Uses difflib quick_ratio for speed (O(n) not O(n²)).
    """
    return difflib.SequenceMatcher(None, old_text, new_text).quick_ratio()


# ── Stage 2: Structural diff ───────────────────────────────────────────────────

def compute_structural_diff(old_json: dict, new_json: dict) -> list[str]:
    """
    Compares two extracted_json dicts at the field level.
    Returns list of change labels — empty list means no structural changes.
    Free — pure Python, no LLM.
    """
    changes = []

    old_rules = old_json.get("coverage_rules", [])
    new_rules = new_json.get("coverage_rules", [])

    # Coverage rule count changed
    if len(old_rules) != len(new_rules):
        diff = len(new_rules) - len(old_rules)
        changes.append(f"coverage_rules_{'added' if diff > 0 else 'removed'} ({abs(diff)})")

    # Step therapy changed
    old_step = _extract_step_therapy(old_rules)
    new_step = _extract_step_therapy(new_rules)
    if old_step != new_step:
        changes.append("step_therapy_changed")

    # PA criteria changed
    old_pa = _extract_pa_flags(old_rules)
    new_pa = _extract_pa_flags(new_rules)
    if old_pa != new_pa:
        changes.append("pa_criteria_changed")

    # Coverage status changed
    old_statuses = _extract_statuses(old_rules)
    new_statuses = _extract_statuses(new_rules)
    if old_statuses != new_statuses:
        changes.append("coverage_status_changed")

    # Indications changed
    old_indications = _extract_indications(old_rules)
    new_indications = _extract_indications(new_rules)
    added = new_indications - old_indications
    removed = old_indications - new_indications
    if added:
        changes.append(f"indications_added ({len(added)})")
    if removed:
        changes.append(f"indications_removed ({len(removed)})")

    # Drug count changed
    old_drugs = {d.get("generic_name") for d in old_json.get("drugs", [])}
    new_drugs = {d.get("generic_name") for d in new_json.get("drugs", [])}
    if old_drugs != new_drugs:
        changes.append("drugs_changed")

    # Effective date changed (not clinically meaningful but worth noting)
    old_date = old_json.get("policy_metadata", {}).get("effective_date")
    new_date = new_json.get("policy_metadata", {}).get("effective_date")
    if old_date != new_date:
        changes.append(f"effective_date_changed ({old_date} → {new_date})")

    return changes


def _extract_step_therapy(rules: list) -> list:
    return [
        (r.get("drug_generic_name"), json.dumps(r.get("step_therapy", []), sort_keys=True))
        for r in rules
        if r.get("step_therapy")
    ]


def _extract_pa_flags(rules: list) -> set:
    return {
        (r.get("drug_generic_name"), r.get("indication_name"), r.get("requires_prior_auth"))
        for r in rules
    }


def _extract_statuses(rules: list) -> set:
    return {
        (r.get("drug_generic_name"), r.get("indication_name"), r.get("coverage_status"))
        for r in rules
    }


def _extract_indications(rules: list) -> set:
    return {
        (r.get("drug_generic_name"), r.get("indication_name"))
        for r in rules
        if r.get("indication_name")
    }


# ── Stage 3: Claude meaningful-change check ────────────────────────────────────

DIFF_PROMPT = """You are a medical policy analyst. Two versions of a drug coverage policy have been compared.

The following structural changes were detected:
{changes}

OLD POLICY (relevant sections):
{old_summary}

NEW POLICY (relevant sections):
{new_summary}

Determine:
1. Is this a MEANINGFUL CLINICAL CHANGE (affects patient access, PA criteria, step therapy, covered indications)?
   Or is it a COSMETIC CHANGE (updated date, formatting, added references, minor wording)?

2. Write a one-sentence plain-English summary of what changed for an analyst.

Respond with ONLY valid JSON:
{{
  "is_meaningful_change": true or false,
  "diff_summary": "one sentence description of what changed",
  "change_types": ["list", "of", "change", "categories"]
}}

Change categories to use: step_therapy_added, step_therapy_removed, indication_added,
indication_removed, pa_criteria_tightened, pa_criteria_loosened, coverage_status_changed,
new_drug_added, drug_removed, effective_date_updated, cosmetic_edit
"""


def claude_diff(
    old_json: dict,
    new_json: dict,
    structural_changes: list[str],
    api_key: str,
) -> dict:
    """
    Stage 3: Ask Claude if structural changes are clinically meaningful.
    Only called when structural_changes is non-empty.
    Sends only the changed fields (~500 tokens), not the full document.
    """
    client = anthropic.Anthropic(api_key=api_key)

    # Build minimal summaries of only the changed parts
    old_summary = _build_change_summary(old_json, structural_changes)
    new_summary = _build_change_summary(new_json, structural_changes)

    prompt = DIFF_PROMPT.format(
        changes="\n".join(f"- {c}" for c in structural_changes),
        old_summary=json.dumps(old_summary, indent=2)[:2000],
        new_summary=json.dumps(new_summary, indent=2)[:2000],
    )

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    # Strip markdown fences if present
    import re
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "is_meaningful_change": True,
            "diff_summary": f"Policy changed: {', '.join(structural_changes[:3])}",
            "change_types": structural_changes,
        }


def _build_change_summary(policy_json: dict, changes: list[str]) -> dict:
    """Extract only the fields relevant to the detected changes."""
    summary = {}
    rules = policy_json.get("coverage_rules", [])

    if any("step_therapy" in c for c in changes):
        summary["step_therapy"] = [
            {"drug": r.get("drug_generic_name"), "steps": r.get("step_therapy")}
            for r in rules if r.get("step_therapy")
        ]

    if any("pa_criteria" in c or "indication" in c or "coverage_status" in c for c in changes):
        summary["coverage_rules"] = [
            {
                "drug": r.get("drug_generic_name"),
                "indication": r.get("indication_name"),
                "status": r.get("coverage_status"),
                "requires_pa": r.get("requires_prior_auth"),
            }
            for r in rules
        ]

    if any("drug" in c for c in changes):
        summary["drugs"] = [d.get("generic_name") for d in policy_json.get("drugs", [])]

    if not summary:
        summary["metadata"] = policy_json.get("policy_metadata", {})

    return summary


# ── Main entry point ───────────────────────────────────────────────────────────

def diff_policy_versions(
    old_text: str,
    new_text: str,
    old_json: dict,
    new_json: dict,
    api_key: str,
) -> dict:
    """
    Full diff pipeline. Returns result dict ready to store in policy_versions.

    Stage 1: text similarity  → if >97%, return cosmetic immediately
    Stage 2: structural diff  → if no changes, return cosmetic
    Stage 3: Claude           → only if structural changes found
    """
    # Stage 1 — text similarity (free)
    similarity = compute_text_similarity(old_text, new_text)
    print(f"    Text similarity: {similarity:.1%}")

    if similarity > 0.97:
        return {
            "is_meaningful_change": False,
            "diff_summary": f"Cosmetic update only ({similarity:.1%} text similarity). No clinical changes detected.",
            "change_types": ["cosmetic_edit"],
            "similarity": similarity,
            "stages_run": ["text_similarity"],
        }

    # Stage 2 — structural diff (free)
    structural_changes = compute_structural_diff(old_json, new_json)
    print(f"    Structural changes: {structural_changes or 'none'}")

    if not structural_changes:
        return {
            "is_meaningful_change": False,
            "diff_summary": f"Minor text changes ({similarity:.1%} similarity) but no structural policy changes.",
            "change_types": ["cosmetic_edit"],
            "similarity": similarity,
            "stages_run": ["text_similarity", "structural_diff"],
        }

    # Stage 3 — Claude (paid, ~500 tokens)
    print(f"    Calling Claude to assess clinical significance...")
    result = claude_diff(old_json, new_json, structural_changes, api_key)
    result["similarity"] = similarity
    result["stages_run"] = ["text_similarity", "structural_diff", "claude_diff"]
    return result
