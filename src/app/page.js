'use client'

import { useEffect, useState } from 'react'

import { DerivedLabel } from '@/components/derived-label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

async function requestJson(url) {
  const response = await fetch(url)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.detail || `Request failed (${response.status})`)
  return payload
}

function formatMetric(value, loading) {
  if (loading) return '...'
  return Number(value || 0).toLocaleString()
}

export default function OverviewPage() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    requestJson('/api/dashboard/summary')
      .then((payload) => {
        if (cancelled) return
        setSummary(payload)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load dashboard summary.')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const userChargingMetrics = [
    { key: 'total_users', label: 'Users', tooltip: 'COUNT(*) FROM `User`.' },
    { key: 'total_requests', label: 'Charging Requests', tooltip: 'COUNT(*) FROM ChargingRequest.' },
    { key: 'total_sessions', label: 'Charging Sessions', tooltip: 'COUNT(*) FROM ChargingSession.' },
    {
      key: 'total_energy_kwh',
      label: 'Energy Delivered (kWh)',
      tooltip: 'SUM(ChargingSession.energy_kwh), rounded to 2 decimals.',
    },
  ]

  const stationOverviewMetrics = [
    {
      key: 'total_stations',
      label: 'Total Stations',
      tooltip: 'COUNT(*) FROM Station.',
      className: '',
    },
    {
      key: 'total_status_reports',
      label: 'Status Reports Logged',
      tooltip: 'COUNT(*) FROM StationStatus.',
      className: 'border-slate-200 bg-slate-50 text-slate-800',
    },
  ]

  const stationStatusMetrics = [
    {
      key: 'active_stations',
      label: 'Active Stations',
      tooltip: 'Count of stations whose latest StationStatus row has status = active.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    },
    {
      key: 'maintenance_stations',
      label: 'Maintenance Stations',
      tooltip: 'Count of stations whose latest StationStatus row has status = maintenance.',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    },
    {
      key: 'offline_stations',
      label: 'Offline Stations',
      tooltip: 'Count of stations whose latest StationStatus row has status = offline.',
      className: 'border-rose-200 bg-rose-50 text-rose-800',
    },
  ]

  const ticketQueueMetrics = [
    {
      key: 'total_tickets',
      label: 'Total Tickets',
      tooltip: 'COUNT(*) FROM MaintenanceTicket.',
      className: '',
    },
    {
      key: 'open_tickets',
      label: 'Open Tickets',
      tooltip: 'COUNT(*) FROM MaintenanceTicket WHERE ticket_status = open.',
      className: 'border-rose-200 bg-rose-50 text-rose-800',
    },
    {
      key: 'in_progress_tickets',
      label: 'In Progress Tickets',
      tooltip: 'COUNT(*) FROM MaintenanceTicket WHERE ticket_status = in_progress.',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    },
    {
      key: 'resolved_closed_tickets',
      label: 'Resolved / Closed',
      tooltip: 'COUNT(*) FROM MaintenanceTicket WHERE ticket_status IN (resolved, closed).',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    },
  ]

  return (
    <main className="space-y-6 p-4 md:p-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Operations Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          High-level aggregates grouped by domain: users and charging activity, station status, and ticket queue.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Users & Charging</h3>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {userChargingMetrics.map((metric) => (
            <Card key={metric.key}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  <DerivedLabel label={metric.label} tooltip={metric.tooltip} />
                </p>
                <p className="mt-1 text-2xl font-semibold">{formatMetric(summary?.[metric.key], loading)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Station Status</h3>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {stationOverviewMetrics.map((metric) => (
            <Card key={metric.key} className={metric.className}>
              <CardContent className="p-4">
                <p className={metric.className ? 'text-xs opacity-80' : 'text-xs text-muted-foreground'}>
                  <DerivedLabel label={metric.label} tooltip={metric.tooltip} />
                </p>
                <p className="mt-1 text-2xl font-semibold">{formatMetric(summary?.[metric.key], loading)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Station Status Breakdown
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {stationStatusMetrics.map((metric) => (
            <Card key={metric.key} className={metric.className}>
              <CardContent className="p-4">
                <p className="text-xs opacity-80">
                  <DerivedLabel label={metric.label} tooltip={metric.tooltip} />
                </p>
                <p className="mt-1 text-2xl font-semibold">{formatMetric(summary?.[metric.key], loading)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ticket Queue</h3>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {ticketQueueMetrics.map((metric) => (
            <Card key={metric.key} className={metric.className}>
              <CardContent className="p-4">
                <p className={metric.className ? 'text-xs opacity-80' : 'text-xs text-muted-foreground'}>
                  <DerivedLabel label={metric.label} tooltip={metric.tooltip} />
                </p>
                <p className="mt-1 text-2xl font-semibold">{formatMetric(summary?.[metric.key], loading)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {error ? <Card className="border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</Card> : null}
    </main>
  )
}
