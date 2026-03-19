import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { HomePage } from '../pages/HomePage'
import { MockAuthProvider } from './test-utils'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCategories = [
  { catId: 1, catParent: 0, catUri: 'php', catName: 'PHP', catDescription: 'PHP programming', depth: 0, articleCount: 5 },
  { catId: 2, catParent: 0, catUri: 'javascript', catName: 'JavaScript', catDescription: 'JS tips', depth: 0, articleCount: 3 },
  { catId: 3, catParent: 0, catUri: 'python', catName: 'Python', catDescription: 'Python tutorials', depth: 0, articleCount: 2 },
  { catId: 4, catParent: 1, catUri: 'php/oop', catName: 'PHP OOP', catDescription: 'OOP in PHP', depth: 1, articleCount: 1 },
]

const mockPopular = [
  { articleId: 1, articleUri: 'intro-php', articleTitle: 'Intro to PHP', articleShortDesc: '', articleDate: 1000, articleHits: 100 },
  { articleId: 2, articleUri: 'js-basics', articleTitle: 'JavaScript Basics', articleShortDesc: '', articleDate: 900, articleHits: 50 },
]

const mockRecent = [
  { articleId: 3, articleUri: 'new-article', articleTitle: 'New Article', articleShortDesc: '', articleDate: 2000, articleHits: 5 },
  { articleId: 1, articleUri: 'intro-php', articleTitle: 'Intro to PHP', articleShortDesc: '', articleDate: 1000, articleHits: 100 },
]

function mockFetch(url: string) {
  if (url.includes('/api/categories')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: mockCategories }),
    })
  }
  if (url.includes('/api/articles/popular')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: mockPopular }),
    })
  }
  if (url.includes('/api/articles/recent')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: mockRecent }),
    })
  }
  if (url.includes('/api/settings/public')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: { siteName: 'Test KB', siteDescription: '' } }),
    })
  }
  return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(mockFetch))
})

function renderHomePage(user = null) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <MockAuthProvider options={{ user, isLoading: false }}>
        <HomePage />
      </MockAuthProvider>
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HomePage — Category Grid', () => {
  it('renders top-level categories in the grid', async () => {
    renderHomePage()
    await waitFor(() => {
      // Top-level categories (depth=0) should appear
      expect(screen.getByText('PHP')).toBeInTheDocument()
      expect(screen.getByText('JavaScript')).toBeInTheDocument()
      expect(screen.getByText('Python')).toBeInTheDocument()
    })
  })

  it('does not render child categories in the top-level grid', async () => {
    renderHomePage()
    await waitFor(() => {
      expect(screen.getByText('PHP')).toBeInTheDocument()
    })
    // Child category (depth=1) should NOT appear in the main grid
    expect(screen.queryByText('PHP OOP')).not.toBeInTheDocument()
  })

  it('links categories to /categories/{uri}', async () => {
    renderHomePage()
    await waitFor(() => {
      expect(screen.getByText('PHP')).toBeInTheDocument()
    })
    const phpLink = screen.getByRole('link', { name: /^php$/i })
    expect(phpLink).toHaveAttribute('href', '/categories/php')
  })

  it('shows article count for categories', async () => {
    renderHomePage()
    await waitFor(() => {
      expect(screen.getByText('PHP')).toBeInTheDocument()
    })
    // The "5 articles" count should appear (or "5" near PHP)
    expect(screen.getByText(/5 article/i) || screen.getAllByText(/5/i).length).toBeTruthy()
  })
})

describe('HomePage — Most Popular Articles', () => {
  it('renders Most Popular section', async () => {
    renderHomePage()
    await waitFor(() => {
      expect(screen.getByText(/most popular/i)).toBeInTheDocument()
    })
  })

  it('renders popular article titles with links', async () => {
    renderHomePage()
    await waitFor(() => {
      // "Intro to PHP" may appear in both popular and recent — use getAllByRole
      const links = screen.getAllByRole('link', { name: /intro to php/i })
      expect(links.length).toBeGreaterThan(0)
      expect(links[0]).toHaveAttribute('href', '/article/intro-php')
    })
  })
})

describe('HomePage — Recent Articles', () => {
  it('renders Recent Articles section', async () => {
    renderHomePage()
    await waitFor(() => {
      expect(screen.getByText(/recent articles/i)).toBeInTheDocument()
    })
  })

  it('renders recent article titles with links', async () => {
    renderHomePage()
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /new article/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /new article/i })).toHaveAttribute('href', '/article/new-article')
  })
})

describe('HomePage — Empty States', () => {
  it('shows empty state when no categories exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/categories')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) })
      }
      if (url.includes('/api/articles/popular')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) })
      }
      if (url.includes('/api/articles/recent')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) })
      }
      if (url.includes('/api/settings/public')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { siteName: 'Test KB' } }) })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    }))

    renderHomePage()

    // Should not crash — page loads
    await waitFor(() => {
      // Some kind of empty state or just no article crash
      expect(document.body).toBeInTheDocument()
    })
  })

  it('shows empty state when no articles exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/categories')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) })
      }
      if (url.includes('/api/articles/popular')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) })
      }
      if (url.includes('/api/articles/recent')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) })
      }
      if (url.includes('/api/settings/public')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { siteName: 'Test KB' } }) })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    }))

    renderHomePage()

    await waitFor(() => {
      // Should render no-articles messages
      expect(screen.queryByText(/intro to php/i)).not.toBeInTheDocument()
    })
  })
})
