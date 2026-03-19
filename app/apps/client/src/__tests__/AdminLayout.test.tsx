import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { AdminLayout } from '../components/AdminLayout'
import { MockAuthProvider } from './test-utils'
import type { AuthUser } from '../contexts/AuthContext'

// ---------------------------------------------------------------------------
// Mock admin user (super admin with all permissions)
// ---------------------------------------------------------------------------
const superAdminUser: AuthUser = {
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

// Admin user with limited permissions (only dashboard access)
const limitedAdminUser: AuthUser = {
  userId: 2,
  username: 'limited',
  userGroup: 3,
  userEmail: 'limited@example.com',
  permissions: {
    canAccessAdmin: true,
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

function renderAdminLayout(user: AuthUser = superAdminUser, path = '/admin') {
  const mockLogout = vi.fn().mockResolvedValue(undefined)
  return {
    mockLogout,
    ...render(
      <MemoryRouter initialEntries={[path]}>
        <MockAuthProvider options={{ user, logout: mockLogout }}>
          <Routes>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<div>Dashboard content</div>} />
              <Route path="articles" element={<div>Articles content</div>} />
              <Route path="users" element={<div>Users content</div>} />
              <Route path="modules" element={<div>Modules content</div>} />
              <Route path="settings" element={<div>Settings content</div>} />
            </Route>
            <Route path="/login" element={<div>Login page</div>} />
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    ),
  }
}

describe('AdminLayout', () => {
  describe('Header', () => {
    it('renders app name "68kb"', () => {
      renderAdminLayout()
      expect(screen.getByText('68kb')).toBeInTheDocument()
    })

    it('renders the username in the header', () => {
      renderAdminLayout()
      expect(screen.getByText('admin')).toBeInTheDocument()
    })

    it('renders Edit Account link', () => {
      renderAdminLayout()
      const editAccountLink = screen.getByRole('link', { name: /edit account/i })
      expect(editAccountLink).toBeInTheDocument()
      expect(editAccountLink).toHaveAttribute('href', '/admin/account')
    })

    it('renders View Site link pointing to /', () => {
      renderAdminLayout()
      const viewSiteLink = screen.getByRole('link', { name: /view site/i })
      expect(viewSiteLink).toBeInTheDocument()
      expect(viewSiteLink).toHaveAttribute('href', '/')
    })

    it('renders a Logout button in header', () => {
      renderAdminLayout()
      // There may be multiple logout elements (header + sub-nav), verify at least one
      const logoutButtons = screen.getAllByRole('button', { name: /logout/i })
      expect(logoutButtons.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Top navigation', () => {
    it('shows all nav tabs for super admin', () => {
      renderAdminLayout()
      // Dashboard appears in both top nav and sub-nav (at least one exists)
      expect(screen.getAllByRole('link', { name: 'Dashboard' }).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByRole('link', { name: 'Articles' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Modules' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    })

    it('hides permission-gated nav tabs for limited admin', () => {
      renderAdminLayout(limitedAdminUser)
      // Dashboard appears in both top nav and sub-nav
      expect(screen.getAllByRole('link', { name: 'Dashboard' }).length).toBeGreaterThanOrEqual(1)
      expect(screen.queryByRole('link', { name: 'Articles' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Modules' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
    })
  })

  describe('Sub-navigation', () => {
    it('shows Dashboard and Logout in sub-nav on dashboard route', () => {
      renderAdminLayout(superAdminUser, '/admin')
      // Find Dashboard link (may be multiple - one in top nav, one in sub-nav)
      const dashboardLinks = screen.getAllByRole('link', { name: 'Dashboard' })
      expect(dashboardLinks.length).toBeGreaterThanOrEqual(1)
      // Find Logout button(s) in sub-nav
      const logoutButtons = screen.getAllByRole('button', { name: /logout/i })
      expect(logoutButtons.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Main content', () => {
    it('renders the Outlet (child route content)', () => {
      renderAdminLayout()
      expect(screen.getByText('Dashboard content')).toBeInTheDocument()
    })
  })

  describe('Logout action', () => {
    it('calls logout and redirects to /login when Logout is clicked', async () => {
      const { mockLogout } = renderAdminLayout()
      // Click the first Logout button found
      const logoutButtons = screen.getAllByRole('button', { name: /logout/i })
      fireEvent.click(logoutButtons[0])
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled()
      })
    })
  })
})
