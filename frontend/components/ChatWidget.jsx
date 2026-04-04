'use client'
import { useState, useRef, useEffect } from 'react'
import styles from './ChatWidget.module.css'

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
    const userMsg = { role: 'user', text: q }
    setMessages(prev => [...prev, userMsg])
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
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.title}>Ask a question</span>
        <span className={styles.grounded}>Grounded in source policies</span>
      </div>
      <div className={styles.body}>
        <div className={styles.well}>
          {messages.length === 0 && (
            <div className={styles.empty}>
              Ask anything about {drugName ? <b>{drugName}</b> : 'a drug'} — coverage rules, step therapy, site-of-care, recent changes.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`${styles.msg} ${m.role === 'user' ? styles.userMsg : styles.asstMsg}`}>
              {m.text}
              {m.sources && <div className={styles.sources}>{m.sources}</div>}
            </div>
          ))}
          {loading && (
            <div className={`${styles.msg} ${styles.asstMsg} ${styles.thinking}`}>
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask about any drug, payer, or policy change…"
          />
          <button className="btn-solid" style={{ fontSize: '12px', padding: '9px 15px' }} onClick={send} disabled={loading}>
            Ask
          </button>
        </div>
      </div>
    </div>
  )
}
