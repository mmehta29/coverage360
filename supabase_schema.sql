-- Coverage360 — Supabase Schema
-- Run this in the Supabase SQL editor to create all tables.
-- Order matters: payers → drugs → policies → coverage_rules → drug_category_positions → policy_versions

-- ── 1. Payers ────────────────────────────────────────────────────────────────
create table if not exists payers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  short_name text,
  type       text,   -- commercial | medicare | medicaid | exchange
  state      text,
  website_url text,
  created_at timestamptz default now()
);

-- ── 2. Drugs (canonical, payer-agnostic reference) ───────────────────────────
create table if not exists drugs (
  id                    uuid primary key default gen_random_uuid(),
  brand_name            text,
  generic_name          text not null,
  biosimilar_suffix     text,                -- e.g. "-awwb", "-pvvr"
  reference_product     text,                -- if biosimilar, the originator brand name
  is_biosimilar         boolean default false,
  drug_class            text,                -- e.g. "VEGF inhibitor", "botulinum toxin"
  route_of_administration text,              -- intravenous | subcutaneous | injection
  hcpcs_codes           jsonb default '[]',  -- [{code, description, unit}]
  manufacturer          text,
  openfda_id            text,
  created_at            timestamptz default now(),
  unique (generic_name, biosimilar_suffix)
);

-- ── 3. Policies (one row per ingested document) ───────────────────────────────
create table if not exists policies (
  id              uuid primary key default gen_random_uuid(),
  payer_id        uuid references payers(id) on delete cascade,
  policy_number   text,
  policy_title    text not null,
  policy_type     text,  -- medical_benefit_drug_policy | medical_drug_list | coverage_guideline | preferred_drug_program
  effective_date  date,
  reviewed_date   date,
  revised_date    date,
  lines_of_business text[],          -- {commercial, medicare, medicaid}
  document_url    text,
  document_source text,              -- payer_website | user_upload | auto_fetch
  raw_text_hash   text unique,       -- sha256 of extracted text; prevents duplicate ingestion
  extracted_json  jsonb,             -- full Claude output, source of truth for re-processing
  extracted_at    timestamptz,
  created_at      timestamptz default now()
);

create index if not exists policies_payer_id_idx on policies(payer_id);
create index if not exists policies_effective_date_idx on policies(effective_date);

-- ── 4. Coverage Rules (policy × drug × indication) ───────────────────────────
-- THE CORE TABLE. One row per (policy, drug, indication) triple.
-- All complex nested data (PA criteria, step therapy, dosing) stored as jsonb.
create table if not exists coverage_rules (
  id                    uuid primary key default gen_random_uuid(),
  policy_id             uuid references policies(id) on delete cascade,
  drug_id               uuid references drugs(id),

  -- Drug identity (denormalized for fast queries without joins)
  drug_brand_name       text,
  drug_generic_name     text,
  hcpcs_code            text,

  -- Indication
  indication_name       text,    -- null = applies to all indications (MDL entries)
  icd10_codes           text[],  -- diagnosis codes

  -- Coverage decision
  coverage_status       text not null,  -- covered | not_covered | preferred | non_preferred | preferred_specialty | non_specialty | unproven
  evidence_basis        text,           -- fda_approved | nccn_category1 | nccn_category2a | off_label | unproven
  requires_prior_auth   boolean default false,
  prior_auth_type       text,           -- standard | specialty | medical_necessity
  coverage_type         text default 'pa_policy',  -- pa_policy | formulary_entry | preferred_program

  -- PA criteria as structured JSON (avoids separate nested table for hackathon)
  -- Shape: {requires_pa, top_level_logic, criteria: [...], step_therapy: [...], ...}
  pa_criteria           jsonb,

  -- Step therapy as JSON array (often duplicated in pa_criteria but useful standalone)
  -- Shape: [{order, logic, reason, required_agents: [...]}]
  step_therapy          jsonb default '[]',

  -- Dosing: {max_dose, dose_unit, max_frequency, notes}
  dosing                jsonb,

  -- Free-text arrays
  general_requirements  text[],
  limitations           text[],

  -- Therapy context
  line_of_therapy       text,           -- first_line | second_line | any
  combination_required  boolean default false,
  combination_drugs     text[],
  site_of_care_restriction text,

  -- For not-covered drugs: [{drug_name, hcpcs_code, note}]
  covered_alternatives  jsonb default '[]',

  -- ICD-10 codes exempt from PA (Priority Health MDL pattern)
  pa_exempt_icd10_codes text[],

  created_at            timestamptz default now()
);

create index if not exists coverage_rules_policy_id_idx on coverage_rules(policy_id);
create index if not exists coverage_rules_drug_generic_idx on coverage_rules(drug_generic_name);
create index if not exists coverage_rules_drug_brand_idx on coverage_rules(drug_brand_name);
create index if not exists coverage_rules_hcpcs_idx on coverage_rules(hcpcs_code);
create index if not exists coverage_rules_status_idx on coverage_rules(coverage_status);

-- ── 5. Drug Category Positions (rebate economics) ────────────────────────────
-- Captures where a drug sits within its competitive tier at each payer.
-- "Bevacizumab is preferred 1-of-2 at BCBS NC" vs "non-preferred 1-of-5 at UHC"
-- This drives rebate economics — Anton RX's core business.
create table if not exists drug_category_positions (
  id                    uuid primary key default gen_random_uuid(),
  policy_id             uuid references policies(id) on delete cascade,
  molecule              text not null,          -- e.g. "bevacizumab", "trastuzumab"
  category_label        text,                   -- e.g. "Bevacizumab-Containing Agents"
  drug_brand_name       text not null,
  drug_generic_name     text,
  tier                  text,                   -- preferred | non_preferred | not_covered
  tier_position         int,                    -- 1, 2, 3 within tier
  total_in_tier         int,                    -- total drugs sharing this tier
  is_exclusive_preferred boolean default false, -- only preferred drug in category?
  step_therapy_required  boolean default false, -- must try preferred before non-preferred?
  notes                 text,
  created_at            timestamptz default now()
);

create index if not exists dcp_policy_id_idx on drug_category_positions(policy_id);
create index if not exists dcp_molecule_idx on drug_category_positions(molecule);

-- ── 6. Policy Versions (change detection / diff) ─────────────────────────────
create table if not exists policy_versions (
  id                    uuid primary key default gen_random_uuid(),
  policy_id             uuid references policies(id) on delete cascade,
  version_number        int not null,
  raw_text_hash         text not null,
  effective_date        date,
  snapshot_json         jsonb,            -- full Claude output at this version
  diff_summary          jsonb,            -- {added: [...], removed: [...], changed: [...]}
  is_meaningful_change  boolean default false,  -- true if clinical/coverage change (not cosmetic)
  snapshotted_at        timestamptz default now(),
  unique (policy_id, version_number)
);

create index if not exists pv_policy_id_idx on policy_versions(policy_id);
create index if not exists pv_meaningful_idx on policy_versions(is_meaningful_change, snapshotted_at);
