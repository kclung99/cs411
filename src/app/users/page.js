'use client'

import { useMemo, useState } from 'react'

import { DerivedLabel } from '@/components/derived-label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'

async function requestJson(url) {
  const response = await fetch(url)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.detail || `Request failed (${response.status})`)
  }
  return payload
}

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function formatDecimal(value, digits = 2) {
  const num = Number(value)
  return Number.isFinite(num) ? num.toFixed(digits) : '-'
}

function fulfillmentClass(value) {
  const num = toNumber(value, -1)
  if (num >= 0.85) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (num >= 0.7) return 'bg-amber-50 text-amber-700 border-amber-200'
  if (num >= 0) return 'bg-rose-50 text-rose-700 border-rose-200'
  return 'bg-muted text-muted-foreground'
}

function idleClass(value) {
  const num = toNumber(value, -1)
  if (num >= 0 && num <= 30) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (num > 30 && num <= 60) return 'bg-amber-50 text-amber-700 border-amber-200'
  if (num > 60) return 'bg-rose-50 text-rose-700 border-rose-200'
  return 'bg-muted text-muted-foreground'
}

function statusClass(status) {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700'
  if (status === 'cancelled') return 'bg-rose-50 text-rose-700'
  if (status === 'incomplete') return 'bg-amber-50 text-amber-700'
  return 'bg-muted text-muted-foreground'
}

