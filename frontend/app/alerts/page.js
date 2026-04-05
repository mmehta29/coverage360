'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import AlertsPanel from '@/components/AlertsPanel'
import TrustBar from '@/components/TrustBar'

const DAYS_OPTIONS = [7, 30, 90]

export default function AlertsPage() {
  const [days, setDays] = useState(90)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('meaningful') // 'all' | 'meaningful' | 'cosmetic'
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [payers, setPayers] = useState([])

  useEffect(() => {
    fetch('/api/payers').then(r => r.ok ? r.json() : [])
      .then(data => setPayers((data || []).map(p => p.short_name || p.name)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadAlerts()
  }, [days])

  async function loadAlerts() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/alerts?days=${days}`)
      if (!res.ok) throw new Error('Failed to load alerts')
      const data = await res.json()
      setAlerts(data.alerts || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = alerts.filter(a => {
    if (filter === 'meaningful') return a.type !== 'warning' || a.summary?.toLowerCase().includes('meaningful') || !a.summary?.toLowerCase().includes('cosmetic')
    if (filter === 'cosmetic') return a.type === 'warning' && a.summary?.toLowerCase().includes('cosmetic')
    return true
  })

  const meaningfulCount = alerts.filter(a => a.type !== 'cosmetic').length
  const lastChecked = alerts[0]?.date || '—'

  async function handleEmailSubscribe(e) {
    e.preventDefault()
    if (!email.trim()) return
    // Store in localStorage for demo; in production this hits a /subscribe endpoint
    localStorage.setItem('alert_email', email)
    setEmailSent(true)
    setTimeout(() => setEmailSent(false), 3000)
  }

  return (
    <div>
      <Topbar payers={payers} alertCount={meaningfulCount} />
      <div className="shell">
        <Sidebar />
        <div className="main">
          <div style={{ padding: '28px 36px', borderBottom: '1px solid var(--line)', background: 'var(--white)' }}>

            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div className="view-title">Policy Alerts</div>
                <div className="view-sub">Automated monitoring of payer policy changes — updated nightly via GitHub Actions</div>
              </div>

              {/* Email subscribe */}
              <form onSubmit={handleEmailSubscribe} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {emailSent ? (
                  <span style={{ fontSize: 12, color: 'var(--covered)', fontWeight: 500 }}>
                    ✓ Subscribed! You'll get nightly digests.
                  </span>
                ) : (
                  <>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      style={{
                        fontSize: 12, padding: '7px 12px', border: '1.5px solid var(--line)',
                        borderRadius: 6, fontFamily: 'var(--sans)', outline: 'none', width: 200,
                        background: 'var(--bg)',
                      }}
                    />
                    <button type="submit" className="btn-solid" style={{ fontSize: 12, padding: '7px 14px' }}>
                      Email alerts
                    </button>
                  </>
                )}
              </form>
            </div>

            {/* Stats bar */}
            <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
              <StatChip label="Meaningful changes" value={meaningfulCount} color="var(--denied)" />
              <StatChip label="Total changes" value={alerts.length} color="var(--ink2)" />
              <StatChip label="Last detected" value={lastChecked} color="var(--ink3)" mono />
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {DAYS_OPTIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    style={{
                      fontSize: 11, padding: '4px 12px', borderRadius: 20,
                      border: '1px solid var(--line)', cursor: 'pointer',
                      fontFamily: 'var(--sans)', fontWeight: days === d ? 500 : 400,
                      background: days === d ? 'var(--navy)' : 'var(--bg)',
                      color: days === d ? '#fff' : 'var(--ink2)',
                    }}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--line)', marginBottom: -1 }}>
              {[
                { key: 'meaningful', label: 'Meaningful' },
                { key: 'all', label: 'All changes' },
                { key: 'cosmetic', label: 'Cosmetic only' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  style={{
                    fontSize: 12, fontWeight: filter === tab.key ? 500 : 400,
                    color: filter === tab.key ? 'var(--accent)' : 'var(--ink3)',
                    borderBottom: filter === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                    padding: '8px 16px', background: 'none', border: 'none',
                    borderBottom: filter === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer', fontFamily: 'var(--sans)', marginBottom: -1,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Alerts feed */}
          <div style={{ padding: '28px 36px' }}>
            <AlertsPanel
              alerts={filtered}
              days={days}
              loading={loading}
              error={error}
            />

            {/* GitHub Actions callout */}
            <div style={{
              marginTop: 24, padding: '14px 18px', background: 'var(--accent-lt)',
              border: '1px solid #c7dcf5', borderRadius: 'var(--rl)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent)' }}>
                  Automated nightly monitoring
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 2 }}>
                  GitHub Actions checks all tracked payer URLs every night at midnight.
                  Policies are re-ingested and diffed with AI when changes are detected.
                </div>
              </div>
            </div>
          </div>

          <TrustBar />
        </div>
      </div>
    </div>
  )
}

function StatChip({ label, value, color, mono }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{
        fontSize: mono ? 13 : 20, fontWeight: 500,
        fontFamily: mono ? 'var(--mono)' : 'var(--serif)',
        color,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  )
}
