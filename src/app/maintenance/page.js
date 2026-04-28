'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { DerivedLabel } from '@/components/derived-label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatTimestamp } from '@/lib/format'
import { isStationNeedsAttention, stationStatusWeight } from '@/lib/station-state'
import { cn } from '@/lib/utils'

const PRIORITIES = ['low', 'medium', 'high']
const EDIT_TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed']
const STATION_STATUSES = ['active', 'offline', 'maintenance']

async function requestJson(url, options = {}) {
  const response = await fetch(url, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.detail || `Request failed (${response.status})`)
  return payload
}

function ticketStatusClass(status) {
  if (status === 'resolved' || status === 'closed') return 'bg-emerald-50 text-emerald-700'
  if (status === 'in_progress') return 'bg-amber-50 text-amber-700'
  return 'bg-rose-50 text-rose-700'
}

function priorityClass(priority) {
  if (priority === 'high') return 'bg-rose-50 text-rose-700'
  if (priority === 'medium') return 'bg-sky-50 text-sky-700'
  return 'bg-muted text-muted-foreground'
}

function issueTypeClass(issueType) {
  if (issueType === 'offline') return 'bg-rose-50 text-rose-700'
  if (issueType === 'maintenance') return 'bg-amber-50 text-amber-700'
  if (issueType === 'inspection') return 'bg-sky-50 text-sky-700'
  if (issueType === 'hardware_issue') return 'bg-orange-50 text-orange-700'
  return 'bg-muted text-muted-foreground'
}

function formatIssueType(issueType) {
  return String(issueType).replaceAll('_', ' ')
}

