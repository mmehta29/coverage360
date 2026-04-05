export const buildExtractionPrompt = (pdfText: string) => `
You are a medical policy analyst. Extract structured data from the policy document below.

Return ONLY raw JSON. No markdown, no backticks, no explanation whatsoever.

Use exactly this structure:

{
  "policy_metadata": {
    "payer_name": "string",
    "payer_type": "commercial | medicare | medicaid",
    "policy_number": "string or null",
    "policy_title": "string",
    "effective_date": "YYYY-MM-DD or null",
    "lines_of_business": ["array of strings"]
  },
  "drugs": [
    {
      "brand_name": "string",
      "generic_name": "string or null",
      "is_biosimilar": false,
      "drug_class": "string or null",
      "route_of_administration": "string or null",
      "manufacturer": "string or null",
      "hcpcs_codes": [
        { "code": "string", "description": "string", "unit": "string or null" }
      ]
    }
  ],
  "coverage_rules": [
    {
      "drug_brand_name": "string",
      "drug_generic_name": "string or null",
      "hcpcs_code": "string or null",
      "overall_coverage_status": "covered | not_covered | unproven",
      "requires_prior_auth": true,
      "coverage_tier": "preferred | non_preferred | null",
      "coverage_tier_detail": "preferred 1 of 2 | preferred 1 of 3 | exclusive preferred | non_preferred | null",
      "category_competitors": ["other drugs in same category at this payer"],
      "indications": [
        {
          "indication_name": "string",
          "icd10_codes": ["array of strings"],
          "coverage_status": "covered | not_covered | unproven",
          "evidence_basis": "fda_approved | off_label | unproven",
          "pa_criteria": {
            "requires_pa": true,
            "top_level_logic": "ALL | ONE_OF",
            "criteria": [
              {
                "criterion_type": "diagnosis | step_therapy | clinical_threshold | age | specialist | documentation | other",
                "description": "string",
                "logic_operator": "AND | OR",
                "metric": "string or null",
                "comparison_operator": ">= | <= | = | > | < | null",
                "threshold_value": null,
                "threshold_unit": "string or null",
                "is_required": true
              }
            ],
            "step_therapy": [
              {
                "step_order": 1,
                "logic": "ONE_OF | ALL",
                "reason": "failure | contraindication | intolerance",
                "required_agents": ["array of drug name strings"]
              }
            ],
            "approval_duration_months": null,
            "reauth_required": true
          },
          "dosing": {
            "max_frequency": "string or null",
            "notes": "string or null"
          },
          "limitations": ["array of strings"]
        }
      ],
      "unproven_indications": [
        {
          "indication_name": "string",
          "notes": "string or null"
        }
      ]
    }
  ]
}

Rules:
- Return ONLY the JSON object, nothing else
- Every array field must be an array even if empty
- Return null for missing fields, never omit fields
- Break all criteria into individual array items, never paragraphs
- effective_date must be YYYY-MM-DD format
- If a drug is excluded set overall_coverage_status to not_covered

Document text:
${pdfText.slice(0, 15000)}
`