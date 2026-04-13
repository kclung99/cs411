function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function ChargingHistoryCard({
  sessions,
  selectedUserId,
  loadingUserData,
  error,
  selectedSession,
  onSelectSession,
}) {
  return (
    <section className="card table-card">
      <h2>Charging History</h2>

      {selectedUserId === null ? (
        <div className="empty-message">No user selected.</div>
      ) : loadingUserData ? (
        <div className="placeholder">Loading charging history...</div>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : sessions.length === 0 ? (
        <div className="empty-message">No charging sessions found for this user.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Station ID</th>
                <th>Connection Time</th>
                <th>Disconnect Time</th>
                <th>Energy (kWh)</th>
                <th>Charging Duration (min)</th>
                <th>Session Duration (min)</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const isSelected = selectedSession?.session_id === session.session_id
                return (
                  <tr
                    key={session.session_id}
                    className={isSelected ? 'selected-row' : ''}
                    onClick={() => onSelectSession(session)}
                  >
                    <td>{session.session_id}</td>
                    <td>{session.station_id}</td>
                    <td>{formatDateTime(session.connection_time)}</td>
                    <td>{formatDateTime(session.disconnect_time)}</td>
                    <td>{session.energy_kwh}</td>
                    <td>{session.charging_duration_min}</td>
                    <td>{session.session_duration_min}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
