'use client'
import { useState, useRef, useEffect } from 'react'

export default function ChatWidget({ drugName }) {
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
    <div className="card">
      <div className="card-head">
        <span className="card-title">Ask a question</span>
        <span style={{fontSize:'10.5px',color:'var(--covered)'}}>Grounded in source policies</span>
      </div>
      <div className="card-body">
        <div className="chat-well">
          {messages.length === 0 && !loading && (
            <div className="chat-msg chat-a" style={{fontStyle:'normal',color:'var(--ink3)'}}>
              Ask anything about {drugName} — coverage rules, step therapy, site-of-care, recent changes.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role === 'user' ? 'chat-u' : 'chat-a'}`}>
              {m.text}
              {m.sources && <div className="chat-src">{m.sources}</div>}
            </div>
          ))}
          {loading && (
            <div className="chat-msg chat-a" style={{color:'var(--ink3)',fontStyle:'italic'}}>Thinking…</div>
          )}
          <div ref={bottomRef}/>
        </div>
        <div className="chat-input-row">
          <input
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask about any drug, payer, or policy change…"
          />
          <button className="btn-solid" style={{fontSize:'12px',padding:'9px 15px'}} onClick={send} disabled={loading}>
            Ask
          </button>
        </div>
      </div>
    </div>
  )
}