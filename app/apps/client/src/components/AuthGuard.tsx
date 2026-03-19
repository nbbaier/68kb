import { Navigate, useLocation, useSearchParams } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'

type AuthGuardProps = {
  children: React.ReactNode
  /** If provided, redirects authenticated users away (for auth pages like /login, /register) */
  redirectIfAuthenticated?: string
  /**
   * If true, also checks that the authenticated user has canAccessAdmin permission.
   * Non-admin users are redirected to / instead of being shown admin content.
   */
  requireAdmin?: boolean
}

/**
 * AuthGuard — protects routes that require authentication.
 *
 * - If user is not authenticated, redirects to /login with ?redirect= storing the intended URL.
 * - If redirectIfAuthenticated is provided and user IS authenticated, redirects to that path.
 *   On auth pages that have a ?redirect= query param (e.g. /login?redirect=/admin/settings),
 *   the authenticated redirect uses the ?redirect= value so post-login deep-links work correctly.
 * - If requireAdmin is true, non-admin users (canAccessAdmin=false) are redirected to /.
 */
export function AuthGuard({ children, redirectIfAuthenticated, requireAdmin }: AuthGuardProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  if (isLoading) {
    // Show nothing (or a spinner) while checking session
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    )
  }

  // Auth page guard: redirect authenticated users away from /login, /register, etc.
  // Respect the ?redirect= param so navigating to /login?redirect=/admin/settings while
  // already authenticated takes you directly to /admin/settings.
  if (redirectIfAuthenticated && user) {
    const target = searchParams.get('redirect') ?? redirectIfAuthenticated
    return <Navigate to={target} replace />
  }

  // Protected route guard: redirect unauthenticated users to /login
  if (!redirectIfAuthenticated && !user) {
    const intendedPath = location.pathname + location.search
    return <Navigate to={`/login?redirect=${encodeURIComponent(intendedPath)}`} replace />
  }

  // Admin guard: redirect authenticated non-admin users to homepage
  if (requireAdmin && user && !user.permissions.canAccessAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
