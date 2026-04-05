'use client'

import { Fragment, useState } from 'react'

const PILL_CLASS = {
  covered: 'pill pill-c',
  restricted: 'pill pill-r',
  denied: 'pill pill-d',
}

export default function CoverageTable({ rows = [] }) {
  const [openPayer, setOpenPayer] = useState('')

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Coverage across payers</span>
        <button className="card-action" onClick={() => exportCsv(rows)}>Export CSV →</button>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <table className="ctable">
          <thead>
            <tr>
              <th style={{ width: 108 }}>Payer</th>
              <th style={{ width: 90 }}>Status</th>
              <th>Criteria summary</th>
              <th style={{ width: 92, textAlign: 'right' }}>Effective</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const isOpen = openPayer === row.payer
              return (
                <Fragment key={row.payer}>
                  <tr key={row.payer}>
                    <td><div className="pnm">{row.payer}</div></td>
                    <td>
                      <span className={PILL_CLASS[row.status] ?? 'pill'}>
                        <span className="pdot" />
                        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      <div className="crit">
                        {row.criteriaHeadline && <b>{row.criteriaHeadline} </b>}
                        {row.criteria}
                      </div>
                      {row.evidence?.length > 0 && (
                        <button
                          type="button"
                          className="card-action evidence-toggle"
                          onClick={() => setOpenPayer(isOpen ? '' : row.payer)}
                        >
                          {isOpen ? 'Hide evidence' : 'View evidence'}
                        </button>
                      )}
                    </td>
                    <td><div className="eff">{row.effective}</div></td>
                  </tr>
                  {isOpen && row.evidence?.length > 0 && (
                    <tr className="evidence-row">
                      <td colSpan={4}>
                        <div className="evidence-grid">
                          {row.evidence.map((item, index) => (
                            <EvidenceCard key={`${row.payer}-${index}`} item={item} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EvidenceCard({ item }) {
  return (
    <div className="evidence-card">
      <div className="evidence-card-head">
        <span className="evidence-card-title">{item.policyTitle}</span>
        <span className="evidence-card-date">{formatDate(item.effectiveDate)}</span>
      </div>
      <div className="evidence-card-meta">{item.indication}</div>
      <div className="evidence-card-list">
        <div><b>Status:</b> {labelStatus(item.coverageStatus)}</div>
        <div><b>Prior auth:</b> {item.requiresPriorAuth ? 'Required' : 'Not required'}</div>
        {item.stepTherapy && <div><b>Step therapy:</b> {item.stepTherapy}</div>}
      </div>
    </div>
  )
}

function labelStatus(status) {
  if (status === 'covered') return 'Covered'
  if (status === 'restricted') return 'Restricted'
  if (status === 'denied') return 'Denied'
  return 'Unknown'
}

function formatDate(iso) {
  if (!iso) return 'Unknown date'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
