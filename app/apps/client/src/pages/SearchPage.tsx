import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CategoryOption = {
  catId: number
  catParent: number
  catUri: string
  catName: string
  depth: number
}

// ---------------------------------------------------------------------------
// SearchPage — /search
//
// Advanced search form with keyword input and category dropdown.
// If ?q= is present in the URL, pre-fills the keywords field.
// On submit, POSTs to /api/search and navigates to results or no-results.
// ---------------------------------------------------------------------------

export function SearchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qParam = searchParams.get('q') ?? ''

  const [keywords, setKeywords] = useState(qParam)
  const [categoryId, setCategoryId] = useState<string>('')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const autoSubmittedRef = useRef(false)

  // Fetch visible categories for the dropdown
  useEffect(() => {
    setCategoriesLoading(true)
    fetch('/api/categories', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) {
          setCategories(json.data)
        }
      })
      .catch(() => {})
      .finally(() => setCategoriesLoading(false))
  }, [])

  // Pre-fill keywords from URL ?q= param
  useEffect(() => {
    if (qParam) {
      setKeywords(qParam)
    }
  }, [qParam])

  // Auto-submit if ?q= is present and categories have loaded
  useEffect(() => {
    if (qParam && !categoriesLoading && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true
      handleSubmit()
    }
  }, [qParam, categoriesLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()

    setLoading(true)
    setError(null)

    try {
      const body: { keywords?: string; categoryId?: number } = {}
      if (keywords.trim()) body.keywords = keywords.trim()
      if (categoryId) body.categoryId = parseInt(categoryId, 10)

      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        navigate('/search/no-results')
        return
      }

      const json = await res.json()

      if (json.data?.noResults) {
        navigate('/search/no-results')
      } else if (json.data?.hash) {
        navigate(`/search/results/${json.data.hash}`)
      } else {
        navigate('/search/no-results')
      }
    } catch {
      setError('An error occurred while searching. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-4">
        <ol className="flex items-center gap-1">
          <li>
            <Link to="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="text-foreground font-medium">
            Search
          </li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold mb-6">Advanced Search</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Keywords field */}
        <div className="space-y-1.5">
          <label
            htmlFor="search-keywords"
            className="text-sm font-medium text-foreground"
          >
            Keywords
          </label>
          <input
            id="search-keywords"
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Enter keywords..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={loading}
          />
        </div>

        {/* Category dropdown */}
        <div className="space-y-1.5">
          <label
            htmlFor="search-category"
            className="text-sm font-medium text-foreground"
          >
            Category
          </label>
          <select
            id="search-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={loading || categoriesLoading}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.catId} value={String(cat.catId)}>
                {cat.depth > 0 ? '\u00bb '.repeat(cat.depth) : ''}
                {cat.catName}
              </option>
            ))}
          </select>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>
    </div>
  )
}
