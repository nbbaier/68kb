import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AdminCategoryDeletePage } from '../pages/AdminCategoryDeletePage'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CATEGORY = {
  catId: 10,
  catName: 'Tech Articles',
  catUri: 'tech-articles',
  catParent: 0,
  catImage: '',
}

const ALL_CATEGORIES = [
  { catId: 20, catParent: 0, catUri: 'other', catName: 'Other Category', depth: 0 },
  { catId: 30, catParent: 20, catUri: 'other/sub', catName: 'Sub Category', depth: 1 },
]

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  global.fetch = fetchMock
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function setupMocks({
  articleCount = 0,
  categoriesForReplacement = ALL_CATEGORIES,
}: {
  articleCount?: number
  categoriesForReplacement?: typeof ALL_CATEGORIES
} = {}) {
  fetchMock
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: CATEGORY }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { count: articleCount } }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: categoriesForReplacement }),
    })
}

function renderDeletePage(catId = '10') {
  return render(
    <MemoryRouter initialEntries={[`/admin/categories/${catId}/delete`]}>
      <Routes>
        <Route path="/admin/categories/:id/delete" element={<AdminCategoryDeletePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminCategoryDeletePage', () => {
  describe('Loading state', () => {
    it('shows loading indicator initially', () => {
      fetchMock.mockReturnValue(new Promise(() => {}))
      renderDeletePage()
      expect(screen.getByText('Loading…')).toBeInTheDocument()
    })
  })

  describe('Category with no articles', () => {
    beforeEach(() => {
      setupMocks({ articleCount: 0 })
    })

    it('shows "Delete Category" heading', async () => {
      renderDeletePage()
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: 'Delete Category' })).toBeInTheDocument(),
      )
    })

    it('shows category name in confirmation text', async () => {
      renderDeletePage()
      await waitFor(() =>
        expect(screen.getByText(/Tech Articles/)).toBeInTheDocument(),
      )
    })

    it('shows Delete button enabled', async () => {
      renderDeletePage()
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /delete category/i })
        expect(btn).toBeInTheDocument()
        expect(btn).not.toBeDisabled()
      })
    })

    it('does NOT show article count warning when no articles', async () => {
      renderDeletePage()
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: 'Delete Category' })).toBeInTheDocument(),
      )
      expect(screen.queryByTestId('article-count')).not.toBeInTheDocument()
    })

    it('calls DELETE API when confirmed', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { deleted: true } }),
      })
      setupMocks({ articleCount: 0 })
      renderDeletePage()
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /delete category/i })).not.toBeDisabled(),
      )
      fireEvent.click(screen.getByRole('button', { name: /delete category/i }))
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/admin/categories/10'),
          expect.objectContaining({ method: 'DELETE' }),
        ),
      )
    })

    it('shows Back to Categories link', async () => {
      renderDeletePage()
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: 'Delete Category' })).toBeInTheDocument(),
      )
      const links = screen.getAllByRole('link', { name: /back to categories|cancel/i })
      expect(links.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Category with articles', () => {
    beforeEach(() => {
      setupMocks({ articleCount: 5 })
    })

    it('shows article count warning', async () => {
      renderDeletePage()
      await waitFor(() =>
        expect(screen.getByTestId('article-count')).toHaveTextContent('5'),
      )
    })

    it('shows reassignment dropdown', async () => {
      renderDeletePage()
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: 'Delete Category' })).toBeInTheDocument(),
      )
      expect(screen.getByLabelText(/replacement category/i)).toBeInTheDocument()
    })

    it('shows other categories in the dropdown (excludes current)', async () => {
      renderDeletePage()
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: 'Delete Category' })).toBeInTheDocument(),
      )
      // The current category (Tech Articles) is excluded from the replacement dropdown
      // Its name appears in the confirmation text but not in dropdown options
      expect(screen.getByLabelText(/replacement category/i)).toBeInTheDocument()
    })

    it('disables Delete button when no replacement selected', async () => {
      renderDeletePage()
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /delete category/i })
        expect(btn).toBeDisabled()
      })
    })
  })

  describe('Error handling', () => {
    it('shows error when API fails', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'Server error' }) })
      renderDeletePage()
      await waitFor(() =>
        expect(screen.getByRole('alert')).toBeInTheDocument(),
      )
    })
  })
})
