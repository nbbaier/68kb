import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { AuthGuard } from '../components/AuthGuard'
import { MockAuthProvider } from './test-utils'
import type { AuthUser } from '../contexts/AuthContext'

const adminUser: AuthUser = {
  userId: 1,
  username: 'admin',
  userGroup: 1,
  userEmail: 'admin@example.com',
  permissions: {
    canAccessAdmin: true,
    canManageArticles: true,
    canDeleteArticles: true,
    canManageUsers: true,
    canManageCategories: true,
    canDeleteCategories: true,
    canManageSettings: true,
    canManageUtilities: true,
    canManageThemes: true,
    canManageModules: true,
    canSearch: true,
  },
}

const registeredUser: AuthUser = {
  userId: 2,
  username: 'regularuser',
  userGroup: 2,
  userEmail: 'user@example.com',
  permissions: {
    canAccessAdmin: false,
    canManageArticles: false,
    canDeleteArticles: false,
    canManageUsers: false,
    canManageCategories: false,
    canDeleteCategories: false,
    canManageSettings: false,
    canManageUtilities: false,
    canManageThemes: false,
    canManageModules: false,
    canSearch: true,
  },
}

describe('AuthGuard', () => {
  it('redirects unauthenticated user to /login', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <MockAuthProvider options={{ user: null }}>
          <Routes>
            <Route
              path="/admin"
              element={
                <AuthGuard>
                  <div>Admin Content</div>
                </AuthGuard>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })

  it('allows authenticated admin user to access admin routes', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <MockAuthProvider options={{ user: adminUser }}>
          <Routes>
            <Route
              path="/admin"
              element={
                <AuthGuard requireAdmin>
                  <div>Admin Content</div>
                </AuthGuard>
              }
            />
            <Route path="/" element={<div>Home Page</div>} />
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Admin Content')).toBeInTheDocument()
  })

  it('redirects non-admin user to / when requireAdmin is true (VAL-GUARD-006)', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <MockAuthProvider options={{ user: registeredUser }}>
          <Routes>
            <Route
              path="/admin"
              element={
                <AuthGuard requireAdmin>
                  <div>Admin Content</div>
                </AuthGuard>
              }
            />
            <Route path="/" element={<div>Home Page</div>} />
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Home Page')).toBeInTheDocument()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })

  it('redirects authenticated user away from login when redirectIfAuthenticated is set', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <MockAuthProvider options={{ user: adminUser }}>
          <Routes>
            <Route
              path="/login"
              element={
                <AuthGuard redirectIfAuthenticated="/admin">
                  <div>Login Page</div>
                </AuthGuard>
              }
            />
            <Route path="/admin" element={<div>Admin Dashboard</div>} />
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  it('shows loading state while auth is being checked', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <MockAuthProvider options={{ user: null, isLoading: true }}>
          <Routes>
            <Route
              path="/admin"
              element={
                <AuthGuard>
                  <div>Admin Content</div>
                </AuthGuard>
              }
            />
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })
})
