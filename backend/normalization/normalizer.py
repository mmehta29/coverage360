"""
Maps an ExtractedPolicy (Gemini output) into the 6-table Supabase schema.
Returns all inserted IDs for reference.
"""
import json
from datetime import datetime, timezone
from typing import Optional

from database.supabase_client import get_client
from extraction.schema import ExtractedPolicy, DrugSchema


def _model_dump(obj) -> dict:
    """Pydantic v2 compatible dict serialization."""
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    return obj.dict()


def upsert_payer(payer_name: str, payer_short_name: Optional[str], payer_type: Optional[str]) -> str:
    """Upsert payer by name, return payer ID."""
    client = get_client()
    result = (
        client.table("payers")
        .upsert(
            {"name": payer_name, "short_name": payer_short_name, "type": payer_type},
            on_conflict="name",
        )
        .execute()
    )
    return result.data[0]["id"]


def upsert_drug(drug: DrugSchema) -> str:
    """Upsert drug by generic_name + biosimilar_suffix, return drug ID."""
    client = get_client()
    hcpcs = [_model_dump(h) for h in drug.hcpcs_codes]
    result = (
        client.table("drugs")
        .upsert(
            {
                "brand_name": drug.brand_name,
                "generic_name": drug.generic_name,
                "biosimilar_suffix": drug.biosimilar_suffix,
                "reference_product": drug.reference_product,
                "is_biosimilar": drug.is_biosimilar,
                "drug_class": drug.drug_class,
                "route_of_administration": drug.route_of_administration,
                "hcpcs_codes": json.dumps(hcpcs),
                "manufacturer": drug.manufacturer,
            },
            on_conflict="generic_name,biosimilar_suffix",
        )
        .execute()
    )
    return result.data[0]["id"]


