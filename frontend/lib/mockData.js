// Swap these out for real API calls when the backend is ready.

// ─── Heatmap ────────────────────────────────────────────────────────────────
// status: covered | restricted | denied | unknown
export const HEATMAP_DRUGS = [
  'Rituximab', 'Adalimumab', 'Bevacizumab', 'Pembrolizumab',
  'Nivolumab', 'Trastuzumab', 'Infliximab', 'Ustekinumab',
]

export const HEATMAP_PAYERS = ['UnitedHealth', 'Cigna', 'Priority Health']

// [drug][payer] → { status, note }
export const HEATMAP_DATA = {
  Rituximab:     { UnitedHealth: { status: 'covered',    note: 'PA required. CD20+ confirmed.' },
                   Cigna:        { status: 'restricted',  note: 'Step therapy: biosimilar ≥12 wks.' },
                   'Priority Health': { status: 'covered', note: 'PA required. Oncology only.' } },
  Adalimumab:    { UnitedHealth: { status: 'restricted',  note: 'Biosimilar step therapy required.' },
                   Cigna:        { status: 'covered',    note: 'PA required. Specialist confirmation.' },
                   'Priority Health': { status: 'restricted', note: 'Biosimilar trial ≥8 wks.' } },
  Bevacizumab:   { UnitedHealth: { status: 'covered',    note: 'PA required. NCCN guideline.' },
                   Cigna:        { status: 'covered',    note: 'PA required. FDA-approved indication.' },
                   'Priority Health': { status: 'covered', note: 'NCCN Category 1 or 2A.' } },
  Pembrolizumab: { UnitedHealth: { status: 'covered',    note: 'PA required. PD-L1 testing required.' },
                   Cigna:        { status: 'restricted',  note: 'Step therapy. Prior platinum required.' },
                   'Priority Health': { status: 'denied',  note: 'Not covered. Off-label only.' } },
  Nivolumab:     { UnitedHealth: { status: 'covered',    note: 'PA required. Oncology indication.' },
                   Cigna:        { status: 'covered',    note: 'NCCN Category 1. No step therapy.' },
                   'Priority Health': { status: 'restricted', note: 'Preferred agent preferred first.' } },
  Trastuzumab:   { UnitedHealth: { status: 'covered',    note: 'PA required. HER2+ confirmed.' },
                   Cigna:        { status: 'covered',    note: 'HER2+ pathology required.' },
                   'Priority Health': { status: 'covered', note: 'PA required. Biosimilar preferred.' } },
  Infliximab:    { UnitedHealth: { status: 'restricted',  note: 'Biosimilar step required. PA required.' },
                   Cigna:        { status: 'restricted',  note: 'Remicade: step therapy applies.' },
                   'Priority Health': { status: 'restricted', note: 'Biosimilar preferred. Step ≥12 wks.' } },
  Ustekinumab:   { UnitedHealth: { status: 'covered',    note: 'PA required. TNF failure documented.' },
                   Cigna:        { status: 'denied',     note: 'Non-covered. Formulary exclusion.' },
                   'Priority Health': { status: 'restricted', note: 'PA required. Two TNF failures.' } },
}

// ─── Alerts ─────────────────────────────────────────────────────────────────
// type: positive | warning | negative
export const ALERTS_DATA = [
  {
    id: 1,
    type: 'negative',
    drug: 'Rituximab',
    payer: 'Cigna',
    summary: 'Step therapy added: biosimilar trial ≥12 weeks now required before brand.',
    date: 'Feb 1, 2026',
    policyRef: 'Cigna CPB 0656',
  },
  {
    id: 2,
    type: 'positive',
    drug: 'Bevacizumab',
    payer: 'UnitedHealth',
    summary: 'Prior auth criteria simplified. Pathology report now sufficient; oncologist letter no longer required.',
    date: 'Jan 15, 2026',
    policyRef: 'UHC MP-02.117',
  },
  {
    id: 3,
    type: 'positive',
    drug: 'Pembrolizumab',
    payer: 'Priority Health',
    summary: 'Coverage expanded to include first-line non-small cell lung cancer (NSCLC) per updated NCCN guidelines.',
    date: 'Mar 1, 2026',
    policyRef: 'PH Oncology Drug List 2026-Q1',
  },
  {
    id: 4,
    type: 'warning',
    drug: 'Rituximab',
    payer: 'UnitedHealth',
    summary: 'Site-of-care restriction updated: ambulatory infusion centers now required. Hospital outpatient requires exception.',
    date: 'Jan 1, 2026',
    policyRef: 'UHC MP-02.093',
  },
  {
    id: 5,
    type: 'negative',
    drug: 'Ustekinumab',
    payer: 'Cigna',
    summary: 'Removed from covered drug list. Formulary exclusion effective Q1 2026. Stelara and Tremfya both excluded.',
    date: 'Jan 1, 2026',
    policyRef: 'Cigna Drug List 2026',
  },
  {
    id: 6,
    type: 'warning',
    drug: 'Infliximab',
    payer: 'Priority Health',
    summary: 'Step therapy duration extended from 8 to 12 weeks for all biosimilar trials before originator product.',
    date: 'Mar 15, 2026',
    policyRef: 'PH Rheum Policy 2026-03',
  },
  {
    id: 7,
    type: 'positive',
    drug: 'Trastuzumab',
    payer: 'UnitedHealth',
    summary: 'Trastuzumab biosimilars (Kanjinti, Herzuma) promoted to preferred tier. Prior auth criteria unchanged.',
    date: 'Feb 15, 2026',
    policyRef: 'UHC MP-02.044',
  },
]

