export default function Topbar({ subtitle = 'Analyst Portal' }) {
  return (
    <div className="topbar">
      <div className="logo">
        <img src="/logo.png" alt="Coverage360" style={{height:'120px',width:'auto'}} />
      </div>
      <div className="topbar-right">
        <button className="btn-ghost">Upload PDF</button>
        <button className="btn-solid">+ Add payer</button>
      </div>
    </div>
  )
}