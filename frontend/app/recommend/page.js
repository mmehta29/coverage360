'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import TrustBar from '@/components/TrustBar'

// ── Scoring ────────────────────────────────────────────────────────────────────
function mapStatus(raw) {
  if (['covered', 'preferred', 'preferred_specialty'].includes(raw)) return 'covered'
  if (['non_preferred', 'non_specialty'].includes(raw)) return 'restricted'
  return 'denied'
}

function scorePayerForPrefs(payer, prefs, budget) {
  let score = 25
  const status = mapStatus(payer.coverage_status)
  if (status === 'covered')         score += 40
  else if (status === 'restricted') score += 12
  else                              score -= 35
  if (!payer.requires_prior_auth) score += 22
  if (payer.requires_prior_auth && prefs.avoidPA) score -= 28
  const hasStep = Array.isArray(payer.step_therapy) && payer.step_therapy.length > 0
  if (!hasStep) score += 15
  if (hasStep && prefs.avoidStep) score -= 22
  const criteriaCount = payer.pa_criteria?.criteria?.length || 0
  if (prefs.fastApproval) score -= criteriaCount * 4
  else score -= criteriaCount * 1
  if (budget === 'low' && status !== 'covered')    score -= 12
  if (budget === 'high' && payer.requires_prior_auth) score += 6
  return Math.max(0, Math.min(100, Math.round(score)))
}

function scoreColor(s) {
  if (s >= 75) return 'var(--covered)'
  if (s >= 50) return 'var(--restricted)'
  return 'var(--denied)'
}

function scoreGradient(s) {
  if (s >= 75) return 'linear-gradient(90deg,#10b981,#059669)'
  if (s >= 50) return 'linear-gradient(90deg,#f59e0b,#d97706)'
  return 'linear-gradient(90deg,#f87171,#dc2626)'
}

