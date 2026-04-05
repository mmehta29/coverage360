'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  {
    href: '/', label: 'Search',
    icon: <svg className="sb-icon" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>,
  },
]

const EXPLORE = [
  {
    href: '/compare', label: 'Compare',
    icon: <svg className="sb-icon" viewBox="0 0 16 16"><rect x="2" y="3" width="5" height="10" rx="1"/><rect x="9" y="5" width="5" height="8" rx="1"/></svg>,
  },
  {
    href: '/ask', label: 'Ask AI',
    icon: <svg className="sb-icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="M8 5v4M8 10.5v.5" strokeLinecap="round"/></svg>,
  },
]

export default function Sidebar({ alertCount = 0 }) {
  const pathname = usePathname()

  return (
    <aside className="sidebar">
      {NAV.map(item => (
        <Link key={item.href} href={item.href} className={`sb-item${pathname === item.href ? ' on' : ''}`}>
          {item.icon}
          {item.label}
        </Link>
      ))}

      <div className="sb-divider" />
      <div className="sb-label">Explore</div>

      {EXPLORE.map(item => (
        <Link key={item.href} href={item.href} className={`sb-item${pathname === item.href ? ' on' : ''}`}>
          {item.icon}
          {item.label}
        </Link>
      ))}

      <div className="sb-divider" />

      <Link href="/alerts" className={`sb-item${pathname === '/alerts' ? ' on' : ''}`}>
        <svg className="sb-icon" viewBox="0 0 16 16">
          <path d="M8 2a4 4 0 00-4 4c0 4-2 5-2 5h12s-2-1-2-5a4 4 0 00-4-4z"/>
          <path d="M9.5 13a1.5 1.5 0 01-3 0" strokeLinecap="round"/>
        </svg>
        Alerts
        {alertCount > 0 && <span className="sb-badge">{alertCount}</span>}
      </Link>
    </aside>
  )
}
