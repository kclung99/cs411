export default function UserSummaryCard({
  selectedUser,
  selectedUserId,
  loadingUserData,
  error,
}) {
  return (
    <section className="card">
      <h2>User Summary</h2>

      {selectedUserId === null ? (
        <div className="empty-message">No user selected.</div>
      ) : loadingUserData ? (
        <div className="placeholder">Loading user summary...</div>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : selectedUser ? (
        <div className="summary-grid">
          <div className="summary-item">
            <span className="label">User ID</span>
            <span className="value">{selectedUser.user_id}</span>
          </div>
          <div className="summary-item">
            <span className="label">User Type</span>
            <span className="value">{selectedUser.user_type}</span>
          </div>
          <div className="summary-item">
            <span className="label">Registration Date</span>
            <span className="value">{selectedUser.registration_date}</span>
          </div>
        </div>
      ) : (
        <p className="error-message">Failed to load user summary.</p>
      )}
    </section>
  )
}
