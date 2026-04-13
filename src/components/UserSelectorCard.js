function formatUserType(userType) {
  if (!userType) return ''
  return userType.charAt(0).toUpperCase() + userType.slice(1)
}

export default function UserSelectorCard({
  users,
  selectedUserId,
  onSelectUser,
  loadingUsers,
  error,
}) {
  return (
    <section className="card">
      <h2>Select User</h2>

      {loadingUsers ? (
        <div className="placeholder">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="empty-message">No users available.</div>
      ) : (
        <div className="selector-wrap">
          <label htmlFor="user-select">User</label>
          <select
            id="user-select"
            value={selectedUserId ?? ''}
            onChange={(e) => {
              const value = e.target.value
              onSelectUser(value === '' ? null : Number(value))
            }}
          >
            <option value="">Select a user</option>
            {users.map((user) => (
              <option key={user.user_id} value={user.user_id}>
                {`User ${user.user_id} — ${formatUserType(user.user_type)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {error ? <p className="error-message">{error}</p> : null}
    </section>
  )
}
