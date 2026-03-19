import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

export type AuthPermissions = {
  canAccessAdmin: boolean
  canManageArticles: boolean
  canDeleteArticles: boolean
  canManageUsers: boolean
  canManageCategories: boolean
  canDeleteCategories: boolean
  canManageSettings: boolean
  canManageUtilities: boolean
  canManageThemes: boolean
  canManageModules: boolean
  canSearch: boolean
}

export type AuthUser = {
  userId: number
  username: string
  userGroup: number
  userEmail: string
  permissions: AuthPermissions
}

type AuthContextValue = {
  user: AuthUser | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  forgotPassword: (email: string) => Promise<string>
  refetch: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        setUser(json.data)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    fetchMe().finally(() => setIsLoading(false))
  }, [fetchMe])

  const login = async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json.error ?? 'Login failed')
    }
    // Refetch full user data (including permissions) from /api/auth/me
    await fetchMe()
  }

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    setUser(null)
  }

  const register = async (username: string, email: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    })
    const json = await res.json()
    if (!res.ok) {
      // Propagate field-level errors for duplicate username/email
      if (json.errors) {
        const error = new Error(json.error ?? 'Registration failed') as Error & {
          fieldErrors?: Record<string, string>
        }
        error.fieldErrors = json.errors
        throw error
      }
      throw new Error(json.error ?? 'Registration failed')
    }
    // Refetch full user data (including permissions) from /api/auth/me
    await fetchMe()
  }

  const forgotPassword = async (email: string): Promise<string> => {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json.error ?? 'Request failed')
    }
    return json.data.message as string
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, register, forgotPassword, refetch: fetchMe }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
