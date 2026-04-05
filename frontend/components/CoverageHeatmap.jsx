'use client'

const STATUS_COLOR = {
  covered:            { bg: 'var(--covered-bg)',    border: 'var(--covered-br)',    text: 'var(--covered)',    label: 'Covered' },
  preferred:          { bg: 'var(--covered-bg)',    border: 'var(--covered-br)',    text: 'var(--covered)',    label: 'Preferred' },
  preferred_specialty:{ bg: 'var(--covered-bg)',    border: 'var(--covered-br)',    text: 'var(--covered)',    label: 'Pref. Specialty' },
  non_preferred:      { bg: 'var(--restricted-bg)', border: 'var(--restricted-br)', text: 'var(--restricted)', label: 'Non-preferred' },
  non_specialty:      { bg: 'var(--restricted-bg)', border: 'var(--restricted-br)', text: 'var(--restricted)', label: 'Non-specialty' },
  not_covered:        { bg: 'var(--denied-bg)',     border: 'var(--denied-br)',     text: 'var(--denied)',     label: 'Not covered' },
  unproven:           { bg: 'var(--denied-bg)',     border: 'var(--denied-br)',     text: 'var(--denied)',     label: 'Unproven' },
}

const FALLBACK = { bg: 'rgba(0,0,0,0.03)', border: 'var(--line)', text: 'var(--ink3)', label: '—' }

export default function CoverageHeatmap({ drugs = [], payers = [], matrix = {}, loading = false, error = '' }) {
  if (loading) {
    return (
      <div className="hm-wrap">
        <div className="hm-header">
          <div className="hm-title">Coverage Heatmap</div>
          <div className="hm-sub">Drug × Payer coverage matrix</div>
        </div>
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>Loading heatmap…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="hm-wrap">
        <div className="hm-header">
          <div className="hm-title">Coverage Heatmap</div>
        </div>
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--denied)', fontSize: 13 }}>{error}</div>
      </div>
    )
  }

  if (!drugs.length || !payers.length) {
    return (
      <div className="hm-wrap">
        <div className="hm-header">
          <div className="hm-title">Coverage Heatmap</div>
          <div className="hm-sub">Drug × Payer coverage matrix</div>
        </div>
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>
          No coverage data indexed yet. Upload a payer policy PDF to populate this view.
        </div>
      </div>
    )
  }

  return (
    <div className="hm-wrap">
      <div className="hm-header">
        <div>
          <div className="hm-title">Coverage Heatmap</div>
          <div className="hm-sub">{drugs.length} drugs · {payers.length} payers</div>
        </div>
        {/* Legend */}
        <div className="hm-legend">
          {[
            { label: 'Covered', bg: 'var(--covered-bg)', border: 'var(--covered-br)', text: 'var(--covered)' },
            { label: 'Restricted', bg: 'var(--restricted-bg)', border: 'var(--restricted-br)', text: 'var(--restricted)' },
            { label: 'Not covered', bg: 'var(--denied-bg)', border: 'var(--denied-br)', text: 'var(--denied)' },
            { label: 'No data', bg: 'rgba(0,0,0,0.03)', border: 'var(--line)', text: 'var(--ink3)' },
          ].map(l => (
            <div key={l.label} className="hm-legend-item">
              <div style={{ width: 12, height: 12, borderRadius: 3, background: l.bg, border: `1px solid ${l.border}` }} />
              <span style={{ color: l.text }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="hm-table-wrap">
        <table className="hm-table">
          <thead>
            <tr>
              <th className="hm-th hm-th-drug">Drug</th>
              {payers.map(p => (
                <th key={p} className="hm-th">
                  <div className="hm-payer-label">{p}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drugs.map(drug => (
              <tr key={drug} className="hm-row">
                <td className="hm-drug-cell">{drug}</td>
                {payers.map(payer => {
                  const status = matrix[drug]?.[payer]
                  const style  = STATUS_COLOR[status] || FALLBACK
                  return (
                    <td key={payer} className="hm-cell" title={`${drug} · ${payer}: ${style.label}`}>
                      <div className="hm-chip" style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.text }}>
                        {style.label}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
