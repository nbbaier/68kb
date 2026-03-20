import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

type AdminImage = {
  filename: string
  thumbFilename: string
  size: number
  width: number | null
  height: number | null
  hasThumbnail: boolean
  url: string
  thumbUrl: string
}

type ImagesResponse = {
  data: {
    images: AdminImage[]
  }
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AdminImagesPage() {
  const [images, setImages] = useState<AdminImage[]>([])
  const [loading, setLoading] = useState(true)
  const [busyFile, setBusyFile] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const loadImages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/images', { credentials: 'include' })
      const json = await res.json().catch(() => null) as ImagesResponse | { error?: string } | null
      if (!res.ok || !json || !('data' in json)) {
        throw new Error((json && 'error' in json && json.error) || 'Failed to load images')
      }
      setImages(json.data.images)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load images')
      setImages([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadImages()
  }, [loadImages])

  async function handleUpload(file: File | null) {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set('image', file)

      const res = await fetch('/api/admin/images/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const json = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok) throw new Error(json?.error ?? 'Upload failed')

      toast.success('Image uploaded')
      await loadImages()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function regenerateThumbnail(filename: string) {
    setBusyFile(filename)
    try {
      const res = await fetch('/api/admin/images/thumbnail', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      })
      const json = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok) throw new Error(json?.error ?? 'Failed to regenerate thumbnail')

      toast.success('Thumbnail regenerated')
      await loadImages()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate thumbnail')
    } finally {
      setBusyFile(null)
    }
  }

  async function deleteImage(filename: string) {
    setBusyFile(filename)
    try {
      const res = await fetch(`/api/admin/images/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok) throw new Error(json?.error ?? 'Failed to delete image')

      setImages((prev) => prev.filter((entry) => entry.filename !== filename))
      toast.success('Image deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete image')
    } finally {
      setBusyFile(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Image Manager</h1>
        <p className="text-sm text-muted-foreground">
          Upload, browse, and remove content images.
        </p>
      </div>

      <div className="rounded-md border p-3">
        <label className="block text-sm font-medium">Upload image</label>
        <p className="text-xs text-muted-foreground mb-2">
          Allowed types: gif, jpg, jpeg, png. Max size and dimensions are validated server-side.
        </p>
        <input
          type="file"
          accept=".gif,.jpg,.jpeg,.png,image/gif,image/jpeg,image/png"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null
            handleUpload(file)
            e.currentTarget.value = ''
          }}
          className="block h-9 w-full max-w-sm rounded border bg-background px-2 py-1 text-sm"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-10 rounded bg-muted/50 animate-pulse" />
          <div className="h-10 rounded bg-muted/50 animate-pulse" />
          <div className="h-10 rounded bg-muted/50 animate-pulse" />
        </div>
      ) : images.length === 0 ? (
        <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
          No images uploaded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Preview</th>
                <th className="px-3 py-2 font-medium">Filename</th>
                <th className="px-3 py-2 font-medium">Dimensions</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {images.map((item) => {
                const isBusy = busyFile === item.filename
                return (
                  <tr key={item.filename} className="border-t">
                    <td className="px-3 py-2">
                      {item.hasThumbnail ? (
                        <img
                          src={item.thumbUrl}
                          alt={item.filename}
                          className="h-12 w-12 rounded border object-cover"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">No thumbnail</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">{item.filename}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {item.width && item.height ? `${item.width} × ${item.height}` : 'Unknown'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{formatFileSize(item.size)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => regenerateThumbnail(item.filename)}
                          className="rounded border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                        >
                          Regenerate Thumbnail
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => deleteImage(item.filename)}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
