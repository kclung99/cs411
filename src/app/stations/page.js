'use client'

import { useEffect, useMemo, useState } from 'react'

import { DerivedLabel } from '@/components/derived-label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'

async function requestJson(url) {
  const response = await fetch(url)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.detail || `Request failed (${response.status})`)
  return payload
}

function formatDecimal(value, digits = 2) {
  const num = Number(value)
  return Number.isFinite(num) ? num.toFixed(digits) : '-'
}

function stationTone(status) {
  if (status === 'offline') {
    return {
      card: 'border-rose-200 bg-rose-50',
      badge: 'bg-rose-100 text-rose-800',
      label: 'offline',
    }
  }
  if (status === 'maintenance') {
    return {
      card: 'border-amber-200 bg-amber-50',
      badge: 'bg-amber-100 text-amber-800',
      label: 'maintenance',
    }
  }
  return {
    card: 'border-emerald-200 bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-800',
    label: 'active',
  }
}

function healthTone(label) {
  if (!['healthy', 'attention', 'danger'].includes(label)) {
    return {
      card: 'border-slate-200 bg-slate-50',
      badge: 'bg-slate-100 text-slate-700',
      label: 'unknown',
    }
  }
  if (label === 'danger') {
    return {
      card: 'border-pink-200 bg-pink-50',
      badge: 'bg-pink-100 text-pink-800',
      label: 'danger',
    }
  }
  if (label === 'attention') {
    return {
      card: 'border-violet-200 bg-violet-50',
      badge: 'bg-violet-100 text-violet-800',
      label: 'attention',
    }
  }
  return {
    card: 'border-sky-200 bg-sky-50',
    badge: 'bg-sky-100 text-sky-800',
    label: 'healthy',
  }
}

function statusCellClass(status) {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700'
  if (status === 'maintenance') return 'bg-amber-50 text-amber-700'
  if (status === 'offline') return 'bg-rose-50 text-rose-700'
  return 'bg-muted text-muted-foreground'
}

function reliabilityHealthClass(label) {
  if (label === 'healthy') return 'border-sky-200 border-l-4 border-l-sky-500 bg-slate-50 text-slate-900'
  if (label === 'attention') return 'border-violet-200 border-l-4 border-l-violet-500 bg-slate-50 text-slate-900'
  if (label === 'danger') return 'border-pink-200 border-l-4 border-l-pink-600 bg-slate-50 text-slate-900'
  return 'bg-muted text-muted-foreground'
}

