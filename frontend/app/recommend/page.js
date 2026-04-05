'use client'
import { useState, useEffect, useRef } from 'react'
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
  if (status === 'covered')    score += 40
  else if (status === 'restricted') score += 12
  else                         score -= 35

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

function meetsPrefCount(payer, prefs) {
  let n = 0
  if (!prefs.avoidPA   || !payer.requires_prior_auth) n++
  const hasStep = Array.isArray(payer.step_therapy) && payer.step_therapy.length > 0
  if (!prefs.avoidStep || !hasStep) n++
  if (mapStatus(payer.coverage_status) === 'covered') n++
  return n
}

function scoreColor(s) {
  if (s >= 75) return 'var(--covered)'
  if (s >= 50) return 'var(--restricted)'
  return 'var(--denied)'
}

function scoreBg(s) {
  if (s >= 75) return 'var(--covered-bg)'
  if (s >= 50) return 'var(--restricted-bg)'
  return 'var(--denied-bg)'
}

function scoreGradient(s) {
  if (s >= 75) return 'linear-gradient(90deg,#10b981,#059669)'
  if (s >= 50) return 'linear-gradient(90deg,#f59e0b,#d97706)'
  return 'linear-gradient(90deg,#f87171,#dc2626)'
}

function rankStyle(rank) {
  if (rank === 1) return { bg: '#fef9c3', color: '#92400e', border: '#fde68a' }
  if (rank === 2) return { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' }
  return { bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' }
}

function extractCriteriaSnippet(payer) {
  const criteria = payer.pa_criteria?.criteria
  if (Array.isArray(criteria) && criteria.length > 0) {
    return criteria[0]?.description || ''
  }
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

// ── Preference pill options ────────────────────────────────────────────────────
const PREF_OPTS = [
  { key: 'avoidPA',      label: 'Avoid prior auth',   icon: 'M8 2l4 2v4c0 3-4 5-4 5S4 11 4 8V4l4-2z' },
  { key: 'avoidStep',    label: 'Avoid step therapy',  icon: 'M3 4h10M5 8h8M7 12h4' },
  { key: 'fastApproval', label: 'Fast approval',        icon: 'M8 2v4l3 3M14 8A6 6 0 102 8' },
  { key: 'switchDrugs',  label: 'Willing to switch',   icon: 'M4 8h8M9 5l3 3-3 3' },
]

const SEVERITY_OPTS = ['Any', 'Mild', 'Moderate', 'Severe', 'End-stage']
const BUDGET_OPTS   = ['low', 'medium', 'high']

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RecommendPage() {
  const [payers,   setPayers]   = useState([])
  const [drugList, setDrugList] = useState([])

  const [drug,         setDrug]         = useState('')
  const [drugInput,    setDrugInput]    = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [condition,    setCondition]    = useState('')
  const [severity,     setSeverity]     = useState('Any')
  const [budget,       setBudget]       = useState('medium')
  const [payerFocus,   setPayerFocus]   = useState('')
  const [prefs, setPrefs] = useState({ avoidPA: false, avoidStep: false, fastApproval: false, switchDrugs: false })

  const [loading,  setLoading]  = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [results,  setResults]  = useState([])
  const [altResults, setAltResults] = useState([])
  const [error,    setError]    = useState('')

  const dropdownRef = useRef(null)

  useEffect(() => {
    fetch('/api/payers')
      .then(r => r.ok ? r.json() : [])
      .then(data => setPayers((data || []).map(p => p.short_name || p.name)))
      .catch(() => {})

    fetch('/api/drugs')
      .then(r => r.ok ? r.json() : [])
      .then(data => setDrugList(data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const filteredDrugs = drugInput.length < 1 ? [] : drugList.filter(d => {
    const q = drugInput.toLowerCase()
    return (d.brand_name || '').toLowerCase().includes(q) || (d.generic_name || '').toLowerCase().includes(q)
  }).slice(0, 8)

  async function handleAnalyze() {
    if (!drug.trim()) { setError('Please select a drug to analyze.'); return }
    setError('')
    setLoading(true)
    setAnalyzed(false)

    try {
      const res = await fetch(`/api/coverage/compare?drug=${encodeURIComponent(drug)}`)
      if (!res.ok) throw new Error('Unable to load coverage data')
      const data = await res.json()

      const payerMap = data.comparison || {}
      let scored = Object.values(payerMap).map(p => ({
        ...p,
        score: scorePayerForPrefs(p, prefs, budget),
      }))

      if (payerFocus) {
        scored = scored.sort((a, b) => {
          if (a.payer_name === payerFocus) return -1
          if (b.payer_name === payerFocus) return 1
          return b.score - a.score
        })
      } else {
        scored.sort((a, b) => b.score - a.score)
      }

      setResults(scored)
      setAnalyzed(true)

      if (prefs.switchDrugs) {
        const selectedDrug = drugList.find(d =>
          d.brand_name === drug || d.generic_name === drug
        )
        const drugClass = selectedDrug?.drug_class
        if (drugClass) {
          const alts = drugList.filter(d =>
            d.drug_class === drugClass &&
            d.brand_name !== drug &&
            d.generic_name !== drug
          ).slice(0, 4)

          const altData = await Promise.all(alts.map(async alt => {
            const name = alt.brand_name || alt.generic_name
            try {
              const r = await fetch(`/api/coverage/compare?drug=${encodeURIComponent(name)}`)
              if (!r.ok) return null
              const d = await r.json()
              const payerList = Object.values(d.comparison || {})
              if (!payerList.length) return null
              const best = payerList.map(p => ({
                ...p, score: scorePayerForPrefs(p, prefs, budget)
              })).sort((a, b) => b.score - a.score)[0]
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
    const status = mapStatus(p.coverage_status)
    if (status !== 'covered') return false
    if (prefs.avoidPA && p.requires_prior_auth) return false
    const hasStep = Array.isArray(p.step_therapy) && p.step_therapy.length > 0
    if (prefs.avoidStep && hasStep) return false
    return true
  }).length

  return (
    <div>
      <Topbar payers={payers} />
      <div className="shell">
        <Sidebar />
        <div className="main">

          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="rec-hero">
            <div className="rec-hero-left">
              <div className="rec-eyebrow">Access Intelligence</div>
              <div className="rec-title">Coverage Strategy Planner</div>
              <div className="rec-sub">
                Rank payers by access burden for any drug — model PA, step therapy, and budget constraints in seconds.
              </div>
            </div>
            {analyzed && (
              <div className="rec-hero-stats">
                <HeroStat value={results.length} label="Payers ranked" />
                <HeroStat value={meetAll} label="Meet all prefs" color="var(--covered)" />
                <HeroStat value={drug} label="Analyzing" mono />
              </div>
            )}
          </div>

          {/* ── Input panel ────────────────────────────────────────── */}
          <div className="rec-panel">

            <div className="rec-panel-row">
              {/* Drug combobox */}
              <div className="rec-field" ref={dropdownRef} style={{ position: 'relative', flex: '1.4' }}>
                <label className="rec-label">Drug name <span className="rec-required">*</span></label>
                <input
                  className="rec-input"
                  value={drugInput}
                  onChange={e => { setDrugInput(e.target.value); setShowDropdown(true); setDrug('') }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Brand or generic name…"
                />
                {drug && (
                  <span className="rec-input-chip">
                    {drug}
                    <button onClick={() => { setDrug(''); setDrugInput(''); setDrugList(drugList) }} className="rec-chip-x">×</button>
                  </span>
                )}
                {showDropdown && filteredDrugs.length > 0 && (
                  <div className="rec-dropdown">
                    {filteredDrugs.map(d => (
                      <button
                        key={d.brand_name || d.generic_name}
                        className="rec-dropdown-item"
                        onClick={() => {
                          setDrug(d.brand_name || d.generic_name)
                          setDrugInput(d.brand_name || d.generic_name)
                          setShowDropdown(false)
                        }}
                      >
                        <span className="rec-dd-brand">{d.brand_name || d.generic_name}</span>
                        {d.generic_name && d.brand_name && (
                          <span className="rec-dd-generic">{d.generic_name}</span>
                        )}
                        {d.drug_class && <span className="rec-dd-class">{d.drug_class}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Condition */}
              <div className="rec-field" style={{ flex: '1.2' }}>
                <label className="rec-label">Condition / diagnosis</label>
                <input
                  className="rec-input"
                  value={condition}
                  onChange={e => setCondition(e.target.value)}
                  placeholder="e.g. Rheumatoid Arthritis"
                />
              </div>

              {/* Severity */}
              <div className="rec-field" style={{ flex: '0.7' }}>
                <label className="rec-label">Severity</label>
                <select className="rec-select" value={severity} onChange={e => setSeverity(e.target.value)}>
                  {SEVERITY_OPTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              {/* Payer focus */}
              <div className="rec-field" style={{ flex: '0.9' }}>
                <label className="rec-label">Payer focus</label>
                <select className="rec-select" value={payerFocus} onChange={e => setPayerFocus(e.target.value)}>
                  <option value="">All payers</option>
                  {payers.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="rec-panel-row rec-panel-row-2">
              {/* Preferences */}
              <div className="rec-prefs-group">
                <span className="rec-group-label">Preferences</span>
                <div className="rec-pref-pills">
                  {PREF_OPTS.map(p => (
                    <button
                      key={p.key}
                      className={`rec-pref-pill${prefs[p.key] ? ' active' : ''}`}
                      onClick={() => setPrefs(prev => ({ ...prev, [p.key]: !prev[p.key] }))}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d={p.icon} />
                      </svg>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget */}
              <div className="rec-budget-group">
                <span className="rec-group-label">Budget level</span>
                <div className="rec-budget-seg">
                  {BUDGET_OPTS.map(b => (
                    <button
                      key={b}
                      className={`rec-budget-btn${budget === b ? ' active' : ''}`}
                      onClick={() => setBudget(b)}
                    >
                      {b.charAt(0).toUpperCase() + b.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <button
                className="btn-solid rec-analyze-btn"
                onClick={handleAnalyze}
                disabled={loading}
              >
                {loading ? 'Analyzing…' : 'Analyze Coverage →'}
              </button>
            </div>

            {error && <div className="rec-error">{error}</div>}
          </div>

          {/* ── Results ────────────────────────────────────────────── */}
          <div className="rec-results-area">
            {!analyzed && !loading && (
              <div className="rec-empty-state">
                <div className="rec-empty-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.2">
                    <circle cx="11" cy="11" r="7" /><circle cx="11" cy="11" r="3" /><path d="M20 20l-3-3" strokeLinecap="round" />
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
                      <button key={name} className="recent-tag" onClick={() => {
                        setDrug(name); setDrugInput(name)
                      }}>{name}</button>
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

            {analyzed && !loading && (
              <>
                {/* Summary strip */}
                <div className="rec-summary-strip">
                  <div className="rec-summary-left">
                    <span className="rec-summary-count">{results.length}</span>
                    <span className="rec-summary-label">payers ranked for</span>
                    <span className="rec-summary-drug">{drug}</span>
                    {condition && <span className="rec-summary-condition">· {condition}{severity !== 'Any' ? ` (${severity})` : ''}</span>}
                  </div>
                  {meetAll > 0 && (
                    <div className="rec-summary-badge">
                      <span className="rec-meet-dot" />
                      {meetAll} meet all preferences
                    </div>
                  )}
                </div>

                {/* Payer result cards */}
                <div className="rec-cards">
                  {results.map((payer, i) => (
                    <PayerCard
                      key={payer.payer_name}
                      rank={i + 1}
                      payer={payer}
                      prefs={prefs}
                      isFocused={payerFocus === payer.payer_name}
                    />
                  ))}
                </div>

                {/* Alternatives */}
                {prefs.switchDrugs && altResults.length > 0 && (
                  <div className="rec-alts-section">
                    <div className="rec-alts-header">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round">
                        <path d="M4 8h8M9 5l3 3-3 3" />
                      </svg>
                      <span>Same-class alternatives</span>
                      <span className="rec-alts-sub">— drugs in the same therapeutic class with their best payer option</span>
                    </div>
                    <div className="rec-alts-grid">
                      {altResults.map(alt => (
                        <div key={alt.drug} className="rec-alt-card">
                          <div className="rec-alt-drug">{alt.drug}</div>
                          {alt.generic && alt.generic !== alt.drug && (
                            <div className="rec-alt-generic">{alt.generic}</div>
                          )}
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
                            <span className="pdot" />
                            {alt.status.charAt(0).toUpperCase() + alt.status.slice(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <TrustBar />
        </div>
      </div>
    </div>
  )
}

// ── PayerCard ─────────────────────────────────────────────────────────────────
function PayerCard({ rank, payer, prefs, isFocused }) {
  const status  = mapStatus(payer.coverage_status)
  const score   = payer.score
  const color   = scoreColor(score)
  const rStyle  = rankStyle(rank)
  const snippet = extractCriteriaSnippet(payer)
  const stepLabel = formatStepTherapy(payer.step_therapy)
  const hasStep   = !!stepLabel
  const hasPA     = payer.requires_prior_auth
  const criteriaCount = payer.pa_criteria?.criteria?.length || 0

  const statusClass = status === 'covered' ? 'cca-covered' : status === 'restricted' ? 'cca-restricted' : 'cca-denied'
  const statusPill  = status === 'covered' ? 'pill pill-c' : status === 'restricted' ? 'pill pill-r' : 'pill pill-d'
  const statusLabel = status === 'covered' ? 'Covered' : status === 'restricted' ? 'Restricted' : 'Not covered'

  return (
    <div className={`rec-card${isFocused ? ' rec-card-focused' : ''}`} style={{ animationDelay: `${rank * 60}ms` }}>
      <div className={`compare-card-accent ${statusClass}`} />

      <div className="rec-card-body">
        {/* Left: rank + payer name + score bar */}
        <div className="rec-card-left">
          <div className="rec-card-top-row">
            <span className="rec-rank" style={{ background: rStyle.bg, color: rStyle.color, border: `1px solid ${rStyle.border}` }}>
              #{rank}
            </span>
            <div className="rec-card-payer">{payer.payer_name}</div>
            {isFocused && <span className="rec-focused-badge">Tracking</span>}
          </div>

          <div className="rec-score-row">
            <div className="rec-score-track">
              <div
                className="rec-score-fill"
                style={{ width: `${score}%`, background: scoreGradient(score) }}
              />
            </div>
            <span className="rec-score-num" style={{ color }}>{score}</span>
            <span className="rec-score-denom">/100</span>
          </div>

          <div className="rec-badges">
            <span className={statusPill}>
              <span className="pdot" />
              {statusLabel}
            </span>
            <FactBadge
              ok={!hasPA}
              okLabel="No prior auth"
              failLabel="PA required"
              warn={prefs.avoidPA && hasPA}
            />
            <FactBadge
              ok={!hasStep}
              okLabel="No step therapy"
              failLabel={stepLabel || 'Step therapy'}
              warn={prefs.avoidStep && hasStep}
            />
            {criteriaCount > 0 && (
              <span className="rec-fact-badge rec-fact-neutral">
                {criteriaCount} criteria step{criteriaCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Right: criteria insight + metadata */}
        <div className="rec-card-right">
          {snippet ? (
            <>
              <div className="rec-insight-label">Access criteria</div>
              <div className="rec-insight-text">
                "{snippet.length > 200 ? snippet.slice(0, 200) + '…' : snippet}"
              </div>
            </>
          ) : (
            <div className="rec-insight-text" style={{ color: 'var(--ink3)', fontStyle: 'normal' }}>
              No detailed PA criteria extracted for this payer.
            </div>
          )}

          <div className="rec-card-meta">
            {payer.effective_date && (
              <span className="rec-meta-item">
                Effective {new Date(payer.effective_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
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
  if (ok) {
    return <span className="rec-fact-badge rec-fact-ok">{okLabel}</span>
  }
  return <span className={`rec-fact-badge ${warn ? 'rec-fact-warn' : 'rec-fact-neutral'}`}>{failLabel}</span>
}

function HeroStat({ value, label, color, mono }) {
  return (
    <div className="rec-hero-stat">
      <div className="rec-hero-stat-val" style={{ color: color || 'var(--navy)', fontFamily: mono ? 'var(--mono)' : 'var(--serif)' }}>
        {value}
      </div>
      <div className="rec-hero-stat-label">{label}</div>
    </div>
  )
}
