'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    id: 'search', label: 'Search',
    icon: <svg className="sb-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/></svg>,
  },
]

const EXPLORE_ITEMS = [
  {
    id: 'organization', label: 'Organization',
    icon: <svg className="sb-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2.5" y="3" width="11" height="10" rx="1.5"/><path d="M5 6h6M5 8.5h4M5 11h3"/></svg>,
  },
  {
    id: 'compare', label: 'Compare',
    icon: <svg className="sb-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="5" height="10" rx="1"/><rect x="9" y="5" width="5" height="8" rx="1"/></svg>,
  },
]

const ROUTE_ITEMS = [
  {
    href: '/recommend', label: 'Recommend',
    icon: <svg className="sb-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15"/></svg>,
  },
]

export default function Sidebar({ alertCount = 0, open = true, active = 'search', onNav }) {
  const pathname = usePathname()

  return (
    <aside className="sidebar" style={{
      maxWidth: open ? '240px' : '0',
      overflow: 'hidden',
      padding: open ? '' : '0',
      transition: 'max-width 0.3s ease, padding 0.3s ease',
    }}>

      {/* Primary nav */}
      {NAV_ITEMS.map(item => (
        <button key={item.id} className={`sb-item${active === item.id ? ' on' : ''}`} onClick={() => onNav?.(item.id)}>
          {item.icon}
          {item.label}
        </button>
      ))}

      <div className="sb-divider" />
      <div className="sb-label">Explore</div>

      {/* Explore nav (tab-based, same page) */}
      {EXPLORE_ITEMS.map(item => (
        <button key={item.id} className={`sb-item${active === item.id ? ' on' : ''}`} onClick={() => onNav?.(item.id)}>
          {item.icon}
          {item.label}
        </button>
      ))}

      {/* Route-based nav (separate pages) */}
      {ROUTE_ITEMS.map(item => (
        <Link key={item.href} href={item.href} className={`sb-item${pathname === item.href ? ' on' : ''}`}>
          {item.icon}
          {item.label}
        </Link>
      ))}

      <div className="sb-divider" />

      {/* Alerts */}
      <button className={`sb-item${active === 'alerts' ? ' on' : ''}`} onClick={() => onNav?.('alerts')}>
        <svg className="sb-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M8 2a5 5 0 100 10A5 5 0 008 2z"/>
          <path d="M8 6v3"/>
          <circle cx="8" cy="10.5" r="0.6" fill="currentColor" stroke="none"/>
        </svg>
        Alerts
        {alertCount > 0 && <span className="sb-badge">{alertCount}</span>}
      </button>

    </aside>
  )
}
