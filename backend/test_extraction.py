"""
Quick smoke test: run Claude extraction on a single local PDF.
Usage (from backend/):
  python test_extraction.py /path/to/policy.pdf
"""
import json
import os
import sys

from dotenv import load_dotenv
load_dotenv()

from extraction.gemini_extractor import extract_policy

def main():
    if len(sys.argv) < 2:
        print("Usage: python test_extraction.py <path_to_pdf>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        print("Error: CLAUDE_API_KEY not set in .env")
        sys.exit(1)

    print(f"Extracting: {pdf_path}")
    policy, _text, text_hash = extract_policy(pdf_path, api_key)

    print(f"\n=== POLICY METADATA ===")
    print(f"Payer:        {policy.policy_metadata.payer_name}")
    print(f"Policy:       {policy.policy_metadata.policy_title}")
    print(f"Type:         {policy.policy_metadata.policy_type}")
    print(f"Effective:    {policy.policy_metadata.effective_date}")
    print(f"Hash:         {text_hash[:16]}...")

    print(f"\n=== DRUGS ({len(policy.drugs)}) ===")
    for d in policy.drugs:
        print(f"  {d.brand_name or d.generic_name} ({d.generic_name}) — {'biosimilar' if d.is_biosimilar else 'originator'}")

    print(f"\n=== COVERAGE RULES ({len(policy.coverage_rules)}) ===")
    for r in policy.coverage_rules[:10]:
        pa = "PA required" if r.requires_prior_auth else "no PA"
        st = f", step therapy: {len(r.step_therapy)} step(s)" if r.step_therapy else ""
        print(f"  {r.drug_brand_name or r.drug_generic_name} | {r.indication_name or 'all indications'} | {r.coverage_status} | {pa}{st}")
    if len(policy.coverage_rules) > 10:
        print(f"  ... and {len(policy.coverage_rules) - 10} more")

    print(f"\n=== DRUG CATEGORY POSITIONS ({len(policy.drug_category_positions)}) ===")
    for p in policy.drug_category_positions:
        pos = f"{p.tier_position}-of-{p.total_in_tier}" if p.tier_position and p.total_in_tier else "?"
        print(f"  {p.drug_brand_name} | {p.molecule} | {p.tier} ({pos})")

    # Optionally dump full JSON
    if "--json" in sys.argv:
        print("\n=== FULL JSON ===")
        print(json.dumps(policy.model_dump(), indent=2))

if __name__ == "__main__":
    main()
