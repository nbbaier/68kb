import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'

type AuthGuardProps = {
  children: React.ReactNode
  /** If true, redirects authenticated users away (for auth pages) */
  redirectIfAuthenticated?: string
}

/**
 * AuthGuard — protects routes that require authentication.
 *
 * - If user is not authenticated, redirects to /login with ?redirect= storing the intended URL.
 * - If redirectIfAuthenticated is provided and user IS authenticated, redirects to that path.
 */
export function AuthGuard({ children, redirectIfAuthenticated }: AuthGuardProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    // Show nothing (or a spinner) while checking session
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    )
  }

  // Auth page guard: redirect authenticated users away from /login, /register, etc.
  if (redirectIfAuthenticated && user) {
    return <Navigate to={redirectIfAuthenticated} replace />
  }

  // Protected route guard: redirect unauthenticated users to /login
  if (!redirectIfAuthenticated && !user) {
    const intendedPath = location.pathname + location.search
    return <Navigate to={`/login?redirect=${encodeURIComponent(intendedPath)}`} replace />
  }

  return <>{children}</>
}
