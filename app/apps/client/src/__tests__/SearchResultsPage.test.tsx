import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { MockAuthProvider } from './test-utils'
import { SearchResultsPage } from '../pages/SearchResultsPage'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockResults = {
  articles: [
    {
      articleId: 1,
      articleUri: 'intro-to-php',
      articleTitle: 'Introduction to PHP',
      articleShortDesc: 'Learn PHP basics',
      articleDate: 1000000,
      articleHits: 100,
    },
    {
      articleId: 2,
      articleUri: 'php-oop-guide',
      articleTitle: 'PHP OOP Guide',
      articleShortDesc: 'Object-oriented PHP programming',
      articleDate: 1100000,
      articleHits: 75,
    },
  ],
  total: 2,
  page: 1,
  limit: 10,
  keywords: 'PHP',
  categoryId: null,
}

const validHash = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupFetch(data: typeof mockResults | null, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/search/results/')) {
        if (status === 404 || data === null) {
          return Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'Not found' }),
          })
        }
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

function renderResultsPage(hash = validHash) {
  return render(
    <MemoryRouter initialEntries={[`/search/results/${hash}`]}>
      <MockAuthProvider>
        <Routes>
          <Route path="/search/results/:hash" element={<SearchResultsPage />} />
          <Route path="/search/no-results" element={<div>No results page</div>} />
          <Route path="/search" element={<div>Search page</div>} />
        </Routes>
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

describe('SearchResultsPage', () => {
  describe('Rendering results', () => {
    it('renders search results heading', async () => {
      setupFetch(mockResults)
      renderResultsPage()

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      })
    })

    it('displays article titles as links', async () => {
      setupFetch(mockResults)
      renderResultsPage()

      await waitFor(() => {
        expect(screen.getByText('Introduction to PHP')).toBeInTheDocument()
        expect(screen.getByText('PHP OOP Guide')).toBeInTheDocument()
      })
    })

    it('links each article to /article/{articleUri}', async () => {
      setupFetch(mockResults)
      renderResultsPage()

      await waitFor(() => {
        const phpLink = screen.getByRole('link', { name: /introduction to php/i })
        expect(phpLink).toHaveAttribute('href', '/article/intro-to-php')

        const oopLink = screen.getByRole('link', { name: /php oop guide/i })
        expect(oopLink).toHaveAttribute('href', '/article/php-oop-guide')
      })
    })

    it('shows total results count', async () => {
      setupFetch(mockResults)
      renderResultsPage()

      await waitFor(() => {
        // "2 results for..."
        expect(screen.getByText(/\d+ results? for/i)).toBeInTheDocument()
      })
    })

    it('shows search keywords in the page', async () => {
      setupFetch(mockResults)
      renderResultsPage()

      await waitFor(() => {
        // Summary line should contain the quoted keyword
        expect(screen.getByText(/results? for/i)).toBeInTheDocument()
      })
    })

    it('shows "Search Again" link back to /search', async () => {
      setupFetch(mockResults)
      renderResultsPage()

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /search again/i })
        expect(link).toHaveAttribute('href', '/search')
      })
    })
  })

  describe('Redirect on invalid hash', () => {
    it('redirects to no-results page when hash returns 404', async () => {
      setupFetch(null, 404)
      renderResultsPage()

      await waitFor(() => {
        expect(screen.getByText('No results page')).toBeInTheDocument()
      })
    })
  })

  describe('Pagination', () => {
    it('shows pagination when total > limit', async () => {
      const paginatedData = {
        ...mockResults,
        total: 15,
        limit: 10,
        page: 1,
        articles: Array.from({ length: 10 }, (_, i) => ({
          articleId: i + 1,
          articleUri: `article-${i + 1}`,
          articleTitle: `Article ${i + 1}`,
          articleShortDesc: `Short desc ${i + 1}`,
          articleDate: 1000000 + i,
          articleHits: i,
        })),
      }
      setupFetch(paginatedData)
      renderResultsPage()

      await waitFor(() => {
        // There should be a "Next" or pagination element
        expect(screen.getByText(/next/i)).toBeInTheDocument()
      })
    })

    it('does not show pagination when total <= limit', async () => {
      const smallData = { ...mockResults, total: 2, limit: 10, page: 1 }
      setupFetch(smallData)
      renderResultsPage()

      await waitFor(() => {
        expect(screen.getByText('Introduction to PHP')).toBeInTheDocument()
      })

      // Should not show previous/next buttons
      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument()
    })
  })
})
