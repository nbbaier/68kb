import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { CategoriesIndexPage } from '../pages/CategoriesIndexPage'
import { MockAuthProvider } from './test-utils'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockCategories = [
  {
    catId: 1,
    catParent: 0,
    catUri: 'php',
    catName: 'PHP',
    catDescription: 'PHP programming language',
    depth: 0,
    articleCount: 5,
  },
  {
    catId: 2,
    catParent: 0,
    catUri: 'javascript',
    catName: 'JavaScript',
    catDescription: 'Frontend and backend JS',
    depth: 0,
    articleCount: 3,
  },
  {
    catId: 3,
    catParent: 0,
    catUri: 'python',
    catName: 'Python',
    catDescription: '',
    depth: 0,
    articleCount: 0,
  },
  // Child category — should NOT appear in the index grid
  {
    catId: 4,
    catParent: 1,
    catUri: 'php/oop',
    catName: 'PHP OOP',
    catDescription: 'OOP in PHP',
    depth: 1,
    articleCount: 2,
  },
]

// ---------------------------------------------------------------------------
// Helper: mock fetch
// ---------------------------------------------------------------------------

function setupFetch(data: typeof mockCategories) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/categories')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    }),
  )
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/categories']}>
      <MockAuthProvider>
        <CategoriesIndexPage />
      </MockAuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CategoriesIndexPage', () => {
  describe('Heading', () => {
    it('renders "Categories" heading', async () => {
      setupFetch(mockCategories)
      renderPage()

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Categories')
      })
    })
  })

  describe('Category grid', () => {
    it('renders all top-level categories (depth === 0)', async () => {
      setupFetch(mockCategories)
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('PHP')).toBeInTheDocument()
        expect(screen.getByText('JavaScript')).toBeInTheDocument()
        expect(screen.getByText('Python')).toBeInTheDocument()
      })
    })

    it('does not render child categories (depth > 0)', async () => {
      setupFetch(mockCategories)
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('PHP')).toBeInTheDocument()
      })
      expect(screen.queryByText('PHP OOP')).not.toBeInTheDocument()
    })

    it('links categories to /categories/{uri}', async () => {
      setupFetch(mockCategories)
      renderPage()

      await waitFor(() => {
        const phpLink = screen.getByRole('link', { name: /^php$/i })
        expect(phpLink).toHaveAttribute('href', '/categories/php')

        const jsLink = screen.getByRole('link', { name: /^javascript$/i })
        expect(jsLink).toHaveAttribute('href', '/categories/javascript')
      })
    })

    it('shows category description when present', async () => {
      setupFetch(mockCategories)
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('PHP programming language')).toBeInTheDocument()
      })
    })

    it('shows article count for each category', async () => {
      setupFetch(mockCategories)
      renderPage()

      await waitFor(() => {
        expect(screen.getByText(/5 articles/i)).toBeInTheDocument()
        expect(screen.getByText(/3 articles/i)).toBeInTheDocument()
      })
    })

    it('shows singular "article" when count is 1', async () => {
      const data = [{ catId: 5, catParent: 0, catUri: 'single', catName: 'Single', catDescription: '', depth: 0, articleCount: 1 }]
      setupFetch(data)
      renderPage()

      await waitFor(() => {
        expect(screen.getByText(/1 article$/)).toBeInTheDocument()
      })
    })
  })

  describe('Empty state', () => {
    it('shows empty message when no categories exist', async () => {
      setupFetch([])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText(/no categories have been created yet/i)).toBeInTheDocument()
      })
    })
  })

  describe('Loading state', () => {
    it('renders loading skeleton initially', () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})))
      renderPage()

      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })
})
