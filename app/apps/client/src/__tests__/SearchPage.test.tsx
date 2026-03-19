import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { MockAuthProvider } from './test-utils'
import { SearchPage } from '../pages/SearchPage'

// ---------------------------------------------------------------------------
// Mock categories for the dropdown
// ---------------------------------------------------------------------------

const mockCategories = [
  {
    catId: 1, catParent: 0, catUri: 'php', catName: 'PHP',
    catDescription: 'PHP programming', depth: 0, articleCount: 5,
  },
  {
    catId: 2, catParent: 0, catUri: 'javascript', catName: 'JavaScript',
    catDescription: 'JS', depth: 0, articleCount: 3,
  },
  {
    catId: 3, catParent: 1, catUri: 'php/oop', catName: 'PHP OOP',
    catDescription: '', depth: 1, articleCount: 2,
  },
]

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

function setupFetchCategories() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/categories')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: mockCategories }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    }),
  )
}

function renderSearchPage(initialPath = '/search') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MockAuthProvider>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
          <Route path="/search/results/:hash" element={<div>Results page</div>} />
          <Route path="/search/no-results" element={<div>No results page</div>} />
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

describe('SearchPage', () => {
  describe('Rendering', () => {
    it('renders the Advanced Search heading', async () => {
      setupFetchCategories()
      renderSearchPage()

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/advanced search/i)
      })
    })

    it('renders Keywords input', async () => {
      setupFetchCategories()
      renderSearchPage()

      await waitFor(() => {
        expect(screen.getByLabelText(/keywords/i)).toBeInTheDocument()
      })
    })

    it('renders Category dropdown', async () => {
      setupFetchCategories()
      renderSearchPage()

      await waitFor(() => {
        const select = screen.getByRole('combobox')
        expect(select).toBeInTheDocument()
      })
    })

    it('renders submit button', async () => {
      setupFetchCategories()
      renderSearchPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
      })
    })

    it('shows "All Categories" as default option in dropdown', async () => {
      setupFetchCategories()
      renderSearchPage()

      await waitFor(() => {
        expect(screen.getByRole('option', { name: /all categories/i })).toBeInTheDocument()
      })
    })

    it('populates category dropdown with visible categories', async () => {
      setupFetchCategories()
      renderSearchPage()

      await waitFor(() => {
        expect(screen.getByRole('option', { name: /php$/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /javascript/i })).toBeInTheDocument()
      })
    })

    it('shows hierarchical indentation for child categories in dropdown', async () => {
      setupFetchCategories()
      renderSearchPage()

      await waitFor(() => {
        // PHP OOP is a child (depth=1) — should show with » prefix
        const phpOopOption = screen.getByRole('option', { name: /php oop/i })
        expect(phpOopOption.textContent).toMatch(/»/)
      })
    })
  })

  describe('Pre-fill from URL query param', () => {
    it('pre-fills keywords input from ?q= URL parameter', async () => {
      setupFetchCategories()
      renderSearchPage('/search?q=hello+world')

      await waitFor(() => {
        const input = screen.getByLabelText(/keywords/i) as HTMLInputElement
        expect(input.value).toBe('hello world')
      })
    })
  })

  describe('Form submission', () => {
    it('submits search and navigates to results page on success', async () => {
      const mockHash = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string, options?: RequestInit) => {
          if (url.includes('/api/categories')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ data: mockCategories }),
            })
          }
          if (url.includes('/api/search') && options?.method === 'POST') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ data: { hash: mockHash, total: 3 } }),
            })
          }
          return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
        }),
      )

      renderSearchPage()

      await waitFor(() => {
        expect(screen.getByLabelText(/keywords/i)).toBeInTheDocument()
      })

      const input = screen.getByLabelText(/keywords/i)
      fireEvent.change(input, { target: { value: 'PHP tutorial' } })

      const button = screen.getByRole('button', { name: /search/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Results page')).toBeInTheDocument()
      })
    })

    it('navigates to no-results page when search returns noResults', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string, options?: RequestInit) => {
          if (url.includes('/api/categories')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ data: mockCategories }),
            })
          }
          if (url.includes('/api/search') && options?.method === 'POST') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ data: { noResults: true } }),
            })
          }
          return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
        }),
      )

      renderSearchPage()

      await waitFor(() => {
        expect(screen.getByLabelText(/keywords/i)).toBeInTheDocument()
      })

      const input = screen.getByLabelText(/keywords/i)
      fireEvent.change(input, { target: { value: 'xyz123nonexistent' } })

      const button = screen.getByRole('button', { name: /search/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('No results page')).toBeInTheDocument()
      })
    })
  })
})
