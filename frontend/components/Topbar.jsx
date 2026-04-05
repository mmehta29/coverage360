export default function Topbar({ onToggleSidebar }) {
  return (
    <div className="topbar">
      <button onClick={onToggleSidebar} style={{background:'none',border:'none',cursor:'pointer',padding:'6px',marginRight:'8px',display:'flex',flexDirection:'column',gap:'4px'}}>
        <span style={{display:'block',width:'18px',height:'2px',background:'var(--ink2)',borderRadius:'2px'}} />
        <span style={{display:'block',width:'18px',height:'2px',background:'var(--ink2)',borderRadius:'2px'}} />
        <span style={{display:'block',width:'18px',height:'2px',background:'var(--ink2)',borderRadius:'2px'}} />
      </button>
      <div className="logo">
        <img src="/logo.png" alt="Coverage360" style={{height:'120px',width:'auto'}} />
      </div>
      <div className="topbar-right">
        <button className="btn-ghost">Upload PDF</button>
        <button className="btn-solid">+ Add payer</button>
        {user && <button className="btn-ghost" onClick={onLogout}>Log out</button>}
      </div>
    </div>
  )
}