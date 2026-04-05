"""
Policy update watcher — run nightly via GitHub Actions or manually.

For each tracked policy in Supabase:
  1. Download current PDF from source URL (free)
  2. Hash it, compare to stored hash (free)
  3. If same → skip
  4. If different → text similarity check (free)
  5. If cosmetic (<2% change) → mark cosmetic, skip Claude
  6. If significant → re-ingest with Claude → structured diff → Claude diff

Run from backend/:
    python3 check_updates.py
"""
import hashlib
import os
import sys
import tempfile

import httpx
from dotenv import load_dotenv

load_dotenv()

from database.supabase_client import get_client
from extraction.gemini_extractor import extract_policy
from ingestion.pdf_parser import extract_text_from_file
from normalization.differ import diff_policy_versions
from normalization.normalizer import (
    get_next_version_number,
    snapshot_policy_version,
    update_policy,
    update_version_diff,
    _model_dump,
)

# ── Known policy source URLs ───────────────────────────────────────────────────
# Maps (payer_name_fragment, title_fragment) → direct PDF URL
# Add URLs here as you discover them from payer websites.
# Cigna URLs can be found at: https://static.cigna.com/assets/chcp/resourceLibrary/coveragePolicies/pharmacy_a-z.html
# UHC URLs follow pattern: https://www.uhcprovider.com/content/dam/provider/docs/public/policies/comm-medical-drug/[NAME].pdf

KNOWN_URLS = [
    {
        "payer_contains": "Cigna",
        "title_contains": "Rituximab",
        "url": "https://static.cigna.com/assets/chcp/pdf/coveragePolicies/pharmacy/ip_0319_coveragepositioncriteria_rituximab_non_oncology.pdf",
    },
    {
        "payer_contains": "UnitedHealthcare",
        "title_contains": "Botulinum",
        "url": "https://www.uhcprovider.com/content/dam/provider/docs/public/policies/comm-medical-drug/botulinum-toxins-a-and-b.pdf",
    },
    # Add more as needed:
    # {
    #     "payer_contains": "Priority Health",
    #     "title_contains": "Medical Drug List",
    #     "url": "https://...",
    # },
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def download_pdf(url: str) -> bytes | None:
    """Download a PDF from a URL. Returns raw bytes or None on failure."""
    try:
        resp = httpx.get(url, timeout=30, follow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (compatible; Coverage360PolicyBot/1.0)",
        })
        resp.raise_for_status()
        return resp.content
    except Exception as e:
        print(f"    Download failed: {e}")
        return None


def hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def find_policy_in_db(client, payer_contains: str, title_contains: str) -> dict | None:
    """Find a policy in Supabase by payer name and title fragment."""
    result = (
        client.table("policies")
        .select("id, policy_title, raw_text_hash, extracted_json, payers(name)")
        .execute()
    )
    for row in result.data:
        payer_name = (row.get("payers") or {}).get("name", "")
        title = row.get("policy_title", "")
        if payer_contains.lower() in payer_name.lower() and title_contains.lower() in title.lower():
            return row
    return None


def get_old_text_from_policy(policy: dict) -> str:
    """Reconstruct old text from extracted_json for similarity comparison."""
    import json
    try:
        data = json.loads(policy["extracted_json"]) if isinstance(policy["extracted_json"], str) else policy["extracted_json"]
        # Best we can do without storing original text — use JSON as proxy
        return json.dumps(data, sort_keys=True)
    except Exception:
        return ""


# ── Main update check ──────────────────────────────────────────────────────────

def check_policy(client, entry: dict, api_key: str) -> dict:
    """
    Check one policy URL for updates.
    Returns a result dict describing what happened.
    """
    payer_frag = entry["payer_contains"]
    title_frag = entry["title_contains"]
    url = entry["url"]

    print(f"\n  Checking: {payer_frag} — {title_frag}")
    print(f"  URL: {url}")

    # Find in DB
    policy = find_policy_in_db(client, payer_frag, title_frag)
    if not policy:
        print(f"  NOT IN DB — skipping (upload manually to track)")
        return {"status": "not_in_db", "payer": payer_frag, "title": title_frag}

    policy_id = policy["id"]
    stored_hash = policy["raw_text_hash"]
    print(f"  Found in DB: {policy['policy_title'][:60]}...")

    # Update document_url in DB if not set
    client.table("policies").update({"document_url": url}).eq("id", policy_id).execute()

    # Download current PDF
    print(f"  Downloading PDF...")
    pdf_bytes = download_pdf(url)
    if not pdf_bytes:
        return {"status": "download_failed", "policy_id": policy_id}

    # Hash check (free)
    new_hash = hash_bytes(pdf_bytes)
    if new_hash == stored_hash:
        print(f"  No change — hash matches")
        return {"status": "no_change", "policy_id": policy_id}

    print(f"  Hash changed — policy was updated!")

    # Save to temp file for pipeline
    suffix = ".pdf"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        # Extract new text (free)
        new_text, _ = extract_text_from_file(tmp_path)
        old_text = get_old_text_from_policy(policy)

        # Re-ingest through full pipeline (Claude call #1)
        print(f"  Re-ingesting through pipeline...")
        new_policy, _, _ = extract_policy(tmp_path, api_key)
        new_extracted_json = _model_dump(new_policy)

        old_extracted_json = (
            policy["extracted_json"]
            if isinstance(policy["extracted_json"], dict)
            else __import__("json").loads(policy["extracted_json"])
        )

        # Diff (free stages first, Claude only if needed)
        print(f"  Running diff pipeline...")
        diff_result = diff_policy_versions(
            old_text=old_text,
            new_text=new_text,
            old_json=old_extracted_json,
            new_json=new_extracted_json,
            api_key=api_key,
        )

        print(f"  Meaningful change: {diff_result['is_meaningful_change']}")
        print(f"  Summary: {diff_result['diff_summary']}")

        # Update policy in DB
        update_policy(policy_id, new_policy, new_hash, new_extracted_json)

        # Save new version snapshot
        version_number = get_next_version_number(policy_id)
        snapshot_policy_version(
            policy_id=policy_id,
            raw_text_hash=new_hash,
            extracted_json=new_extracted_json,
            version_number=version_number,
        )

        # Store diff results on the version
        update_version_diff(policy_id, version_number, diff_result)

        return {
            "status": "updated",
            "policy_id": policy_id,
            "version": version_number,
            "is_meaningful_change": diff_result["is_meaningful_change"],
            "diff_summary": diff_result["diff_summary"],
        }

    finally:
        os.unlink(tmp_path)


def main():
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        print("ERROR: CLAUDE_API_KEY not set")
        sys.exit(1)

    client = get_client()

    print("=== Coverage360 Policy Update Check ===")
    print(f"Monitoring {len(KNOWN_URLS)} policies\n")

    results = []
    for entry in KNOWN_URLS:
        result = check_policy(client, entry, api_key)
        results.append(result)

    # Summary
    print("\n=== SUMMARY ===")
    updated = [r for r in results if r["status"] == "updated"]
    meaningful = [r for r in updated if r.get("is_meaningful_change")]
    no_change = [r for r in results if r["status"] == "no_change"]

    print(f"  Checked:           {len(results)}")
    print(f"  No change:         {len(no_change)}")
    print(f"  Updated:           {len(updated)}")
    print(f"  Meaningful change: {len(meaningful)}")

    if meaningful:
        print("\nMEANINGFUL CHANGES DETECTED:")
        for r in meaningful:
            print(f"  • {r['diff_summary']}")

    if updated and not meaningful:
        print("\nAll updates were cosmetic (date/formatting changes).")


if __name__ == "__main__":
    main()
