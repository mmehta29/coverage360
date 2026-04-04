const PILL_CLASS = {
  covered: 'pill pill-c',
  restricted: 'pill pill-r',
  denied: 'pill pill-d',
}

export default function CoverageTable({ rows = [] }) {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Coverage across payers</span>
        <button className="card-action" onClick={() => exportCsv(rows)}>Export CSV →</button>
      </div>
      <div className="card-body" style={{padding:0}}>
        <table className="ctable">
          <thead>
            <tr>
              <th style={{width:108}}>Payer</th>
              <th style={{width:90}}>Status</th>
              <th>Criteria summary</th>
              <th style={{width:66,textAlign:'right'}}>Effective</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.payer}>
                <td><div className="pnm">{row.payer}</div></td>
                <td>
                  <span className={PILL_CLASS[row.status] ?? 'pill'}>
                    <span className="pdot"/>
                    {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                  </span>
                </td>
                <td>
                  <div className="crit">
                    {row.criteriaHeadline && <b>{row.criteriaHeadline} </b>}
                    {row.criteria}
                  </div>
                </td>
                <td><div className="eff">{row.effective}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function exportCsv(rows) {
  const header = 'Payer,Status,Criteria,Effective\n'
  const body = rows.map(r =>
    `"${r.payer}","${r.status}","${r.criteriaHeadline ?? ''} ${r.criteria}","${r.effective}"`
  ).join('\n')
  const blob = new Blob([header + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'coverage.csv'; a.click()
  URL.revokeObjectURL(url)
}
