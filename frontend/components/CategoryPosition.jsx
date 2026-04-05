'use client'
import { useState, useEffect } from 'react'

export default function CategoryPosition({ drugName }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!drugName) return
    setLoading(true)
    fetch(`/api/category?drug=${encodeURIComponent(drugName)}`)
      .then(r => r.ok ? r.json() : { positions: [] })
      .then(d => setData(d))
      .catch(() => setData({ positions: [] }))
      .finally(() => setLoading(false))
  }, [drugName])

  if (loading) return null
  if (!data?.positions?.length) return null

  // Group positions by category_label, then within that by payer
  const byCategory = {}
  for (const pos of data.positions) {
    const cat = pos.category_label || 'Drug Category'
    if (!byCategory[cat]) byCategory[cat] = []
    const payer = pos.policies?.payers?.name || 'Unknown'
    byCategory[cat].push({ ...pos, payer })
  }

  return (
    <div className="cat-section">
      <div className="cat-header">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--slate)" strokeWidth="1.6" strokeLinecap="round">
          <path d="M8 2l1.8 3.6L14 6.5l-3 2.9.7 4.1L8 11.4l-3.7 2.1.7-4.1L2 6.5l4.2-.9L8 2z"/>
        </svg>
        <span className="cat-header-title">Competitive Tier Position</span>
        <span className="cat-header-sub">rebate economics · preferred access</span>
      </div>

      {Object.entries(byCategory).map(([category, positions]) => (
        <div key={category} className="cat-category">
          <div className="cat-category-label">{category}</div>
          <div className="cat-grid">
            {positions.map((pos, i) => {
              const isPreferred   = pos.tier === 'preferred'
              const isExclusive   = pos.is_exclusive_preferred
              const tierClass     = isPreferred ? 'cat-tier-preferred' : pos.tier === 'non_preferred' ? 'cat-tier-nonpref' : 'cat-tier-denied'
              const positionLabel = isExclusive
                ? 'Exclusive preferred'
                : pos.tier_position && pos.total_in_tier
                  ? `${pos.tier_position} of ${pos.total_in_tier}`
                  : pos.tier === 'preferred' ? 'Preferred' : pos.tier === 'non_preferred' ? 'Non-preferred' : 'Not covered'

              return (
                <div key={i} className={`cat-card ${isPreferred ? 'cat-card-preferred' : ''}`}>
                  <div className="cat-card-top">
                    <div className="cat-payer">{pos.payer}</div>
                    <span className={`cat-tier-badge ${tierClass}`}>
                      {isPreferred ? '★ Preferred' : pos.tier === 'non_preferred' ? 'Non-preferred' : 'Not covered'}
                    </span>
                  </div>

                  <div className="cat-position-row">
                    <div className="cat-position-val">{positionLabel}</div>
                    {pos.step_therapy_required && (
                      <span className="cat-flag-step">Step therapy required</span>
                    )}
                    {isExclusive && (
                      <span className="cat-flag-exclusive">Exclusive</span>
                    )}
                  </div>

                  {pos.tier_position && pos.total_in_tier && !isExclusive && (
                    <div className="cat-position-bar">
                      {Array.from({ length: pos.total_in_tier }).map((_, idx) => (
                        <div
                          key={idx}
                          className={`cat-bar-seg ${idx < pos.tier_position ? 'cat-bar-filled' : 'cat-bar-empty'}`}
                        />
                      ))}
                      <span className="cat-bar-label">Slot {pos.tier_position} / {pos.total_in_tier}</span>
                    </div>
                  )}

                  {pos.notes && (
                    <div className="cat-notes">{pos.notes}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
