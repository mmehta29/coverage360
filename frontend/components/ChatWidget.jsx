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
    <div className="ai-panel">
      <div className="ai-header">
        <span className="ai-title">AI Chatbot</span>
      </div>

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
    </div>
  )
}
