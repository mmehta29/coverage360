'use client'
import { useState } from 'react'
import styles from './Sidebar.module.css'

const NAV = [
  {
    id: 'search', label: 'Search',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>,
  },
  {
    id: 'intelligence', label: 'Intelligence',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 13l3-3 2 2 4-5 3 4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
]

const EXPLORE = [
  {
    id: 'heatmap', label: 'Heatmap',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 5.5h6M5 8h4M5 10.5h5" strokeLinecap="round"/></svg>,
  },
  {
    id: 'compare', label: 'Compare',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="3" width="5" height="10" rx="1"/><rect x="9" y="5" width="5" height="8" rx="1"/></svg>,
  },
  {
    id: 'diff', label: 'Policy diff',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 4h10M3 8h7M3 12h9" strokeLinecap="round"/></svg>,
  },
]

export default function Sidebar({ alertCount = 0 }) {
  const [active, setActive] = useState('search')

  return (
    <aside className={styles.sidebar}>
      {NAV.map(item => (
        <button
          key={item.id}
          className={`${styles.item} ${active === item.id ? styles.on : ''}`}
          onClick={() => setActive(item.id)}
        >
          <span className={styles.icon}>{item.icon}</span>
          {item.label}
        </button>
      ))}

      <div className={styles.divider} />
      <div className={styles.label}>Explore</div>

      {EXPLORE.map(item => (
        <button
          key={item.id}
          className={`${styles.item} ${active === item.id ? styles.on : ''}`}
          onClick={() => setActive(item.id)}
        >
          <span className={styles.icon}>{item.icon}</span>
          {item.label}
        </button>
      ))}

      <div className={styles.divider} />

      <button
        className={`${styles.item} ${active === 'alerts' ? styles.on : ''}`}
        onClick={() => setActive('alerts')}
      >
        <span className={styles.icon}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M8 2a5 5 0 100 10A5 5 0 008 2z"/>
            <path d="M8 6v3" strokeLinecap="round"/>
            <circle cx="8" cy="10.5" r="0.6" fill="currentColor" stroke="none"/>
          </svg>
        </span>
        Alerts
        {alertCount > 0 && <span className={styles.badge}>{alertCount}</span>}
      </button>
    </aside>
  )
}
