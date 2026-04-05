'use client'

import { useState, useEffect, useRef } from 'react'

const TYPE_LABEL = {
  positive: 'Coverage added',
  warning:  'Policy updated',
  negative: 'Coverage reduced',
}

// ── Sound cache: fetch once, reuse as blob URL ────────────────────────────────
const sfxCache = {}

async function loadSfx(type) {
  if (sfxCache[type]) return sfxCache[type]
  try {
    const res = await fetch(`/api/voice/sfx?type=${type}`)
    if (!res.ok) return null
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    sfxCache[type] = url
    return url
  } catch {
    return null
  }
}

function playSfx(type) {
  loadSfx(type).then(url => {
    if (!url) return
    const audio = new Audio(url)
    audio.volume = 0.4
    audio.play().catch(() => {})  // ignore autoplay policy errors silently
  })
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AlertsPanel({ alerts = [], days = 1, loading = false, error = '' }) {
  const [openAlertId,   setOpenAlertId]   = useState('')
  const [diffCache,     setDiffCache]     = useState({})
  const [diffLoadingId, setDiffLoadingId] = useState('')
  const [diffError,     setDiffError]     = useState('')
  const [digestStatus,  setDigestStatus]  = useState('') // '' | 'sending' | 'sent' | 'error'
  const [digestMsg,     setDigestMsg]     = useState('')

  // Track whether we've played the sound for this alerts load
  const soundPlayedRef = useRef(false)

  useEffect(() => {
    if (loading || error || alerts.length === 0) {
      soundPlayedRef.current = false
      return
    }
    if (soundPlayedRef.current) return
    soundPlayedRef.current = true

    // Determine dominant type: negative > warning > positive
    const hasNegative = alerts.some(a => a.type === 'negative')
    const hasWarning  = alerts.some(a => a.type === 'warning')
    const sfxType     = hasNegative ? 'negative' : hasWarning ? 'warning' : 'positive'

    // Pre-load all three in background, play the dominant one
    loadSfx('negative')
    loadSfx('warning')
    loadSfx('positive')
    playSfx(sfxType)
  }, [alerts, loading, error])

  async function sendDigest() {
    setDigestStatus('sending')
    setDigestMsg('')
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: days || 30 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send digest')
      setDigestStatus('sent')
      setDigestMsg(`Sent to ${data.sent} subscriber${data.sent !== 1 ? 's' : ''}`)
    } catch (e) {
      setDigestStatus('error')
      setDigestMsg(e.message || 'Failed to send digest')
    }
    window.setTimeout(() => { setDigestStatus(''); setDigestMsg('') }, 4000)
  }

  async function toggleDiff(alert) {
    if (!alert.policyId) return
    if (openAlertId === alert.id) { setOpenAlertId(''); return }

    setOpenAlertId(alert.id)
    setDiffError('')
    if (diffCache[alert.policyId]) return

    setDiffLoadingId(alert.id)
    try {
      const response = await fetch(`/api/policies/diff?policyId=${encodeURIComponent(alert.policyId)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load policy diff')
      setDiffCache(prev => ({ ...prev, [alert.policyId]: data }))
    } catch (loadError) {
      setDiffError(loadError.message || 'Unable to load policy diff')
    } finally {
      setDiffLoadingId('')
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Recent policy changes</span>
        <span style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>Last {days} days</span>
      </div>

      {/* Email digest banner */}
      <div style={{
        margin: '0 0 0 0',
        padding: '14px 20px',
        background: 'linear-gradient(135deg, rgba(21,23,63,0.05) 0%, rgba(145,191,235,0.12) 100%)',
        borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #15173f 0%, #3e5161 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4l7 5 7-5M1 4h14v9a1 1 0 01-1 1H2a1 1 0 01-1-1V4z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>Email Alert Digest</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 1 }}>
              Send a summary of recent policy changes to all subscribers
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {digestMsg && (
            <span style={{
              fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 500,
              color: digestStatus === 'sent' ? 'var(--covered)' : 'var(--denied)',
              background: digestStatus === 'sent' ? 'var(--covered-bg)' : 'var(--denied-bg)',
              border: `1px solid ${digestStatus === 'sent' ? 'var(--covered-br)' : 'var(--denied-br)'}`,
              borderRadius: 20, padding: '3px 10px',
            }}>
              {digestStatus === 'sent' ? '✓ ' : '✗ '}{digestMsg}
            </span>
          )}
          <button
            onClick={sendDigest}
            disabled={digestStatus === 'sending'}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: digestStatus === 'sending' ? 'var(--ink3)' : 'linear-gradient(135deg, #15173f 0%, #3e5161 100%)',
              color: 'white', border: 'none', borderRadius: 10,
              padding: '9px 18px', fontSize: 13, fontWeight: 600,
              fontFamily: 'var(--sans)', cursor: digestStatus === 'sending' ? 'not-allowed' : 'pointer',
              boxShadow: digestStatus === 'sending' ? 'none' : '0 4px 14px rgba(21,23,63,0.28)',
              transition: 'all 0.2s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4l7 5 7-5M1 4h14v9a1 1 0 01-1 1H2a1 1 0 01-1-1V4z"/>
            </svg>
            {digestStatus === 'sending' ? 'Sending…' : 'Send digest now'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card-body">
          <div className="search-status">Loading alerts...</div>
        </div>
      ) : error ? (
        <div className="card-body">
          <div className="search-status">{error}</div>
        </div>
      ) : alerts.length === 0 ? (
        <div className="card-body">
          <div className="search-status">No recent policy changes found.</div>
        </div>
      ) : (
        <div className="alerts-feed">
          {alerts.map(alert => {
            const isOpen       = openAlertId === alert.id
            const diff         = alert.policyId ? diffCache[alert.policyId] : null
            const isLoadingDiff = diffLoadingId === alert.id

            return (
              <div key={alert.id} className={`alert-item alert-${alert.type}`}>
                <div className="alert-bar" />
                <div className="alert-body">
                  <div className="alert-meta">
                    <span className="alert-drug">{alert.drug}</span>
                    <span className="alert-payer">{alert.payer}</span>
                    <span className="alert-type-badge">{TYPE_LABEL[alert.type] || TYPE_LABEL.warning}</span>
                    <span className="alert-date">{alert.date}</span>
                  </div>
                  <div className="alert-summary">{alert.summary}</div>
                  <div className="alert-ref">{alert.policyRef}</div>
                  {alert.policyId && (
                    <button type="button" className="card-action diff-toggle" onClick={() => toggleDiff(alert)}>
                      {isOpen ? 'Hide diff' : 'View diff'}
                    </button>
                  )}

                  {isOpen && (
                    <div className="policy-diff-panel">
                      {isLoadingDiff ? (
                        <div className="policy-diff-empty">Loading policy diff...</div>
                      ) : diffError && !diff ? (
                        <div className="policy-diff-empty">{diffError}</div>
                      ) : diff ? (
                        <>
                          <div className="policy-diff-summary">{diff.summary}</div>
                          <div className="policy-diff-changes">
                            {(diff.changes || []).map(change => (
                              <span key={change.type} className="policy-diff-chip">{change.label}</span>
                            ))}
                          </div>
                          <div className="policy-diff-versions">
                            <div className="policy-diff-version">
                              <div className="policy-diff-version-label">Latest</div>
                              <div>Version {diff.latest_version?.version_number ?? '—'}</div>
                              <div>{formatVersionDate(diff.latest_version?.snapshotted_at)}</div>
                              <div>{diff.latest_version?.coverage_rule_count ?? 0} coverage rules</div>
                            </div>
                            <div className="policy-diff-version">
                              <div className="policy-diff-version-label">Previous</div>
                              <div>{diff.previous_version ? `Version ${diff.previous_version.version_number}` : 'No previous version'}</div>
                              <div>{formatVersionDate(diff.previous_version?.snapshotted_at)}</div>
                              <div>{diff.previous_version?.coverage_rule_count ?? 0} coverage rules</div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="policy-diff-empty">No diff data available.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatVersionDate(iso) {
  if (!iso) return 'Unknown date'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
