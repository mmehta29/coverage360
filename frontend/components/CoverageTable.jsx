import styles from './CoverageTable.module.css'

const STATUS_STYLE = {
  covered: styles.pillCovered,
  restricted: styles.pillRestricted,
  denied: styles.pillDenied,
}

export default function CoverageTable({ rows = [] }) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.title}>Coverage across payers</span>
        <button className={styles.action} onClick={() => exportCsv(rows)}>Export CSV →</button>
      </div>
      <div className={styles.body}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: 108 }}>Payer</th>
              <th style={{ width: 90 }}>Status</th>
              <th>Criteria summary</th>
              <th style={{ width: 66, textAlign: 'right' }}>Effective</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.payer}>
                <td><div className={styles.payer}>{row.payer}</div></td>
                <td>
                  <span className={`${styles.pill} ${STATUS_STYLE[row.status] ?? ''}`}>
                    <span className={styles.dot} />
                    {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                  </span>
                </td>
                <td>
                  <div className={styles.criteria}>
                    {row.criteriaHeadline && <b>{row.criteriaHeadline} </b>}
                    {row.criteria}
                  </div>
                </td>
                <td><div className={styles.eff}>{row.effective}</div></td>
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
  a.href = url
  a.download = 'coverage.csv'
  a.click()
  URL.revokeObjectURL(url)
}
