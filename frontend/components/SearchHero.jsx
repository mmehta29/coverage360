'use client'
import styles from './SearchHero.module.css'

const RECENT = ['Adalimumab', 'Bevacizumab', 'Pembrolizumab']

export default function SearchHero({ query, onQueryChange, onSearch, indexStats }) {
  function handleKey(e) {
    if (e.key === 'Enter') onSearch(query)
  }

  return (
    <div className={styles.hero}>
      <div className={styles.eyebrow}>Medical benefit drug coverage</div>
      <div className={styles.bar}>
        <div className={styles.wrap}>
          <svg className={styles.ico} width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#8a9db5" strokeWidth="1.6">
            <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/>
          </svg>
          <input
            className={styles.input}
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Drug name, generic name, or J-code…"
          />
        </div>
        <button className="btn-solid" style={{ padding: '12px 22px', fontSize: '13px' }} onClick={() => onSearch(query)}>
          Search
        </button>
      </div>
      <div className={styles.recent}>
        <span className={styles.recentLbl}>Recent:</span>
        {RECENT.map(r => (
          <button key={r} className={styles.recentTag} onClick={() => onSearch(r)}>
            {r}
          </button>
        ))}
        {indexStats && (
          <span className={styles.stats}>
            {indexStats.policies} policies indexed · {indexStats.payers} payers · Updated {indexStats.updated}
          </span>
        )}
      </div>
    </div>
  )
}
