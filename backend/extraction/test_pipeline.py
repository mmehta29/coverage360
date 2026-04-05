"""
Testing and validation utilities for the unified extraction pipeline.

Usage:
  python -m extraction.test_pipeline /path/to/policy.pdf your_claude_api_key
"""

import json
import sys
from pathlib import Path

from extraction.pipeline import extract_policy_unified
from extraction.schema import ExtractedPolicy
from ingestion.pdf_parser import parse_document, extract_text_from_file


def test_text_extraction(file_path: str) -> None:
    """Test Step 1: Text extraction (PDF or DOCX)."""
    print("\n" + "=" * 70)
    print("TEST 1: Text Extraction")
    print("=" * 70)

    try:
        full_text, text_hash = extract_text_from_file(file_path)
        print(f"✓ Total text length: {len(full_text)} characters")
        print(f"✓ Text hash: {text_hash[:16]}...")
        print(f"✓ First 200 chars: {full_text[:200]}")
        return full_text
    except Exception as e:
        print(f"✗ FAILED: {e}")
        raise


def test_rule_based_extraction(file_path: str) -> dict:
    """Test Step 2: Rule-based extraction (payer, dates, HCPCS, ICD-10)."""
    print("\n" + "=" * 70)
    print("TEST 2: Rule-Based Extraction (FREE)")
    print("=" * 70)

    try:
        pre = parse_document(file_path)
        print(f"✓ Payer: {pre['payer_name']} ({pre['payer_short_name']})")
        print(f"✓ Policy Type: {pre['policy_type']}")
        print(f"✓ Policy Number: {pre['policy_number']}")
        print(f"✓ Effective Date: {pre['effective_date']}")
        print(f"✓ HCPCS Codes: {len(pre['hcpcs_codes'])} found")
        if pre['hcpcs_codes']:
            print(f"  Sample: {[c['code'] for c in pre['hcpcs_codes'][:5]]}")
        print(f"✓ ICD-10 Codes: {len(pre['icd10_codes'])} found")
        if pre['icd10_codes']:
            print(f"  Sample: {pre['icd10_codes'][:5]}")
        print(f"✓ Text for Claude: {len(pre['text_for_claude']):,} chars (trimmed from {pre['full_text_length']:,})")
        return pre
    except Exception as e:
        print(f"✗ FAILED: {e}")
        raise


def test_full_extraction(file_path: str, api_key: str) -> ExtractedPolicy:
    """Test complete unified pipeline."""
    print("\n" + "=" * 70)
    print("TEST 3: Complete Unified Extraction Pipeline")
    print("=" * 70)

    try:
        policy, raw_text, text_hash = extract_policy_unified(file_path, api_key)

        print(f"✓ Extraction successful")
        print(f"✓ Payer: {policy.policy_metadata.payer_name}")
        print(f"✓ Policy title: {policy.policy_metadata.policy_title}")
        print(f"✓ Policy type: {policy.policy_metadata.policy_type}")
        print(f"✓ Drugs extracted: {len(policy.drugs)}")
        print(f"✓ Coverage rules: {len(policy.coverage_rules)}")
        print(f"✓ Drug categories: {len(policy.drug_category_positions)}")

        return policy
    except Exception as e:
        print(f"✗ FAILED: {e}")
        raise


def validate_extracted_policy(policy: ExtractedPolicy) -> bool:
    """Validate the extracted policy structure."""
    print("\n" + "=" * 70)
    print("TEST 4: Policy Validation")
    print("=" * 70)

    checks = {
        "Has payer name": bool(policy.policy_metadata.payer_name),
        "Has policy title": bool(policy.policy_metadata.policy_title),
        "Has policy type": bool(policy.policy_metadata.policy_type),
        "Has at least one drug": len(policy.drugs) > 0,
        "Has at least one coverage rule": len(policy.coverage_rules) > 0,
        "Payer name is string": isinstance(policy.policy_metadata.payer_name, str),
        "Drugs are DrugSchema": all(hasattr(d, 'generic_name') for d in policy.drugs),
        "Rules have drug_generic_name": all(r.drug_generic_name for r in policy.coverage_rules),
    }

    all_pass = True
    for check_name, passed in checks.items():
        status = "✓" if passed else "✗"
        print(f"{status} {check_name}")
        if not passed:
            all_pass = False

    return all_pass


def export_policy_json(policy: ExtractedPolicy, output_path: str) -> None:
    """Export extracted policy as JSON."""
    print("\n" + "=" * 70)
    print("TEST 5: Export to JSON")
    print("=" * 70)

    try:
        policy_dict = policy.model_dump(mode='json')
        with open(output_path, 'w') as f:
            json.dump(policy_dict, f, indent=2)
        print(f"✓ Exported policy to: {output_path}")
    except Exception as e:
        print(f"✗ FAILED: {e}")
        raise


def main(file_path: str, api_key: str, output_dir: str = None):
    """Run full test suite."""
    print("\n" + "=" * 70)
    print("Coverage360 — Unified Extraction Pipeline Test Suite")
    print("=" * 70)

    # Validate inputs
    input_file = Path(file_path)
    if not input_file.exists():
        print(f"✗ File not found: {file_path}")
        sys.exit(1)

    if not api_key:
        print(f"✗ API key not provided")
        sys.exit(1)

    try:
        # Run tests
        full_text = test_text_extraction(file_path)
        pre_extracted = test_rule_based_extraction(file_path)
        policy = test_full_extraction(file_path, api_key)
        is_valid = validate_extracted_policy(policy)

        # Export results
        if output_dir:
            output_path = Path(output_dir) / f"{input_file.stem}_extracted.json"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            export_policy_json(policy, str(output_path))

        # Summary
        print("\n" + "=" * 70)
        print("TEST SUMMARY")
        print("=" * 70)
        print(f"Status: {'✓ PASS' if is_valid else '✗ FAIL'}")
        print(f"Payer: {policy.policy_metadata.payer_name}")
        print(f"Drugs: {len(policy.drugs)}")
        print(f"Rules: {len(policy.coverage_rules)}")
        print(f"Pipeline: Unified Hybrid (1 Claude call)")

    except Exception as e:
        print("\n" + "=" * 70)
        print(f"✗ TEST SUITE FAILED: {e}")
        print("=" * 70)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python -m extraction.test_pipeline <file_path> <api_key> [output_dir]")
        print("  file_path: Path to PDF or DOCX file")
        print("  api_key: Anthropic API key")
        print("  output_dir: Optional directory to export extracted JSON")
        sys.exit(1)

    file_path = sys.argv[1]
    api_key = sys.argv[2]
    output_dir = sys.argv[3] if len(sys.argv) > 3 else None

    main(file_path, api_key, output_dir)
