import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'

type FailedLoginIpSummary = {
  failedIp: string
  attempts: number
  lastFailedDate: number
  usernames: string[]
  status: 'none' | 'delay30' | 'delay60' | 'lockout'
  retryAfterSeconds: number
}

type FailedLoginsResponse = {
  data: FailedLoginIpSummary[]
  windowHours: number
  totalIps: number
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabel(status: FailedLoginIpSummary['status']): string {
  if (status === 'lockout') return 'Locked'
  if (status === 'delay60') return '60s delay'
  if (status === 'delay30') return '30s delay'
  return 'None'
}

export function AdminFailedLoginsPage() {
  const [rows, setRows] = useState<FailedLoginIpSummary[]>([])
  const [windowHours, setWindowHours] = useState(24)
  const [isLoading, setIsLoading] = useState(true)

  const fetchRows = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/users/failed-logins?windowHours=${windowHours}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        throw new Error('Failed to load failed login data')
      }
      const json = await res.json() as FailedLoginsResponse
      setRows(json.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load failed login data')
    } finally {
      setIsLoading(false)
    }
  }, [windowHours])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Failed Login IP Activity</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={windowHours === 24 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setWindowHours(24)}
          >
            24h
          </Button>
          <Button
            variant={windowHours === 72 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setWindowHours(72)}
          >
            72h
          </Button>
          <Button
            variant={windowHours === 168 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setWindowHours(168)}
          >
            7d
          </Button>
          <Button variant="outline" size="sm" onClick={fetchRows}>
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading failed login activity…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No failed login activity in this window.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IP Address</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Last Failed Attempt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Retry After</TableHead>
                <TableHead>Usernames</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.failedIp}>
                  <TableCell className="font-mono text-xs">{row.failedIp}</TableCell>
                  <TableCell>{row.attempts}</TableCell>
                  <TableCell>{formatDate(row.lastFailedDate)}</TableCell>
                  <TableCell>{statusLabel(row.status)}</TableCell>
                  <TableCell>{row.retryAfterSeconds > 0 ? `${row.retryAfterSeconds}s` : '—'}</TableCell>
                  <TableCell className="max-w-xs truncate">{row.usernames.join(', ') || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
