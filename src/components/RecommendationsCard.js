function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function RecommendationsCard({
  recommendations,
  selectedUserId,
  loadingUserData,
  error,
  selectedRecommendation,
  onSelectRecommendation,
}) {
  return (
    <section className="card table-card">
      <h2>Recommendations</h2>

      {selectedUserId === null ? (
        <div className="empty-message">No user selected.</div>
      ) : loadingUserData ? (
        <div className="placeholder">Loading recommendations...</div>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : recommendations.length === 0 ? (
        <div className="empty-message">No recommendations found for this user.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Recommendation ID</th>
                <th>Station ID</th>
                <th>Time Slot</th>
                <th>Score</th>
                <th>Created At</th>
                <th>Model Type</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((recommendation) => {
                const isSelected =
                  selectedRecommendation?.recommendation_id ===
                  recommendation.recommendation_id

                return (
                  <tr
                    key={recommendation.recommendation_id}
                    className={isSelected ? 'selected-row' : ''}
                    onClick={() => onSelectRecommendation(recommendation)}
                  >
                    <td>{recommendation.recommendation_id}</td>
                    <td>{recommendation.station_id}</td>
                    <td>{formatDateTime(recommendation.recommendation_time_slot)}</td>
                    <td>{recommendation.score}</td>
                    <td>{formatDateTime(recommendation.createdAt)}</td>
                    <td>{recommendation.model_type}</td>
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