export default function MaintenancePage() {
  const [stations, setStations] = useState([])
  const [tickets, setTickets] = useState([])
  const [statusForm, setStatusForm] = useState({ station_id: '', status: 'active', note: '' })
  const [ticketForm, setTicketForm] = useState({ priority: 'medium', description: '' })
  const [activeTab, setActiveTab] = useState('ticket')
  const [insightStationId, setInsightStationId] = useState('')
  const [editingTickets, setEditingTickets] = useState({})
  const [triggerNotice, setTriggerNotice] = useState(null)
  const [lastResolution, setLastResolution] = useState(null)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resolvingTicketId, setResolvingTicketId] = useState(null)

  const autosaveTimersRef = useRef({})
  const autosaveVersionRef = useRef({})

  const queueStats = useMemo(() => {
    return {
      open: tickets.filter((ticket) => ticket.ticket_status === 'open').length,
      inProgress: tickets.filter((ticket) => ticket.ticket_status === 'in_progress').length,
      highPriority: tickets.filter((ticket) => ticket.priority === 'high').length,
      resolved: tickets.filter((ticket) => ['resolved', 'closed'].includes(ticket.ticket_status)).length,
    }
  }, [tickets])

  const activeQueue = useMemo(
    () => tickets.filter((ticket) => ['open', 'in_progress'].includes(ticket.ticket_status)),
    [tickets],
  )

  const selectedInsightStation = useMemo(
    () => stations.find((station) => station.station_id === insightStationId) ?? null,
    [insightStationId, stations],
  )

  const selectedInsightStationTickets = useMemo(() => {
    if (!insightStationId) return []
    return tickets
      .filter((ticket) => ticket.station_id === insightStationId)
      .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
      .slice(0, 10)
  }, [insightStationId, tickets])

  const attentionStations = useMemo(() => {
    return [...stations]
      .filter((station) => isStationNeedsAttention(station.latest_status, station.open_ticket_count))
      .sort((a, b) => {
        const scoreA = stationStatusWeight(a.latest_status) * 100 + Number(a.open_ticket_count || 0)
        const scoreB = stationStatusWeight(b.latest_status) * 100 + Number(b.open_ticket_count || 0)
        if (scoreA !== scoreB) return scoreB - scoreA
        return String(a.station_name).localeCompare(String(b.station_name))
      })
      .slice(0, 12)
  }, [stations])

  async function loadData() {
    const [stationsRows, ticketRows] = await Promise.all([requestJson('/api/stations/overview'), requestJson('/api/tickets')])
    setStations(stationsRows)
    setTickets(ticketRows)
    return { stationsRows, ticketRows }
  }

  useEffect(() => {
    let cancelled = false

    loadData()
      .then(({ stationsRows }) => {
        if (cancelled || stationsRows.length === 0) return

        setStatusForm((prev) => ({
          ...prev,
          station_id:
            prev.station_id && stationsRows.some((station) => station.station_id === prev.station_id)
              ? prev.station_id
              : stationsRows[0].station_id,
        }))

        setInsightStationId((prev) =>
          prev && stationsRows.some((station) => station.station_id === prev) ? prev : stationsRows[0].station_id,
        )
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load maintenance data.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () => () => {
      Object.values(autosaveTimersRef.current).forEach((timer) => window.clearTimeout(timer))
    },
    [],
  )

  useEffect(() => {
    if (!lastResolution) return
    const timer = window.setTimeout(() => setLastResolution(null), 7000)
    return () => window.clearTimeout(timer)
  }, [lastResolution])

  function stationOpenCount(stationRows, stationId) {
    return Number(stationRows.find((station) => station.station_id === stationId)?.open_ticket_count || 0)
  }

  function getTicketDraft(ticket) {
    return editingTickets[ticket.ticket_id] ?? {
      priority: ticket.priority,
      ticket_status: ticket.ticket_status,
      description: ticket.description,
    }
  }

  function cancelTicketAutosave(ticketId) {
    if (autosaveTimersRef.current[ticketId]) {
      window.clearTimeout(autosaveTimersRef.current[ticketId])
      delete autosaveTimersRef.current[ticketId]
    }
    autosaveVersionRef.current[ticketId] = (autosaveVersionRef.current[ticketId] || 0) + 1
  }

  async function persistTicketDraft(ticketId, draft, version) {
    try {
      await requestJson(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })

      if (autosaveVersionRef.current[ticketId] !== version) return

      setEditingTickets((prev) => {
        const next = { ...prev }
        delete next[ticketId]
        return next
      })

      await loadData()
    } catch (err) {
      if (autosaveVersionRef.current[ticketId] !== version) return
      setError(err instanceof Error ? err.message : `Failed to auto-save ticket ${ticketId}.`)
    }
  }

  function scheduleTicketAutosave(ticketId, draft) {
    if (autosaveTimersRef.current[ticketId]) {
      window.clearTimeout(autosaveTimersRef.current[ticketId])
    }

    const version = (autosaveVersionRef.current[ticketId] || 0) + 1
    autosaveVersionRef.current[ticketId] = version

    autosaveTimersRef.current[ticketId] = window.setTimeout(() => {
      delete autosaveTimersRef.current[ticketId]
      persistTicketDraft(ticketId, draft, version)
    }, 500)
  }

  function updateTicketDraft(ticket, patch) {
    const currentDraft = getTicketDraft(ticket)
    const nextDraft = { ...currentDraft, ...patch }

    setEditingTickets((prev) => ({
      ...prev,
      [ticket.ticket_id]: nextDraft,
    }))

    setTickets((prev) =>
      prev.map((row) => (row.ticket_id === ticket.ticket_id ? { ...row, ...nextDraft } : row)),
    )

    scheduleTicketAutosave(ticket.ticket_id, nextDraft)
  }

  function handleTabChange(nextTab) {
    setActiveTab(nextTab)
    loadData().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to refresh maintenance data.')
    })
  }

  async function submitIncident(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    setTriggerNotice(null)

    try {
      const stationId = statusForm.station_id
      const previousOpenCount = stationOpenCount(stations, stationId)
      const shouldCreateTicket = statusForm.status === 'offline' || statusForm.status === 'maintenance'

      const statusPayload = await requestJson('/api/station-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...statusForm,
          ticket_priority: shouldCreateTicket ? ticketForm.priority : null,
          ticket_description: shouldCreateTicket ? ticketForm.description : null,
        }),
      })

      const { stationsRows } = await loadData()
      const nextOpenCount = stationOpenCount(stationsRows, stationId)

      setMessage(statusPayload.detail)
      setStatusForm((prev) => ({ ...prev, note: '' }))
      if (shouldCreateTicket) {
        setTicketForm((prev) => ({ ...prev, description: '' }))
      }
      setActiveTab('ticket')

      if (nextOpenCount > previousOpenCount) {
        const createdCount = nextOpenCount - previousOpenCount
        setTriggerNotice(
          `Trigger signal: ${createdCount} new open ticket${createdCount > 1 ? 's were' : ' was'} created for station ${stationId}.`,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit routine check.')
    } finally {
      setLoading(false)
    }
  }

  async function resolveTicket(ticketId) {
    cancelTicketAutosave(ticketId)
    setResolvingTicketId(ticketId)
    setError(null)
    setMessage(null)

    try {
      const payload = await requestJson(`/api/tickets/${ticketId}/resolve`, { method: 'POST' })
      setMessage(payload.detail)
      setLastResolution(payload)
      setTriggerNotice(
        `Transaction signal: resolved ticket ${ticketId}, station ${payload.station_id} moved to ${payload.inserted_status}.`,
      )
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to resolve ticket ${ticketId}.`)
    } finally {
      setResolvingTicketId(null)
    }
  }

  async function deleteTicket(ticketId) {
    if (!window.confirm(`Delete ticket ${ticketId}?`)) return
    cancelTicketAutosave(ticketId)

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const payload = await requestJson(`/api/tickets/${ticketId}`, { method: 'DELETE' })
      setMessage(payload.detail)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete ticket.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="space-y-6 p-4 md:p-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Routine Operations</h2>
        <p className="text-sm text-muted-foreground">
          Run routine station check-ins, log issues when needed, manage ticket queue, and execute resolution transactions.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-rose-200 bg-rose-50 text-rose-800">
          <CardContent className="p-4">
            <p className="text-xs opacity-80">
              <DerivedLabel
                label="Open Tickets"
                tooltip="Count of ticket rows where ticket_status = open."
              />
            </p>
            <p className="mt-1 text-2xl font-semibold">{queueStats.open}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50 text-amber-800">
          <CardContent className="p-4">
            <p className="text-xs opacity-80">
              <DerivedLabel
                label="In Progress"
                tooltip="Count of ticket rows where ticket_status = in_progress."
              />
            </p>
            <p className="mt-1 text-2xl font-semibold">{queueStats.inProgress}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50 text-orange-800">
          <CardContent className="p-4">
            <p className="text-xs opacity-80">
              <DerivedLabel
                label="High Priority"
                tooltip="Count of ticket rows where priority = high."
              />
            </p>
            <p className="mt-1 text-2xl font-semibold">{queueStats.highPriority}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <CardContent className="p-4">
            <p className="text-xs opacity-80">
              <DerivedLabel
                label="Resolved / Closed"
                tooltip="Count of ticket rows where ticket_status is resolved or closed."
              />
            </p>
            <p className="mt-1 text-2xl font-semibold">{queueStats.resolved}</p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant={activeTab === 'station' ? 'default' : 'outline'} onClick={() => handleTabChange('station')}>
            Station View
          </Button>
          <Button variant={activeTab === 'ticket' ? 'default' : 'outline'} onClick={() => handleTabChange('ticket')}>
            Ticket View
          </Button>
          <Button variant={activeTab === 'report' ? 'default' : 'outline'} onClick={() => handleTabChange('report')}>
            Check-In Form
          </Button>
        </div>

        {triggerNotice ? (
          <Card className="border-emerald-200 bg-emerald-50 text-emerald-800">
            <CardContent className="p-4 text-sm font-medium">{triggerNotice}</CardContent>
          </Card>
        ) : null}

        {activeTab === 'ticket' ? (
          <Card>
            <CardHeader>
              <CardTitle>
                <DerivedLabel
                  label="Active Queue"
                  tooltip="Subset of tickets filtered to ticket_status in (open, in_progress)."
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Ticket Status</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeQueue.map((ticket) => {
                    const draft = getTicketDraft(ticket)
                    const isResolved = ['resolved', 'closed'].includes(draft.ticket_status)

                    return (
                      <TableRow key={ticket.ticket_id}>
                        <TableCell>
                          <div className="min-w-[220px] space-y-1">
                            <p className="font-medium leading-5">{ticket.station_name}</p>
                            <p className="text-xs text-muted-foreground">#{ticket.ticket_id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={cn('inline-flex rounded px-2 py-1 text-xs font-medium', issueTypeClass(ticket.issue_type))}>
                            {formatIssueType(ticket.issue_type)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 min-w-[280px]"
                            value={draft.description}
                            onChange={(e) => updateTicketDraft(ticket, { description: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <select
                            className={cn('h-8 w-24 rounded border bg-transparent px-2 text-xs', priorityClass(draft.priority))}
                            value={draft.priority}
                            onChange={(e) => updateTicketDraft(ticket, { priority: e.target.value })}
                          >
                            {PRIORITIES.map((priority) => (
                              <option key={`${ticket.ticket_id}-priority-${priority}`} value={priority}>
                                {priority}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          <select
                            className={cn('h-8 w-28 rounded border bg-transparent px-2 text-xs', ticketStatusClass(draft.ticket_status))}
                            value={draft.ticket_status}
                            onChange={(e) => updateTicketDraft(ticket, { ticket_status: e.target.value })}
                          >
                            {EDIT_TICKET_STATUSES.map((ticketStatus) => (
                              <option key={`${ticket.ticket_id}-status-${ticketStatus}`} value={ticketStatus}>
                                {ticketStatus}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatTimestamp(ticket.opened_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex min-w-[170px] flex-nowrap items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={isResolved || resolvingTicketId === ticket.ticket_id}
                              onClick={() => resolveTicket(ticket.ticket_id)}
                            >
                              Resolve
                            </Button>
                            <Button type="button" size="sm" variant="destructive" disabled={loading} onClick={() => deleteTicket(ticket.ticket_id)}>
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {activeQueue.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground">
                        No open/in-progress tickets.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : activeTab === 'station' ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <DerivedLabel
                    label="Attention Queue"
                    tooltip="Stations where latest status is offline/maintenance OR open_ticket_count > 0, ranked by status severity then open tickets."
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Station</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Open</TableHead>
                      <TableHead>Latest</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attentionStations.map((station) => (
                      <TableRow key={`attention-${station.station_id}`}>
                        <TableCell>{station.station_name}</TableCell>
                        <TableCell>{station.latest_status}</TableCell>
                        <TableCell>{station.open_ticket_count}</TableCell>
                        <TableCell>{formatTimestamp(station.latest_status_time)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setInsightStationId(station.station_id)}
                          >
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {attentionStations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground">
                          No station rows available.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-3">
                <CardTitle>Selected Station Tickets</CardTitle>
                <div className="space-y-1">
                  <label htmlFor="insight-station-select" className="text-sm font-medium">
                    Station
                  </label>
                  <select
                    id="insight-station-select"
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    value={insightStationId}
                    onChange={(e) => setInsightStationId(e.target.value)}
                  >
                    {stations.map((station) => (
                      <option key={`insight-${station.station_id}`} value={station.station_id}>
                        {station.station_name} ({station.station_id})
                      </option>
                    ))}
                  </select>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedInsightStation ? (
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p>
                      <span className="font-medium">Status:</span> {selectedInsightStation.latest_status}
                    </p>
                    <p>
                      <span className="font-medium">Latest:</span> {formatTimestamp(selectedInsightStation.latest_status_time)}
                    </p>
                    <p>
                      <span className="font-medium">
                        <DerivedLabel
                          label="Open Tickets"
                          tooltip="Count of linked MaintenanceTicket rows where status is open or in_progress."
                        />
                        :
                      </span>{' '}
                      {selectedInsightStation.open_ticket_count}
                    </p>
                    <p>
                      <span className="font-medium">Location:</span> {selectedInsightStation.location_label}
                    </p>
                  </div>
                ) : null}

                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Ticket Status</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInsightStationTickets.map((ticket) => {
                      const draft = getTicketDraft(ticket)
                      const isResolved = ['resolved', 'closed'].includes(draft.ticket_status)

                      return (
                        <TableRow key={`insight-ticket-${ticket.ticket_id}`}>
                          <TableCell>
                            <div className="min-w-[140px] space-y-1">
                              <p className="text-xs text-muted-foreground">#{ticket.ticket_id}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={cn('inline-flex rounded px-2 py-1 text-xs font-medium', issueTypeClass(ticket.issue_type))}>
                              {formatIssueType(ticket.issue_type)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 min-w-[280px]"
                              value={draft.description}
                              onChange={(e) => updateTicketDraft(ticket, { description: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <select
                              className={cn('h-8 w-24 rounded border bg-transparent px-2 text-xs', priorityClass(draft.priority))}
                              value={draft.priority}
                              onChange={(e) => updateTicketDraft(ticket, { priority: e.target.value })}
                            >
                              {PRIORITIES.map((priority) => (
                                <option key={`${ticket.ticket_id}-station-priority-${priority}`} value={priority}>
                                  {priority}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            <select
                              className={cn('h-8 w-28 rounded border bg-transparent px-2 text-xs', ticketStatusClass(draft.ticket_status))}
                              value={draft.ticket_status}
                              onChange={(e) => updateTicketDraft(ticket, { ticket_status: e.target.value })}
                            >
                              {EDIT_TICKET_STATUSES.map((ticketStatus) => (
                                <option key={`${ticket.ticket_id}-station-status-${ticketStatus}`} value={ticketStatus}>
                                  {ticketStatus}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{formatTimestamp(ticket.opened_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex min-w-[170px] flex-nowrap items-center justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={isResolved || resolvingTicketId === ticket.ticket_id}
                                onClick={() => resolveTicket(ticket.ticket_id)}
                              >
                                Resolve
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={loading}
                                onClick={() => deleteTicket(ticket.ticket_id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {selectedInsightStationTickets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-muted-foreground">
                          No tickets found for this station.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Station Check-In</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={submitIncident}>
                  <div className="space-y-1">
                    <label htmlFor="status-station" className="text-sm font-medium">
                      Station
                    </label>
                    <select
                      id="status-station"
                      className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                      value={statusForm.station_id}
                      onChange={(e) => setStatusForm((prev) => ({ ...prev, station_id: e.target.value }))}
                      required
                    >
                      {stations.map((station) => (
                        <option key={`status-station-${station.station_id}`} value={station.station_id}>
                          {station.station_name} ({station.station_id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="station-status" className="text-sm font-medium">
                      Status
                    </label>
                    <select
                      id="station-status"
                      className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                      value={statusForm.status}
                      onChange={(e) => setStatusForm((prev) => ({ ...prev, status: e.target.value }))}
                    >
                      {STATION_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="status-note" className="text-sm font-medium">
                      Check Note
                    </label>
                    <Input
                      id="status-note"
                      placeholder="Describe what you observed (normal or issue)"
                      value={statusForm.note}
                      onChange={(e) => setStatusForm((prev) => ({ ...prev, note: e.target.value }))}
                      required
                    />
                  </div>

                  {statusForm.status === 'offline' || statusForm.status === 'maintenance' ? (
                    <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-medium">Ticket Details</p>
                      <p className="text-xs text-muted-foreground">
                        Additional ticket fields are shown because this status needs follow-up maintenance.
                      </p>
                      <div className="space-y-1">
                        <label htmlFor="ticket-priority" className="text-sm font-medium">
                          Priority
                        </label>
                        <select
                          id="ticket-priority"
                          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                          value={ticketForm.priority}
                          onChange={(e) => setTicketForm((prev) => ({ ...prev, priority: e.target.value }))}
                        >
                          {PRIORITIES.map((priority) => (
                            <option key={priority} value={priority}>
                              {priority}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="ticket-description" className="text-sm font-medium">
                          Description
                        </label>
                        <Input
                          id="ticket-description"
                          placeholder="Describe the issue"
                          value={ticketForm.description}
                          onChange={(e) => setTicketForm((prev) => ({ ...prev, description: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                  ) : null}

                  <Button disabled={loading || stations.length === 0}>
                    {statusForm.status === 'offline' || statusForm.status === 'maintenance'
                      ? 'Submit Check-In + Create Ticket'
                      : 'Submit Check-In'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Status submissions for offline/maintenance create trigger-generated tickets automatically.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {message ? <Card className="p-4 text-sm">{message}</Card> : null}
        {error ? <Card className="border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</Card> : null}
      </section>

      {lastResolution ? (
        <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,440px)]">
          <Card className="border-emerald-300 bg-emerald-50 shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base text-emerald-900">Ticket Resolved</CardTitle>
                <Button type="button" size="sm" variant="outline" onClick={() => setLastResolution(null)}>
                  Dismiss
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-emerald-900">
              <p>
                <span className="font-medium">Station:</span> {lastResolution.station_name} ({lastResolution.station_id})
              </p>
              <p>
                <span className="font-medium">Inserted status:</span> {lastResolution.inserted_status}
              </p>
              <p>
                <span className="font-medium">Remaining open tickets:</span> {lastResolution.remaining_open_tickets}
              </p>
              <p>
                <span className="font-medium">Recent fulfillment (30d):</span>{' '}
                {lastResolution.recent_fulfillment_rate === null
                  ? '-'
                  : Number(lastResolution.recent_fulfillment_rate).toFixed(3)}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  )
}
