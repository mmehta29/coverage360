'use client'
import { useState, useEffect, useRef } from 'react'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import SearchHero from '@/components/SearchHero'
import CoverageTable from '@/components/CoverageTable'
import CoverageHeatmap from '@/components/CoverageHeatmap'
import AlertsPanel from '@/components/AlertsPanel'
import CompareView from '@/components/CompareView'
import TrustBar from '@/components/TrustBar'
import { PAYERS as FALLBACK_PAYERS, INDEX_STATS } from '@/lib/mockData'

// ── Inline persistent chat (not imported from ChatWidget to keep panel layout tight) ──
import { useCallback } from 'react'

const ALERTS_CACHE_KEY = 'coverage360-alerts-cache-v1'
const ALERTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

function PersistentChat({ drugName }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, drug: drugName }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer, sources: data.sources }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Unable to reach the server.' }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, drugName])

  return (
    <aside className="chat-panel">
      <div className="chat-panel-head">
        <span className="chat-panel-title">Ask a question</span>
        <span className="chat-panel-grounded">Grounded in source policies</span>
      </div>
      <div className="chat-panel-body">
        <div className="chat-panel-well">
          {messages.length === 0 && !loading && (
            <div className="chat-panel-empty">
              Ask anything about {drugName
                ? <><b style={{ color: 'var(--ink)' }}>{drugName}</b> — coverage rules, step therapy, site-of-care, or recent changes.</>
                : 'any drug — coverage rules, step therapy, site-of-care, or policy changes.'}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role === 'user' ? 'chat-u' : 'chat-a'}`}>
              {m.text}
              {m.sources && <div className="chat-src">{m.sources}</div>}
            </div>
          ))}
          {loading && (
            <div className="chat-msg chat-a" style={{ color: 'var(--ink3)', fontStyle: 'italic' }}>Thinking…</div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="chat-input-row">
          <input
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask about any drug or policy…"
          />
          <button className="btn-solid" style={{ fontSize: '12px', padding: '9px 14px' }} onClick={send} disabled={loading}>
            Ask
          </button>
        </div>
      </div>
    </aside>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Home() {
  const [nav, setNav] = useState('search')
  const [query, setQuery] = useState('Rituximab')
  const [result, setResult] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(false)
  const [payers, setPayers] = useState(FALLBACK_PAYERS)
  const [heatmapData, setHeatmapData] = useState({ drugs: [], payers: [], matrix: {} })
  const [heatmapLoading, setHeatmapLoading] = useState(false)
  const [heatmapError, setHeatmapError] = useState('')
  const [compareData, setCompareData] = useState({ comparison: {}, payers: [] })
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState('')
  const [alertsData, setAlertsData] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [alertsError, setAlertsError] = useState('')

  useEffect(() => {
    fetch('/api/payers')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.length) setPayers(data.map(p => p.short_name || p.name)) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (nav !== 'heatmap' || heatmapData.drugs.length > 0 || heatmapLoading) return

    setHeatmapLoading(true)
    setHeatmapError('')
    fetch('/api/coverage/heatmap')
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'Unable to load heatmap')
        setHeatmapData(data)
      })
      .catch(err => setHeatmapError(err.message || 'Unable to load heatmap'))
      .finally(() => setHeatmapLoading(false))
  }, [nav, heatmapData.drugs.length, heatmapLoading])

  useEffect(() => {
    if (nav !== 'alerts' || alertsLoading) return

    const cached = readAlertsCache()
    const cacheIsFresh = cached && Date.now() - cached.savedAt < ALERTS_CACHE_TTL_MS
    if (cacheIsFresh) {
      setAlertsData(cached.alerts)
      setAlertsError('')
      return
    }

    setAlertsLoading(true)
    setAlertsError('')
    fetch('/api/alerts')
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'Unable to load alerts')
        const alerts = data.alerts || []
        setAlertsData(alerts)
        writeAlertsCache(alerts)
      })
      .catch(err => setAlertsError(err.message || 'Unable to load alerts'))
      .finally(() => setAlertsLoading(false))
  }, [nav, alertsLoading])

  useEffect(() => {
    const cached = readAlertsCache()
    if (cached?.alerts?.length) {
      setAlertsData(cached.alerts)
    }
  }, [])

  useEffect(() => {
    if (nav !== 'compare' || !result?.name) return

    setCompareLoading(true)
    setCompareError('')
    fetch(`/api/coverage/compare?drug=${encodeURIComponent(result.name)}`)
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'Unable to load comparison')
        setCompareData(data)
      })
      .catch(err => setCompareError(err.message || 'Unable to load comparison'))
      .finally(() => setCompareLoading(false))
  }, [nav, result?.name])

  async function handleSearch(q) {
    const trimmed = q.trim()
    if (!trimmed) return
    setQuery(trimmed)
    setNotFound(false)
    setLoading(true)
    setNav('search')
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
      if (!res.ok) { setResult(null); setNotFound(true); return }
      setResult(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const burdenStyle = result ? getBurdenStyle(result.burdenScore) : {}
  const alertCount = alertsData.filter(a => a.type === 'negative').length

  return (
    <div>
      <Topbar payers={payers} />

      <div className="shell">
        <Sidebar active={nav} onNav={setNav} alertCount={alertCount} />

        {/* ── Centre column ───────────────────────────────────────── */}
        <div className="center-col">

          {nav === 'search' && (
            <>
              <SearchHero
                query={query}
                onQueryChange={setQuery}
                onSearch={handleSearch}
                indexStats={INDEX_STATS}
              />
              <div className="content">
                {loading && <div className="search-status">Searching…</div>}

                {notFound && !loading && (
                  <div className="search-status">
                    No results for <b>{query}</b>. Check the spelling or try a generic name.
                  </div>
                )}

                {!result && !loading && !notFound && (
                  <div className="empty-state">
                    <div className="empty-title">Search for a drug to see coverage</div>
                    <div className="empty-hint">Try a brand name, generic name, or J-code. Or ask the assistant on the right.</div>
                  </div>
                )}

                {result && !loading && (
                  <>
                    <div className="result-top">
                      <div>
                        <div className="drug-name">{result.name}</div>
                        <div className="drug-generic">{result.generic}</div>
                        <div className="drug-tags">
                          {result.tags.map(t => <span key={t} className="dtag">{t}</span>)}
                        </div>
                      </div>
                      <div className="burden-badge" style={burdenStyle}>
                        <div className="burden-num" style={{ color: burdenStyle.color }}>{result.burdenScore}</div>
                        <div className="burden-lbl" style={{ color: burdenStyle.color }}>burden</div>
                      </div>
                    </div>
                    <CoverageTable rows={result.coverage} />
                  </>
                )}
              </div>
            </>
          )}

          {nav === 'heatmap' && (
            <div className="content">
              <div className="view-header">
                <div className="view-title">Coverage heatmap</div>
                <div className="view-sub">At-a-glance coverage status across all indexed drugs and payers.</div>
              </div>
              <CoverageHeatmap
                drugs={heatmapData.drugs}
                payers={heatmapData.payers}
                matrix={heatmapData.matrix}
                loading={heatmapLoading}
                error={heatmapError}
              />
            </div>
          )}

          {nav === 'compare' && (
            <div className="content">
              <div className="view-header">
                <div className="view-title">Payer comparison</div>
                <div className="view-sub">
                  {result
                    ? `Side-by-side coverage details for ${result.name} across all payers.`
                    : 'Search for a drug to compare coverage side-by-side.'}
                </div>
              </div>
              <CompareView
                result={result}
                comparisonData={compareData}
                loading={compareLoading}
                error={compareError}
                onGoToSearch={() => setNav('search')}
              />
            </div>
          )}

          {nav === 'alerts' && (
            <div className="content">
              <div className="view-header">
                <div className="view-title">Policy alerts</div>
                <div className="view-sub">Recent coverage changes detected across indexed policies.</div>
              </div>
              <AlertsPanel alerts={alertsData} loading={alertsLoading} error={alertsError} />
            </div>
          )}

          <TrustBar />
        </div>

        {/* ── Persistent chat panel ───────────────────────────────── */}
        <PersistentChat drugName={result?.name ?? null} />
      </div>
    </div>
  )
}

function getBurdenStyle(score) {
  if (score >= 70) return { borderColor: 'var(--denied-br)', background: 'var(--denied-bg)', color: 'var(--denied)' }
  if (score >= 50) return { borderColor: 'var(--restricted-br)', background: 'var(--restricted-bg)', color: 'var(--restricted)' }
  return { borderColor: 'var(--covered-br)', background: 'var(--covered-bg)', color: 'var(--covered)' }
}

function readAlertsCache() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(ALERTS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.alerts) ? parsed : null
  } catch {
    return null
  }
}

function writeAlertsCache(alerts) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ALERTS_CACHE_KEY, JSON.stringify({
      alerts,
      savedAt: Date.now(),
    }))
  } catch {}
}
