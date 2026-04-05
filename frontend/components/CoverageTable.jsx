'use client'

import { useState } from 'react'

const PILL_CLASS = {
  covered: 'pill pill-c',
  restricted: 'pill pill-r',
  denied: 'pill pill-d',
}

const PA_BADGE = {
  standard: 'pa-badge pa-standard',
  specialty: 'pa-badge pa-specialty',
  medical_necessity: 'pa-badge pa-medical',
}

export default function CoverageTable({ rows = [] }) {
  const [expandedRows, setExpandedRows] = useState({})

  const toggleRow = (index) => {
    setExpandedRows(prev => ({ ...prev, [index]: !prev[index] }))
  }

  // All rows are expandable to show details (even if just "no info" messages)
  const hasDetails = () => true

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Coverage by indication</span>
        <button className="card-action" onClick={() => exportCsv(rows)}>Export CSV →</button>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <table className="ctable">
          <thead>
            <tr>
              <th style={{ width: 120 }}>Payer</th>
              <th style={{ width: 85 }}>Status</th>
              <th style={{ width: 75 }}>Prior Auth</th>
              <th>Indication / Conditions</th>
              <th style={{ width: 70, textAlign: 'right' }}>Effective</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <>
                <tr
                  key={`row-${idx}`}
                  className={hasDetails(row) ? 'expandable-row' : ''}
                  onClick={() => hasDetails(row) && toggleRow(idx)}
                >
                  <td><div className="pnm">{row.payer}</div></td>
                  <td>
                    <span className={PILL_CLASS[row.status] ?? 'pill'}>
                      <span className="pdot" />
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    {row.requiresPriorAuth ? (
                      <span className={PA_BADGE[row.priorAuthType] || 'pa-badge'}>
                        {formatPaType(row.priorAuthType)}
                      </span>
                    ) : (
                      <span className="pa-none">None</span>
                    )}
                  </td>
                  <td>
                    <div className="indication-cell">
                      <div className="indication-name">
                        {row.indication}
                        {hasDetails(row) && (
                          <span className={`expand-icon ${expandedRows[idx] ? 'expanded' : ''}`}>▼</span>
                        )}
                      </div>
                      {row.conditions?.length > 0 && !expandedRows[idx] && (
                        <div className="conditions-preview">
                          {row.conditions[0]}
                          {row.conditions.length > 1 && ` (+${row.conditions.length - 1} more)`}
                        </div>
                      )}
                    </div>
                  </td>
                  <td><div className="eff">{row.effective}</div></td>
                </tr>
                {expandedRows[idx] && (
                  <tr key={`detail-${idx}`} className="detail-row">
                    <td colSpan={5}>
                      <div className="detail-panel">
                        <div className="detail-section">
                          <div className="detail-label">Requirements</div>
                          {row.conditions?.length > 0 ? (
                            <ul className="detail-list">
                              {row.conditions.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                          ) : (
                            <div className="detail-empty">No specific requirements listed</div>
                          )}
                        </div>
                        <div className="detail-section">
                          <div className="detail-label">Step Therapy</div>
                          {row.stepTherapy?.length > 0 ? (
                            <div className="detail-value">
                              Must try first: {row.stepTherapy.join(', ')}
                            </div>
                          ) : (
                            <div className="detail-empty">Not required</div>
                          )}
                        </div>
                        <div className="detail-section">
                          <div className="detail-label">Approval Duration</div>
                          <div className="detail-value">
                            {row.approvalDuration || <span className="detail-empty">Not specified</span>}
                          </div>
                        </div>
                        <div className="detail-section">
                          <div className="detail-label">Site of Care</div>
                          <div className="detail-value">
                            {row.siteOfCare || <span className="detail-empty">No restriction</span>}
                          </div>
                        </div>
                        <div className="detail-section">
                          <div className="detail-label">Limitations</div>
                          {row.limitations?.length > 0 ? (
                            <ul className="detail-list">
                              {row.limitations.map((l, i) => <li key={i}>{l}</li>)}
                            </ul>
                          ) : (
                            <div className="detail-empty">No limitations listed</div>
                          )}
                        </div>
                        {row.status === 'denied' && (
                          <div className="detail-section">
                            <div className="detail-label">Covered Alternatives</div>
                            {row.coveredAlternatives?.length > 0 ? (
                              <div className="detail-value alt-drugs">
                                {row.coveredAlternatives.join(', ')}
                              </div>
                            ) : (
                              <div className="detail-empty">No alternatives listed</div>
                            )}
                          </div>
                        )}
                        <div className="detail-section">
                          <div className="detail-label">Policy</div>
                          <div className="detail-value policy-ref">
                            {row.policyTitle || <span className="detail-empty">Policy not specified</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
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

function formatPaType(type) {
  if (!type) return 'Required'
  const labels = {
    standard: 'Standard',
    specialty: 'Specialty',
    medical_necessity: 'Medical',
  }
  return labels[type] || 'Required'
}

function exportCsv(rows) {
  const header = 'Payer,Status,Prior Auth,Indication,Conditions,Effective\n'
  const body = rows.map(r =>
    `"${r.payer}","${r.status}","${r.requiresPriorAuth ? r.priorAuthType || 'Yes' : 'No'}","${r.indication}","${(r.conditions || []).join('; ')}","${r.effective}"`
  ).join('\n')
  const blob = new Blob([header + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'coverage.csv'; a.click()
  URL.revokeObjectURL(url)
}