import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type UtilitiesSummary = {
  tableCount: number
  tables: string[]
  searchCacheEntries: number
  cacheDirectories: string[]
}

type UtilitiesResponse = {
  data: UtilitiesSummary
}

type ActionResponse = {
  data?: {
    tableCount?: number
    repaired?: boolean
    optimized?: boolean
    searchCacheRowsDeleted?: number
    fileEntriesRemoved?: number
  }
  error?: string
}

export function AdminUtilitiesPage() {
  const [summary, setSummary] = useState<UtilitiesSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [runningAction, setRunningAction] = useState<string | null>(null)

  async function loadSummary() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/utilities', { credentials: 'include' })
      const json = await res.json().catch(() => null) as UtilitiesResponse | { error?: string } | null
      if (!res.ok || !json || !('data' in json)) {
        throw new Error((json as { error?: string } | null)?.error ?? 'Failed to load utility status')
      }
      setSummary(json.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load utility status')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [])

  async function runAction(endpoint: 'optimize' | 'repair' | 'clear-cache', successMessage: string) {
    setRunningAction(endpoint)
    try {
      const res = await fetch(`/api/admin/utilities/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json().catch(() => null) as ActionResponse | null
      if (!res.ok) {
        throw new Error(json?.error ?? `Failed to ${endpoint}`)
      }
      toast.success(successMessage)
      await loadSummary()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${endpoint}`)
    } finally {
      setRunningAction(null)
    }
  }

  async function downloadBackup() {
    setRunningAction('backup')
    try {
      const res = await fetch('/api/admin/utilities/backup', {
        credentials: 'include',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null) as { error?: string } | null
        throw new Error(json?.error ?? 'Backup failed')
      }

      const blob = await res.blob()
      const contentDisposition = res.headers.get('Content-Disposition') ?? ''
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/i)
      const filename = filenameMatch?.[1] ?? `68kb-${Date.now()}.json.gz`

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      toast.success('Backup download started')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Backup failed')
    } finally {
      setRunningAction(null)
    }
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Utilities</h1>
        <p className="text-sm text-muted-foreground">
          Maintenance tools for cache cleanup, DB checks, and backup export.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading utility status…</p>
      ) : summary ? (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4 text-sm">
            <p>
              Tables: <span className="font-medium">{summary.tableCount}</span>
            </p>
            <p>
              Search cache entries: <span className="font-medium">{summary.searchCacheEntries}</span>
            </p>
            <p>
              Cache directories: <span className="font-medium">{summary.cacheDirectories.length}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => runAction('optimize', 'Database optimized')}
              disabled={runningAction !== null}
            >
              {runningAction === 'optimize' ? 'Optimizing…' : 'Optimize DB'}
            </Button>

            <Button
              variant="outline"
              onClick={() => runAction('repair', 'Database integrity check passed')}
              disabled={runningAction !== null}
            >
              {runningAction === 'repair' ? 'Checking…' : 'Repair / Check DB'}
            </Button>

            <Button
              variant="outline"
              onClick={() => runAction('clear-cache', 'Cache cleared')}
              disabled={runningAction !== null}
            >
              {runningAction === 'clear-cache' ? 'Clearing…' : 'Clear Cache'}
            </Button>

            <Button
              variant="secondary"
              onClick={downloadBackup}
              disabled={runningAction !== null}
            >
              {runningAction === 'backup' ? 'Preparing…' : 'Download Backup (.gz)'}
            </Button>
          </div>

          {summary.tables.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="mb-2 text-sm font-semibold">Detected Tables</h2>
              <p className="text-xs text-muted-foreground">
                {summary.tables.join(', ')}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
