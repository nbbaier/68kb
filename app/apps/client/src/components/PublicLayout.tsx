import { useState, useEffect, useCallback } from 'react'
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
    <aside className="w-full md:w-56 md:shrink-0 space-y-6">
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const currentYear = new Date().getFullYear()

  // Determine active nav item
  const getIsActive = useCallback((path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }, [location.pathname])

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

          {/* Main navigation — hidden on mobile, shown on sm+ */}
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

          {/* Right side: user nav + mobile menu toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {/* User nav */}
            <div className="flex items-center gap-3 text-sm">
              {user ? (
                <>
                  <Link
                    to="/admin"
                    className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline truncate max-w-[120px]"
                  >
                    Welcome, {user.username}
                  </Link>
                  <Link
                    to="/admin"
                    className="text-muted-foreground hover:text-foreground transition-colors text-xs sm:text-sm"
                  >
                    My Account
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-muted-foreground hover:text-foreground transition-colors text-xs sm:text-sm"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="text-muted-foreground hover:text-foreground transition-colors text-xs sm:text-sm"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu toggle — visible only on small screens */}
            <button
              type="button"
              className="sm:hidden inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {/* Hamburger / close icon */}
              {mobileMenuOpen ? (
                /* X icon */
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              ) : (
                /* Hamburger icon */
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="4" x2="20" y1="18" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile navigation menu — shown only on small screens when open */}
        {mobileMenuOpen && (
          <nav
            id="mobile-nav"
            aria-label="Mobile navigation"
            className="sm:hidden border-t bg-card"
          >
            <ul className="max-w-screen-xl mx-auto px-4 py-2 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = getIsActive(item.path)
                return (
                  <li key={item.label}>
                    <Link
                      to={item.path}
                      className={[
                        'block px-3 py-2 rounded text-sm font-medium transition-colors',
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
        )}
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Content + Sidebar — stack on mobile, side-by-side on md+ */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 flex flex-col gap-6 md:flex-row">
        {/* Main content — full width on mobile, flex-1 on desktop */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>

        {/* Sidebar — full width on mobile, fixed width on desktop */}
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
