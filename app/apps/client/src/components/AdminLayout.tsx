import { Outlet, Link, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import type { AuthPermissions } from '@/contexts/AuthContext'

// ---------------------------------------------------------------------------
// Top navigation item definitions
// ---------------------------------------------------------------------------
type NavItem = {
  label: string
  path: string
  key: string
  permission?: keyof AuthPermissions
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/admin', key: '' },
  { label: 'Articles', path: '/admin/articles', key: 'articles', permission: 'canManageArticles' },
  { label: 'Users', path: '/admin/users', key: 'users', permission: 'canManageUsers' },
  { label: 'Modules', path: '/admin/modules', key: 'modules', permission: 'canManageModules' },
  { label: 'Settings', path: '/admin/settings', key: 'settings', permission: 'canManageSettings' },
]

// ---------------------------------------------------------------------------
// Sub-navigation by section
// ---------------------------------------------------------------------------
type SubNavItem =
  | { label: string; path: string; action?: never }
  | { label: string; path?: never; action: 'logout' }

const SUB_NAV: Record<string, SubNavItem[]> = {
  '': [
    { label: 'Dashboard', path: '/admin' },
    { label: 'Logout', action: 'logout' },
  ],
  articles: [
    { label: 'Articles', path: '/admin/articles' },
    { label: 'Categories', path: '/admin/categories' },
    { label: 'Glossary', path: '/admin/kb/glossary' },
  ],
  categories: [
    { label: 'Articles', path: '/admin/articles' },
    { label: 'Categories', path: '/admin/categories' },
    { label: 'Glossary', path: '/admin/kb/glossary' },
  ],
  kb: [
    { label: 'Articles', path: '/admin/articles' },
    { label: 'Categories', path: '/admin/categories' },
    { label: 'Glossary', path: '/admin/kb/glossary' },
  ],
  usergroups: [
    { label: 'Users', path: '/admin/users' },
    { label: 'User Groups', path: '/admin/usergroups' },
    { label: 'Failed Logins', path: '/admin/users/failed-logins' },
  ],
  users: [
    { label: 'Users', path: '/admin/users' },
    { label: 'Comments', path: '/admin/comments' },
    { label: 'User Groups', path: '/admin/usergroups' },
    { label: 'Failed Logins', path: '/admin/users/failed-logins' },
  ],
  comments: [
    { label: 'Users', path: '/admin/users' },
    { label: 'Comments', path: '/admin/comments' },
    { label: 'User Groups', path: '/admin/usergroups' },
    { label: 'Failed Logins', path: '/admin/users/failed-logins' },
  ],
  modules: [{ label: 'Modules', path: '/admin/modules' }],
  settings: [
    { label: 'Settings', path: '/admin/settings' },
    { label: 'Images', path: '/admin/images' },
    { label: 'Themes', path: '/admin/themes' },
    { label: 'Utilities', path: '/admin/utilities' },
  ],
  images: [
    { label: 'Settings', path: '/admin/settings' },
    { label: 'Images', path: '/admin/images' },
    { label: 'Themes', path: '/admin/themes' },
    { label: 'Utilities', path: '/admin/utilities' },
  ],
  themes: [
    { label: 'Settings', path: '/admin/settings' },
    { label: 'Images', path: '/admin/images' },
    { label: 'Themes', path: '/admin/themes' },
    { label: 'Utilities', path: '/admin/utilities' },
  ],
  utilities: [
    { label: 'Settings', path: '/admin/settings' },
    { label: 'Images', path: '/admin/images' },
    { label: 'Themes', path: '/admin/themes' },
    { label: 'Utilities', path: '/admin/utilities' },
  ],
}

/**
 * AdminLayout — wraps all /admin/* routes with a consistent shell:
 * header (app name + user info + actions), top nav bar, sub-nav, main content.
 */
export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Derive active section from pathname: /admin → '', /admin/articles → 'articles'
  const section = location.pathname.split('/')[2] ?? ''

  const handleLogout = async () => {
    await logout()
    toast.success('Signed out successfully')
    navigate('/login', { replace: true })
  }

  // Filter top nav items by permissions
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!item.permission) return true
    return user?.permissions[item.permission] === true
  })

  // Sub-nav for the current section (default to dashboard)
  const subNavItems: SubNavItem[] = SUB_NAV[section] ?? SUB_NAV['']

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ------------------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b bg-card">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* App name */}
          <Link
            to="/admin"
            className="text-lg font-bold text-primary shrink-0"
            aria-label="68kb Knowledge Base admin"
          >
            68kb
          </Link>

          {/* Top navigation */}
          <nav aria-label="Admin main navigation" className="flex-1 hidden sm:flex">
            <ul className="flex items-center gap-1">
              {visibleNavItems.map((item) => {
                // Articles tab is also active for categories and kb sub-sections
                const isActive =
                  item.key === ''
                    ? section === ''
                    : item.key === 'articles'
                      ? section === 'articles' || section === 'categories' || section === 'kb'
                      : item.key === 'users'
                        ? section === 'users' || section === 'usergroups' || section === 'comments'
                        : item.key === 'settings'
                          ? section === 'settings' || section === 'themes' || section === 'utilities' || section === 'images'
                          : section === item.key
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

          {/* User info area */}
          <div className="flex items-center gap-3 shrink-0 text-sm">
            <span className="text-muted-foreground hidden md:inline">
              {user?.username}
            </span>
            <Link
              to="/admin/account"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Edit Account"
            >
              Edit Account
            </Link>
            <Link
              to="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="View Site"
            >
              View Site
            </Link>
            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Logout"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Sub-navigation bar */}
      {/* ------------------------------------------------------------------ */}
      <nav
        aria-label="Admin sub-navigation"
        className="border-b bg-muted/40"
      >
        <div className="max-w-screen-xl mx-auto px-4 h-10 flex items-center gap-4">
          {subNavItems.map((item) => {
            if (item.action === 'logout') {
              return (
                <button
                  key={item.label}
                  onClick={handleLogout}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Logout"
                >
                  {item.label}
                </button>
              )
            }
            return (
              <Link
                key={item.label}
                to={item.path}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* Main content */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