function rankStyle(rank) {
  if (rank === 1) return { bg: '#fef9c3', color: '#92400e', border: '#fde68a' }
  if (rank === 2) return { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' }
  return { bg: 'rgba(145,191,235,0.15)', color: 'var(--slate)', border: 'var(--sky)' }
}

function extractCriteriaSnippet(payer) {
  const criteria = payer.pa_criteria?.criteria
  if (Array.isArray(criteria) && criteria.length > 0) return criteria[0]?.description || ''
  const inds = payer.indications
  if (Array.isArray(inds) && inds.length > 0) {
    const lims = inds[0]?.limitations
    if (Array.isArray(lims) && lims.length > 0) return lims[0]
  }
  return ''
}

function formatStepTherapy(step) {
  if (!Array.isArray(step) || step.length === 0) return null
  const agents = step.flatMap(s => s.required_agents ?? []).filter(Boolean)
  if (!agents.length) return 'Step therapy required'
  return `Try ${agents.slice(0, 3).join(', ')} first`
}

const PREF_OPTS = [
  { key: 'avoidPA',      label: 'Avoid prior auth',  icon: 'M8 2l4 2v4c0 3-4 5-4 5S4 11 4 8V4l4-2z' },
  { key: 'avoidStep',    label: 'Avoid step therapy', icon: 'M3 4h10M5 8h8M7 12h4' },
  { key: 'fastApproval', label: 'Fast approval',       icon: 'M8 2v4l3 3M14 8A6 6 0 102 8' },
  { key: 'switchDrugs',  label: 'Willing to switch',  icon: 'M4 8h8M9 5l3 3-3 3' },
]

const SEVERITY_OPTS = ['Any', 'Mild', 'Moderate', 'Severe', 'End-stage']
const BUDGET_OPTS   = ['low', 'medium', 'high']

// Watercolor blobs — same as main page
const WASHES = [
  { top:'-80px', left:'-60px',    width:'600px', height:'600px', rx:'60% 40% 55% 45% / 50% 60% 40% 55%', color:'rgba(255,160,60,0.38)',  color2:'rgba(255,120,30,0.18)', blur:40 },
  { top:'10%',   right:'-80px',   width:'550px', height:'650px', rx:'45% 55% 40% 60% / 60% 40% 55% 45%', color:'rgba(100,180,230,0.35)', color2:'rgba(60,140,210,0.18)',  blur:50 },
  { bottom:'-60px', left:'30%',   width:'580px', height:'500px', rx:'55% 45% 60% 40% / 45% 55% 40% 60%', color:'rgba(220,60,140,0.28)',  color2:'rgba(200,40,120,0.14)',  blur:45 },
  { top:'40%',   left:'20%',      width:'400px', height:'400px', rx:'50%',                                  color:'rgba(255,200,80,0.2)',   color2:'transparent',           blur:60 },
  { bottom:'10%',right:'15%',     width:'350px', height:'350px', rx:'50%',                                  color:'rgba(80,160,220,0.22)', color2:'transparent',           blur:55 },
]

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RecommendPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [drugList,    setDrugList]    = useState([])
  const [payerList,   setPayerList]   = useState([])

  const [drug,         setDrug]         = useState('')
  const [drugObj,      setDrugObj]      = useState(null)   // full drug record
  const [drugInput,    setDrugInput]    = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [condition,    setCondition]    = useState('')
  const [severity,     setSeverity]     = useState('Any')
  const [budget,       setBudget]       = useState('medium')
  const [payerFocus,   setPayerFocus]   = useState('')
  const [prefs, setPrefs] = useState({ avoidPA: false, avoidStep: false, fastApproval: false, switchDrugs: false })

  const [loading,    setLoading]    = useState(false)
  const [analyzed,   setAnalyzed]   = useState(false)
  const [results,    setResults]    = useState([])
  const [altResults, setAltResults] = useState([])
  const [error,      setError]      = useState('')

  const dropdownRef = useRef(null)

  useEffect(() => {
    fetch('/api/payers')
      .then(r => r.ok ? r.json() : [])
      .then(d => setPayerList((d || []).map(p => p.short_name || p.name)))
      .catch(() => {})
    fetch('/api/drugs')
      .then(r => r.ok ? r.json() : [])
      .then(d => setDrugList(d || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Deduplicate by brand_name so the same drug doesn't appear multiple times
  const seenNames = new Set()
  const dedupedDrugs = drugList.filter(d => {
    const key = (d.brand_name || d.generic_name || '').toLowerCase()
    if (seenNames.has(key)) return false
    seenNames.add(key)
    return true
  })

  const filteredDrugs = drugInput.length < 1 ? [] : dedupedDrugs.filter(d => {
    const q = drugInput.toLowerCase()
    return (d.brand_name || '').toLowerCase().includes(q) || (d.generic_name || '').toLowerCase().includes(q)
  }).slice(0, 8)

  async function handleAnalyze() {
    if (!drug.trim()) { setError('Please select a drug to analyze.'); return }
    setError(''); setLoading(true); setAnalyzed(false)
    try {
      // Try brand name first, fall back to generic name if no results
      let data = null
      const namesToTry = [drug]
      const genericName = drugObj?.generic_name
      if (genericName && genericName.toLowerCase() !== drug.toLowerCase()) {
        namesToTry.push(genericName)
      }

      for (const name of namesToTry) {
        const res = await fetch(`/api/coverage/compare?drug=${encodeURIComponent(name)}`)
        if (!res.ok) throw new Error('Unable to load coverage data')
        const d = await res.json()
        if (Object.keys(d.comparison || {}).length > 0) { data = d; break }
        data = d // keep last response even if empty
      }

      let scored = Object.values(data.comparison || {}).map(p => ({
        ...p, score: scorePayerForPrefs(p, prefs, budget)
      }))
      if (payerFocus) {
        scored.sort((a, b) => a.payer_name === payerFocus ? -1 : b.payer_name === payerFocus ? 1 : b.score - a.score)
      } else {
        scored.sort((a, b) => b.score - a.score)
      }
      setResults(scored)
      setAnalyzed(true)

      if (prefs.switchDrugs) {
        const drugClass = drugObj?.drug_class
        if (drugClass) {
          const alts = drugList.filter(d => d.drug_class === drugClass && d.brand_name !== drug && d.generic_name !== drug).slice(0, 4)
          const altData = await Promise.all(alts.map(async alt => {
            const name = alt.brand_name || alt.generic_name
            try {
              const r = await fetch(`/api/coverage/compare?drug=${encodeURIComponent(name)}`)
              if (!r.ok) return null
              const d = await r.json()
              const list = Object.values(d.comparison || {})
              if (!list.length) return null
              const best = list.map(p => ({ ...p, score: scorePayerForPrefs(p, prefs, budget) })).sort((a,b)=>b.score-a.score)[0]
              return { drug: name, generic: alt.generic_name, bestPayer: best.payer_name, score: best.score, status: mapStatus(best.coverage_status) }
            } catch { return null }
          }))
          setAltResults(altData.filter(Boolean))
        }
      } else {
        setAltResults([])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const meetAll = results.filter(p => {
    if (mapStatus(p.coverage_status) !== 'covered') return false
    if (prefs.avoidPA && p.requires_prior_auth) return false
    if (prefs.avoidStep && Array.isArray(p.step_therapy) && p.step_therapy.length > 0) return false
    return true
  }).length

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: '#faf8f5' }}>
      {/* Watercolor washes */}
      {WASHES.map((w, i) => (
        <div key={i} style={{
          position: 'fixed', pointerEvents: 'none', zIndex: 0,
          top: w.top, left: w.left, right: w.right, bottom: w.bottom,
          width: w.width, height: w.height, borderRadius: w.rx,
          background: `radial-gradient(ellipse, ${w.color} 0%, ${w.color2} 50%, transparent 75%)`,
          filter: `blur(${w.blur}px)`, mixBlendMode: 'multiply',
        }} />
      ))}

      <Topbar onToggleSidebar={() => setSidebarOpen(o => !o)} />

      <div className="shell">
        <Sidebar open={sidebarOpen} alertCount={0} onNav={(id) => router.push(`/?nav=${id}`)} />

        {/* Span 2 columns so content fills the full width (no chat widget on this page) */}
        <div className="main" style={{ gridColumn: '2 / -1' }}>

          {/* Hero */}
          <div className="rec-hero">
            <div className="rec-hero-left">
              <div className="rec-eyebrow">Access Intelligence</div>
              <div className="rec-title">Coverage Strategy Planner</div>
              <div className="rec-sub">
                Rank payers by access burden for any drug — model PA, step therapy, and budget constraints instantly.
              </div>
            </div>
            {analyzed && (
              <div className="rec-hero-stats">
                <HeroStat value={results.length} label="Payers ranked" />
                <HeroStat value={meetAll}         label="Meet all prefs" color="var(--covered)" />
                <HeroStat value={drug}            label="Analyzing"      mono />
              </div>
            )}
          </div>

          {/* Input panel */}
          <div className="rec-panel">
            {/* Row 1: Drug + Condition */}
            <div className="rec-panel-row">
              {/* Drug combobox */}
              <div className="rec-field" ref={dropdownRef} style={{ position: 'relative', flex: '1.5' }}>
                <label className="rec-label">Drug name <span className="rec-required">*</span></label>
                <input
                  className="rec-input"
                  value={drugInput}
                  onChange={e => { setDrugInput(e.target.value); setShowDropdown(true); setDrug(''); setDrugObj(null) }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Brand or generic name…"
                />
                {drug && (
                  <span className="rec-input-chip">
                    <span>{drug}</span>
                    {drugObj?.generic_name && drugObj.generic_name.toLowerCase() !== drug.toLowerCase() && (
                      <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 11 }}> · {drugObj.generic_name}</span>
                    )}
                    <button onClick={() => { setDrug(''); setDrugObj(null); setDrugInput('') }} className="rec-chip-x">×</button>
                  </span>
                )}
                {showDropdown && filteredDrugs.length > 0 && (
                  <div className="rec-dropdown">
                    {filteredDrugs.map(d => (
                      <button key={(d.brand_name || d.generic_name) + '|' + (d.generic_name || '')} className="rec-dropdown-item"
                        onClick={() => {
                          const name = d.brand_name || d.generic_name
                          setDrug(name); setDrugObj(d); setDrugInput(name); setShowDropdown(false)
                        }}>
                        <span className="rec-dd-brand">{d.brand_name || d.generic_name}</span>
                        {d.generic_name && d.brand_name && <span className="rec-dd-generic">{d.generic_name}</span>}
                        {d.drug_class && <span className="rec-dd-class">{d.drug_class}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rec-field" style={{ flex: '1.3' }}>
                <label className="rec-label">Condition / diagnosis</label>
                <input className="rec-input" value={condition} onChange={e => setCondition(e.target.value)} placeholder="e.g. Rheumatoid Arthritis" />
              </div>
            </div>

            {/* Row 2: Filters */}
            <div className="rec-panel-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 2 }}>
              <div className="rec-field" style={{ flex: '0.7' }}>
                <label className="rec-label">Severity</label>
                <select className="rec-select" value={severity} onChange={e => setSeverity(e.target.value)}>
                  {SEVERITY_OPTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div className="rec-field" style={{ flex: '1' }}>
                <label className="rec-label">Payer focus</label>
                <select className="rec-select" value={payerFocus} onChange={e => setPayerFocus(e.target.value)}>
                  <option value="">All payers</option>
                  {payerList.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>

              <div className="rec-field" style={{ flex: '0.9' }}>
                <label className="rec-label">Budget sensitivity</label>
                <div className="rec-budget-seg">
                  {BUDGET_OPTS.map(b => (
                    <button key={b} className={`rec-budget-btn${budget === b ? ' active' : ''}`} onClick={() => setBudget(b)}>
                      {b.charAt(0).toUpperCase() + b.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                <button className="rec-analyze-btn" onClick={handleAnalyze} disabled={loading || !drug}>
                  {loading ? 'Analyzing…' : 'Analyze Coverage →'}
                </button>
              </div>
            </div>

            {/* Row 3: Preferences */}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="rec-group-label" style={{ flexShrink: 0 }}>Preferences</span>
              <div className="rec-pref-pills">
                {PREF_OPTS.map(p => (
                  <button key={p.key} className={`rec-pref-pill${prefs[p.key] ? ' active' : ''}`}
                    onClick={() => setPrefs(prev => ({ ...prev, [p.key]: !prev[p.key] }))}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d={p.icon} />
                    </svg>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="rec-error">{error}</div>}
          </div>

          {/* Results */}
          <div className="rec-results-area">
            {!analyzed && !loading && (
              <div className="rec-empty-state">
                <div className="rec-empty-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.2">
                    <circle cx="11" cy="11" r="7"/><circle cx="11" cy="11" r="3"/><path d="M20 20l-3-3" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="rec-empty-title">Configure and analyze</div>
                <div className="rec-empty-hint">Select a drug, set your preferences, and click Analyze Coverage to rank payers by access burden.</div>
                {drugList.length > 0 && (
                  <div className="rec-quick-drugs">
                    <span className="rec-quick-label">Quick start:</span>
                    {['Rituximab', 'Bevacizumab', 'Adalimumab'].filter(n =>
                      drugList.some(d => d.brand_name === n || d.generic_name === n)
                    ).map(name => (
                      <button key={name} className="recent-tag" onClick={() => { setDrug(name); setDrugInput(name) }}>{name}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {loading && (
              <div className="rec-loading">
                <div className="rec-spinner" />
                <div>Fetching coverage data and scoring payers…</div>
              </div>
            )}

            {analyzed && !loading && results.length === 0 && (
              <div className="rec-empty-state">
                <div className="rec-empty-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.2">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="rec-empty-title">No coverage data found for <em>{drug}</em></div>
                <div className="rec-empty-hint">This drug may not be indexed yet. Try uploading the payer policy PDF using the Upload PDF button.</div>
              </div>
            )}

            {analyzed && !loading && results.length > 0 && (
              <>
                <div className="rec-summary-strip">
                  <span className="rec-summary-count">{results.length}</span>
                  <span className="rec-summary-label">payers ranked for</span>
                  <span className="rec-summary-drug">{drug}</span>
                  {condition && <span className="rec-summary-condition">· {condition}{severity !== 'Any' ? ` (${severity})` : ''}</span>}
                  {meetAll > 0 && (
                    <div className="rec-summary-badge">
                      <span className="rec-meet-dot" />{meetAll} meet all preferences
                    </div>
                  )}
                </div>

                <div className="rec-cards">
                  {results.map((payer, i) => (
                    <PayerCard key={payer.payer_name} rank={i + 1} payer={payer} prefs={prefs} isFocused={payerFocus === payer.payer_name} />
                  ))}
                </div>

                {prefs.switchDrugs && altResults.length > 0 && (
                  <div className="rec-alts-section">
                    <div className="rec-alts-header">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--slate)" strokeWidth="1.6" strokeLinecap="round"><path d="M4 8h8M9 5l3 3-3 3"/></svg>
                      <span>Same-class alternatives</span>
                      <span className="rec-alts-sub">— best payer per drug in the same therapeutic class</span>
                    </div>
                    <div className="rec-alts-grid">
                      {altResults.map(alt => (
                        <div key={alt.drug} className="rec-alt-card">
                          <div className="rec-alt-drug">{alt.drug}</div>
                          {alt.generic && alt.generic !== alt.drug && <div className="rec-alt-generic">{alt.generic}</div>}
                          <div className="rec-alt-row">
                            <span className="rec-alt-payer">{alt.bestPayer}</span>
                            <div className="rec-alt-score-wrap">
                              <div className="rec-alt-score-bar">
                                <div style={{ width: `${alt.score}%`, background: scoreGradient(alt.score), height: '100%', borderRadius: 2 }} />
                              </div>
                              <span className="rec-alt-score-num" style={{ color: scoreColor(alt.score) }}>{alt.score}</span>
                            </div>
                          </div>
                          <span className={`pill ${alt.status === 'covered' ? 'pill-c' : alt.status === 'restricted' ? 'pill-r' : 'pill-d'}`} style={{ marginTop: 6, fontSize: 10 }}>
                            <span className="pdot" />{alt.status.charAt(0).toUpperCase() + alt.status.slice(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
      <TrustBar />
    </div>
  )
}

function PayerCard({ rank, payer, prefs, isFocused }) {
  const status     = mapStatus(payer.coverage_status)
  const score      = payer.score
  const color      = scoreColor(score)
  const rStyle     = rankStyle(rank)
  const snippet    = extractCriteriaSnippet(payer)
  const stepLabel  = formatStepTherapy(payer.step_therapy)
  const hasStep    = !!stepLabel
  const hasPA      = payer.requires_prior_auth
  const criteriaCount = payer.pa_criteria?.criteria?.length || 0
  const statusClass = status === 'covered' ? 'cca-covered' : status === 'restricted' ? 'cca-restricted' : 'cca-denied'
  const statusPill  = `pill ${status === 'covered' ? 'pill-c' : status === 'restricted' ? 'pill-r' : 'pill-d'}`
  const statusLabel = status === 'covered' ? 'Covered' : status === 'restricted' ? 'Restricted' : 'Not covered'

  return (
    <div className={`rec-card${isFocused ? ' rec-card-focused' : ''}`} style={{ animationDelay: `${rank * 60}ms` }}>
      {/* 4px color bar at top */}
      <div style={{ height: 4, background: status === 'covered' ? 'var(--covered)' : status === 'restricted' ? 'var(--restricted)' : 'var(--denied)' }} />
      <div className="rec-card-body">
        <div className="rec-card-left">
          <div className="rec-card-top-row">
            <span className="rec-rank" style={{ background: rStyle.bg, color: rStyle.color, border: `1px solid ${rStyle.border}` }}>#{rank}</span>
            <div className="rec-card-payer">{payer.payer_name}</div>
            {isFocused && <span className="rec-focused-badge">Tracking</span>}
          </div>
          <div className="rec-score-row">
            <div className="rec-score-track">
              <div className="rec-score-fill" style={{ width: `${score}%`, background: scoreGradient(score) }} />
            </div>
            <span className="rec-score-num" style={{ color }}>{score}</span>
            <span className="rec-score-denom">/100</span>
          </div>
          <div className="rec-badges">
            <span className={statusPill}><span className="pdot" />{statusLabel}</span>
            <FactBadge ok={!hasPA}   okLabel="No prior auth"    failLabel="PA required"          warn={prefs.avoidPA && hasPA} />
            <FactBadge ok={!hasStep} okLabel="No step therapy"  failLabel={stepLabel || 'Step therapy'} warn={prefs.avoidStep && hasStep} />
            {criteriaCount > 0 && <span className="rec-fact-badge rec-fact-neutral">{criteriaCount} criteria step{criteriaCount !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        <div className="rec-card-right">
          {snippet ? (
            <>
              <div className="rec-insight-label">Access criteria</div>
              <div className="rec-insight-text">"{snippet.length > 200 ? snippet.slice(0, 200) + '…' : snippet}"</div>
            </>
          ) : (
            <div className="rec-insight-text" style={{ fontStyle: 'normal', color: 'var(--ink3)' }}>No PA criteria extracted for this payer.</div>
          )}
          <div className="rec-card-meta">
            {payer.effective_date && (
              <span className="rec-meta-item">Effective {new Date(payer.effective_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            )}
            {payer.indications?.length > 0 && (
              <span className="rec-meta-item">{payer.indications.length} indication{payer.indications.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FactBadge({ ok, okLabel, failLabel, warn }) {
  if (ok) return <span className="rec-fact-badge rec-fact-ok">{okLabel}</span>
  return <span className={`rec-fact-badge ${warn ? 'rec-fact-warn' : 'rec-fact-neutral'}`}>{failLabel}</span>
}

function HeroStat({ value, label, color, mono }) {
  return (
    <div className="rec-hero-stat">
      <div className="rec-hero-stat-val" style={{ color: color || 'var(--navy)', fontFamily: mono ? 'var(--mono)' : 'var(--serif)' }}>{value}</div>
      <div className="rec-hero-stat-label">{label}</div>
    </div>
  )
}
