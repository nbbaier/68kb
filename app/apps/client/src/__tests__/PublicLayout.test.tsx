import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { PublicLayout } from '../components/PublicLayout'
import { MockAuthProvider } from './test-utils'
import type { AuthUser } from '../contexts/AuthContext'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock fetch for settings and categories
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/settings/public')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { siteName: 'Test KB', siteDescription: '' } }),
      })
    }
    if (url.includes('/api/categories')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { catId: 1, catParent: 0, catUri: 'php', catName: 'PHP', catDescription: '', depth: 0, articleCount: 5 },
            { catId: 2, catParent: 0, catUri: 'javascript', catName: 'JavaScript', catDescription: '', depth: 0, articleCount: 3 },
          ],
        }),
      })
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
  }))
})

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

function renderPublicLayout(user: AuthUser | null = null, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MockAuthProvider options={{ user, isLoading: false }}>
        <Routes>
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<div>Home content</div>} />
            <Route path="categories" element={<div>Categories content</div>} />
            <Route path="glossary" element={<div>Glossary content</div>} />
            <Route path="search" element={<div>Search content</div>} />
          </Route>
        </Routes>
      </MockAuthProvider>
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PublicLayout — Navigation', () => {
  it('renders all 4 navigation links', async () => {
    renderPublicLayout()
    expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument()
    // Categories link exists (may be multiple — check at least one)
    expect(screen.getAllByRole('link', { name: /^categories$/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /^glossary$/i })).toBeInTheDocument()
    // Advanced Search link exists (may be multiple — nav + sidebar)
    expect(screen.getAllByRole('link', { name: /advanced search/i }).length).toBeGreaterThan(0)
  })

  it('Home link points to /', async () => {
    renderPublicLayout()
    expect(screen.getByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/')
  })

  it('Categories link points to /categories', async () => {
    renderPublicLayout()
    const links = screen.getAllByRole('link', { name: /^categories$/i })
    // There may be a categories nav link and sidebar link — find the nav one
    const navLink = links.find((l) => l.getAttribute('href') === '/categories')
    expect(navLink).toBeInTheDocument()
  })

  it('Glossary link points to /glossary', async () => {
    renderPublicLayout()
    expect(screen.getByRole('link', { name: /^glossary$/i })).toHaveAttribute('href', '/glossary')
  })

  it('Advanced Search link points to /search', async () => {
    renderPublicLayout()
    // Both nav bar and sidebar have Advanced Search links
    const links = screen.getAllByRole('link', { name: /advanced search/i })
    expect(links.some((l) => l.getAttribute('href') === '/search')).toBe(true)
  })
})

describe('PublicLayout — User Navigation', () => {
  it('shows Login and Register links when not authenticated', () => {
    renderPublicLayout(null)
    expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument()
  })

  it('does not show Welcome or My Account when logged out', () => {
    renderPublicLayout(null)
    expect(screen.queryByText(/welcome,/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /my account/i })).not.toBeInTheDocument()
  })

  it('shows Welcome username and My Account when authenticated', () => {
    renderPublicLayout(adminUser)
    expect(screen.getByText(/welcome.*admin/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /my account/i })).toBeInTheDocument()
  })

  it('does not show Login/Register when authenticated', () => {
    renderPublicLayout(adminUser)
    expect(screen.queryByRole('link', { name: /^login$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^register$/i })).not.toBeInTheDocument()
  })

  it('My Account link points to /users/account', () => {
    renderPublicLayout(adminUser)
    expect(screen.getByRole('link', { name: /my account/i })).toHaveAttribute('href', '/users/account')
  })

  it('Login link points to /users/login', () => {
    renderPublicLayout(null)
    expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/users/login')
  })

  it('Register link points to /users/register', () => {
    renderPublicLayout(null)
    expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute('href', '/users/register')
  })
})

describe('PublicLayout — Sidebar', () => {
  it('renders search box with input and submit button', () => {
    renderPublicLayout()
    // type="search" input has role "searchbox"
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
  })

  it('renders Advanced Search link in sidebar', () => {
    renderPublicLayout()
    // There should be at least one "Advanced Search" link in the sidebar pointing to /search
    const links = screen.getAllByRole('link', { name: /advanced search/i })
    expect(links.length).toBeGreaterThan(0)
  })

  it('renders "Categories" section heading in sidebar', () => {
    renderPublicLayout()
    // The sidebar has a "Categories" h2 heading
    const headings = screen.getAllByRole('heading', { name: /categories/i })
    expect(headings.length).toBeGreaterThan(0)
  })
})

describe('PublicLayout — Footer', () => {
  it('renders footer with copyright', () => {
    renderPublicLayout()
    // Footer should have © current year text
    const year = new Date().getFullYear().toString()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo').textContent).toContain(year)
  })
})

describe('PublicLayout — Active Nav Indicator', () => {
  it('Home link has active indicator on / route', () => {
    renderPublicLayout(null, '/')
    const homeLink = screen.getByRole('link', { name: /^home$/i })
    // Should have aria-current or active class
    expect(
      homeLink.getAttribute('aria-current') === 'page' ||
      homeLink.className.includes('active') ||
      homeLink.className.includes('font-bold') ||
      homeLink.className.includes('text-primary')
    ).toBe(true)
  })
})
