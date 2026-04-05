import { HEATMAP_DRUGS, HEATMAP_PAYERS, HEATMAP_DATA } from '@/lib/mockData'

const STATUS_LABEL = {
  covered: 'Covered',
  restricted: 'Restricted',
  denied: 'Not covered',
  unknown: 'No data',
}

export default function CoverageHeatmap() {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Coverage heatmap</span>
        <span className="hm-meta">
          {HEATMAP_DRUGS.length} drugs · {HEATMAP_PAYERS.length} payers
        </span>
      </div>

      <div className="card-body">
        <div className="hm-legend">
          {[
            { key: 'hm-covered', label: 'Covered' },
            { key: 'hm-restricted', label: 'Restricted' },
            { key: 'hm-denied', label: 'Not covered' },
            { key: 'hm-unknown', label: 'No data' },
          ].map(({ key, label }) => (
            <div key={key} className="hm-legend-item">
              <span className={`hm-legend-swatch ${key}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="hm-wrap">
          <table className="hm-table">
            <thead>
              <tr>
                <th className="hm-drug-head">Drug</th>
                {HEATMAP_PAYERS.map(payer => (
                  <th key={payer} className="hm-payer-head">{payer}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HEATMAP_DRUGS.map(drug => (
                <tr key={drug}>
                  <td className="hm-drug-label">{drug}</td>
                  {HEATMAP_PAYERS.map(payer => {
                    const cell = HEATMAP_DATA[drug]?.[payer]
                    const status = cell?.status ?? 'unknown'
                    const note = cell?.note ?? 'No data available.'

                    return (
                      <td key={payer} className="hm-td">
                        <div className={`hm-cell hm-${status}`}>
                          <div className="hm-chip-row">
                            <span className={`hm-chip hm-chip-${status}`}>
                              <span className="hm-cell-dot" />
                              {STATUS_LABEL[status]}
                            </span>
                          </div>
                          <div className="hm-note">{note}</div>
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
    </div>
  )
}
