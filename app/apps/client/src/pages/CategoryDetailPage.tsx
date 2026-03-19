import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Breadcrumb = {
  catName: string
  catUri: string
}

type SubCategory = {
  catId: number
  catName: string
  catUri: string
  catDescription: string
  articleCount: number
}

type ArticleItem = {
  articleId: number
  articleUri: string
  articleTitle: string
  articleShortDesc: string
  articleDate: number
  articleHits: number
}

type CategoryDetail = {
  catId: number
  catName: string
  catUri: string
  catDescription: string
  catParent: number
  catImage: string
  catKeywords: string
}

type CategoryPageData = {
  category: CategoryDetail
  breadcrumbs: Breadcrumb[]
  subCategories: SubCategory[]
  articles: {
    data: ArticleItem[]
    total: number
    page: number
    limit: number
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags from a string (for use in <meta> or plain-text excerpts).
 * Runs only when document is available (browser context).
 */
function stripHtml(html: string): string {
  if (typeof document === 'undefined') return html
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent ?? ''
}

// ---------------------------------------------------------------------------
// CategoryDetailPage — /categories/*
//
// Fetches category detail from GET /api/categories/{slug} where slug can
// contain slashes (e.g., "php/oop/basics" for nested categories).
//
// On 404 (invalid/hidden URI), redirects to /categories.
// ---------------------------------------------------------------------------

export function CategoryDetailPage() {
  const params = useParams<{ '*': string }>()
  // React Router wildcard param: for route "/categories/*" and URL "/categories/php/oop",
  // params['*'] === "php/oop"
  const slug = params['*'] ?? ''

  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [pageData, setPageData] = useState<CategoryPageData | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const articlesPerPage = 10

  useEffect(() => {
    if (!slug) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setLoading(true)
    setNotFound(false)

    fetch(
      `/api/categories/${slug}?page=${currentPage}&limit=${articlesPerPage}`,
      { credentials: 'include' },
    )
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        if (!res.ok) {
          setNotFound(true)
          return
        }
        const json = await res.json()
        const data = json.data as CategoryPageData
        setPageData(data)
        document.title = `${data.category.catName} — 68kb`
      })
      .catch(() => {
        setNotFound(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [slug, currentPage])

  // Redirect to /categories for invalid/missing categories
  useEffect(() => {
    if (notFound) {
      navigate('/categories', { replace: true })
    }
  }, [notFound, navigate])

  // Restore default title on unmount
  useEffect(() => {
    return () => {
      document.title = '68kb'
    }
  }, [])

  // Reset to page 1 when slug changes
  useEffect(() => {
    setCurrentPage(1)
  }, [slug])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-2/3 bg-muted/40 rounded animate-pulse" />
        <div className="h-8 w-1/2 bg-muted/40 rounded animate-pulse" />
        <div className="h-4 w-full bg-muted/40 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 bg-muted/40 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // notFound → redirect is triggered by useEffect; render nothing while redirecting
  if (notFound || !pageData) return null

  const { category, breadcrumbs, subCategories, articles } = pageData
  const totalPages = Math.ceil(articles.total / articlesPerPage)

  // breadcrumbs contains [ancestors..., current]. For the nav:
  //   "Categories" > ancestor1 > ancestor2 > current (not a link)
  // We show all items from breadcrumbs[] as the trail, but the LAST one is current (not linked).
  const ancestorCrumbs = breadcrumbs.slice(0, -1) // everything except current

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Breadcrumbs */}
      {/* ------------------------------------------------------------------ */}
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <li>
            <Link to="/categories" className="hover:text-foreground transition-colors">
              Categories
            </Link>
          </li>
          {ancestorCrumbs.map((bc) => (
            <li key={bc.catUri} className="flex items-center gap-1">
              <span aria-hidden="true">›</span>
              <Link
                to={`/categories/${bc.catUri}`}
                className="hover:text-foreground transition-colors"
              >
                {bc.catName}
              </Link>
            </li>
          ))}
          <li className="flex items-center gap-1">
            <span aria-hidden="true">›</span>
            <span className="text-foreground font-medium" aria-current="page">
              {category.catName}
            </span>
          </li>
        </ol>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* Category heading + description */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{category.catName}</h1>
        {category.catDescription && (
          <p className="mt-2 text-muted-foreground">{category.catDescription}</p>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sub-category grid — only rendered when there are sub-categories */}
      {/* ------------------------------------------------------------------ */}
      {subCategories.length > 0 && (
        <section aria-labelledby="subcategories-heading">
          <h2 id="subcategories-heading" className="text-lg font-semibold mb-3">
            Sub-Categories
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subCategories.map((sub) => (
              <div
                key={sub.catId}
                className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
              >
                <Link
                  to={`/categories/${sub.catUri}`}
                  className="text-base font-semibold text-foreground hover:text-primary transition-colors"
                >
                  {sub.catName}
                </Link>
                {sub.catDescription && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {sub.catDescription}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {sub.articleCount} {sub.articleCount === 1 ? 'article' : 'articles'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Paginated article list */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="articles-heading">
        <h2 id="articles-heading" className="text-lg font-semibold mb-3">
          Articles
        </h2>

        {articles.data.length === 0 ? (
          <p className="text-muted-foreground">No articles found in this category.</p>
        ) : (
          <>
            <ul className="space-y-3" data-testid="article-list">
              {articles.data.map((article) => (
                <li
                  key={article.articleId}
                  className="border-b pb-3 last:border-0 last:pb-0"
                >
                  <Link
                    to={`/article/${article.articleUri}`}
                    className="font-medium text-foreground hover:text-primary transition-colors hover:underline"
                  >
                    {article.articleTitle}
                  </Link>
                  {article.articleShortDesc && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {stripHtml(article.articleShortDesc)}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            {/* Pagination controls — only shown when more than one page */}
            {totalPages > 1 && (
              <div
                className="flex items-center gap-3 mt-4"
                role="navigation"
                aria-label="Article pagination"
              >
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded border text-sm font-medium disabled:opacity-50 hover:bg-muted transition-colors"
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded border text-sm font-medium disabled:opacity-50 hover:bg-muted transition-colors"
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
