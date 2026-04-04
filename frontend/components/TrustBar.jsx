export default function TrustBar() {
  return (
    <div className="trust-bar">
      <div className="ti">
        <svg className="tico" viewBox="0 0 16 16"><path d="M8 2l4 2v4c0 3-4 5-4 5S4 11 4 8V4l4-2z"/></svg>
        HIPAA-aligned
      </div>
      <div className="ti">
        <svg className="tico" viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>
        Encrypted storage
      </div>
      <div className="ti">
        <svg className="tico" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="M5.5 8l2 2 3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Source citations on every answer
      </div>
      <div className="ti">
        <svg className="tico" viewBox="0 0 16 16"><path d="M2 8h12M8 2v12" strokeLinecap="round"/></svg>
        No cross-org data sharing
      </div>
      <div style={{marginLeft:'auto',fontSize:'11px',color:'var(--ink3)',fontWeight:300}}>
        Coverage360 · Innovation Hacks 2.0 · April 2026
      </div>
    </div>
  )
}
