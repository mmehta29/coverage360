'use client'

export default function SearchHero({ query, onQueryChange, onSearch, indexStats, recentSearches = [] }) {
  return (
    <div className="search-hero">
      <div className="search-eyebrow">Medical benefit drug coverage</div>
      <div className="search-bar">
        <div className="search-wrap">
          <div className="s-ico">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#8a9db5" strokeWidth="1.6">
              <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/>
            </svg>
          </div>
          <input
            className="search-input"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch(query)}
            placeholder="Drug name, generic name, or J-code…"
          />
        </div>
        <button className="btn-solid" style={{padding:'12px 22px',fontSize:'13px'}} onClick={() => onSearch(query)}>
          Search
        </button>
      </div>
      <div className="recent-row">
        {recentSearches.length > 0 && <span className="recent-lbl">Recent:</span>}
        {recentSearches.map(r => (
          <button key={r} className="recent-tag" onClick={() => onSearch(r)}>{r}</button>
        ))}
        {indexStats && (
          <span style={{marginLeft:'auto',fontSize:'11px',color:'var(--ink3)',fontWeight:300}}>
            {indexStats.policies} policies indexed · {indexStats.payers} payers · Updated {indexStats.updated}
          </span>
        )}
      </div>
    </div>
  )
}