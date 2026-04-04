export default function Topbar({ payers = [] }) {
  return (
    <div className="topbar">
      <div className="logo">
        <span className="logo-main">Coverage</span>
        <span className="logo-360">360</span>
        <span className="logo-tag">by Anton Rx · Analyst Portal</span>
      </div>
      <div className="topbar-right">
        {payers.map(p => (
          <span key={p} className="payer-pill">{p}</span>
        ))}
        <button className="btn-ghost">Upload PDF</button>
        <button className="btn-solid">+ Add payer</button>
      </div>
    </div>
  )
}
