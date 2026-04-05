'use client'
import { useState, useRef, useCallback } from 'react'

const STAGES = [
  { label: 'Parsing document',     sub: 'Extracting text, HCPCS codes, and dates' },
  { label: 'Extracting with AI',   sub: 'Single Claude call — takes 15–30 seconds' },
  { label: 'Saving to database',   sub: 'Writing to Supabase' },
]

const ACCEPTED = ['.pdf', '.docx', '.doc']
const MAX_MB = 20

export default function UploadModal({ isOpen, onClose }) {
  const [file,        setFile]        = useState(null)
  const [docUrl,      setDocUrl]      = useState('')
  const [dragging,    setDragging]    = useState(false)
  const [stage,       setStage]       = useState(-1)   // -1 = idle, 0/1/2 = in-progress
  const [result,      setResult]      = useState(null) // success payload
  const [error,       setError]       = useState('')
  const fileRef = useRef(null)
  const timerRef = useRef([])

  // ── helpers ────────────────────────────────────────────────────────────────
  function reset() {
    setFile(null); setDocUrl(''); setStage(-1); setResult(null); setError('')
    timerRef.current.forEach(clearTimeout)
    timerRef.current = []
  }

  function handleClose() { reset(); onClose() }

  function validateFile(f) {
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!ACCEPTED.includes(ext)) {
      setError(`Unsupported file type "${ext}". Upload a PDF or DOCX.`)
      return false
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File is too large (max ${MAX_MB} MB).`)
      return false
    }
    return true
  }

  function pickFile(f) {
    setError('')
    if (validateFile(f)) setFile(f)
  }

  // ── drag & drop ────────────────────────────────────────────────────────────
  const onDragOver  = useCallback(e => { e.preventDefault(); setDragging(true)  }, [])
  const onDragLeave = useCallback(()  => setDragging(false), [])
  const onDrop      = useCallback(e  => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) pickFile(f)
  }, [])

  // ── upload ─────────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!file) { setError('Please select a file first.'); return }
    setError('')
    setResult(null)

    // Advance stages with realistic timing
    setStage(0)
    timerRef.current.push(setTimeout(() => setStage(1), 2500))
    timerRef.current.push(setTimeout(() => setStage(2), 22000))

    const form = new FormData()
    form.append('file', file)
    if (docUrl.trim()) form.append('document_url', docUrl.trim())

    try {
      const res = await fetch('/api/ingest/upload', { method: 'POST', body: form })
      timerRef.current.forEach(clearTimeout)
      timerRef.current = []

      const data = await res.json()

      if (!res.ok) {
        setStage(-1)
        setError(data.error || data.detail || 'Upload failed.')
        return
      }

      setStage(-1)
      setResult(data)
    } catch {
      timerRef.current.forEach(clearTimeout)
      timerRef.current = []
      setStage(-1)
      setError('Could not reach the server. Make sure the backend is running.')
    }
  }

  if (!isOpen) return null

  const isProcessing = stage >= 0
  const isDuplicate  = result?.status === 'duplicate'
  const isSuccess    = result?.status === 'success'

  return (
    <div className="upl-overlay" onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
      <div className="upl-modal">

        {/* Header */}
        <div className="upl-header">
          <div>
            <div className="upl-title">Upload Policy Document</div>
            <div className="upl-sub">PDF or DOCX · extracted automatically with AI</div>
          </div>
          <button className="upl-close" onClick={handleClose} disabled={isProcessing}>×</button>
        </div>

        {/* ── Success state ─────────────────────────────────────────── */}
        {isSuccess && (
          <div className="upl-body">
            <div className="upl-success-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--covered)" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="upl-success-title">Policy ingested</div>
            <div className="upl-result-card">
              <div className="upl-result-policy">{result.policy_title || 'Untitled Policy'}</div>
              <div className="upl-result-payer">{result.payer || 'Unknown payer'}</div>
              <div className="upl-result-stats">
                <ResultStat value={result.drugs_upserted ?? 0}            label="drugs" />
                <ResultStat value={result.coverage_rules_inserted ?? 0}   label="coverage rules" />
                <ResultStat value={result.category_positions_inserted ?? 0} label="tier positions" />
              </div>
            </div>
            <div className="upl-actions">
              <button className="btn-ghost" onClick={reset}>Upload another</button>
              <button className="upl-btn-primary" onClick={handleClose}>Done</button>
            </div>
          </div>
        )}

        {/* ── Duplicate state ───────────────────────────────────────── */}
        {isDuplicate && (
          <div className="upl-body">
            <div className="upl-dup-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--restricted)" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="upl-dup-title">Already indexed</div>
            <div className="upl-dup-sub">This document is already in the database — no changes were made.</div>
            <div className="upl-actions">
              <button className="btn-ghost" onClick={reset}>Try a different file</button>
              <button className="upl-btn-primary" onClick={handleClose}>Close</button>
            </div>
          </div>
        )}

        {/* ── Processing state ──────────────────────────────────────── */}
        {isProcessing && (
          <div className="upl-body">
            <div className="upl-processing-file">
              <FileIcon />
              <span>{file.name}</span>
            </div>
            <div className="upl-stages">
              {STAGES.map((s, i) => {
                const done    = i < stage
                const active  = i === stage
                const pending = i > stage
                return (
                  <div key={i} className={`upl-stage${active ? ' active' : done ? ' done' : ' pending'}`}>
                    <div className="upl-stage-icon">
                      {done   && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--covered)" strokeWidth="2"><path d="M3 8l4 4 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      {active && <div className="upl-stage-spinner" />}
                      {pending && <div className="upl-stage-dot" />}
                    </div>
                    <div className="upl-stage-text">
                      <div className="upl-stage-label">{s.label}</div>
                      {active && <div className="upl-stage-sub">{s.sub}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Idle state (file picker) ──────────────────────────────── */}
        {!isProcessing && !result && (
          <div className="upl-body">
            {/* Drop zone */}
            <div
              className={`upl-drop${dragging ? ' dragging' : ''}${file ? ' has-file' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => !file && fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.doc"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
              />
              {file ? (
                <div className="upl-file-chosen">
                  <FileIcon />
                  <div className="upl-file-info">
                    <div className="upl-file-name">{file.name}</div>
                    <div className="upl-file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                  </div>
                  <button
                    className="upl-file-remove"
                    onClick={e => { e.stopPropagation(); setFile(null); setError('') }}
                  >×</button>
                </div>
              ) : (
                <div className="upl-drop-idle">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div className="upl-drop-title">Drop PDF or DOCX here</div>
                  <div className="upl-drop-hint">or <span className="upl-drop-link">click to browse</span> · max {MAX_MB} MB</div>
                </div>
              )}
            </div>

            {/* Optional URL */}
            <div className="upl-url-row">
              <label className="rec-label">Source URL <span style={{ color: 'var(--ink3)', textTransform: 'none', letterSpacing: 0 }}>(optional — for change tracking)</span></label>
              <input
                className="rec-input"
                value={docUrl}
                onChange={e => setDocUrl(e.target.value)}
                placeholder="https://payer.com/path/to/policy.pdf"
              />
            </div>

            {error && <div className="upl-error">{error}</div>}

            <div className="upl-actions">
              <button className="btn-ghost" onClick={handleClose}>Cancel</button>
              <button className="upl-btn-primary" onClick={handleUpload} disabled={!file}>
                Upload & Extract →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round"/>
    </svg>
  )
}

function ResultStat({ value, label }) {
  return (
    <div className="upl-result-stat">
      <span className="upl-result-stat-val">{value}</span>
      <span className="upl-result-stat-label">{label}</span>
    </div>
  )
}
