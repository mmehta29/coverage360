'use client'
import { useState, useRef, useEffect } from 'react'

export default function ChatWidget({ drugName }) {
  const [open, setOpen] = useState(true)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const q = input.trim()
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
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer, sources: data.sources }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Unable to reach the server. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-panel" style={{height: open ? '630px' : 'auto', overflow: 'hidden', transition: 'height 0.3s ease'}}>
      <div className="ai-header">
        <span className="ai-title">AI Chatbot</span>
        <button onClick={() => setOpen(o => !o)} title={open ? 'Collapse' : 'Expand'} style={{background:'none',border:'none',cursor:'pointer',padding:'4px',color:'var(--ink2)',display:'flex',alignItems:'center'}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>

      {open && (
        <>
          <div className="chat-container">
            {messages.length === 0 && !loading && (
              <div className="ai-empty">
                Ask anything about {drugName || 'a drug'} — coverage rules, step therapy, site-of-care, recent changes.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i}>
                {m.role === 'user'
                  ? <div className="ai-msg-q">{m.text}</div>
                  : <div className="ai-msg-a">
                      {m.text}
                      {m.sources && <div className="ai-msg-src">{m.sources}</div>}
                    </div>
                }
              </div>
            ))}
            {loading && (
              <div className="ai-msg-a" style={{color:'var(--ink3)',fontStyle:'italic'}}>Thinking…</div>
            )}
            <div ref={bottomRef}/>
          </div>

          <div className="ai-input-wrap">
            <textarea
              className="ai-textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Ask about any drug, payer, or policy change..."
            />
            <button className="ai-submit" onClick={send} disabled={loading}>Ask</button>
          </div>
        </>
      )}
    </div>
  )
}