export default function StationsPage() {
  const [stations, setStations] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [mapMode, setMapMode] = useState('status')
  const [selectedStationId, setSelectedStationId] = useState('')
  const [statusHistory, setStatusHistory] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [statusHistoryLoading, setStatusHistoryLoading] = useState(false)
  const [error, setError] = useState(null)

  const selectedStation = useMemo(
    () => stations.find((station) => station.station_id === selectedStationId) ?? null,
    [selectedStationId, stations],
  )

  const stationStats = useMemo(() => {
    return {
      total: stations.length,
      active: stations.filter((s) => s.latest_status === 'active').length,
      maintenance: stations.filter((s) => s.latest_status === 'maintenance').length,
      offline: stations.filter((s) => s.latest_status === 'offline').length,
    }
  }, [stations])

  const healthStats = useMemo(() => {
    return {
      healthy: stations.filter((s) => s.reliability_health_label === 'healthy').length,
      attention: stations.filter((s) => s.reliability_health_label === 'attention').length,
      danger: stations.filter((s) => s.reliability_health_label === 'danger').length,
    }
  }, [stations])

  async function evaluateStation(stationId) {
    if (!stationId) return
    setLoading(true)
    setError(null)
    requestJson(`/api/reliability/${encodeURIComponent(stationId)}`)
      .then((payload) => setResult(payload))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to evaluate station reliability.'))
      .finally(() => setLoading(false))
  }

  async function loadStatusHistory(stationId) {
    if (!stationId) {
      setStatusHistory([])
      return
    }

    setStatusHistoryLoading(true)
    requestJson(`/api/stations/${encodeURIComponent(stationId)}/status-history`)
      .then((rows) => setStatusHistory(rows))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load station status history.'))
      .finally(() => setStatusHistoryLoading(false))
  }

  function selectStation(stationId) {
    setSelectedStationId(stationId)
    evaluateStation(stationId)
    loadStatusHistory(stationId)
  }

  useEffect(() => {
    let cancelled = false

    requestJson('/api/stations/overview')
      .then((stationRows) => {
        if (cancelled) return
        setStations(stationRows)

        const firstStationId = stationRows[0]?.station_id || ''
        setSelectedStationId(firstStationId)
        if (firstStationId) {
          evaluateStation(firstStationId)
          loadStatusHistory(firstStationId)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load stations.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="space-y-6 p-4 md:p-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Station Status Console</h2>
        <p className="text-sm text-muted-foreground">Review station status, inspect reliability risk metrics, and drill into station-level maintenance context.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={activeTab === 'overview' ? 'default' : 'outline'} onClick={() => setActiveTab('overview')}>
          Overview
        </Button>
        <Button variant={activeTab === 'station' ? 'default' : 'outline'} onClick={() => setActiveTab('station')}>
          Station Detail
        </Button>
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button variant={mapMode === 'status' ? 'default' : 'outline'} size="sm" onClick={() => setMapMode('status')}>
              Live Status View
            </Button>
            <Button variant={mapMode === 'health' ? 'default' : 'outline'} size="sm" onClick={() => setMapMode('health')}>
              Reliability Health View
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Stations</p>
                <p className="mt-1 text-2xl font-semibold">{stationStats.total}</p>
              </CardContent>
            </Card>

            {mapMode === 'status' ? (
              <>
                <Card className="border-emerald-200 bg-emerald-50 text-emerald-800">
                  <CardContent className="p-4">
                    <p className="text-xs opacity-80">
                      <DerivedLabel
                        label="Active"
                        tooltip="Count of stations whose latest StationStatus row has status = active."
                      />
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{stationStats.active}</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200 bg-amber-50 text-amber-800">
                  <CardContent className="p-4">
                    <p className="text-xs opacity-80">
                      <DerivedLabel
                        label="Maintenance"
                        tooltip="Count of stations whose latest StationStatus row has status = maintenance."
                      />
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{stationStats.maintenance}</p>
                  </CardContent>
                </Card>
                <Card className="border-rose-200 bg-rose-50 text-rose-800">
                  <CardContent className="p-4">
                    <p className="text-xs opacity-80">
                      <DerivedLabel
                        label="Offline"
                        tooltip="Count of stations whose latest StationStatus row has status = offline."
                      />
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{stationStats.offline}</p>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <Card className="border-sky-200 bg-sky-50 text-sky-800">
                  <CardContent className="p-4">
                    <p className="text-xs opacity-80">
                      <DerivedLabel
                        label="Healthy"
                        tooltip="Count of stations with derived reliability health = healthy."
                      />
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{healthStats.healthy}</p>
                  </CardContent>
                </Card>
                <Card className="border-violet-200 bg-violet-50 text-violet-800">
                  <CardContent className="p-4">
                    <p className="text-xs opacity-80">
                      <DerivedLabel
                        label="Attention"
                        tooltip="Count of stations with derived reliability health = attention."
                      />
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{healthStats.attention}</p>
                  </CardContent>
                </Card>
                <Card className="border-pink-200 bg-pink-50 text-pink-800">
                  <CardContent className="p-4">
                    <p className="text-xs opacity-80">
                      <DerivedLabel
                        label="Danger"
                        tooltip="Count of stations with derived reliability health = danger."
                      />
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{healthStats.danger}</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                <DerivedLabel
                  label={mapMode === 'status' ? 'Station Status Map' : 'Station Health Map'}
                  tooltip={
                    mapMode === 'status'
                      ? 'Visual grouping by latest StationStatus row (active, maintenance, offline).'
                      : 'Visual grouping by derived reliability_health_label (healthy, attention, danger).'
                  }
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {stations.map((station) => {
                const tone = mapMode === 'status' ? stationTone(station.latest_status) : healthTone(station.reliability_health_label)
                const isSelected = station.station_id === selectedStationId

                return (
                  <button
                    type="button"
                    key={station.station_id}
                    onClick={() => {
                      selectStation(station.station_id)
                      setActiveTab('station')
                    }}
                    className={cn(
                      'rounded-md border p-4 text-left transition hover:shadow-sm',
                      tone.card,
                      isSelected && 'ring-2 ring-primary',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{station.station_name}</p>
                      <span className={cn('rounded px-2 py-0.5 text-xs font-medium', tone.badge)}>{tone.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{station.location_label}</p>
                    {mapMode === 'status' ? (
                      <>
                        <p className="mt-2 text-xs">
                          <span className="font-medium">Live status:</span> {station.latest_status || 'unknown'}
                        </p>
                        <p className="mt-1 text-xs">
                          <span className="font-medium">Health:</span> {station.reliability_health_label || '-'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-2 text-xs">
                          <span className="font-medium">Health:</span> {station.reliability_health_label || 'unknown'}
                        </p>
                        <p className="mt-1 text-xs">
                          <span className="font-medium">Live status:</span> {station.latest_status || '-'}
                        </p>
                      </>
                    )}
                    <p className="mt-1 text-xs">
                      <span className="font-medium">Open tickets:</span> {station.open_ticket_count}
                    </p>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Selected Station</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <label htmlFor="station-select" className="text-sm font-medium">
                  Station
                </label>
                <select
                  id="station-select"
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={selectedStationId}
                  onChange={(e) => selectStation(e.target.value)}
                >
                  {stations.map((station) => (
                    <option key={`station-option-${station.station_id}`} value={station.station_id}>
                      {station.station_name} ({station.station_id})
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {selectedStation ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Station Detail</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Name:</span> {selectedStation.station_name}
                  </p>
                  <p>
                    <span className="font-medium">Station ID:</span> {selectedStation.station_id}
                  </p>
                  <p>
                    <span className="font-medium">Location:</span> {selectedStation.location_label}
                  </p>
                  <p>
                    <span className="font-medium">Latest Status:</span> {selectedStation.latest_status || '-'}
                  </p>
                  <p>
                    <span className="font-medium">Latest Status Time:</span> {formatTimestamp(selectedStation.latest_status_time)}
                  </p>
                  <p>
                    <span className="font-medium">Reliability Health:</span>{' '}
                    <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize', healthTone(selectedStation.reliability_health_label).badge)}>
                      {selectedStation.reliability_health_label || '-'}
                    </span>
                  </p>
                  <p>
                    <span className="font-medium">
                      <DerivedLabel
                        label="Open Tickets"
                        tooltip="Count of linked MaintenanceTicket rows where status is open or in_progress."
                      />
                      :
                    </span>{' '}
                    {selectedStation.open_ticket_count}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Reliability Metrics</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  <div className={cn('rounded-md border p-3', reliabilityHealthClass(result?.reliability_health_label))}>
                    <p className="text-xs text-muted-foreground">
                      <DerivedLabel
                        label="Reliability Health"
                        tooltip="Derived risk tier (healthy/attention/danger) from open tickets, issue status count, fulfillment, and idle-time thresholds. This is separate from live station status."
                      />
                    </p>
                    <p className="mt-1 text-lg font-semibold capitalize">
                      {result?.reliability_health_label || (loading ? 'loading...' : '-')}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs opacity-80">
                      <DerivedLabel
                        label="Open Tickets"
                        tooltip="Count of MaintenanceTicket rows where ticket_status is open or in_progress for this station."
                      />
                    </p>
                    <p className="mt-1 text-lg font-semibold">{result?.open_ticket_count ?? '-'}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">
                      <DerivedLabel
                        label="Reliability Rank"
                        tooltip="Window-function rank across stations ordered by open tickets, issue statuses, fulfillment, and idle time."
                      />
                    </p>
                    <p className="mt-1 text-lg font-semibold">{result?.reliability_rank ? `#${result.reliability_rank}` : '-'}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">
                      <DerivedLabel
                        label="Avg Fulfillment"
                        tooltip="AVG(ChargingSession.energy_kwh / ChargingRequest.kwh_requested) for the station."
                      />
                    </p>
                    <p className="mt-1 text-lg font-semibold">{formatDecimal(result?.avg_fulfillment_rate, 3)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">
                      <DerivedLabel
                        label="Avg Idle Minutes"
                        tooltip="AVG(TIMESTAMPDIFF(MINUTE, done_charging_time, disconnect_time)) for station sessions."
                      />
                    </p>
                    <p className="mt-1 text-lg font-semibold">{formatDecimal(result?.avg_idle_minutes, 1)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">
                      <DerivedLabel
                        label="Issue Status Count"
                        tooltip="Count of StationStatus rows where status is offline or maintenance for the station."
                      />
                    </p>
                    <p className="mt-1 text-lg font-semibold">{result?.issue_status_count ?? '-'}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">
                      <DerivedLabel
                        label="Sessions"
                        tooltip="Count of ChargingSession rows linked to this station."
                      />
                    </p>
                    <p className="mt-1 text-lg font-semibold">{result?.session_count ?? '-'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {selectedStation ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <DerivedLabel
                    label="Station Status History"
                    tooltip="Recent StationStatus rows for the selected station, ordered by reported_at DESC."
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reported At</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statusHistory.map((row) => (
                      <TableRow key={`status-row-${row.status_id}`}>
                        <TableCell>{row.status_id}</TableCell>
                        <TableCell>
                          <span className={cn('inline-flex rounded px-2 py-1 text-xs', statusCellClass(row.status))}>
                            {row.status}
                          </span>
                        </TableCell>
                        <TableCell>{formatTimestamp(row.reported_at)}</TableCell>
                        <TableCell>{row.note}</TableCell>
                      </TableRow>
                    ))}
                    {statusHistoryLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground">
                          Loading station status history...
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {!statusHistoryLoading && statusHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground">
                          No status reports found for this station.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {error ? <Card className="border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</Card> : null}
    </main>
  )
}
