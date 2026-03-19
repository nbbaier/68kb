import { Link } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Public homepage — minimal placeholder for the public site.
 * Full implementation comes in a later milestone (public site).
 */
export function HomePage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8">
      <div className="max-w-lg w-full text-center space-y-6">
        <h1 className="text-4xl font-bold">68kb Knowledge Base</h1>
        <p className="text-muted-foreground text-lg">
          Welcome to the 68kb Knowledge Base. The public site is coming soon.
        </p>
        <div className="flex gap-4 justify-center">
          {user ? (
            <Link
              to="/admin"
              className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Go to Admin
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
