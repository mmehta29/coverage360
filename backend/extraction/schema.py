"""
Pydantic models for the normalized policy JSON schema.
This is what Gemini must output for every document, regardless of source format.
"""
from typing import Optional
from pydantic import BaseModel, Field


class HCPCSCode(BaseModel):
    code: str
    description: Optional[str] = None
    unit: Optional[str] = None


class DrugSchema(BaseModel):
    brand_name: Optional[str] = None
    generic_name: str
    biosimilar_suffix: Optional[str] = None      # e.g. "-awwb", "-pvvr"
    reference_product: Optional[str] = None       # if biosimilar, the reference brand
    is_biosimilar: bool = False
    drug_class: Optional[str] = None              # e.g. "VEGF inhibitor", "botulinum toxin"
    route_of_administration: Optional[str] = None # intravenous | subcutaneous | injection
    hcpcs_codes: list[HCPCSCode] = []
    manufacturer: Optional[str] = None


class StepTherapyStep(BaseModel):
    order: int
    logic: str                      # ONE_OF | ALL
    reason: str                     # failure_or_intolerance | contraindication | failure
    required_agents: list[str]      # drug names that must be tried


class PACriterion(BaseModel):
    type: str                        # diagnosis | step_therapy | clinical_threshold | age | specialist | documentation | other
    description: str
    metric: Optional[str] = None     # e.g. "headache_days_per_month"
    operator: Optional[str] = None   # >= | <= | = | > | <
    value: Optional[float] = None
    unit: Optional[str] = None
    required: bool = True


class PACriteria(BaseModel):
    requires_pa: bool = True
    top_level_logic: Optional[str] = "ALL"   # ALL | ANY — whether all criteria must be met
    criteria: list[PACriterion] = []
    step_therapy: list[StepTherapyStep] = []
    documentation_required: list[str] = []
    specialist_required: Optional[str] = None
    approval_duration_days: Optional[int] = None
    approval_duration_months: Optional[int] = None
    reauth_required: Optional[bool] = False
    reauth_criteria_same_as_initial: Optional[bool] = True


class DosingInfo(BaseModel):
    max_dose: Optional[str] = None
    dose_unit: Optional[str] = None   # mg/kg | mg/m2 | units
    max_frequency: Optional[str] = None
    notes: Optional[str] = None


class CoveredAlternative(BaseModel):
    drug_name: str
    hcpcs_code: Optional[str] = None
    note: Optional[str] = None


class CoverageRuleSchema(BaseModel):
    drug_brand_name: Optional[str] = None
    drug_generic_name: str
    hcpcs_code: Optional[str] = None

    # Indication-level fields
    indication_name: Optional[str] = None          # None = applies to all indications (e.g. MDL entry)
    icd10_codes: list[str] = []
    coverage_status: Optional[str] = "unknown"     # covered | not_covered | preferred | non_preferred | preferred_specialty | non_specialty | unproven
    evidence_basis: Optional[str] = None            # fda_approved | nccn_category1 | nccn_category2a | off_label | unproven
    requires_prior_auth: bool = False
    prior_auth_type: Optional[str] = None           # standard | specialty | medical_necessity
    coverage_type: str = "pa_policy"                # pa_policy | formulary_entry | preferred_program

    # Clinical requirements (stored as jsonb in DB)
    pa_criteria: Optional[PACriteria] = None
    step_therapy: list[StepTherapyStep] = []
    dosing: Optional[DosingInfo] = None
    general_requirements: list[str] = []
    limitations: list[str] = []

    # Therapy details
    line_of_therapy: Optional[str] = None           # first_line | second_line | any
    combination_required: bool = False
    combination_drugs: list[str] = []
    site_of_care_restriction: Optional[str] = None

    # For MDL / not-covered drugs
    covered_alternatives: list[CoveredAlternative] = []
    pa_exempt_icd10_codes: list[str] = []           # ICD-10s that bypass PA (Priority Health pattern)


class DrugCategoryPosition(BaseModel):
    """
    Captures a drug's competitive position within its therapeutic category.
    Critical for rebate economics: preferred 1-of-2 vs 1-of-3 drives different rates.
    """
    molecule: str                       # e.g. "bevacizumab", "trastuzumab"
    category_label: str                 # e.g. "Bevacizumab-Containing Agents"
    drug_brand_name: str
    drug_generic_name: Optional[str] = None
    tier: str                           # preferred | non_preferred | not_covered
    tier_position: Optional[int] = None # 1, 2, 3 within the tier
    total_in_tier: Optional[int] = None # how many drugs share this tier
    is_exclusive_preferred: bool = False
    step_therapy_required: bool = False # must try preferred before non-preferred
    notes: Optional[str] = None


class PolicyMetadata(BaseModel):
    payer_name: str
    payer_short_name: Optional[str] = None          # e.g. "UHC", "BCBS NC"
    payer_type: Optional[str] = None                # commercial | medicare | medicaid | exchange
    plan_names: list[str] = []
    policy_number: Optional[str] = None
    policy_title: str
    policy_type: str                                # medical_benefit_drug_policy | medical_drug_list | coverage_guideline | preferred_drug_program
    effective_date: Optional[str] = None            # YYYY-MM-DD
    reviewed_date: Optional[str] = None
    revised_date: Optional[str] = None
    lines_of_business: list[str] = []              # [commercial, medicare, medicaid]
    document_source: str = "user_upload"            # payer_website | user_upload | auto_fetch


class ExtractedPolicy(BaseModel):
    """
    The complete normalized output Gemini produces for any policy document.
    All fields in coverage_rules expand per indication — one rule per drug+indication pair.
    """
    policy_metadata: PolicyMetadata
    drugs: list[DrugSchema] = []
    coverage_rules: list[CoverageRuleSchema] = []
    drug_category_positions: list[DrugCategoryPosition] = []
