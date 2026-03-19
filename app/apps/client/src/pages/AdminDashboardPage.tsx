import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type DashboardStats = {
  version: string
  userCount: number
}

/**
 * AdminDashboardPage — default landing page under /admin.
 * Displays site statistics: app version and member count.
 */
export function AdminDashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/stats', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load stats')
        const json = await res.json()
        setStats(json.data)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load stats')
      })
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back, <strong>{user?.username}</strong>
        </p>
      </div>

      {/* Statistics cards */}
      {isLoading && (
        <p className="text-muted-foreground text-sm">Loading statistics…</p>
      )}

      {error && (
        <p className="text-destructive text-sm">{error}</p>
      )}

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                App Version
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.version}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.userCount}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
