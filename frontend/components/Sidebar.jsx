'use client'

const NAV = [
  {
    id: 'search', label: 'Search',
    icon: <svg className="sb-icon" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>,
  },
]

const EXPLORE = [
  {
    id: 'heatmap', label: 'Heatmap',
    icon: <svg className="sb-icon" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 5.5h6M5 8h4M5 10.5h5"/></svg>,
  },
  {
    id: 'compare', label: 'Compare',
    icon: <svg className="sb-icon" viewBox="0 0 16 16"><rect x="2" y="3" width="5" height="10" rx="1"/><rect x="9" y="5" width="5" height="8" rx="1"/></svg>,
  },
]

export default function Sidebar({ active = 'search', onNav, alertCount = 0 }) {
  const go = (id) => onNav?.(id)

  return (
    <aside className="sidebar">
      {NAV.map(item => (
        <button key={item.id} className={`sb-item${active === item.id ? ' on' : ''}`} onClick={() => go(item.id)}>
          {item.icon}
          {item.label}
        </button>
      ))}

      <div className="sb-divider" />
      <div className="sb-label">Explore</div>

      {EXPLORE.map(item => (
        <button key={item.id} className={`sb-item${active === item.id ? ' on' : ''}`} onClick={() => go(item.id)}>
          {item.icon}
          {item.label}
        </button>
      ))}

      <div className="sb-divider" />

      <button className={`sb-item${active === 'alerts' ? ' on' : ''}`} onClick={() => go('alerts')}>
        <svg className="sb-icon" viewBox="0 0 16 16">
          <path d="M8 2a5 5 0 100 10A5 5 0 008 2z"/>
          <path d="M8 6v3" strokeLinecap="round"/>
          <circle cx="8" cy="10.5" r="0.6" fill="currentColor" stroke="none"/>
        </svg>
        Alerts
        {alertCount > 0 && <span className="sb-badge">{alertCount}</span>}
      </button>
    </aside>
  )
}
