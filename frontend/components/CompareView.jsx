const PILL_CLASS = {
  covered: 'pill pill-c',
  restricted: 'pill pill-r',
  denied: 'pill pill-d',
}

const ACCENT_CLASS = {
  covered: 'cca-covered',
  restricted: 'cca-restricted',
  denied: 'cca-denied',
}

export default function CompareView({ result, comparisonData, loading = false, error = '', onGoToSearch }) {
  if (!result) {
    return (
      <div className="compare-no-result">
        No drug selected.<br />
        <a onClick={onGoToSearch}>Search for a drug</a> to see a side-by-side comparison.
      </div>
    )
  }

  const payerRows = Object.values(comparisonData?.comparison || {})

  return (
    <div>
      <div className="compare-drug-header">
        <div className="drug-name" style={{ fontSize: 18 }}>{result.name}</div>
        <div className="drug-generic">{result.generic}</div>
        <div className="drug-tags" style={{ marginTop: 8 }}>
          {result.tags.map(t => <span key={t} className="dtag">{t}</span>)}
        </div>
      </div>

      {loading ? (
        <div className="compare-empty">Loading comparison…</div>
      ) : error ? (
        <div className="compare-empty">{error}</div>
      ) : payerRows.length === 0 ? (
        <div className="compare-empty">No comparison data found for this drug yet.</div>
      ) : (
        <div className="compare-grid">
          {payerRows.map(row => {
            const fields = buildFields(row)
            const frontendStatus = mapCoverageStatus(row.coverage_status)
            const accent = ACCENT_CLASS[frontendStatus] ?? ''

            return (
              <div key={row.payer_name} className="compare-card">
                <div className={`compare-card-accent ${accent}`} />
                <div className="compare-card-head">
                  <div className="compare-card-payer">{row.payer_name}</div>
                  <span className={PILL_CLASS[frontendStatus] ?? 'pill'}>
                    <span className="pdot" />
                    {labelStatus(frontendStatus)}
                  </span>
                </div>
                <div className="compare-fields">
                  <FieldRow label="Prior auth" icon={<path d="M8 2l4 2v4c0 3-4 5-4 5S4 11 4 8V4l4-2z" strokeLinecap="round" strokeLinejoin="round" />}>
                    {fields.priorAuth
                      ? <span className="compare-field-value cfv-warn">Required</span>
                      : <span className="compare-field-value cfv-no">Not required</span>}
                  </FieldRow>

                  <FieldRow label="Step therapy" icon={<><path d="M3 4h10M5 8h8M7 12h4" strokeLinecap="round" /></>}>
                    {fields.stepTherapy
                      ? <span className="compare-field-value cfv-warn">{fields.stepTherapy}</span>
                      : <span className="compare-field-value cfv-no">None</span>}
                  </FieldRow>

                  <FieldRow label="Site of care" icon={<><path d="M8 2a4 4 0 100 8A4 4 0 008 2z" /><path d="M8 14v-4" strokeLinecap="round" /></>}>
                    {fields.siteOfCare
                      ? <span className="compare-field-value cfv-warn">{fields.siteOfCare}</span>
                      : <span className="compare-field-value cfv-no">No restriction</span>}
                  </FieldRow>

                  <FieldRow label="Key criteria" icon={<><path d="M3 4h10M3 8h7M3 12h9" strokeLinecap="round" /></>}>
                    <span className="compare-field-value">{fields.criteria}</span>
                  </FieldRow>

                  <FieldRow label="Effective" icon={<><rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M5 2v2M11 2v2M2 7h12" strokeLinecap="round" /></>}>
                    <span className="compare-field-value cfv-mono">{fields.effective}</span>
                  </FieldRow>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FieldRow({ icon, label, children }) {
  return (
    <div className="compare-field">
      <svg className="compare-field-icon" viewBox="0 0 16 16">{icon}</svg>
      <div className="compare-field-body">
        <div className="compare-field-label">{label}</div>
        <div>{children}</div>
      </div>
    </div>
  )
}

function buildFields(row) {
  const paCriteria = normalizeJson(row.pa_criteria, null)
  const stepTherapy = normalizeJson(row.step_therapy, [])
  const firstIndication = row.indications?.[0] || {}
  const siteOfCare = firstIndication.site_of_care_restriction || null

  return {
    priorAuth: row.requires_prior_auth || !!paCriteria,
    stepTherapy: formatStepTherapy(stepTherapy),
    siteOfCare,
    criteria: buildCriteria(paCriteria, firstIndication),
    effective: formatDate(row.effective_date),
  }
}

function normalizeJson(value, fallback) {
  if (value == null || value === '') return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function formatStepTherapy(stepTherapy) {
  if (!Array.isArray(stepTherapy) || stepTherapy.length === 0) return null
  const agents = stepTherapy.flatMap(step => step.required_agents ?? []).filter(Boolean)
  if (agents.length === 0) return 'Required'
  return `Try ${agents.slice(0, 3).join(', ')} first`
}

function buildCriteria(paCriteria, indication) {
  const criteria = paCriteria?.criteria
    ?.map(item => item.description)
    .filter(Boolean)
    .slice(0, 2)
  if (criteria?.length) return criteria.join(' ')
  if (Array.isArray(indication.limitations) && indication.limitations.length) return indication.limitations.slice(0, 2).join(' ')
  return 'See policy for details.'
}

function mapCoverageStatus(status) {
  if (['covered', 'preferred', 'preferred_specialty'].includes(status)) return 'covered'
  if (['non_preferred', 'non_specialty'].includes(status)) return 'restricted'
  return 'denied'
}

function labelStatus(status) {
  if (status === 'denied') return 'Denied'
  if (status === 'restricted') return 'Restricted'
  return 'Covered'
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
