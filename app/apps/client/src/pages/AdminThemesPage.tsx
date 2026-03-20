import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type AdminTheme = {
  directory: string
  hasLayout: boolean
  isActive: boolean
}

type ThemesResponse = {
  data: {
    activeTheme: string
    themes: AdminTheme[]
  }
}

export function AdminThemesPage() {
  const [themes, setThemes] = useState<AdminTheme[]>([])
  const [activeTheme, setActiveTheme] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [activatingTheme, setActivatingTheme] = useState<string | null>(null)

  async function loadThemes() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/themes', { credentials: 'include' })
      const json = await res.json().catch(() => null) as ThemesResponse | { error?: string } | null
      if (!res.ok || !json || !('data' in json)) {
        throw new Error((json as { error?: string } | null)?.error ?? 'Failed to load themes')
      }
      setThemes(json.data.themes)
      setActiveTheme(json.data.activeTheme)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load themes')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadThemes()
  }, [])

  async function activateTheme(theme: string) {
    setActivatingTheme(theme)
    try {
      const res = await fetch('/api/admin/themes/activate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      })
      const json = await res.json().catch(() => null) as { data?: { activeTheme: string }; error?: string } | null
      if (!res.ok || !json?.data) {
        throw new Error(json?.error ?? 'Failed to activate theme')
      }
      setActiveTheme(json.data.activeTheme)
      setThemes((prev) =>
        prev.map((entry) => ({
          ...entry,
          isActive: entry.directory === json.data!.activeTheme,
        })),
      )
      toast.success(`Theme activated: ${json.data.activeTheme}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to activate theme')
    } finally {
      setActivatingTheme(null)
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Themes</h1>
        <p className="text-sm text-muted-foreground">
          Active theme: <span className="font-medium text-foreground">{activeTheme || 'none'}</span>
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading themes…</p>
      ) : themes.length === 0 ? (
        <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
          No theme directories found.
        </div>
      ) : (
        <div className="rounded-md border">
          {themes.map((theme) => (
            <div
              key={theme.directory}
              className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
            >
              <div className="space-y-0.5">
                <p className="font-medium">{theme.directory}</p>
                <p className="text-xs text-muted-foreground">
                  {theme.hasLayout ? 'Valid theme (layout.php found)' : 'Invalid theme (layout.php missing)'}
                </p>
              </div>

              <Button
                variant={theme.isActive ? 'secondary' : 'default'}
                onClick={() => activateTheme(theme.directory)}
                disabled={theme.isActive || !theme.hasLayout || activatingTheme === theme.directory}
              >
                {theme.isActive
                  ? 'Active'
                  : activatingTheme === theme.directory
                    ? 'Activating…'
                    : 'Activate'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
