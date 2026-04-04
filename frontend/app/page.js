'use client'
import { useState } from 'react'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import SearchHero from '@/components/SearchHero'
import CoverageTable from '@/components/CoverageTable'
import ChatWidget from '@/components/ChatWidget'
import TrustBar from '@/components/TrustBar'
import styles from './page.module.css'
import { PAYERS, INDEX_STATS } from '@/lib/mockData'

export default function Home() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSearch(q) {
    if (!q.trim()) return
    setQuery(q)
    setNotFound(false)
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) { setResult(null); setNotFound(true); return }
      setResult(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const burdenColor = result
    ? result.burdenScore >= 70 ? 'var(--denied)'
      : result.burdenScore >= 50 ? 'var(--restricted)'
      : 'var(--covered)'
    : 'var(--restricted)'

  const burdenBorder = result
    ? result.burdenScore >= 70 ? 'var(--denied-br)'
      : result.burdenScore >= 50 ? 'var(--restricted-br)'
      : 'var(--covered-br)'
    : 'var(--restricted-br)'

  const burdenBg = result
    ? result.burdenScore >= 70 ? 'var(--denied-bg)'
      : result.burdenScore >= 50 ? 'var(--restricted-bg)'
      : 'var(--covered-bg)'
    : 'var(--restricted-bg)'

  return (
    <div className={styles.page}>
      <Topbar payers={PAYERS} />
      <div className={styles.shell}>
        <Sidebar alertCount={3} />
        <div className={styles.main}>
          <SearchHero
            query={query}
            onQueryChange={setQuery}
            onSearch={handleSearch}
            indexStats={INDEX_STATS}
          />

          <div className={styles.content}>
            {loading && <div className={styles.status}>Searching…</div>}

            {notFound && !loading && (
              <div className={styles.status}>No results found for <b>{query}</b>. Try Rituximab, Adalimumab, or Bevacizumab.</div>
            )}

            {!result && !loading && !notFound && (
              <div className={styles.empty}>
                <div className={styles.emptyTitle}>Search for a drug to see coverage</div>
                <div className={styles.emptyHint}>Try searching by brand name, generic name, or J-code.</div>
              </div>
            )}

            {result && !loading && (
              <>
                <div className={styles.resultTop}>
                  <div>
                    <div className={styles.drugName}>{result.name}</div>
                    <div className={styles.drugGeneric}>{result.generic}</div>
                    <div className={styles.tags}>
                      {result.tags.map(t => (
                        <span key={t} className={styles.tag}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div
                    className={styles.burdenBadge}
                    style={{ borderColor: burdenBorder, background: burdenBg, color: burdenColor }}
                  >
                    <div className={styles.burdenNum}>{result.burdenScore}</div>
                    <div className={styles.burdenLbl}>burden</div>
                  </div>
                </div>

                <div className={styles.twoCol}>
                  <CoverageTable rows={result.coverage} />
                  <ChatWidget drugName={result.name} />
                </div>
              </>
            )}
          </div>

          <TrustBar />
        </div>
      </div>
    </div>
  )
}
