import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'

/**
 * LogoutPage — handles logout flow.
 *
 * On mount, calls logout() which destroys the session (POST /api/auth/logout).
 * Then redirects to /login. Works whether authenticated or not (idempotent).
 */
export function LogoutPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // logout is best-effort: ignore errors (idempotent) and always redirect to /login
    logout()
      .catch(() => {})
      .then(() => {
        navigate('/login', { replace: true })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted-foreground text-sm">Signing out…</div>
    </div>
  )
}
