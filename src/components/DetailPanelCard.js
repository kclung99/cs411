function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function DetailField({ label, value }) {
  return (
    <div className="detail-item">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
    </div>
  )
}

export default function DetailPanelCard({ selectedSession, selectedRecommendation }) {
  if (selectedSession) {
    return (
      <section className="card">
        <h2>Selected Session Details</h2>
        <div className="detail-grid">
          <DetailField label="Session ID" value={selectedSession.session_id} />
          <DetailField label="Station ID" value={selectedSession.station_id} />
          <DetailField
            label="Connection Time"
            value={formatDateTime(selectedSession.connection_time)}
          />
          <DetailField
            label="Disconnect Time"
            value={formatDateTime(selectedSession.disconnect_time)}
          />
          <DetailField label="Energy (kWh)" value={selectedSession.energy_kwh} />
          <DetailField
            label="Charging Duration (min)"
            value={selectedSession.charging_duration_min}
          />
          <DetailField
            label="Session Duration (min)"
            value={selectedSession.session_duration_min}
          />
        </div>
      </section>
    )
  }

  if (selectedRecommendation) {
    return (
      <section className="card">
        <h2>Selected Recommendation Details</h2>
        <div className="detail-grid">
          <DetailField
            label="Recommendation ID"
            value={selectedRecommendation.recommendation_id}
          />
          <DetailField label="Station ID" value={selectedRecommendation.station_id} />
          <DetailField
            label="Time Slot"
            value={formatDateTime(selectedRecommendation.recommendation_time_slot)}
          />
          <DetailField label="Score" value={selectedRecommendation.score} />
          <DetailField
            label="Created At"
            value={formatDateTime(selectedRecommendation.createdAt)}
          />
          <DetailField label="Model Type" value={selectedRecommendation.model_type} />
        </div>
      </section>
    )
  }

  return (
    <section className="card">
      <h2>Details</h2>
      <div className="empty-message">
        Select a session or recommendation row to view details.
      </div>
    </section>
  )
}
