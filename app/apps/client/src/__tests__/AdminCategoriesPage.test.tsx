import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AdminCategoriesPage, type CategoryWithDepth } from '../pages/AdminCategoriesPage'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeCategory = (overrides: Partial<CategoryWithDepth> = {}): CategoryWithDepth => ({
  catId: 1,
  catParent: 0,
  catUri: 'test-cat',
  catName: 'Test Category',
  catDescription: 'A test category',
  catAllowads: 'yes',
  catDisplay: 'yes',
  catOrder: 0,
  catImage: '',
  catKeywords: '',
  depth: 0,
  ...overrides,
})

const CATEGORIES: CategoryWithDepth[] = [
  makeCategory({ catId: 1, catName: 'Root Cat', catAllowads: 'yes', catDisplay: 'yes', depth: 0 }),
  makeCategory({
    catId: 2,
    catName: 'Child Cat',
    catParent: 1,
    catAllowads: 'no',
    catDisplay: 'no',
    depth: 1,
  }),
  makeCategory({
    catId: 3,
    catName: 'Grandchild Cat',
    catParent: 2,
    catAllowads: 'yes',
    catDisplay: 'yes',
    depth: 2,
  }),
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/categories']}>
      <AdminCategoriesPage />
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminCategoriesPage', () => {
  describe('Loading state', () => {
    it('shows loading indicator initially', () => {
      fetchMock.mockReturnValue(new Promise(() => {})) // never resolves
      renderPage()
      expect(screen.getByText('Loading…')).toBeInTheDocument()
    })
  })

  describe('Empty state', () => {
    it('shows empty state message when no categories', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      renderPage()
      await waitFor(() =>
        expect(
          screen.getByText(/No categories found/i),
        ).toBeInTheDocument(),
      )
    })
  })

  describe('Grid render', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: CATEGORIES }),
      })
    })

    it('shows Add Category button linking to /admin/categories/new', async () => {
      renderPage()
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      const addBtn = screen.getByRole('link', { name: /add category/i })
      expect(addBtn).toBeInTheDocument()
      expect(addBtn).toHaveAttribute('href', '/admin/categories/new')
    })

    it('renders column headers: Title, Allow Ads, Display, Duplicate, Delete', async () => {
      renderPage()
      await waitFor(() => expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0))
      expect(screen.getByRole('columnheader', { name: /title/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /allow ads/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /display/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /duplicate/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /delete/i })).toBeInTheDocument()
    })

    it('renders category names as links to edit page', async () => {
      renderPage()
      await waitFor(() => expect(screen.getByText('Root Cat')).toBeInTheDocument())
      const link = screen.getByRole('link', { name: 'Root Cat' })
      expect(link).toHaveAttribute('href', '/admin/categories/1/edit')
    })

    it('shows Allow Ads column values', async () => {
      renderPage()
      await waitFor(() => expect(screen.getByText('Root Cat')).toBeInTheDocument())
      // Root Cat: Allow Ads = yes; Child Cat: Allow Ads = no; multiple Yes/No badges exist
      const yesBadges = screen.getAllByText('Yes')
      expect(yesBadges.length).toBeGreaterThanOrEqual(1)
      const noBadges = screen.getAllByText('No')
      expect(noBadges.length).toBeGreaterThanOrEqual(1)
    })

    it('shows tree indentation for child categories', async () => {
      renderPage()
      await waitFor(() => expect(screen.getByText('Child Cat')).toBeInTheDocument())
      // Depth 1: one » marker
      expect(screen.getByText('»')).toBeInTheDocument()
      // Depth 2: two » markers
      expect(screen.getByText('»»')).toBeInTheDocument()
    })

    it('renders Duplicate link for each category', async () => {
      renderPage()
      await waitFor(() => expect(screen.getByText('Root Cat')).toBeInTheDocument())
      const dupLinks = screen.getAllByRole('link', { name: /duplicate/i })
      expect(dupLinks).toHaveLength(CATEGORIES.length)
      expect(dupLinks[0]).toHaveAttribute(
        'href',
        `/admin/categories/new?duplicateId=${CATEGORIES[0].catId}`,
      )
    })

    it('renders Delete link for each category', async () => {
      renderPage()
      await waitFor(() => expect(screen.getByText('Root Cat')).toBeInTheDocument())
      const delLinks = screen.getAllByRole('link', { name: /delete/i })
      expect(delLinks).toHaveLength(CATEGORIES.length)
      expect(delLinks[0]).toHaveAttribute('href', `/admin/categories/1/delete`)
    })
  })

  describe('Error state', () => {
    it('shows error message when fetch fails', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
      renderPage()
      await waitFor(() =>
        expect(screen.getByRole('alert')).toBeInTheDocument(),
      )
    })
  })
})
