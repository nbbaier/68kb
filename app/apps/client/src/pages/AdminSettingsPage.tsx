import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type AdminSiteSettings = {
  siteName: string
  siteEmail: string
  siteKeywords: string
  siteDescription: string
  siteMaxSearch: number
  siteCacheTime: number
  siteBadWords: string
}

const DEFAULT_SETTINGS: AdminSiteSettings = {
  siteName: '',
  siteEmail: '',
  siteKeywords: '',
  siteDescription: '',
  siteMaxSearch: 20,
  siteCacheTime: 0,
  siteBadWords: '',
}

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSiteSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings', { credentials: 'include' })
      .then(async (res) => {
        const json = await res.json().catch(() => null) as { data?: AdminSiteSettings; error?: string } | null
        if (!res.ok || !json?.data) {
          throw new Error(json?.error ?? 'Failed to load site settings')
        }
        setSettings(json.data)
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to load site settings')
      })
      .finally(() => setIsLoading(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const json = await res.json().catch(() => null) as { data?: AdminSiteSettings; error?: string } | null
      if (!res.ok || !json?.data) {
        throw new Error(json?.error ?? 'Failed to save site settings')
      }
      setSettings(json.data)
      toast.success('Settings updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save site settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure core site metadata, email, and search behavior.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-4" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="siteName">Site Name</Label>
            <Input
              id="siteName"
              value={settings.siteName}
              onChange={(e) => setSettings((prev) => ({ ...prev, siteName: e.target.value }))}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="siteEmail">Site Email</Label>
            <Input
              id="siteEmail"
              type="email"
              value={settings.siteEmail}
              onChange={(e) => setSettings((prev) => ({ ...prev, siteEmail: e.target.value }))}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="siteKeywords">Site Keywords</Label>
            <Input
              id="siteKeywords"
              value={settings.siteKeywords}
              onChange={(e) => setSettings((prev) => ({ ...prev, siteKeywords: e.target.value }))}
              placeholder="keyword,keyword2"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="siteDescription">Site Description</Label>
            <Textarea
              id="siteDescription"
              value={settings.siteDescription}
              onChange={(e) => setSettings((prev) => ({ ...prev, siteDescription: e.target.value }))}
              rows={4}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="siteMaxSearch">Search Results Per Page</Label>
              <Input
                id="siteMaxSearch"
                type="number"
                min={1}
                value={String(settings.siteMaxSearch)}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    siteMaxSearch: Number.parseInt(e.target.value, 10) || 0,
                  }))
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="siteCacheTime">Cache Time (seconds)</Label>
              <Input
                id="siteCacheTime"
                type="number"
                min={0}
                value={String(settings.siteCacheTime)}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    siteCacheTime: Number.parseInt(e.target.value, 10) || 0,
                  }))
                }
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="siteBadWords">Bad Words (comma-separated)</Label>
            <Textarea
              id="siteBadWords"
              value={settings.siteBadWords}
              onChange={(e) => setSettings((prev) => ({ ...prev, siteBadWords: e.target.value }))}
              rows={3}
            />
          </div>

          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save Settings'}
          </Button>
        </form>
      )}
    </div>
  )
}
