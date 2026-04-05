const TYPE_LABEL = {
  positive: 'Coverage added',
  warning: 'Policy updated',
  negative: 'Coverage reduced',
}

export default function AlertsPanel({ alerts = [], days = 90, loading = false, error = '' }) {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Recent policy changes</span>
        <span style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>
          Last {days} days
        </span>
      </div>

      {loading ? (
        <div className="card-body">
          <div className="search-status">Loading alerts…</div>
        </div>
      ) : error ? (
        <div className="card-body">
          <div className="search-status">{error}</div>
        </div>
      ) : alerts.length === 0 ? (
        <div className="card-body">
          <div className="search-status">No recent policy changes found.</div>
        </div>
      ) : (
        <div className="alerts-feed">
          {alerts.map(alert => (
            <div key={alert.id} className={`alert-item alert-${alert.type}`}>
              <div className="alert-bar" />
              <div className="alert-body">
                <div className="alert-meta">
                  <span className="alert-drug">{alert.drug}</span>
                  <span className="alert-payer">{alert.payer}</span>
                  <span className="alert-type-badge">{TYPE_LABEL[alert.type] || TYPE_LABEL.warning}</span>
                  <span className="alert-date">{alert.date}</span>
                </div>
                <div className="alert-summary">{alert.summary}</div>
                <div className="alert-ref">{alert.policyRef}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
