'use client'
import { useState } from 'react'
import UploadModal from './UploadModal'

export default function Topbar({ onToggleSidebar, user, onLogout }) {
  const [uploadOpen, setUploadOpen] = useState(false)

  return (
    <>
      <div className="topbar">
        <button
          onClick={onToggleSidebar}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', marginRight: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          <span style={{ display: 'block', width: '18px', height: '2px', background: 'var(--ink2)', borderRadius: '2px' }} />
          <span style={{ display: 'block', width: '18px', height: '2px', background: 'var(--ink2)', borderRadius: '2px' }} />
          <span style={{ display: 'block', width: '18px', height: '2px', background: 'var(--ink2)', borderRadius: '2px' }} />
        </button>
        <div className="logo">
          <img src="/logo.png" alt="Coverage360" style={{ height: '120px', width: 'auto' }} />
        </div>
        <div className="topbar-right">
          <button className="btn-ghost" onClick={() => setUploadOpen(true)}>Upload PDF</button>
          {user && <button className="btn-ghost" onClick={onLogout}>Log out</button>}
        </div>
      </div>

      <UploadModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  )
}
