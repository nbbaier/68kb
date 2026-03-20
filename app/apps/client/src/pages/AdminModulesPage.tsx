import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type AdminModule = {
  moduleId: number | null
  moduleName: string
  moduleDisplayName: string
  moduleDescription: string
  moduleDirectory: string
  moduleVersion: string
  moduleOrder: number
  moduleActive: 'yes' | 'no'
  isInstalled: boolean
  isAvailable: boolean
  requiredDependencies: string[]
  optionalDependencies: string[]
  missingRequiredDependencies: string[]
  hookEvents: string[]
}

type ModulesResponse = {
  data: AdminModule[]
  totals: {
    total: number
    active: number
    inactive: number
  }
}

type ActionBody = {
  moduleDirectory: string
}

export function AdminModulesPage() {
  const [modules, setModules] = useState<AdminModule[]>([])
  const [totals, setTotals] = useState({ total: 0, active: 0, inactive: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [pendingModule, setPendingModule] = useState<string | null>(null)

  async function loadModules() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/modules', { credentials: 'include' })
      const json = await res.json().catch(() => null) as ModulesResponse | { error?: string } | null
      if (!res.ok || !json || !('data' in json)) {
        throw new Error((json as { error?: string } | null)?.error ?? 'Failed to load modules')
      }
      setModules(json.data)
      setTotals(json.totals)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load modules')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadModules()
  }, [])

  async function runAction(
    endpoint: 'activate' | 'deactivate' | 'uninstall',
    body: ActionBody,
    successMessage: string,
  ) {
    setPendingModule(body.moduleDirectory)
    try {
      const res = await fetch(`/api/admin/modules/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json().catch(() => null) as {
        error?: string
        blockingDependents?: string[]
        missingRequiredDependencies?: string[]
      } | null

      if (!res.ok) {
        const dependencyHint =
          json?.blockingDependents?.length
            ? ` Active dependents: ${json.blockingDependents.join(', ')}`
            : json?.missingRequiredDependencies?.length
              ? ` Missing dependencies: ${json.missingRequiredDependencies.join(', ')}`
              : ''
        throw new Error(`${json?.error ?? `Failed to ${endpoint} module`}${dependencyHint}`)
      }

      toast.success(successMessage)
      await loadModules()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${endpoint} module`)
    } finally {
      setPendingModule(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Modules</h1>
        <p className="text-sm text-muted-foreground">
          {totals.active} active · {totals.inactive} inactive · {totals.total} total
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading modules…</p>
      ) : modules.length === 0 ? (
        <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
          No modules were discovered.
        </div>
      ) : (
        <div className="rounded-md border">
          {modules.map((item) => {
            const isPending = pendingModule === item.moduleDirectory
            const canActivate =
              item.isAvailable &&
              item.moduleActive !== 'yes' &&
              item.missingRequiredDependencies.length === 0

            return (
              <div
                key={item.moduleDirectory}
                className="border-b px-4 py-4 last:border-b-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{item.moduleDisplayName}</h2>
                      <Badge variant={item.moduleActive === 'yes' ? 'default' : 'secondary'}>
                        {item.moduleActive === 'yes' ? 'Active' : 'Inactive'}
                      </Badge>
                      {!item.isAvailable && <Badge variant="outline">Missing Files</Badge>}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {item.moduleDescription || 'No description provided.'}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Directory: <span className="font-mono">{item.moduleDirectory}</span> · Version:{' '}
                      {item.moduleVersion}
                    </p>

                    {item.requiredDependencies.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Required: {item.requiredDependencies.join(', ')}
                      </p>
                    )}
                    {item.optionalDependencies.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Optional: {item.optionalDependencies.join(', ')}
                      </p>
                    )}
                    {item.missingRequiredDependencies.length > 0 && (
                      <p className="text-xs text-destructive">
                        Missing dependencies: {item.missingRequiredDependencies.join(', ')}
                      </p>
                    )}
                    {item.hookEvents.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Hook events: {item.hookEvents.join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={!canActivate || isPending}
                      onClick={() =>
                        runAction(
                          'activate',
                          { moduleDirectory: item.moduleDirectory },
                          `Activated ${item.moduleDisplayName}`,
                        )
                      }
                    >
                      {isPending && canActivate ? 'Working…' : 'Activate'}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={item.moduleActive !== 'yes' || isPending}
                      onClick={() =>
                        runAction(
                          'deactivate',
                          { moduleDirectory: item.moduleDirectory },
                          `Deactivated ${item.moduleDisplayName}`,
                        )
                      }
                    >
                      Deactivate
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!item.isInstalled || isPending}
                      onClick={() =>
                        runAction(
                          'uninstall',
                          { moduleDirectory: item.moduleDirectory },
                          `Uninstalled ${item.moduleDisplayName}`,
                        )
                      }
                    >
                      Uninstall
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
