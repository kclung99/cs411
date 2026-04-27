'use client'

import { useEffect, useState } from 'react'

async function requestJson(url, options = {}) {
  const response = await fetch(url, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = payload?.detail || `Request failed (${response.status})`
    throw new Error(detail)
  }
  return payload
}

function defaultCreateForm() {
  return {
    site_name: '',
    location: '',
    cluster_id: '',
  }
}

function toEditForm(site) {
  return {
    site_name: site.site_name ?? '',
    location: site.location ?? '',
    cluster_id: String(site.cluster_id ?? ''),
  }
}

export default function SiteManagementCard() {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [createForm, setCreateForm] = useState(defaultCreateForm)
  const [editingSiteId, setEditingSiteId] = useState(null)
  const [editForm, setEditForm] = useState(defaultCreateForm)
  const [submitting, setSubmitting] = useState(false)

  async function loadSites() {
    setLoading(true)
    setError(null)
    try {
      const rows = await requestJson('/api/sites')
      setSites(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sites.')
      setSites([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSites()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await requestJson('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      setCreateForm(defaultCreateForm())
      await loadSites()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create site.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(siteId) {
    const confirmed = window.confirm(`Delete site ${siteId}?`)
    if (!confirmed) return

    setSubmitting(true)
    setError(null)
    try {
      await requestJson(`/api/sites/${siteId}`, { method: 'DELETE' })
      if (editingSiteId === siteId) {
        setEditingSiteId(null)
        setEditForm(defaultCreateForm())
      }
      await loadSites()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete site.')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(site) {
    setEditingSiteId(site.site_id)
    setEditForm(toEditForm(site))
    setError(null)
  }

  function cancelEdit() {
    setEditingSiteId(null)
    setEditForm(defaultCreateForm())
  }

  async function handleSave(siteId) {
    setSubmitting(true)
    setError(null)
    try {
      await requestJson(`/api/sites/${siteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      setEditingSiteId(null)
      setEditForm(defaultCreateForm())
      await loadSites()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update site.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="card table-card">
      <h2>Site Management (CRUD)</h2>

      <form className="form-grid" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Site name"
          value={createForm.site_name}
          onChange={(e) => setCreateForm((prev) => ({ ...prev, site_name: e.target.value }))}
          disabled={submitting}
          required
        />
        <input
          type="text"
          placeholder="Location"
          value={createForm.location}
          onChange={(e) => setCreateForm((prev) => ({ ...prev, location: e.target.value }))}
          disabled={submitting}
          required
        />
        <input
          type="number"
          placeholder="Cluster ID"
          value={createForm.cluster_id}
          onChange={(e) => setCreateForm((prev) => ({ ...prev, cluster_id: e.target.value }))}
          disabled={submitting}
          required
        />
        <button type="submit" disabled={submitting}>
          Create Site
        </button>
      </form>

      {loading ? (
        <div className="placeholder">Loading sites...</div>
      ) : sites.length === 0 ? (
        <div className="empty-message">No sites found.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Site ID</th>
                <th>Site Name</th>
                <th>Location</th>
                <th>Cluster ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => {
                const isEditing = editingSiteId === site.site_id
                return (
                  <tr key={site.site_id}>
                    <td>{site.site_id}</td>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.site_name}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, site_name: e.target.value }))
                          }
                          disabled={submitting}
                          required
                        />
                      ) : (
                        site.site_name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.location}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, location: e.target.value }))
                          }
                          disabled={submitting}
                          required
                        />
                      ) : (
                        site.location
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.cluster_id}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, cluster_id: e.target.value }))
                          }
                          disabled={submitting}
                          required
                        />
                      ) : (
                        site.cluster_id
                      )}
                    </td>
                    <td>
                      <div className="button-row">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSave(site.site_id)}
                              disabled={submitting}
                            >
                              Save
                            </button>
                            <button type="button" onClick={cancelEdit} disabled={submitting}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => startEdit(site)} disabled={submitting}>
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(site.site_id)}
                              disabled={submitting}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {error ? <p className="error-message">{error}</p> : null}
    </section>
  )
}
