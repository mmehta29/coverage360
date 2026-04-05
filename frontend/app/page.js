'use client'
import { useState } from 'react'
import WelcomePage from '@/components/WelcomePage'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import SearchHero from '@/components/SearchHero'
import CoverageTable from '@/components/CoverageTable'
import CoverageHeatmap from '@/components/CoverageHeatmap'
import AlertsPanel from '@/components/AlertsPanel'
import CompareView from '@/components/CompareView'
import OrganizationProfile from '@/components/OrganizationProfile'
import TrustBar from '@/components/TrustBar'
import { INDEX_STATS } from '@/lib/mockData'

export default function Home() {
  const [showWelcome, setShowWelcome] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || nav !== 'heatmap' || heatmapData.drugs.length > 0 || heatmapLoading) return

    setHeatmapLoading(true)
    setHeatmapError('')
    fetch('/api/coverage/heatmap')
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load heatmap')
        setHeatmapData(data)
      })
      .catch(error => setHeatmapError(error.message || 'Unable to load heatmap'))
      .finally(() => setHeatmapLoading(false))
  }, [user, nav, heatmapData.drugs.length, heatmapLoading])

  useEffect(() => {
    if (!user || nav !== 'alerts' || alertsLoading) return

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
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load alerts')
        const alerts = data.alerts || []
        setAlertsData(alerts)
        writeAlertsCache(alerts)
      })
      .catch(error => setAlertsError(error.message || 'Unable to load alerts'))
      .finally(() => setAlertsLoading(false))
  }, [user, nav, alertsLoading])

  useEffect(() => {
    const cached = readAlertsCache()
    if (user && cached?.alerts?.length) {
      setAlertsData(cached.alerts)
    }
  }, [user])

  useEffect(() => {
    if (!user || nav !== 'compare' || !result?.name) return

    setCompareLoading(true)
    setCompareError('')
    fetch(`/api/coverage/compare?drug=${encodeURIComponent(result.name)}`)
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load comparison')
        setCompareData(data)
      })
      .catch(error => setCompareError(error.message || 'Unable to load comparison'))
      .finally(() => setCompareLoading(false))
  }, [user, nav, result?.name])

  async function handleSearch(nextQuery) {
    const trimmed = nextQuery.trim()
    if (!trimmed) return
    setQuery(trimmed)
    setNotFound(false)
    setLoading(true)
    setShowWelcome(false) // Hide welcome page when searching
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
      if (!res.ok) {
        setResult(null)
        setNotFound(true)
        return
      }
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
  const alertCount = alertsData.filter(alert => alert.type === 'negative').length

  if (isLoading) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-title">Loading Coverage360</div>
          <div className="auth-sub">Checking your session...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-eyebrow">Coverage360</div>
          <div className="auth-title">Log in to continue</div>
          <div className="auth-sub">Use Auth0 Universal Login to access the coverage recommendation workspace.</div>
          <a className="btn-solid auth-link" href="/auth/login">Log in with Auth0</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{position:'relative',minHeight:'100vh',overflow:'hidden',background:'#faf8f5'}}>
      {/* Watercolor washes */}
      <div style={{position:'fixed',top:'-80px',left:'-60px',width:'600px',height:'600px',borderRadius:'60% 40% 55% 45% / 50% 60% 40% 55%',background:'radial-gradient(ellipse, rgba(255,160,60,0.38) 0%, rgba(255,120,30,0.18) 50%, transparent 75%)',filter:'blur(40px)',mixBlendMode:'multiply',pointerEvents:'none',zIndex:0}} />
      <div style={{position:'fixed',top:'10%',right:'-80px',width:'550px',height:'650px',borderRadius:'45% 55% 40% 60% / 60% 40% 55% 45%',background:'radial-gradient(ellipse, rgba(100,180,230,0.35) 0%, rgba(60,140,210,0.18) 50%, transparent 75%)',filter:'blur(50px)',mixBlendMode:'multiply',pointerEvents:'none',zIndex:0}} />
      <div style={{position:'fixed',bottom:'-60px',left:'30%',width:'580px',height:'500px',borderRadius:'55% 45% 60% 40% / 45% 55% 40% 60%',background:'radial-gradient(ellipse, rgba(220,60,140,0.28) 0%, rgba(200,40,120,0.14) 50%, transparent 75%)',filter:'blur(45px)',mixBlendMode:'multiply',pointerEvents:'none',zIndex:0}} />
      <div style={{position:'fixed',top:'40%',left:'20%',width:'400px',height:'400px',borderRadius:'50%',background:'radial-gradient(ellipse, rgba(255,200,80,0.2) 0%, transparent 70%)',filter:'blur(60px)',mixBlendMode:'multiply',pointerEvents:'none',zIndex:0}} />
      <div style={{position:'fixed',bottom:'10%',right:'15%',width:'350px',height:'350px',borderRadius:'50%',background:'radial-gradient(ellipse, rgba(80,160,220,0.22) 0%, transparent 70%)',filter:'blur(55px)',mixBlendMode:'multiply',pointerEvents:'none',zIndex:0}} />
      <Topbar onToggleSidebar={() => setSidebarOpen(o => !o)} />

      <div className="shell">
        <Sidebar alertCount={3} open={sidebarOpen} />

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
                {loading && <div className="search-status">Searching...</div>}

            {notFound && !loading && (
              <div className="search-status">
                No results for <b>{query}</b>. Try searching by brand name, generic name, or J-code.
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