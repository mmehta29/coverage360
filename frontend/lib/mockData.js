// Swap these out for real API calls when the backend is ready.

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
  updated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
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