import styles from './TrustBar.module.css'

const ITEMS = [
  {
    label: 'HIPAA-aligned',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 2l4 2v4c0 3-4 5-4 5S4 11 4 8V4l4-2z"/></svg>,
  },
  {
    label: 'Encrypted storage',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>,
  },
  {
    label: 'Source citations on every answer',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6"/><path d="M5.5 8l2 2 3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    label: 'No cross-org data sharing',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 8h12M8 2v12" strokeLinecap="round"/></svg>,
  },
]

export default function TrustBar() {
  return (
    <div className={styles.bar}>
      {ITEMS.map(item => (
        <div key={item.label} className={styles.item}>
          <span className={styles.ico}>{item.icon}</span>
          {item.label}
        </div>
      ))}
      <span className={styles.tag}>Coverage360 · Innovation Hacks 2.0 · April 2026</span>
    </div>
  )
}
