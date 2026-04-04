import styles from './Topbar.module.css'

export default function Topbar({ payers = [] }) {
  return (
    <div className={styles.topbar}>
      <div className={styles.logo}>
        <span className={styles.main}>Coverage</span>
        <span className={styles.accent}>360</span>
        <span className={styles.tag}>by Anton Rx · Analyst Portal</span>
      </div>
      <div className={styles.right}>
        {payers.map(p => (
          <span key={p} className={styles.payerPill}>{p}</span>
        ))}
        <button className="btn-ghost">Upload PDF</button>
        <button className="btn-solid">+ Add payer</button>
      </div>
    </div>
  )
}
