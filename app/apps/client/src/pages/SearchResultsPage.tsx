import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchArticle = {
  articleId: number
  articleUri: string
  articleTitle: string
  articleShortDesc: string
  articleDate: number
  articleHits: number
}

type SearchResultsData = {
  articles: SearchArticle[]
  total: number
  page: number
  limit: number
  keywords: string
  categoryId: number | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(timestamp: number): string {
  if (!timestamp) return ''
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function stripHtml(html: string): string {
  if (typeof document === 'undefined') return html
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent ?? ''
}

// ---------------------------------------------------------------------------
// SearchResultsPage — /search/results/:hash
//
// Displays paginated search results for a given search hash.
// On 404 (expired/invalid hash), redirects to /search/no-results.
// ---------------------------------------------------------------------------

export function SearchResultsPage() {
  const { hash } = useParams<{ hash: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<SearchResultsData | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const perPage = results?.limit ?? 10

  useEffect(() => {
    if (!hash) {
      navigate('/search/no-results')
      return
    }

    // Validate hash length
    if (hash.length !== 32) {
      navigate('/search/no-results')
      return
    }

    loadPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  async function loadPage(page: number) {
    if (!hash) return

    setLoading(true)
    try {
      const res = await fetch(
        `/api/search/results/${hash}?page=${page}&limit=${perPage}`,
        { credentials: 'include' },
      )

      if (!res.ok) {
        navigate('/search/no-results')
        return
      }

      const json = await res.json()
      setResults(json.data)
      setCurrentPage(page)
    } catch {
      navigate('/search/no-results')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = results ? Math.ceil(results.total / (results.limit || 10)) : 0

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        {/* Title skeleton */}
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        {/* Result skeletons */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2 animate-pulse">
            <div className="h-5 w-3/4 bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!results) {
    return null
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-4">
        <ol className="flex items-center gap-1">
          <li>
            <Link to="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <Link to="/search" className="hover:text-foreground transition-colors">
              Search
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="text-foreground font-medium">
            Results
          </li>
        </ol>
      </nav>

      {/* Heading */}
      <h1 className="text-2xl font-bold mb-2">Search Results</h1>

      {/* Summary */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          {results.total} {results.total === 1 ? 'result' : 'results'} for{' '}
          {results.keywords ? (
            <span className="font-medium text-foreground">"{results.keywords}"</span>
          ) : (
            <span className="italic">all articles</span>
          )}
        </p>
        <Link
          to="/search"
          className="text-sm text-primary hover:underline"
        >
          Search again
        </Link>
      </div>

      {/* Article list */}
      <div className="space-y-4">
        {results.articles.map((article) => (
          <article
            key={article.articleId}
            className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
          >
            <Link
              to={`/article/${article.articleUri}`}
              className="text-base font-semibold text-foreground hover:text-primary transition-colors"
            >
              {article.articleTitle}
            </Link>
            {article.articleShortDesc && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {stripHtml(article.articleShortDesc)}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {formatDate(article.articleDate)}
              {article.articleHits > 0 && (
                <span className="ml-3">
                  {article.articleHits} {article.articleHits === 1 ? 'view' : 'views'}
                </span>
              )}
            </p>
          </article>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          aria-label="Search results pagination"
          className="mt-6 flex items-center justify-between"
        >
          <button
            onClick={() => loadPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors"
            aria-label="Previous page"
          >
            Previous
          </button>

          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => loadPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors"
            aria-label="Next page"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  )
}
