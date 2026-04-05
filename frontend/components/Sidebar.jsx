'use client'
import Link from 'next/link'

const NAV_ITEMS = [
  {
    id: 'search', label: 'Search',
    icon: <svg className="sb-icon" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>,
  },
]

const EXPLORE_ITEMS = [
  {
    id: 'organization', label: 'Organization',
    icon: <svg className="sb-icon" viewBox="0 0 16 16"><rect x="2.5" y="3" width="11" height="10" rx="1.5"/><path d="M5 6h6M5 8.5h4M5 11h3"/></svg>,
  },
  {
    id: 'compare', label: 'Compare',
    icon: <svg className="sb-icon" viewBox="0 0 16 16"><rect x="2" y="3" width="5" height="10" rx="1"/><rect x="9" y="5" width="5" height="8" rx="1"/></svg>,
  },
  {
    href: '/ask', label: 'Ask AI',
    icon: <svg className="sb-icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="M8 5v4M8 10.5v.5" strokeLinecap="round"/></svg>,
  },
]

export default function Sidebar({ alertCount = 0, active = 'search', onNav }) {
  const handleNav = (id) => {
    if (onNav) onNav(id)
  }

  return (
    <aside className="sidebar">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`sb-item${active === item.id ? ' on' : ''}`}
          onClick={() => handleNav(item.id)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}

      <div className="sb-divider" />
      <div className="sb-label">Explore</div>

      {EXPLORE_ITEMS.map(item => (
        item.href ? (
          <Link key={item.href} href={item.href} className="sb-item">
            {item.icon}
            {item.label}
          </Link>
        ) : (
          <button
            key={item.id}
            className={`sb-item${active === item.id ? ' on' : ''}`}
            onClick={() => handleNav(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        )
      ))}

      <div className="sb-divider" />

      <button
        className={`sb-item${active === 'alerts' ? ' on' : ''}`}
        onClick={() => handleNav('alerts')}
      >
        <svg className="sb-icon" viewBox="0 0 16 16">
          <path d="M8 2a4 4 0 00-4 4c0 4-2 5-2 5h12s-2-1-2-5a4 4 0 00-4-4z"/>
          <path d="M9.5 13a1.5 1.5 0 01-3 0" strokeLinecap="round"/>
        </svg>
        Alerts
        {alertCount > 0 && <span className="sb-badge">{alertCount}</span>}
      </button>
    </aside>
  )
}
