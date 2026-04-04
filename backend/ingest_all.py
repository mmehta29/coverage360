"""
Batch ingest all sample policy files directly (no HTTP server needed).
Run from backend/: python ingest_all.py
"""
import os
import time
from dotenv import load_dotenv
load_dotenv()

from extraction.gemini_extractor import extract_policy
from normalization.normalizer import normalize_and_store
from database.supabase_client import get_client

POLICIES = [
    "/Users/manyamehta/Downloads/Medical Drug Coverage Policy Examples/UHC Botulinum Toxins A and B – Commercial Medical Benefit Drug Policy.pdf",
    "/Users/manyamehta/Downloads/Medical Drug Coverage Policy Examples/BCBS NC - Corporate Medical Policy_ Preferred Injectable Oncology Program (Avastin example).pdf",
    "/Users/manyamehta/Downloads/Medical Drug Coverage Policy Examples/Florida Blue MCG Bevecizumab policy.pdf",
    "/Users/manyamehta/Downloads/Medical Drug Coverage Policy Examples/Cigna Rituximab Intravenous Products for Non-Oncology Indications.pdf",
    "/Users/manyamehta/Downloads/Medical Drug Coverage Policy Examples/Priority Health 2026 MDL - Priority Health Commercial (Employer Group) and MyPriority.pdf",
]

def main():
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        print("ERROR: CLAUDE_API_KEY not set in .env")
        return

    client = get_client()
    total = len(POLICIES)

    for i, path in enumerate(POLICIES, 1):
        filename = path.split("/")[-1]
        print(f"\n[{i}/{total}] {filename}")

        print(f"  Extracting via Claude...")

        try:
            policy, _text, text_hash = extract_policy(path, api_key)

            # Check if already ingested
            dup = client.table("policies").select("id").eq("raw_text_hash", text_hash).execute()
            if dup.data:
                print(f"  SKIPPED — already in database (policy_id: {dup.data[0]['id']})")
                continue

            result = normalize_and_store(policy, text_hash)
            print(f"  ✓ Payer:     {policy.policy_metadata.payer_name}")
            print(f"  ✓ Policy:    {policy.policy_metadata.policy_title}")
            print(f"  ✓ Drugs:     {result['drugs_upserted']}")
            print(f"  ✓ Rules:     {result['coverage_rules_inserted']}")
            print(f"  ✓ Positions: {result['category_positions_inserted']}")
            print(f"  ✓ policy_id: {result['policy_id']}")

        except Exception as e:
            print(f"  ERROR: {e}")

        # Wait between calls to avoid Claude rate limit (8K output tokens/min)
        if i < total:
            print(f"  Waiting 65s for rate limit reset...")
            time.sleep(65)

    print("\n=== INGESTION COMPLETE ===")
    print("\nVerifying database counts:")
    print(f"  Payers:     {len(client.table('payers').select('id').execute().data)}")
    print(f"  Policies:   {len(client.table('policies').select('id').execute().data)}")
    print(f"  Drugs:      {len(client.table('drugs').select('id').execute().data)}")
    print(f"  Rules:      {len(client.table('coverage_rules').select('id').execute().data)}")
    print(f"  Positions:  {len(client.table('drug_category_positions').select('id').execute().data)}")

if __name__ == "__main__":
    main()
