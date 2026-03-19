/**
 * Test utilities — provides a MockAuthProvider to avoid async fetch issues.
 */
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { AuthContext, type AuthUser } from '../contexts/AuthContext'

type MockAuthOptions = {
  user?: AuthUser | null
  isLoading?: boolean
  login?: (username: string, password: string) => Promise<void>
  logout?: () => Promise<void>
  register?: (username: string, email: string, password: string) => Promise<void>
  forgotPassword?: (email: string) => Promise<string>
  refetch?: () => Promise<void>
}

export function MockAuthProvider({
  children,
  options = {},
}: {
  children: ReactNode
  options?: MockAuthOptions
}) {
  const defaultLogin = vi.fn().mockResolvedValue(undefined)
  const defaultLogout = vi.fn().mockResolvedValue(undefined)
  const defaultRegister = vi.fn().mockResolvedValue(undefined)
  const defaultForgotPassword = vi.fn().mockResolvedValue('Success message')
  const defaultRefetch = vi.fn().mockResolvedValue(undefined)

  return (
    <AuthContext.Provider
      value={{
        user: options.user ?? null,
        isLoading: options.isLoading ?? false,
        login: options.login ?? defaultLogin,
        logout: options.logout ?? defaultLogout,
        register: options.register ?? defaultRegister,
        forgotPassword: options.forgotPassword ?? defaultForgotPassword,
        refetch: options.refetch ?? defaultRefetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