export const DRUG_DB = {
  rituximab: {
    name: 'Rituximab',
    generic: 'rituximab-abbs · Truxima · Ruxience',
    tags: ['J9312', 'CD20 monoclonal Ab', 'Oncology / Rheumatology', 'Biologic'],
    burdenScore: 62,
    coverage: [
      {
        payer: 'UnitedHealth',
        status: 'covered',
        criteriaHeadline: 'PA required.',
        criteria: 'CD20+ confirmed. Prior anthracycline required. No step therapy.',
        effective: 'Jan 2026',
      },
      {
        payer: 'Cigna',
        status: 'restricted',
        criteriaHeadline: 'Step therapy.',
        criteria: 'Biosimilar trial ≥12 wks before brand. PA required.',
        effective: 'Feb 2026',
      },
      {
        payer: 'Priority Health',
        status: 'covered',
        criteriaHeadline: 'PA required.',
        criteria: 'Oncology only. Ambulatory infusion site preferred.',
        effective: 'Jan 2026',
      },
    ],
  },
  adalimumab: {
    name: 'Adalimumab',
    generic: 'adalimumab-adbm · Cyltezo · Hadlima',
    tags: ['J0135', 'TNF inhibitor', 'Rheumatology / Dermatology', 'Biologic'],
    burdenScore: 74,
    coverage: [
      {
        payer: 'UnitedHealth',
        status: 'restricted',
        criteriaHeadline: 'Step therapy.',
        criteria: 'Biosimilar preferred. Brand requires failure of ≥1 biosimilar.',
        effective: 'Jan 2026',
      },
      {
        payer: 'Cigna',
        status: 'covered',
        criteriaHeadline: 'PA required.',
        criteria: 'Diagnosis confirmed by specialist. DMARD failure documented.',
        effective: 'Jan 2026',
      },
      {
        payer: 'Priority Health',
        status: 'restricted',
        criteriaHeadline: 'Step therapy.',
        criteria: 'Preferred biosimilar trial ≥8 wks. Site-of-care restriction applies.',
        effective: 'Mar 2026',
      },
    ],
  },
  bevacizumab: {
    name: 'Bevacizumab',
    generic: 'bevacizumab-awwb · Mvasi · Zirabev',
    tags: ['J9035', 'VEGF inhibitor', 'Oncology', 'Biologic'],
    burdenScore: 55,
    coverage: [
      {
        payer: 'UnitedHealth',
        status: 'covered',
        criteriaHeadline: 'PA required.',
        criteria: 'Oncology indication per NCCN guideline. Pathology report required.',
        effective: 'Jan 2026',
      },
      {
        payer: 'Cigna',
        status: 'covered',
        criteriaHeadline: 'PA required.',
        criteria: 'FDA-approved indication. No biosimilar step therapy for oncology.',
        effective: 'Jan 2026',
      },
      {
        payer: 'Priority Health',
        status: 'covered',
        criteriaHeadline: 'PA required.',
        criteria: 'NCCN Category 1 or 2A recommendation required.',
        effective: 'Feb 2026',
      },
    ],
  },
}

export const INDEX_STATS = {
  policies: 847,
  payers: 3,
  updated: 'Apr 4, 2026',
}

export const PAYERS = ['UnitedHealth', 'Cigna', 'Priority Health']

// Looks up a drug by name (case-insensitive, partial match on first word)
export function lookupDrug(query) {
  const q = query.trim().toLowerCase()
  for (const [key, drug] of Object.entries(DRUG_DB)) {
    if (key.startsWith(q) || drug.name.toLowerCase().startsWith(q)) return drug
  }
  return null
}

// Simulated chat responses for demo
export function mockChatAnswer(question, drugName) {
  const q = question.toLowerCase()
  const drug = drugName ?? 'this drug'

  if (q.includes('ra') || q.includes('rheumatoid') || q.includes('which plan')) {
    return {
      answer: `UnitedHealth and Priority Health cover ${drug} for rheumatoid arthritis with prior authorization. Cigna requires a biosimilar step-therapy trial first, effective Feb 2026.`,
      sources: 'Sources: UHC MP-02.093 · Cigna CPB 0656 · PH Drug List 2026',
    }
  }
  if (q.includes('change') || q.includes('quarter') || q.includes('uhc') || q.includes('united')) {
    return {
      answer: `UHC reduced their prior chemo requirement from 2 regimens to 1, added biosimilar step therapy, and restricted site of care to ambulatory infusion centers. Effective Jan 1, 2026.`,
      sources: 'Source: UHC Policy MP-02.093 · Q4 2025 update bulletin',
    }
  }
  if (q.includes('step') || q.includes('biosimilar')) {
    return {
      answer: `Cigna imposes a ≥12-week biosimilar trial before brand ${drug}. Priority Health requires ≥8 weeks for some indications. UnitedHealth has no biosimilar step requirement for oncology.`,
      sources: 'Sources: Cigna CPB 0656 · PH Policy 2026-03',
    }
  }
  return {
    answer: `Based on the indexed policies, coverage for ${drug} varies by payer and indication. Prior authorization is required by all three payers. Review the coverage table for payer-specific criteria.`,
    sources: 'Sources: Indexed policy documents as of Apr 2026',
  }
}
