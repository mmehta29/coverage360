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
  const [open,     setOpen]     = useState(true)
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)

  // Voice state
  const [listening,  setListening]  = useState(false)
  const [speaking,   setSpeaking]   = useState(false)
  const [voiceError, setVoiceError] = useState('')

  const bottomRef      = useRef(null)
  const prevDrug       = useRef(drugName)
  const recognitionRef = useRef(null)
  const audioRef       = useRef(null)

  // Clear conversation when drug changes
  useEffect(() => {
    if (prevDrug.current !== drugName) {
      prevDrug.current = drugName
      setMessages([])
      stopSpeaking()
    }
  }, [drugName])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    return () => { stopListening(); stopSpeaking() }
  }, [])

  // ── TTS ───────────────────────────────────────────────────────────────────

  function stopSpeaking() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    setSpeaking(false)
  }

  async function speakText(text) {
    if (!text) return
    stopSpeaking()
    setSpeaking(true)
    setVoiceError('')
    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error || 'TTS failed')
      }
      const blob  = await res.blob()
      const url   = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url) }
      audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url) }
      await audio.play()
    } catch (e) {
      setSpeaking(false)
      if (!e.message.includes('not configured')) setVoiceError(e.message)
    }
  }

  function speakLastAnswer() {
    const last = [...messages].reverse().find(m => m.role === 'assistant')
    if (last) speakText(last.text)
  }

  // ── STT (Web Speech API) ──────────────────────────────────────────────────

  const voiceSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  function startListening() {
    if (!voiceSupported || listening) return
    setVoiceError('')
    stopSpeaking()

    const SR  = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults  = false
    rec.maxAlternatives = 1

    rec.onstart  = () => setListening(true)
    rec.onend    = () => setListening(false)
    rec.onerror  = (e) => {
      setListening(false)
      if (e.error !== 'no-speech' && e.error !== 'aborted') setVoiceError(`Mic error: ${e.error}`)
    }
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript?.trim()
      if (transcript) { setInput(transcript); setTimeout(() => send(transcript), 300) }
    }

    recognitionRef.current = rec
    rec.start()
  }

  function stopListening() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }

  function toggleMic() { if (listening) stopListening(); else startListening() }

  // ── Chat ──────────────────────────────────────────────────────────────────

  async function send(text) {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setInput('')
    setVoiceError('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)
    try {
      const res  = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, drug: drugName }),
      })
      const data       = await res.json()
      const answerText = data.answer || 'No answer returned.'
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: answerText,
        sources:     Array.isArray(data.sources) ? data.sources : data.sources ? [data.sources] : [],
        contextRows: data.context_rows_used ?? 0,
      }])
      // Auto-speak when question came from voice
      if (text !== undefined) speakText(answerText)
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ai-panel" style={{ height: open ? '630px' : 'auto', overflow: 'hidden', transition: 'height 0.3s ease' }}>

      {/* Header */}
      <div className="ai-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="ai-title">AI Assistant</span>
          {speaking && <span className="voice-badge">Speaking…</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {speaking && (
            <button onClick={stopSpeaking} title="Stop speaking"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--restricted)', display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            </button>
          )}
          {!speaking && messages.some(m => m.role === 'assistant') && (
            <button onClick={speakLastAnswer} title="Read last answer aloud"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ink3)', display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"/>
              </svg>
            </button>
          )}
          <button onClick={() => setOpen(o => !o)} title={open ? 'Collapse' : 'Expand'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ink2)', display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {open ? <path d="M18 15l-6-6-6 6"/> : <path d="M6 9l6 6 6-6"/>}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="chat-container">

            {/* Empty state */}
            {isEmpty && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="ai-empty">
                  {drugName
                    ? `Ask anything about ${drugName} — coverage rules, step therapy, prior auth, or recent policy changes.`
                    : 'Search for a drug first, then ask me anything about its coverage policies.'}
                </div>
                {voiceSupported && drugName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink3)', fontStyle: 'italic' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                      <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                    </svg>
                    Tap the mic to ask by voice
                  </div>
                )}
                {drugName && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {SUGGESTIONS.map(s => (
                      <button key={s} onClick={() => send(s)} style={{
                        textAlign: 'left', background: 'rgba(255,255,255,0.5)',
                        border: '1.5px solid rgba(255,255,255,0.7)', borderRadius: 10,
                        padding: '8px 12px', fontSize: 12, color: 'var(--slate)',
                        cursor: 'pointer', fontFamily: 'var(--sans)', transition: 'all 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.8)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.5)'}
                      >{s}</button>
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
                          {m.sources.map((s, si) => <div key={si} style={{ marginTop: 2 }}>· {s}</div>)}
                          {m.contextRows > 0 && (
                            <div style={{ marginTop: 4, color: 'var(--ink3)', fontSize: 10 }}>
                              Based on {m.contextRows} policy rule{m.contextRows !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      )}
                      <button onClick={() => speakText(m.text)} title="Read aloud"
                        style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink3)', fontSize: 11 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                          <path d="M15.54 8.46a5 5 0 010 7.07"/>
                        </svg>
                        Listen
                      </button>
                    </div>
                  )
                }
              </div>
            ))}

            {loading && (
              <div className="ai-msg-a" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 14, height: 14, border: '2px solid rgba(62,81,97,0.2)', borderTopColor: 'var(--slate)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                <span style={{ color: 'var(--ink3)', fontStyle: 'italic', fontSize: 12 }}>Searching policy database…</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {voiceError && (
            <div style={{ padding: '4px 14px', fontSize: 11.5, color: 'var(--denied)', background: 'var(--denied-bg)', borderTop: '1px solid var(--denied-br)' }}>
              {voiceError}
            </div>
          )}

          {/* Input row */}
          <div className="ai-input-wrap">
            <textarea
              className="ai-textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={listening ? 'Listening…' : drugName ? `Ask about ${drugName}…` : 'Search for a drug first…'}
              disabled={!drugName || listening}
              style={{ flex: 1 }}
            />
            {voiceSupported && (
              <button onClick={toggleMic} disabled={!drugName || loading}
                title={listening ? 'Stop recording' : 'Ask by voice'}
                className={`ai-mic-btn${listening ? ' listening' : ''}`}>
                {listening
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                      <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                    </svg>
                }
              </button>
            )}
            <button className="ai-submit" onClick={() => send()} disabled={loading || !input.trim() || !drugName}>
              Ask
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function MarkdownText({ text }) {
  if (!text) return null
  const lines = text.split('\n')

  // Group table lines together
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^\|.+\|/.test(line.trim())) {
      const tableLines = []
      while (i < lines.length && /^\|.+\|/.test(lines[i].trim())) {
        tableLines.push(lines[i])
        i++
      }
      blocks.push({ type: 'table', lines: tableLines })
    } else {
      blocks.push({ type: 'line', content: line })
      i++
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {blocks.map((block, bi) => {
        if (block.type === 'table') {
          const rows = block.lines.filter(l => !/^[\|\s\-:]+$/.test(l.trim()))
          return (
            <div key={bi} style={{ overflowX: 'auto', margin: '6px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <tbody>
                  {rows.map((row, ri) => {
                    const cells = row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1)
                    const isHeader = ri === 0
                    return (
                      <tr key={ri} style={{ background: isHeader ? 'var(--bg)' : ri % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                        {cells.map((cell, ci) => (
                          <td key={ci} style={{
                            padding: '5px 8px', border: '1px solid var(--line)',
                            fontWeight: isHeader ? 700 : 400, color: isHeader ? 'var(--ink)' : 'var(--ink2)',
                            whiteSpace: 'nowrap',
                          }}>
                            {renderInline(cell.trim())}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        }

        const line = block.content
        if (!line.trim()) return <div key={bi} style={{ height: 4 }} />
        if (/^---+$/.test(line.trim())) return <hr key={bi} style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '6px 0' }} />

        const h3 = line.match(/^###\s+(.+)/)
        if (h3) return <div key={bi} style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginTop: 8, marginBottom: 2 }}>{renderInline(h3[1])}</div>

        const h2 = line.match(/^##\s+(.+)/)
        if (h2) return <div key={bi} style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginTop: 8, marginBottom: 2 }}>{renderInline(h2[1])}</div>

        const isBullet = /^[\-\*•]\s/.test(line.trim())
        const content = renderInline(isBullet ? line.trim().replace(/^[\-\*•]\s/, '') : line)
        return (
          <div key={bi} style={{ display: 'flex', gap: isBullet ? 6 : 0, alignItems: 'flex-start' }}>
            {isBullet && <span style={{ color: 'var(--slate)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>·</span>}
            <span>{content}</span>
          </div>
        )
      })}
    </div>
  )
}

function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} style={{ color: 'var(--ink)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}
