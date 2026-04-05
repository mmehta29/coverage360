'use client'
import { useState, useRef, useEffect } from 'react'

const SUGGESTIONS = [
  'Which payers cover this drug?',
  'Is prior auth required?',
  'What step therapy applies?',
  'What are the PA criteria?',
  'What changed in the latest policy?',
]

export default function ChatWidget({ drugName }) {
  const [open, setOpen]       = useState(true)
  const [messages, setMessages] = useState([])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const prevDrug  = useRef(drugName)

  // Clear conversation when the searched drug changes
  useEffect(() => {
    if (prevDrug.current !== drugName) {
      prevDrug.current = drugName
      setMessages([])
    }
  }, [drugName])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text) {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, drug: drugName }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.answer,
        sources: Array.isArray(data.sources) ? data.sources : data.sources ? [data.sources] : [],
        contextRows: data.context_rows_used ?? 0,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Unable to reach the server. Make sure the backend is running.',
        sources: [],
      }])
    } finally {
      setLoading(false)
    }
  }

  const isEmpty = messages.length === 0 && !loading

  return (
    <div className="ai-panel" style={{ height: open ? '630px' : 'auto', overflow: 'hidden', transition: 'height 0.3s ease' }}>

      {/* Header */}
      <div className="ai-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="ai-title">AI Assistant</span>
          <span className="grounded-badge">Grounded</span>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          title={open ? 'Collapse' : 'Expand'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--ink2)', display: 'flex', alignItems: 'center' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {open
              ? <path d="M18 15l-6-6-6 6"/>
              : <path d="M6 9l6 6 6-6"/>}
          </svg>
        </button>
      </div>

      {open && (
        <>
          <div className="chat-container">

            {/* Empty state with suggestions */}
            {isEmpty && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="ai-empty">
                  {drugName
                    ? `Ask anything about ${drugName} — coverage rules, step therapy, prior auth, or recent policy changes.`
                    : 'Search for a drug first, then ask me anything about its coverage policies.'}
                </div>
                {drugName && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        style={{
                          textAlign: 'left', background: 'rgba(255,255,255,0.5)',
                          border: '1.5px solid rgba(255,255,255,0.7)', borderRadius: 10,
                          padding: '8px 12px', fontSize: 12, color: 'var(--slate)',
                          cursor: 'pointer', fontFamily: 'var(--sans)', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.8)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.5)'}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                {m.role === 'user'
                  ? <div className="ai-msg-q">{m.text}</div>
                  : (
                    <div className="ai-msg-a">
                      <MarkdownText text={m.text} />
                      {m.sources?.length > 0 && (
                        <div className="ai-msg-src">
                          <strong style={{ color: 'var(--ink2)', fontFamily: 'var(--mono)', fontSize: 10 }}>Sources</strong>
                          {m.sources.map((s, si) => (
                            <div key={si} style={{ marginTop: 2 }}>· {s}</div>
                          ))}
                          {m.contextRows > 0 && (
                            <div style={{ marginTop: 4, color: 'var(--ink3)', fontSize: 10 }}>
                              Based on {m.contextRows} policy rule{m.contextRows !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                }
              </div>
            ))}

            {loading && (
              <div className="ai-msg-a" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 14, height: 14, border: '2px solid rgba(62,81,97,0.2)',
                  borderTopColor: 'var(--slate)', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite', flexShrink: 0,
                }} />
                <span style={{ color: 'var(--ink3)', fontStyle: 'italic', fontSize: 12 }}>Searching policy database…</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="ai-input-wrap">
            <textarea
              className="ai-textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder={drugName ? `Ask about ${drugName}…` : 'Search for a drug first…'}
              disabled={!drugName}
            />
            <button className="ai-submit" onClick={() => send()} disabled={loading || !input.trim() || !drugName}>
              Ask
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Renders **bold**, line breaks, and bullet points from Claude's response
function MarkdownText({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 4 }} />
        const isBullet = /^[\-\*•]\s/.test(line.trim())
        const content = renderInline(isBullet ? line.trim().replace(/^[\-\*•]\s/, '') : line)
        return (
          <div key={i} style={{ display: 'flex', gap: isBullet ? 6 : 0, alignItems: 'flex-start' }}>
            {isBullet && <span style={{ color: 'var(--slate)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>·</span>}
            <span>{content}</span>
          </div>
        )
      })}
    </div>
  )
}

function renderInline(text) {
  // Split on **bold** markers
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--ink)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}
