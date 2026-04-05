'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Items with href  → real Next.js routes (Link)
// Items with navId → client-side tabs on the home page (button + onNav)
const NAV_ITEMS = [
  {
    href: '/', label: 'Search',
    icon: <svg className="sb-icon" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>,
  },
  {
    href: '/recommend', label: 'Recommend',
    icon: <svg className="sb-icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15" strokeLinecap="round"/></svg>,
  },
]

const EXPLORE_ITEMS = [
  {
    navId: 'organization', label: 'Organization',
    icon: <svg className="sb-icon" viewBox="0 0 16 16"><rect x="2.5" y="3" width="11" height="10" rx="1.5"/><path d="M5 6h6M5 8.5h4M5 11h3"/></svg>,
  },
  {
    navId: 'heatmap', label: 'Heatmap',
    icon: <svg className="sb-icon" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M2 6h12M2 10h12M6 2v12M10 2v12" strokeLinecap="round"/></svg>,
  },
  {
    href: '/ask', label: 'Ask AI',
    icon: <svg className="sb-icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="M8 5v4M8 10.5v.5" strokeLinecap="round"/></svg>,
  },
]

export default function Sidebar({ alertCount = 0, onNav }) {
  const pathname = usePathname()

  return (
    <aside className="sidebar">
      {NAV_ITEMS.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`sb-item${pathname === item.href ? ' on' : ''}`}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}

      <div className="sb-divider" />
      <div className="sb-label">Explore</div>

      {EXPLORE_ITEMS.map(item => {
        if (item.href) {
          return (
            <Link key={item.href} href={item.href} className={`sb-item${pathname === item.href ? ' on' : ''}`}>
              {item.icon}
              {item.label}
            </Link>
          )
        }
        return (
          <button
            key={item.navId}
            className="sb-item"
            onClick={() => onNav?.(item.navId)}
          >
            {item.icon}
            {item.label}
          </button>
        )
      })}

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