def insert_policy(
    payer_id: str,
    extracted: ExtractedPolicy,
    raw_text_hash: str,
    document_url: Optional[str],
    extracted_json: dict,
) -> str:
    """Insert a policy row, return policy ID."""
    client = get_client()
    meta = extracted.policy_metadata

    def parse_date(d):
        if not d:
            return None
        # handle YYYY-MM-DD
        try:
            return d
        except Exception:
            return None

    result = (
        client.table("policies")
        .insert(
            {
                "payer_id": payer_id,
                "policy_number": meta.policy_number,
                "policy_title": meta.policy_title,
                "policy_type": meta.policy_type,
                "effective_date": parse_date(meta.effective_date),
                "reviewed_date": parse_date(meta.reviewed_date),
                "revised_date": parse_date(meta.revised_date),
                "lines_of_business": meta.lines_of_business,
                "document_url": document_url,
                "document_source": meta.document_source,
                "raw_text_hash": raw_text_hash,
                "extracted_json": json.dumps(extracted_json),
                "extracted_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .execute()
    )
    return result.data[0]["id"]


def insert_coverage_rules(policy_id: str, drug_id_map: dict[str, str], extracted: ExtractedPolicy):
    """Insert all coverage_rules rows for a policy."""
    client = get_client()
    rows = []
    for rule in extracted.coverage_rules:
        drug_id = drug_id_map.get(rule.drug_generic_name)
        pa = rule.pa_criteria
        rows.append(
            {
                "policy_id": policy_id,
                "drug_id": drug_id,
                "drug_brand_name": rule.drug_brand_name,
                "drug_generic_name": rule.drug_generic_name,
                "hcpcs_code": rule.hcpcs_code,
                "indication_name": rule.indication_name,
                "icd10_codes": rule.icd10_codes,
                "coverage_status": rule.coverage_status,
                "evidence_basis": rule.evidence_basis,
                "requires_prior_auth": rule.requires_prior_auth,
                "prior_auth_type": rule.prior_auth_type,
                "coverage_type": rule.coverage_type,
                "pa_criteria": json.dumps(_model_dump(pa)) if pa else None,
                "step_therapy": json.dumps([_model_dump(s) for s in rule.step_therapy]),
                "dosing": json.dumps(_model_dump(rule.dosing)) if rule.dosing else None,
                "general_requirements": rule.general_requirements,
                "limitations": rule.limitations,
                "line_of_therapy": rule.line_of_therapy,
                "combination_required": rule.combination_required,
                "combination_drugs": rule.combination_drugs,
                "site_of_care_restriction": rule.site_of_care_restriction,
                "covered_alternatives": json.dumps([_model_dump(a) for a in rule.covered_alternatives]),
                "pa_exempt_icd10_codes": rule.pa_exempt_icd10_codes,
            }
        )
    if rows:
        client.table("coverage_rules").insert(rows).execute()


def insert_drug_category_positions(policy_id: str, extracted: ExtractedPolicy):
    """Insert drug_category_positions rows."""
    client = get_client()
    rows = []
    for pos in extracted.drug_category_positions:
        rows.append(
            {
                "policy_id": policy_id,
                "molecule": pos.molecule,
                "category_label": pos.category_label,
                "drug_brand_name": pos.drug_brand_name,
                "drug_generic_name": pos.drug_generic_name,
                "tier": pos.tier,
                "tier_position": pos.tier_position,
                "total_in_tier": pos.total_in_tier,
                "is_exclusive_preferred": pos.is_exclusive_preferred,
                "step_therapy_required": pos.step_therapy_required,
                "notes": pos.notes,
            }
        )
    if rows:
        client.table("drug_category_positions").insert(rows).execute()


def get_next_version_number(policy_id: str) -> int:
    """Return the next version number for a policy."""
    client = get_client()
    result = (
        client.table("policy_versions")
        .select("version_number")
        .eq("policy_id", policy_id)
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    return (result.data[0]["version_number"] + 1) if result.data else 1


def update_policy(
    policy_id: str,
    extracted: ExtractedPolicy,
    raw_text_hash: str,
    extracted_json: dict,
) -> None:
    """Update an existing policy row with a new extraction."""
    client = get_client()
    meta = extracted.policy_metadata
    client.table("policies").update({
        "raw_text_hash": raw_text_hash,
        "extracted_json": json.dumps(extracted_json),
        "effective_date": meta.effective_date,
        "reviewed_date": meta.reviewed_date,
        "revised_date": meta.revised_date,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", policy_id).execute()

    # Replace coverage rules with new ones
    client.table("coverage_rules").delete().eq("policy_id", policy_id).execute()
    client.table("drug_category_positions").delete().eq("policy_id", policy_id).execute()

    # Re-upsert drugs
    drug_id_map: dict[str, str] = {}
    for drug in extracted.drugs:
        drug_id = upsert_drug(drug)
        drug_id_map[drug.generic_name] = drug_id

    insert_coverage_rules(policy_id, drug_id_map, extracted)
    insert_drug_category_positions(policy_id, extracted)


def update_version_diff(policy_id: str, version_number: int, diff_result: dict) -> None:
    """Store diff results on an existing policy_versions row."""
    client = get_client()
    client.table("policy_versions").update({
        "diff_summary": json.dumps(diff_result),
        "is_meaningful_change": diff_result.get("is_meaningful_change", False),
    }).eq("policy_id", policy_id).eq("version_number", version_number).execute()


def snapshot_policy_version(policy_id: str, raw_text_hash: str, extracted_json: dict, version_number: int = 1):
    """Save a version snapshot for change detection."""
    client = get_client()
    client.table("policy_versions").insert(
        {
            "policy_id": policy_id,
            "version_number": version_number,
            "raw_text_hash": raw_text_hash,
            "snapshot_json": json.dumps(extracted_json),
            "diff_summary": None,
            "is_meaningful_change": False,
            "snapshotted_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()


def normalize_and_store(
    extracted: ExtractedPolicy,
    raw_text_hash: str,
    document_url: Optional[str] = None,
) -> dict:
    """
    Full pipeline: take an ExtractedPolicy and persist everything to Supabase.
    Returns dict of inserted IDs.
    """
    meta = extracted.policy_metadata
    extracted_json = _model_dump(extracted)

    # 1. Upsert payer
    payer_id = upsert_payer(meta.payer_name, meta.payer_short_name, meta.payer_type)

    # 2. Upsert all drugs, build generic_name → drug_id map
    drug_id_map: dict[str, str] = {}
    for drug in extracted.drugs:
        drug_id = upsert_drug(drug)
        drug_id_map[drug.generic_name] = drug_id

    # 3. Insert policy
    policy_id = insert_policy(payer_id, extracted, raw_text_hash, document_url, extracted_json)

    # 4. Insert coverage rules
    insert_coverage_rules(policy_id, drug_id_map, extracted)

    # 5. Insert drug category positions
    insert_drug_category_positions(policy_id, extracted)

    # 6. Snapshot for versioning
    snapshot_policy_version(policy_id, raw_text_hash, extracted_json)

    return {
        "payer_id": payer_id,
        "policy_id": policy_id,
        "drugs_upserted": len(drug_id_map),
        "coverage_rules_inserted": len(extracted.coverage_rules),
        "category_positions_inserted": len(extracted.drug_category_positions),
    }
