'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

export default function AlertsBell() {
  const [count, setCount] = useState(0)
  const [preview, setPreview] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    fetch('/api/alerts?days=7')
      .then(r => r.ok ? r.json() : { alerts: [] })
      .then(data => {
        const alerts = data.alerts || []
        const meaningful = alerts.filter(a => a.type !== 'cosmetic')
        setCount(meaningful.length)
        setPreview(meaningful.slice(0, 3))
      })
      .catch(() => {})
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const TYPE_COLOR = {
    positive: 'var(--covered)',
    negative: 'var(--denied)',
    warning: 'var(--restricted)',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative', background: 'none', border: '1px solid var(--line)',
          borderRadius: 8, width: 34, height: 34, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: count > 0 ? 'var(--denied)' : 'var(--ink3)',
          transition: 'all 0.15s',
        }}
        title="Policy change alerts"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: 'var(--denied)', color: '#fff',
            fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 600,
            width: 16, height: 16, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--white)',
            animation: 'pulse-bell 2s ease-in-out infinite',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 42, right: 0, width: 340,
          background: 'var(--white)', border: '1px solid var(--line)',
          borderRadius: 'var(--rl)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 1000,
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>
              Policy alerts — last 7 days
            </span>
            {count > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                background: 'var(--denied-bg)', color: 'var(--denied)',
                border: '1px solid var(--denied-br)',
              }}>
                {count} meaningful
              </span>
            )}
          </div>

          {preview.length === 0 ? (
            <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--ink3)', textAlign: 'center' }}>
              No meaningful changes in the last 7 days
            </div>
          ) : (
            <div>
              {preview.map(alert => (
                <div key={alert.id} style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--line2)',
                  display: 'flex', gap: 10,
                }}>
                  <div style={{
                    width: 3, borderRadius: 3, flexShrink: 0, alignSelf: 'stretch', minHeight: 32,
                    background: TYPE_COLOR[alert.type] || 'var(--restricted)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 3, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>{alert.drug}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>{alert.payer}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink2)', lineHeight: 1.5 }}>
                      {alert.summary?.slice(0, 100)}{alert.summary?.length > 100 ? '…' : ''}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 3, fontFamily: 'var(--mono)' }}>
                      {alert.date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: '10px 16px' }}>
            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              style={{
                display: 'block', textAlign: 'center', fontSize: 12,
                color: 'var(--accent)', fontWeight: 500, textDecoration: 'none',
                padding: '6px 0',
              }}
            >
              View all alerts →
            </Link>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-bell {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  )
}
