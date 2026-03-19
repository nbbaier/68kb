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

type PublicArticle = {
  articleId: number
  articleUri: string
  articleTitle: string
  articleShortDesc: string
  articleDate: number
  articleHits: number
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

// ---------------------------------------------------------------------------
// Category card
// ---------------------------------------------------------------------------

function CategoryCard({ category }: { category: PublicCategory }) {
  return (
    <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
      <Link
        to={`/categories/${category.catUri}`}
        className="text-base font-semibold text-foreground hover:text-primary transition-colors"
      >
        {category.catName}
      </Link>
      {category.catDescription && (
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
          {category.catDescription}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {category.articleCount} {category.articleCount === 1 ? 'article' : 'articles'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HomePage
// ---------------------------------------------------------------------------

export function HomePage() {
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [popularArticles, setPopularArticles] = useState<PublicArticle[]>([])
  const [recentArticles, setRecentArticles] = useState<PublicArticle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [catsRes, popularRes, recentRes] = await Promise.all([
          fetch('/api/categories', { credentials: 'include' }),
          fetch('/api/articles/popular', { credentials: 'include' }),
          fetch('/api/articles/recent', { credentials: 'include' }),
        ])

        if (catsRes.ok) {
          const json = await catsRes.json()
          setCategories(json.data ?? [])
        }

        if (popularRes.ok) {
          const json = await popularRes.json()
          setPopularArticles(json.data ?? [])
        }

        if (recentRes.ok) {
          const json = await recentRes.json()
          setRecentArticles(json.data ?? [])
        }
      } catch {
        // Silently fail — empty state will show
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [])

  // Top-level categories only (depth === 0)
  const topLevelCategories = categories.filter((c) => c.depth === 0)

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-32 bg-muted/40 rounded animate-pulse" />
        <div className="h-32 bg-muted/40 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------------ */}
      {/* Category grid — 3 columns */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="categories-heading">
        <h2 id="categories-heading" className="text-xl font-bold mb-4">
          Categories
        </h2>
        {topLevelCategories.length === 0 ? (
          <p className="text-muted-foreground">No categories have been created yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topLevelCategories.map((cat) => (
              <CategoryCard key={cat.catId} category={cat} />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Articles — two columns */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Most Popular */}
        <section aria-labelledby="popular-heading">
          <h2 id="popular-heading" className="text-lg font-bold mb-3">
            Most Popular
          </h2>
          {popularArticles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No articles found.</p>
          ) : (
            <ul className="space-y-2">
              {popularArticles.map((article) => (
                <li key={article.articleId}>
                  <Link
                    to={`/article/${article.articleUri}`}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors hover:underline"
                  >
                    {article.articleTitle}
                  </Link>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({article.articleHits} views)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent Articles */}
        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="text-lg font-bold mb-3">
            Recent Articles
          </h2>
          {recentArticles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No articles found.</p>
          ) : (
            <ul className="space-y-2">
              {recentArticles.map((article) => (
                <li key={article.articleId}>
                  <Link
                    to={`/article/${article.articleUri}`}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors hover:underline"
                  >
                    {article.articleTitle}
                  </Link>
                  {article.articleDate > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {formatDate(article.articleDate)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
