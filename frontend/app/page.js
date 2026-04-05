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
import { PAYERS as FALLBACK_PAYERS, INDEX_STATS, ALERTS_DATA } from '@/lib/mockData'

// ── Inline persistent chat (not imported from ChatWidget to keep panel layout tight) ──
import { useCallback } from 'react'

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

  useEffect(() => {
    fetch('/api/payers')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.length) setPayers(data.map(p => p.short_name || p.name)) })
      .catch(() => {})
  }, [])

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
  const alertCount = ALERTS_DATA.filter(a => a.type === 'negative').length

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
                      {result.burdenScore !== null && (
                        <div className="burden-badge" style={burdenStyle}>
                          <div className="burden-num" style={{ color: burdenStyle.color }}>{result.burdenScore}</div>
                          <div className="burden-lbl" style={{ color: burdenStyle.color }}>burden</div>
                        </div>
                      )}
                    </div>
                    {result.noCoverageData && (
                      <div className="no-coverage-banner">
                        <div className="no-coverage-title">No coverage data available</div>
                        <div className="no-coverage-hint">Coverage information has not been indexed for this drug yet. Check back when policies are added.</div>
                      </div>
                    )}
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
              <CoverageHeatmap />
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
              <CompareView result={result} onGoToSearch={() => setNav('search')} />
            </div>
          )}

          {nav === 'alerts' && (
            <div className="content">
              <div className="view-header">
                <div className="view-title">Policy alerts</div>
                <div className="view-sub">Recent coverage changes detected across indexed policies.</div>
              </div>
              <AlertsPanel />
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
