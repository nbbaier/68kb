import { useState, useEffect } from 'react'
import { Link } from 'react-router'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PublicCategory = {
  catId: number
  catParent: number
  catUri: string
  catName: string
  catDescription: string
  depth: number
  articleCount: number
}

// ---------------------------------------------------------------------------
// CategoriesIndexPage — /categories
// Lists all top-level categories (cat_parent = 0, cat_display = 'yes').
// ---------------------------------------------------------------------------

export function CategoriesIndexPage() {
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'Categories — 68kb'

    fetch('/api/categories', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) {
          setCategories(json.data)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Restore default title on unmount
  useEffect(() => {
    return () => {
      document.title = '68kb'
    }
  }, [])

  // Top-level categories only (depth === 0)
  const topLevel = categories.filter((c) => c.depth === 0)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-1/3 bg-muted/40 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 bg-muted/40 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Categories</h1>

      {topLevel.length === 0 ? (
        <p className="text-muted-foreground">No categories have been created yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topLevel.map((cat) => (
            <div
              key={cat.catId}
              className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
            >
              <Link
                to={`/categories/${cat.catUri}`}
                className="text-base font-semibold text-foreground hover:text-primary transition-colors"
              >
                {cat.catName}
              </Link>
              {cat.catDescription && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {cat.catDescription}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {cat.articleCount} {cat.articleCount === 1 ? 'article' : 'articles'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
