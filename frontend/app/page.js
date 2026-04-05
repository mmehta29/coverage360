'use client'
import { useState } from 'react'
import WelcomePage from '@/components/WelcomePage'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import SearchHero from '@/components/SearchHero'
import CoverageTable from '@/components/CoverageTable'
import ChatWidget from '@/components/ChatWidget'
import TrustBar from '@/components/TrustBar'
import { INDEX_STATS } from '@/lib/mockData'

export default function Home() {
  const [showWelcome, setShowWelcome] = useState(true)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSearch(q) {
    const trimmed = q.trim()
    if (!trimmed) return
    setQuery(trimmed)
    setNotFound(false)
    setLoading(true)
    setShowWelcome(false) // Hide welcome page when searching
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
      if (!res.ok) { setResult(null); setNotFound(true); return }
      setResult(await res.json())
    } finally {
      setLoading(false)
    }
  }

  // Show welcome page first
  if (showWelcome) {
    return <WelcomePage onGetStarted={() => setShowWelcome(false)} />
  }

  // Main app interface
  const burdenStyle = result ? getBurdenStyle(result.burdenScore) : {}

  return (
    <div>
      <Topbar />

      <div className="shell">
        <Sidebar alertCount={3} />

        <div className="main">
          <SearchHero
            query={query}
            onQueryChange={setQuery}
            onSearch={handleSearch}
            indexStats={INDEX_STATS}
          />

          <div className="content">
            {loading && (
              <div className="search-status">Searching…</div>
            )}

            {notFound && !loading && (
              <div className="search-status">
                No results for <b>{query}</b>. Try searching by brand name, generic name, or J-code.
              </div>
            )}

            {!result && !loading && !notFound && (
              <div className="empty-state">
                <div className="empty-title">Search for a drug to see coverage</div>
                <div className="empty-hint">Try searching by brand name, generic name, or J-code.</div>
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
                    <div className="burden-num" style={{color: burdenStyle.color}}>{result.burdenScore}</div>
                    <div className="burden-lbl" style={{color: burdenStyle.color}}>burden</div>
                  </div>
                </div>

                <CoverageTable rows={result.coverage} />
              </>
            )}
          </div>

        </div>

        <ChatWidget drugName={result?.name} />
      </div>
      <TrustBar />
    </div>
  )
}

function getBurdenStyle(score) {
  if (score >= 70) return { borderColor: 'var(--denied-br)', background: 'var(--denied-bg)', color: 'var(--denied)' }
  if (score >= 50) return { borderColor: 'var(--restricted-br)', background: 'var(--restricted-bg)', color: 'var(--restricted)' }
  return { borderColor: 'var(--covered-br)', background: 'var(--covered-bg)', color: 'var(--covered)' }
}