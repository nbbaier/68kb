import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { toast } from 'sonner'
import { AlertTriangleIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CategoryDetail = {
  catId: number
  catName: string
  catUri: string
  catParent: number
  catImage: string
}

type CategoryWithDepth = {
  catId: number
  catParent: number
  catUri: string
  catName: string
  catDepth?: number
  depth: number
}

// ---------------------------------------------------------------------------
// AdminCategoryDeletePage
// ---------------------------------------------------------------------------

export function AdminCategoryDeletePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const catId = id ? parseInt(id, 10) : NaN

  // State
  const [category, setCategory] = useState<CategoryDetail | null>(null)
  const [articleCount, setArticleCount] = useState(0)
  const [allCategories, setAllCategories] = useState<CategoryWithDepth[]>([])
  const [selectedReplacementId, setSelectedReplacementId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // -------------------------------------------------------------------------
  // Validate ID
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isNaN(catId) || catId <= 0) {
      toast.error('Invalid category ID')
      navigate('/admin/categories', { replace: true })
    }
  }, [catId, navigate])

  // -------------------------------------------------------------------------
  // Load data: category info, article count, all categories
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isNaN(catId) || catId <= 0) return

    const fetchData = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const [catRes, countRes, allRes] = await Promise.all([
          fetch(`/api/admin/categories/${catId}`, { credentials: 'include' }),
          fetch(`/api/admin/categories/${catId}/article-count`, { credentials: 'include' }),
          fetch('/api/admin/categories', { credentials: 'include' }),
        ])

        if (!catRes.ok) {
          if (catRes.status === 404) {
            toast.error('Category not found')
            navigate('/admin/categories', { replace: true })
            return
          }
          throw new Error('Failed to load category')
        }

        const catJson: { data: CategoryDetail } = await catRes.json()
        setCategory(catJson.data)

        if (countRes.ok) {
          const countJson: { data: { count: number } } = await countRes.json()
          setArticleCount(countJson.data.count)
        }

        if (allRes.ok) {
          const allJson: { data: CategoryWithDepth[] } = await allRes.json()
          // Exclude the current category from replacement options
          setAllCategories(allJson.data.filter((c) => c.catId !== catId))
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [catId, navigate])

  // -------------------------------------------------------------------------
  // Delete handler
  // -------------------------------------------------------------------------
  const handleDelete = async () => {
    if (!category) return

    // If articles exist, require a replacement
    if (articleCount > 0 && !selectedReplacementId) {
      toast.error('Please select a replacement category for the articles')
      return
    }

    setIsDeleting(true)
    try {
      const body: Record<string, unknown> = {}
      if (articleCount > 0 && selectedReplacementId) {
        body.newCatId = parseInt(selectedReplacementId, 10)
      }

      const res = await fetch(`/api/admin/categories/${catId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      })

      const json = await res.json() as { data?: { deleted: boolean }; error?: string }

      if (!res.ok) {
        toast.error(json.error ?? 'Failed to delete category')
        return
      }

      toast.success(`Category "${category.catName}" deleted successfully`)
      navigate('/admin/categories')
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsDeleting(false)
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (loadError || !category) {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError ?? 'Category not found'}
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/categories">Back to Categories</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Delete Category</h1>
        <Button variant="outline" asChild>
          <Link to="/admin/categories">Back to Categories</Link>
        </Button>
      </div>

      {/* Confirmation card */}
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangleIcon className="size-5 text-destructive mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              Are you sure you want to delete{' '}
              <span className="font-bold">"{category.catName}"</span>?
            </p>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          </div>
        </div>

        {/* Article count warning + reassignment */}
        {articleCount > 0 && (
          <div className="space-y-3 rounded-md border border-warning/30 bg-amber-50 dark:bg-amber-950/20 p-4">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangleIcon className="inline size-4 mr-1.5 align-middle" />
              This category has{' '}
              <span className="font-bold" data-testid="article-count">
                {articleCount}
              </span>{' '}
              article{articleCount === 1 ? '' : 's'}.
            </p>
            <p className="text-sm text-muted-foreground">
              Please select a replacement category to reassign these articles before deleting.
            </p>

            <div className="space-y-2">
              <label
                htmlFor="replacement-category"
                className="text-sm font-medium"
              >
                Reassign articles to: <span className="text-destructive">*</span>
              </label>
              <Select
                value={selectedReplacementId}
                onValueChange={setSelectedReplacementId}
              >
                <SelectTrigger
                  id="replacement-category"
                  aria-label="Replacement category"
                >
                  <SelectValue placeholder="Select a replacement category…" />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map((cat) => (
                    <SelectItem key={cat.catId} value={String(cat.catId)}>
                      {cat.depth > 0 && (
                        <span className="text-muted-foreground">
                          {'»'.repeat(cat.depth)}{' '}
                        </span>
                      )}
                      {cat.catName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || (articleCount > 0 && !selectedReplacementId)}
          >
            {isDeleting ? 'Deleting…' : 'Delete Category'}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/categories">Cancel</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
