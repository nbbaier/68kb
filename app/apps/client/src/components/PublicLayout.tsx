import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'

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
// Top navigation items
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { label: 'Home', path: '/' },
  { label: 'Categories', path: '/categories' },
  { label: 'Glossary', path: '/glossary' },
  { label: 'Advanced Search', path: '/search' },
]

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

function PublicSidebar({ categories }: { categories: PublicCategory[] }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <aside className="w-56 shrink-0 space-y-6">
      {/* Search box */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Search</h2>
        <form onSubmit={handleSearchSubmit} className="space-y-2" role="search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Search keywords"
          />
          <button
            type="submit"
            className="w-full rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Search
          </button>
          <Link
            to="/search"
            className="block text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Advanced Search
          </Link>
        </form>
      </div>

      {/* Category tree */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Categories</h2>
        {categories.length === 0 ? (
          <p className="text-xs text-muted-foreground">No categories yet.</p>
        ) : (
          <ul className="space-y-1">
            {categories.map((cat) => (
              <li
                key={cat.catId}
                style={{ paddingLeft: `${cat.depth * 12}px` }}
              >
                <Link
                  to={`/categories/${cat.catUri}`}
                  className="flex items-center justify-between text-sm text-foreground hover:text-primary transition-colors group"
                >
                  <span className="group-hover:underline">
                    {cat.depth > 0 && (
                      <span className="text-muted-foreground mr-1">»</span>
                    )}
                    {cat.catName}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1 shrink-0">
                    ({cat.articleCount})
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// PublicLayout — wraps all public pages
// ---------------------------------------------------------------------------

export function PublicLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const [siteName, setSiteName] = useState('68kb')
  const [categories, setCategories] = useState<PublicCategory[]>([])

  useEffect(() => {
    // Fetch public settings
    fetch('/api/settings/public', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data?.siteName) {
          setSiteName(json.data.siteName)
        }
      })
      .catch(() => {})

    // Fetch public categories for sidebar
    fetch('/api/categories', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) {
          setCategories(json.data)
        }
      })
      .catch(() => {})
  }, [])

  const currentYear = new Date().getFullYear()

  // Determine active nav item
  const getIsActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ------------------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b bg-card">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Site name */}
          <Link
            to="/"
            className="text-lg font-bold text-primary shrink-0"
            aria-label={`${siteName} Knowledge Base`}
          >
            {siteName}
          </Link>

          {/* Main navigation */}
          <nav aria-label="Main navigation" className="flex-1 hidden sm:flex">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = getIsActive(item.path)
                return (
                  <li key={item.label}>
                    <Link
                      to={item.path}
                      className={[
                        'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                      ].join(' ')}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* User nav */}
          <div className="flex items-center gap-3 shrink-0 text-sm">
            {user ? (
              <>
                <Link
                  to={`/users/profile/${user.username}`}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Welcome, {user.username}
                </Link>
                <Link
                  to="/users/account"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  My Account
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/users/login"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/users/register"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Content + Sidebar */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 flex gap-6">
        {/* Main content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>

        {/* Sidebar */}
        <PublicSidebar categories={categories} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Footer */}
      {/* ------------------------------------------------------------------ */}
      <footer
        role="contentinfo"
        className="border-t bg-card py-4 text-center text-sm text-muted-foreground"
      >
        © {currentYear} {siteName}
      </footer>
    </div>
  )
}
