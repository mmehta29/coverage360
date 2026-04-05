'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '@auth0/nextjs-auth0/client'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import SearchHero from '@/components/SearchHero'
import CoverageTable from '@/components/CoverageTable'
import CoverageHeatmap from '@/components/CoverageHeatmap'
import AlertsPanel from '@/components/AlertsPanel'
import CompareView from '@/components/CompareView'
import OrganizationProfile from '@/components/OrganizationProfile'
import TrustBar from '@/components/TrustBar'
import { PAYERS as FALLBACK_PAYERS, INDEX_STATS } from '@/lib/mockData'

const ALERTS_CACHE_KEY = 'coverage360-alerts-cache-v1'
const ALERTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const ORG_PROFILE_STORAGE_PREFIX = 'coverage360-organization-profile-v1:'

function PersistentChat({ drugName }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const bottomRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])

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

  const toggleVoice = useCallback(async () => {
    setVoiceError('')

    if (isRecording) {
      recorderRef.current?.stop()
      setIsRecording(false)
      return
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setVoiceError('This browser does not support microphone access.')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (typeof MediaRecorder === 'undefined') {
        stream.getTracks().forEach(track => track.stop())
        setVoiceError('This browser does not support audio recording.')
        return
      }

      const preferredMimeType = MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported?.('audio/webm') ? 'audio/webm' : '')

      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream)

      chunksRef.current = []
      recorderRef.current = recorder

      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const formData = new FormData()
        formData.append('audio', blob)
        setTranscribing(true)

        try {
          const res = await fetch('/api/voice', { method: 'POST', body: formData })
          const data = await res.json()
          if (!res.ok) {
            throw new Error(data.error || 'Transcription failed.')
          }
          if (data.transcript) {
            setInput(data.transcript)
          } else {
            setVoiceError('No transcript was returned.')
          }
        } catch (error) {
          setVoiceError(error?.message || 'Voice transcription failed.')
        } finally {
          setTranscribing(false)
        }
      }

      recorder.start()
      setIsRecording(true)
    } catch (error) {
      if (error?.name === 'NotAllowedError') {
        setVoiceError('Microphone permission was denied.')
      } else {
        setVoiceError('Unable to start voice recording.')
      }
    }
  }, [isRecording])

  const micLabel = transcribing ? '...' : (isRecording ? 'Stop' : 'Mic')
  const micTitle = isRecording ? 'Stop recording' : 'Record a question'

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
                ? <><b style={{ color: 'var(--ink)' }}>{drugName}</b> - coverage rules, step therapy, site-of-care, or recent changes.</>
                : 'any drug - coverage rules, step therapy, site-of-care, or policy changes.'}
            </div>
          )}
          {messages.map((message, index) => (
            <div key={index} className={`chat-msg ${message.role === 'user' ? 'chat-u' : 'chat-a'}`}>
              {message.text}
              {message.sources && <div className="chat-src">{message.sources}</div>}
            </div>
          ))}
          {loading && (
            <div className="chat-msg chat-a" style={{ color: 'var(--ink3)', fontStyle: 'italic' }}>Thinking...</div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="chat-input-row">
          <button
            className={`chat-mic-btn${isRecording ? ' recording' : ''}`}
            onClick={toggleVoice}
            title={micTitle}
            disabled={transcribing}
            type="button"
          >
            {micLabel}
          </button>
          <input
            className="chat-input"
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && send()}
            placeholder={transcribing ? 'Transcribing...' : 'Ask about any drug or policy...'}
          />
          <button className="btn-solid chat-send-btn" onClick={send} disabled={loading} type="button">
            Ask
          </button>
        </div>
        {voiceError && <div className="chat-input-error">{voiceError}</div>}
      </div>
    </aside>
  )
}

export default function Home() {
  const { user, isLoading } = useUser()
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
  const [organizationProfile, setOrganizationProfile] = useState(null)

  useEffect(() => {
    if (!user?.sub || typeof window === 'undefined') {
      setOrganizationProfile(null)
      return
    }

    try {
      const raw = window.localStorage.getItem(`${ORG_PROFILE_STORAGE_PREFIX}${user.sub}`)
      setOrganizationProfile(raw ? JSON.parse(raw) : null)
    } catch {
      setOrganizationProfile(null)
    }
  }, [user?.sub])

  useEffect(() => {
    if (!user) return
    fetch('/api/payers')
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (data?.length) setPayers(data.map(payer => payer.short_name || payer.name))
      })
      .catch(() => {})
  }, [user])

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
    setNav('search')
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
    <div>
      <Topbar
        payers={payers}
        user={user}
        organizationName={organizationProfile?.organizationName || ''}
        onLogout={() => { window.location.href = '/auth/logout' }}
      />

      <div className="shell">
        <Sidebar active={nav} onNav={setNav} alertCount={alertCount} />

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
                          {result.tags.map(tag => <span key={tag} className="dtag">{tag}</span>)}
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
              <CoverageHeatmap
                drugs={heatmapData.drugs}
                payers={heatmapData.payers}
                matrix={heatmapData.matrix}
                loading={heatmapLoading}
                error={heatmapError}
              />
            </div>
          )}

          {nav === 'organization' && (
            <OrganizationProfile user={user} onProfileChange={setOrganizationProfile} />
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
