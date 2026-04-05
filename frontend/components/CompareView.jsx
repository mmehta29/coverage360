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

function buildFields(row) {
  const criteria = row.criteria ?? ''
  const headline = row.criteriaHeadline ?? ''

  const hasStep = headline.toLowerCase().includes('step') || criteria.toLowerCase().includes('step')
  const hasSoC = criteria.toLowerCase().includes('site') ||
    criteria.toLowerCase().includes('infusion') ||
    criteria.toLowerCase().includes('ambulatory')

  const stepText = hasStep
    ? (criteria.match(/biosimilar[^.]+\.?/i)?.[0] ?? criteria.match(/step[^.]+\.?/i)?.[0] ?? 'Required')
    : null

  const socText = hasSoC
    ? (criteria.match(/ambulatory[^.]+\.?/i)?.[0] ?? 'Restricted to specific sites')
    : null

  return {
    priorAuth: headline.includes('PA') || criteria.toLowerCase().includes('prior auth'),
    stepTherapy: stepText,
    siteOfCare: socText,
    criteria,
    effective: row.effective,
  }
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

export default function CompareView({ result, onGoToSearch }) {
  if (!result) {
    return (
      <div className="compare-no-result">
        No drug selected.<br />
        <a onClick={onGoToSearch}>Search for a drug</a> to see a side-by-side comparison.
      </div>
    )
  }

  return (
    <div>
      <div className="compare-drug-header">
        <div className="drug-name" style={{ fontSize: 18 }}>{result.name}</div>
        <div className="drug-generic">{result.generic}</div>
        <div className="drug-tags" style={{ marginTop: 8 }}>
          {result.tags.map(t => <span key={t} className="dtag">{t}</span>)}
        </div>
      </div>

      <div className="compare-grid">
        {result.coverage.map(row => {
          const fields = buildFields(row)
          const accent = ACCENT_CLASS[row.status] ?? ''
          return (
            <div key={row.payer} className="compare-card">
              <div className={`compare-card-accent ${accent}`} />
              <div className="compare-card-head">
                <div className="compare-card-payer">{row.payer}</div>
                <span className={PILL_CLASS[row.status] ?? 'pill'}>
                  <span className="pdot" />
                  {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                </span>
              </div>
              <div className="compare-fields">

                <FieldRow label="Prior auth" icon={
                  <path d="M8 2l4 2v4c0 3-4 5-4 5S4 11 4 8V4l4-2z" strokeLinecap="round" strokeLinejoin="round"/>
                }>
                  {fields.priorAuth
                    ? <span className="compare-field-value cfv-warn">Required</span>
                    : <span className="compare-field-value cfv-no">Not required</span>}
                </FieldRow>

                <FieldRow label="Step therapy" icon={
                  <><path d="M3 4h10M5 8h8M7 12h4" strokeLinecap="round"/></>
                }>
                  {fields.stepTherapy
                    ? <span className="compare-field-value cfv-warn">{fields.stepTherapy}</span>
                    : <span className="compare-field-value cfv-no">None</span>}
                </FieldRow>

                <FieldRow label="Site of care" icon={
                  <><path d="M8 2a4 4 0 100 8A4 4 0 008 2z"/><path d="M8 14v-4" strokeLinecap="round"/></>
                }>
                  {fields.siteOfCare
                    ? <span className="compare-field-value cfv-warn">{fields.siteOfCare}</span>
                    : <span className="compare-field-value cfv-no">No restriction</span>}
                </FieldRow>

                <FieldRow label="Key criteria" icon={
                  <><path d="M3 4h10M3 8h7M3 12h9" strokeLinecap="round"/></>
                }>
                  <span className="compare-field-value">{fields.criteria}</span>
                </FieldRow>

                <FieldRow label="Effective" icon={
                  <><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 2v2M11 2v2M2 7h12" strokeLinecap="round"/></>
                }>
                  <span className="compare-field-value cfv-mono">{fields.effective}</span>
                </FieldRow>

              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
