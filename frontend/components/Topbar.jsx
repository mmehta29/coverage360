'use client'
import { useState } from 'react'
import AlertsBell from './AlertsBell'
import UploadModal from './UploadModal'

export default function Topbar({ payers = [], user = null, organizationName = '', onLogout }) {
  const [uploadOpen, setUploadOpen] = useState(false)

  return (
    <>
      <div className="topbar">
        <div className="logo">
          <span className="logo-main">Coverage</span>
          <span className="logo-360">360</span>
          <span className="logo-tag">by Anton Rx · Analyst Portal</span>
        </div>
        <div className="topbar-right">
          {organizationName && <span className="payer-pill">{organizationName}</span>}
          {payers.map(p => (
            <span key={p} className="payer-pill">{p}</span>
          ))}
          {user?.email && <span className="payer-pill">{user.email}</span>}
          <AlertsBell />
          <button className="btn-ghost" onClick={() => setUploadOpen(true)}>Upload PDF</button>
          <button className="btn-solid">+ Add payer</button>
          {user && <button className="btn-ghost" onClick={onLogout}>Log out</button>}
        </div>
      </div>

      <UploadModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  )
}
