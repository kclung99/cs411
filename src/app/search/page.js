'use client'

import { useState } from 'react'

async function requestJson(url) {
  const response = await fetch(url)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = payload?.detail || `Request failed (${response.status})`
    throw new Error(detail)
  }
  return payload
}

export default function SearchPage() {
  const [keyword, setKeyword] = useState('')
  const [lastKeyword, setLastKeyword] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = keyword.trim()
    if (!trimmed) {
      setError('Enter a keyword to search.')
      setResults([])
      setLastKeyword('')
      return
    }

    setLoading(true)
    setError(null)
    setLastKeyword(trimmed)

    try {
      const rows = await requestJson(`/api/search/sites?keyword=${encodeURIComponent(trimmed)}`)
      setResults(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run keyword search.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="dashboard-page">
      <header className="card header-card">
        <h1>Keyword Search</h1>
        <p>Search sites by name or location with station and recommendation context.</p>
      </header>

      <section className="card table-card">
        <h2>Site Search</h2>

        <form className="search-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Keyword (e.g. Pasadena, Downtown, Garage)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={loading}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {loading ? <div className="placeholder">Running search...</div> : null}

        {!loading && lastKeyword && results.length === 0 && !error ? (
          <div className="empty-message">No matches for &quot;{lastKeyword}&quot;.</div>
        ) : null}

        {!loading && results.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Site ID</th>
                  <th>Site Name</th>
                  <th>Location</th>
                  <th>Cluster</th>
                  <th>Stations</th>
                  <th>Recommendations</th>
                  <th>Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr key={row.site_id}>
                    <td>{row.site_id}</td>
                    <td>{row.site_name}</td>
                    <td>{row.location}</td>
                    <td>{row.cluster_id}</td>
                    <td>{row.station_count}</td>
                    <td>{row.recommendation_count}</td>
                    <td>{row.avg_recommendation_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {error ? <p className="error-message">{error}</p> : null}
      </section>
    </main>
  )
}
