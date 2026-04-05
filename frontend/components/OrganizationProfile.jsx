'use client'

import { useEffect, useMemo, useState } from 'react'

const EMPTY_PROFILE = {
  organizationName: '',
  organizationType: 'company',
  contactName: '',
  contactEmail: '',
  website: '',
  notes: '',
}

const VALID_TYPES = ['company', 'clinic', 'hospital', 'practice', 'other']

export default function OrganizationProfile({ user, onProfileChange }) {
  const storageKey = useMemo(() => {
    const subject = typeof user?.sub === 'string' ? user.sub : 'anonymous'
    return `coverage360-organization-profile-v1:${subject}`
  }, [user?.sub])

  const [profile, setProfile] = useState(EMPTY_PROFILE)
  const [saved, setSaved] = useState(false)
  const [subscribeStatus, setSubscribeStatus] = useState('') // '' | 'subscribing' | 'subscribed' | 'error'
  const [showPopup, setShowPopup] = useState(false)

  useEffect(() => {
    const nextProfile = normalizeProfile(readStorage(storageKey))
    setProfile(nextProfile)
    onProfileChange?.(nextProfile)
  }, [onProfileChange, storageKey])

  async function saveProfile() {
    const normalized = normalizeProfile(profile)
    writeStorage(storageKey, normalized)
    onProfileChange?.(normalized)
    setSaved(true)
    setShowPopup(true)
    setProfile(EMPTY_PROFILE)
    window.setTimeout(() => { setSaved(false); setShowPopup(false) }, 3000)

    // Subscribe email to alerts if provided
    if (normalized.contactEmail) {
      setSubscribeStatus('subscribing')
      try {
        const res = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalized.contactEmail,
            name: normalized.contactName,
            org_name: normalized.organizationName,
          }),
        })
        setSubscribeStatus(res.ok ? 'subscribed' : 'error')
      } catch {
        setSubscribeStatus('error')
      }
      window.setTimeout(() => setSubscribeStatus(''), 4000)
    }
  }

  const orgSummary = profile.organizationName
    ? `${profile.organizationName}${profile.organizationType ? ` - ${profile.organizationType}` : ''}`
    : 'No organization profile saved yet.'

  return (
    <div className="content org-content" style={{ position: 'relative' }}>
      {showPopup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(15,20,40,0.35)', backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.97)', borderRadius: 20,
            padding: '36px 44px', textAlign: 'center', maxWidth: 360,
            boxShadow: '0 24px 64px rgba(0,0,0,0.16)',
            border: '1.5px solid rgba(255,255,255,0.8)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--covered-bg)', border: '2px solid var(--covered-br)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--covered)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 700, color: 'var(--navy)' }}>Profile saved</div>
            {subscribeStatus === 'subscribed' ? (
              <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
                Your organization profile has been saved and you're subscribed to policy alert digests.
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
                Your organization profile has been saved successfully.
              </div>
            )}
            {subscribeStatus === 'subscribing' && (
              <div style={{ fontSize: 12, color: 'var(--ink3)' }}>Subscribing to alerts…</div>
            )}
          </div>
        </div>
      )}
      <div className="view-header">
        <div className="view-title">Organization profile</div>
        <div className="view-sub">Manage the organization context used for your coverage recommendation workflow.</div>
      </div>

      <section className="card org-card">
        <div className="card-head">
          <span className="card-title">Profile details</span>
        </div>
        <div className="card-body org-form">
          <div className="org-summary">
            <div className="org-summary-label">Current organization</div>
            <div className="org-summary-value">{orgSummary}</div>
          </div>

          <div className="org-form-grid">
            <Field
              label="Organization name"
              value={profile.organizationName}
              onChange={value => setProfile(prev => ({ ...prev, organizationName: value }))}
            />
            <label className="org-field">
              <span className="org-label">Organization type</span>
              <select
                className="org-input"
                value={profile.organizationType}
                onChange={event => setProfile(prev => ({ ...prev, organizationType: event.target.value }))}
              >
                {VALID_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <Field
              label="Contact name"
              value={profile.contactName}
              onChange={value => setProfile(prev => ({ ...prev, contactName: value }))}
            />
            <Field
              label="Contact email"
              type="email"
              value={profile.contactEmail}
              onChange={value => setProfile(prev => ({ ...prev, contactEmail: value }))}
            />
            <Field
              label="Website"
              value={profile.website}
              onChange={value => setProfile(prev => ({ ...prev, website: value }))}
            />
          </div>

          <label className="org-field">
            <span className="org-label">Notes</span>
            <textarea
              className="org-input org-textarea"
              value={profile.notes}
              onChange={event => setProfile(prev => ({ ...prev, notes: event.target.value }))}
              placeholder="Anything your team wants to remember about this organization context."
            />
          </label>

          <button type="button" className="btn-solid org-action" onClick={saveProfile}>
            Save organization profile
          </button>
        </div>
      </section>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="org-field">
      <span className="org-label">{label}</span>
      <input
        className="org-input"
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
    </label>
  )
}

function readStorage(key) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function normalizeProfile(value) {
  const profile = value && typeof value === 'object' ? value : {}
  return {
    organizationName: asText(profile.organizationName),
    organizationType: VALID_TYPES.includes(profile.organizationType) ? profile.organizationType : 'company',
    contactName: asText(profile.contactName),
    contactEmail: asText(profile.contactEmail),
    website: asText(profile.website),
    notes: asText(profile.notes),
  }
}

function asText(value) {
  return typeof value === 'string' ? value : ''
}
