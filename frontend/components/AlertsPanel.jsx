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
        <span style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>
          Last {days} days
        </span>
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
