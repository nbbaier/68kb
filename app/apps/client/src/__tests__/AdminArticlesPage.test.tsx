import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AdminArticlesPage, type Article } from '../pages/AdminArticlesPage'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeArticle = (overrides: Partial<Article> = {}): Article => ({
  articleId: 1,
  articleTitle: 'Test Article',
  articleUri: 'test-article',
  articleDate: 1700000000,
  articleModified: 1700100000,
  articleDisplay: 'y',
  articleOrder: 0,
  categories: [{ catId: 1, catName: 'Tutorials' }],
  ...overrides,
})

const ARTICLES: Article[] = [
  makeArticle({ articleId: 1, articleTitle: 'Alpha Article', articleDisplay: 'y', categories: [{ catId: 1, catName: 'Tutorials' }] }),
  makeArticle({ articleId: 2, articleTitle: 'Beta Article', articleDisplay: 'n', categories: [] }),
  makeArticle({ articleId: 3, articleTitle: 'Gamma Article', articleDisplay: 'y', categories: [{ catId: 2, catName: 'Guides' }, { catId: 3, catName: 'Tips' }] }),
]

function makeResponse(articles: Article[], total?: number, page = 1) {
  return {
    data: articles,
    total: total ?? articles.length,
    page,
  }
}

// ---------------------------------------------------------------------------
// Mock global fetch
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
// Render helper
// ---------------------------------------------------------------------------

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/articles']}>
      <AdminArticlesPage />
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminArticlesPage', () => {
  describe('Initial render', () => {
    it('shows Add Article button linking to /admin/articles/new', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(ARTICLES),
      })
      renderPage()
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

      const addButton = screen.getByRole('link', { name: /add article/i })
      expect(addButton).toBeInTheDocument()
      expect(addButton).toHaveAttribute('href', '/admin/articles/new')
    })

    it('renders column headers: Title, Categories, Date Added, Date Edited, Display', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(ARTICLES),
      })
      renderPage()
      await waitFor(() => expect(screen.getByText('Alpha Article')).toBeInTheDocument())

      expect(screen.getByRole('button', { name: /sort by title/i })).toBeInTheDocument()
      expect(screen.getByText('Categories')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by date added/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by date edited/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by display/i })).toBeInTheDocument()
    })

    it('renders article titles as links to edit pages', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(ARTICLES),
      })
      renderPage()
      await waitFor(() => expect(screen.getByText('Alpha Article')).toBeInTheDocument())

      const titleLink = screen.getByRole('link', { name: 'Alpha Article' })
      expect(titleLink).toHaveAttribute('href', '/admin/articles/1/edit')
    })

    it('renders category names comma-separated', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(ARTICLES),
      })
      renderPage()
      await waitFor(() => expect(screen.getByText('Guides, Tips')).toBeInTheDocument())
    })

    it('shows em-dash for articles with no categories', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(ARTICLES),
      })
      renderPage()
      await waitFor(() => expect(screen.getByText('Beta Article')).toBeInTheDocument())
      // The em-dash for Beta Article's empty categories
      const cells = screen.getAllByText('—')
      expect(cells.length).toBeGreaterThanOrEqual(1)
    })

    it('renders Active badge for display=y and Inactive badge for display=n', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(ARTICLES),
      })
      renderPage()
      await waitFor(() => expect(screen.getByText('Alpha Article')).toBeInTheDocument())

      const activeBadges = screen.getAllByText('Active')
      const inactiveBadges = screen.getAllByText('Inactive')
      expect(activeBadges.length).toBeGreaterThanOrEqual(1)
      expect(inactiveBadges.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Empty state', () => {
    it('shows empty state message when no articles exist', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse([]),
      })
      renderPage()
      await waitFor(() =>
        expect(
          screen.getByText(/no articles found/i),
        ).toBeInTheDocument(),
      )
    })

    it('shows search-specific empty message when search returns no results', async () => {
      // First call returns data, then after search returns empty
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => makeResponse(ARTICLES) })
        .mockResolvedValueOnce({ ok: true, json: async () => makeResponse([]) })

      renderPage()
      await waitFor(() => expect(screen.getByText('Alpha Article')).toBeInTheDocument())

      const searchInput = screen.getByRole('searchbox', { name: /search articles/i })
      fireEvent.change(searchInput, { target: { value: 'zzznomatch' } })
      fireEvent.submit(searchInput.closest('form')!)

      await waitFor(() =>
        expect(
          screen.getByText(/no articles match your search/i),
        ).toBeInTheDocument(),
      )
    })
  })

  describe('Search', () => {
    it('fetches with search param when search is submitted', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => makeResponse(ARTICLES) })
        .mockResolvedValueOnce({ ok: true, json: async () => makeResponse([ARTICLES[0]]) })

      renderPage()
      await waitFor(() => expect(screen.getByText('Alpha Article')).toBeInTheDocument())

      const searchInput = screen.getByRole('searchbox', { name: /search articles/i })
      fireEvent.change(searchInput, { target: { value: 'alpha' } })
      fireEvent.submit(searchInput.closest('form')!)

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2)
        const lastCall = fetchMock.mock.calls[1][0] as string
        expect(lastCall).toContain('search=alpha')
      })
    })

    it('resets to page 1 when search is submitted', async () => {
      fetchMock
        .mockResolvedValue({ ok: true, json: async () => makeResponse(ARTICLES) })

      renderPage()
      await waitFor(() => expect(screen.getByText('Alpha Article')).toBeInTheDocument())

      const searchInput = screen.getByRole('searchbox', { name: /search articles/i })
      fireEvent.change(searchInput, { target: { value: 'alpha' } })
      fireEvent.submit(searchInput.closest('form')!)

      await waitFor(() => {
        const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string
        expect(lastCall).toContain('page=1')
      })
    })
  })

  describe('Sorting', () => {
    it('fetches with sort=title asc when Title header clicked', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => makeResponse(ARTICLES) })
        .mockResolvedValueOnce({ ok: true, json: async () => makeResponse(ARTICLES) })

      renderPage()
      await waitFor(() => expect(screen.getByText('Alpha Article')).toBeInTheDocument())

      fireEvent.click(screen.getByRole('button', { name: /sort by title/i }))

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2)
        const lastCall = fetchMock.mock.calls[1][0] as string
        expect(lastCall).toContain('sort=title')
        expect(lastCall).toContain('order=asc')
      })
    })

    it('toggles to desc when the same column header is clicked twice', async () => {
      fetchMock
        .mockResolvedValue({ ok: true, json: async () => makeResponse(ARTICLES) })

      renderPage()
      await waitFor(() => expect(screen.getByText('Alpha Article')).toBeInTheDocument())

      // Click once → asc
      fireEvent.click(screen.getByRole('button', { name: /sort by title/i }))
      await waitFor(() => {
        const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string
        expect(lastCall).toContain('order=asc')
      })

      // Click again → desc
      fireEvent.click(screen.getByRole('button', { name: /sort by title/i }))
      await waitFor(() => {
        const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string
        expect(lastCall).toContain('order=desc')
      })
    })
  })

  describe('Pagination', () => {
    it('shows pagination when total > page size', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: ARTICLES, total: 25, page: 1 }),
      })
      renderPage()
      await waitFor(() => expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument())
    })

    it('does not show pagination when total <= page size', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(ARTICLES),
      })
      renderPage()
      await waitFor(() => expect(screen.getByText('Alpha Article')).toBeInTheDocument())
      expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument()
    })

    it('fetches page 2 when next page is clicked', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: ARTICLES, total: 25, page: 1 }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: ARTICLES, total: 25, page: 2 }) })

      renderPage()
      await waitFor(() => expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument())

      // PaginationNext renders an <a> without href, so use aria-label directly
      const nextBtn = screen.getByLabelText(/go to next page/i)
      fireEvent.click(nextBtn)

      await waitFor(() => {
        const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string
        expect(lastCall).toContain('page=2')
      })
    })
  })

  describe('Loading state', () => {
    it('shows loading text while fetching', () => {
      // Hang the fetch
      fetchMock.mockReturnValueOnce(new Promise(() => {}))
      renderPage()
      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })
  })

  describe('Error state', () => {
    it('shows error message when fetch fails', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Unauthorized' }) })
      renderPage()
      await waitFor(() =>
        expect(screen.getByRole('alert')).toBeInTheDocument(),
      )
    })
  })

  describe('Row selection', () => {
    it('shows selected count when rows are selected', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(ARTICLES),
      })
      renderPage()
      await waitFor(() => expect(screen.getByText('Alpha Article')).toBeInTheDocument())

      // Select first article's checkbox
      const checkboxes = screen.getAllByRole('checkbox')
      // First checkbox is "select all", subsequent are per-row
      fireEvent.click(checkboxes[1])

      await waitFor(() => {
        expect(screen.getByText(/1 of 3 article\(s\) selected/i)).toBeInTheDocument()
      })
    })
  })
})