export default function DashboardPage() {
  const [keyword, setKeyword] = useState('')
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [summary, setSummary] = useState(null)
  const [requests, setRequests] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const selectedUserId = selectedUser?.user_id || ''

  const kpis = useMemo(
    () => [
      { label: 'Total Requests', tooltip: 'COUNT(DISTINCT ChargingRequest.request_id) for selected user.', value: summary?.total_requests ?? 0 },
      { label: 'Completed Requests', tooltip: 'Count of selected user requests where request_status = completed.', value: summary?.completed_requests ?? 0, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
      { label: 'Cancelled Requests', tooltip: 'Count of selected user requests where request_status = cancelled.', value: summary?.cancelled_requests ?? 0, className: 'border-rose-200 bg-rose-50 text-rose-700' },
      { label: 'Incomplete Requests', tooltip: 'Count of selected user requests where request_status = incomplete.', value: summary?.incomplete_requests ?? 0, className: 'border-amber-200 bg-amber-50 text-amber-700' },
      { label: 'Total Sessions', tooltip: 'COUNT(DISTINCT ChargingSession.session_id) for selected user.', value: summary?.total_sessions ?? 0 },
      { label: 'Energy Delivered (kWh)', tooltip: 'SUM(ChargingSession.energy_kwh) for selected user sessions.', value: formatDecimal(summary?.total_energy_kwh, 2) },
      { label: 'Avg Fulfillment', tooltip: 'AVG(energy_kwh / kwh_requested) across joined sessions/requests.', value: formatDecimal(summary?.avg_fulfillment_rate, 3), className: fulfillmentClass(summary?.avg_fulfillment_rate) },
      { label: 'Avg Idle Minutes', tooltip: 'AVG(TIMESTAMPDIFF(MINUTE, done_charging_time, disconnect_time)).', value: formatDecimal(summary?.avg_idle_minutes, 1), className: idleClass(summary?.avg_idle_minutes) },
      {
        label: 'Avg Requested / Delivered',
        tooltip: 'Side-by-side AVG(request kWh) and AVG(delivered kWh) for selected user.',
        value: `${formatDecimal(summary?.avg_requested_kwh, 2)} / ${formatDecimal(summary?.avg_delivered_kwh, 2)}`,
        wide: true,
      },
    ],
    [summary],
  )

  async function searchUsers() {
    setLoading(true)
    setError(null)
    try {
      const results = await requestJson(`/api/users/search?q=${encodeURIComponent(keyword.trim())}`)
      setUsers(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search users.')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  async function selectUser(userId) {
    setLoading(true)
    setError(null)
    try {
      const [profile, summaryData, requestRows, sessionRows] = await Promise.all([
        requestJson(`/api/users/${userId}/profile`),
        requestJson(`/api/users/${userId}/summary`),
        requestJson(`/api/users/${userId}/requests?limit=15`),
        requestJson(`/api/users/${userId}/sessions?limit=15`),
      ])
      setKeyword('')
      setUsers([profile])
      setSelectedUser(profile)
      setSummary(summaryData)
      setRequests(requestRows)
      setSessions(sessionRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  function onSearchSubmit(e) {
    e.preventDefault()
    if (!keyword.trim()) return
    searchUsers()
  }

  return (
    <main className="space-y-6 p-4 md:p-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">User Operations</h2>
        <p className="text-sm text-muted-foreground">Find a driver, inspect demand patterns, and compare request outcomes to delivered charging sessions.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>User Lookup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onSearchSubmit}>
              <Input
                placeholder="Search by user_id, first name, last name, email"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Button type="submit" disabled={loading || keyword.trim().length === 0}>
                Search
              </Button>
            </form>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[96px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user.user_id}
                      className={cn(selectedUserId === user.user_id && 'bg-primary/5')}
                    >
                      <TableCell>{user.user_id}</TableCell>
                      <TableCell>
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant={selectedUserId === user.user_id ? 'default' : 'outline'} size="sm" onClick={() => selectUser(user.user_id)}>
                          Select
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        No users loaded yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Selected User Context</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedUser ? (
              <dl className="space-y-2 text-sm">
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="font-medium text-muted-foreground">Name</dt>
                  <dd>{selectedUser.full_name}</dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="font-medium text-muted-foreground">User ID</dt>
                  <dd>{selectedUser.user_id}</dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="font-medium text-muted-foreground">Email</dt>
                  <dd>{selectedUser.email}</dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="font-medium text-muted-foreground">
                    <DerivedLabel
                      label="Age"
                      tooltip="Computed by TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) in user profile query."
                    />
                  </dt>
                  <dd>{selectedUser.age}</dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="font-medium text-muted-foreground">Registered</dt>
                  <dd>{formatTimestamp(selectedUser.registered_at)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Select a user to load profile, behavior metrics, and activity timelines.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedUser ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Behavior Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((item) => (
                <div
                  key={item.label}
                  className={cn('rounded-md border p-3', item.className, item.wide && 'sm:col-span-2')}
                >
                  <p className="text-xs text-muted-foreground">
                    <DerivedLabel label={item.label} tooltip={item.tooltip} />
                  </p>
                  <p className="mt-1 text-lg font-semibold">{item.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Charging Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Station</TableHead>
                      <TableHead>Requested kWh</TableHead>
                      <TableHead>Requested Departure</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((row) => (
                      <TableRow key={row.request_id}>
                        <TableCell className={statusClass(row.request_status)}>{row.request_status}</TableCell>
                        <TableCell>{row.station_name}</TableCell>
                        <TableCell>{formatDecimal(row.kwh_requested, 2)}</TableCell>
                        <TableCell>{formatTimestamp(row.requested_departure)}</TableCell>
                        <TableCell>{formatTimestamp(row.modified_at)}</TableCell>
                      </TableRow>
                    ))}
                    {requests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground">
                          No recent requests.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Charging Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Station</TableHead>
                      <TableHead>Connected</TableHead>
                      <TableHead>Done Charging</TableHead>
                      <TableHead>Disconnected</TableHead>
                      <TableHead>Energy (kWh)</TableHead>
                      <TableHead>
                        <DerivedLabel
                          label="Fulfillment"
                          tooltip="Per-session derived value: energy_kwh / requested_kwh."
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((row) => (
                      <TableRow key={row.session_id}>
                        <TableCell>{row.station_name}</TableCell>
                        <TableCell>{formatTimestamp(row.connection_time)}</TableCell>
                        <TableCell>{formatTimestamp(row.done_charging_time)}</TableCell>
                        <TableCell>{formatTimestamp(row.disconnect_time)}</TableCell>
                        <TableCell>{formatDecimal(row.energy_kwh, 2)}</TableCell>
                        <TableCell className={fulfillmentClass(row.fulfillment_rate)}>{formatDecimal(row.fulfillment_rate, 3)}</TableCell>
                      </TableRow>
                    ))}
                    {sessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-muted-foreground">
                          No recent sessions.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {error ? <Card className="border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</Card> : null}
    </main>
  )
}
