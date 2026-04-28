'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const ACTIONS = [
  {
    id: 'create',
    title: 'Create Schema',
    description: 'Create database and apply schema from data/sql/schema.sql (tables, keys, checks).',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    danger: false,
  },
  {
    id: 'seed',
    title: 'Seed Generated Data',
    description: 'Load data/generated/*.json in FK-safe order, then install trigger + stored procedure.',
    tone: 'border-sky-200 bg-sky-50 text-sky-800',
    danger: false,
  },
  {
    id: 'drop',
    title: 'Drop Database',
    description: 'Delete the configured database entirely.',
    tone: 'border-rose-200 bg-rose-50 text-rose-800',
    danger: true,
  },
  {
    id: 'reset',
    title: 'Reset Database',
    description: 'Drop -> create schema -> seed data -> install advanced objects.',
    tone: 'border-orange-200 bg-orange-50 text-orange-800',
    danger: true,
  },
]

async function requestJson(url, options = {}) {
  const response = await fetch(url, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.detail || `Request failed (${response.status})`)
  return payload
}

export default function DbPage() {
  const [selected, setSelected] = useState(null)
  const [adminPassword, setAdminPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const canRun = useMemo(() => {
    if (!selected) return false
    if (!adminPassword.trim()) return false
    if (!selected.danger) return true
    return confirmText.trim().toLowerCase() === selected.id
  }, [selected, confirmText, adminPassword])

  async function runAction() {
    if (!selected || !canRun) return

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const payload = await requestJson('/api/admin/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: selected.id, password: adminPassword }),
      })
      setMessage(payload.detail)
      setSelected(null)
      setConfirmText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed DB action.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="space-y-6 p-4 md:p-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Database Lifecycle Controls</h2>
        <p className="text-sm text-muted-foreground">Run schema and seed operations for demo setup without leaving the UI. All actions require DB admin password. Destructive actions also require typed confirmation.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Action Palette</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {ACTIONS.map((action) => (
              <button
                type="button"
                key={action.id}
                onClick={() => {
                  setSelected(action)
                  setConfirmText('')
                }}
                className={cn(
                  'rounded-md border p-4 text-left transition hover:shadow-sm',
                  action.tone,
                  selected?.id === action.id && 'ring-2 ring-primary',
                )}
                disabled={loading}
              >
                <p className="text-sm font-semibold">{action.title}</p>
                <p className="mt-1 text-xs opacity-90">{action.description}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Execution Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">DB Admin Password</p>
              <Input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter DB_ADMIN_PASSWORD"
              />
            </div>
            {selected ? (
              <>
                <div className={cn('rounded-md border p-3', selected.tone)}>
                  <p className="font-semibold">{selected.title}</p>
                  <p className="mt-1 text-xs opacity-90">{selected.description}</p>
                </div>
                {selected.danger ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Destructive confirmation: type <span className="font-semibold text-foreground">{selected.id}</span>
                    </p>
                    <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={`Type ${selected.id}`} />
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setSelected(null)} disabled={loading}>
                    Cancel
                  </Button>
                  <Button type="button" variant={selected.danger ? 'destructive' : 'default'} onClick={runAction} disabled={loading || !canRun}>
                    {loading ? 'Running...' : 'Run Action'}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Select an action from the left panel to run database operations.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {message ? <Card className="p-4 text-sm">{message}</Card> : null}
      {error ? <Card className="border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</Card> : null}
    </main>
  )
}
