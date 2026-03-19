import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { CategoryDetailPage } from '../pages/CategoryDetailPage'
import { MockAuthProvider } from './test-utils'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockPageData = {
  category: {
    catId: 1,
    catName: 'PHP',
    catUri: 'php',
    catDescription: 'PHP programming language tutorials',
    catParent: 0,
    catImage: '',
    catKeywords: '',
  },
  breadcrumbs: [{ catName: 'PHP', catUri: 'php' }],
  subCategories: [
    {
      catId: 2,
      catName: 'PHP OOP',
      catUri: 'php/oop',
      catDescription: 'Object-oriented PHP',
      articleCount: 3,
    },
    {
      catId: 3,
      catName: 'PHP Basics',
      catUri: 'php/basics',
      catDescription: '',
      articleCount: 5,
    },
  ],
  articles: {
    data: [
      { articleId: 1, articleUri: 'intro-php', articleTitle: 'Intro to PHP', articleShortDesc: 'A beginner guide', articleDate: 1000000, articleHits: 50 },
      { articleId: 2, articleUri: 'php-arrays', articleTitle: 'PHP Arrays', articleShortDesc: '', articleDate: 900000, articleHits: 30 },
    ],
    total: 2,
    page: 1,
    limit: 10,
  },
}

// Nested category mock (PHP > OOP)
const mockNestedPageData = {
  category: {
    catId: 2,
    catName: 'PHP OOP',
    catUri: 'php/oop',
    catDescription: 'Object-oriented programming in PHP',
    catParent: 1,
    catImage: '',
    catKeywords: '',
  },
  breadcrumbs: [
    { catName: 'PHP', catUri: 'php' },
    { catName: 'PHP OOP', catUri: 'php/oop' },
  ],
  subCategories: [],
  articles: {
    data: [
      { articleId: 3, articleUri: 'php-classes', articleTitle: 'PHP Classes', articleShortDesc: '', articleDate: 800000, articleHits: 20 },
    ],
    total: 1,
    page: 1,
    limit: 10,
  },
}

// Empty category mock (no articles, no sub-categories)
const mockEmptyCategoryData = {
  category: {
    catId: 4,
    catName: 'Empty Cat',
    catUri: 'empty-cat',
    catDescription: '',
    catParent: 0,
    catImage: '',
    catKeywords: '',
  },
  breadcrumbs: [{ catName: 'Empty Cat', catUri: 'empty-cat' }],
  subCategories: [],
  articles: { data: [], total: 0, page: 1, limit: 10 },
}

// Paginated mock (more than 10 articles)
const mockPaginatedData = {
  ...mockPageData,
  articles: {
    data: Array.from({ length: 10 }, (_, i) => ({
      articleId: i + 1,
      articleUri: `article-${i + 1}`,
      articleTitle: `Article ${i + 1}`,
      articleShortDesc: '',
      articleDate: 1000000 - i * 1000,
      articleHits: i,
    })),
    total: 15,
    page: 1,
    limit: 10,
  },
}

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

function setupFetchForSlug(
  slug: string,
  data: typeof mockPageData | null,
  status = 200,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      if (url.includes(`/api/categories/${slug}`)) {
        if (status === 404 || data === null) {
          return Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'Category not found' }),
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

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderCategoryPage(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/categories/${slug}`]}>
      <MockAuthProvider>
        <Routes>
          {/* Simulate exact routing: /categories matches index, /categories/* matches detail */}
          <Route path="/categories/*" element={<CategoryDetailPage />} />
          <Route path="/categories" element={<div>Categories Index</div>} />
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

describe('CategoryDetailPage', () => {
  describe('Category name and description', () => {
    it('renders category name as h1', async () => {
      setupFetchForSlug('php', mockPageData)
      renderCategoryPage('php')

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('PHP')
      })
    })

    it('renders category description', async () => {
      setupFetchForSlug('php', mockPageData)
      renderCategoryPage('php')

      await waitFor(() => {
        expect(screen.getByText('PHP programming language tutorials')).toBeInTheDocument()
      })
    })
  })

  describe('Breadcrumbs', () => {
    it('renders breadcrumb with "Categories" link to /categories', async () => {
      setupFetchForSlug('php', mockPageData)
      renderCategoryPage('php')

      await waitFor(() => {
        const catLink = screen.getByRole('link', { name: 'Categories' })
        expect(catLink).toHaveAttribute('href', '/categories')
      })
    })

    it('renders breadcrumb for root category (Categories > PHP)', async () => {
      setupFetchForSlug('php', mockPageData)
      renderCategoryPage('php')

      await waitFor(() => {
        // "Categories" link present
        expect(screen.getByRole('link', { name: 'Categories' })).toBeInTheDocument()
        // Current category shown as non-link with aria-current="page"
        const currentCrumb = document.querySelector('[aria-current="page"]')
        expect(currentCrumb).toBeTruthy()
        expect(currentCrumb?.textContent).toBe('PHP')
      })
    })

    it('renders full breadcrumb trail for nested category (Categories > PHP > PHP OOP)', async () => {
      setupFetchForSlug('php/oop', mockNestedPageData)
      renderCategoryPage('php/oop')

      await waitFor(() => {
        // "Categories" link
        const catLink = screen.getByRole('link', { name: 'Categories' })
        expect(catLink).toHaveAttribute('href', '/categories')

        // Ancestor "PHP" as a link
        const phpLink = screen.getByRole('link', { name: 'PHP' })
        expect(phpLink).toHaveAttribute('href', '/categories/php')

        // Current category shown as non-link with aria-current="page"
        const currentCrumb = document.querySelector('[aria-current="page"]')
        expect(currentCrumb?.textContent).toBe('PHP OOP')
      })
    })
  })

  describe('Sub-category grid', () => {
    it('renders sub-categories with links', async () => {
      setupFetchForSlug('php', mockPageData)
      renderCategoryPage('php')

      await waitFor(() => {
        const oopLink = screen.getByRole('link', { name: 'PHP OOP' })
        expect(oopLink).toHaveAttribute('href', '/categories/php/oop')

        const basicsLink = screen.getByRole('link', { name: 'PHP Basics' })
        expect(basicsLink).toHaveAttribute('href', '/categories/php/basics')
      })
    })

    it('shows article counts for sub-categories', async () => {
      setupFetchForSlug('php', mockPageData)
      renderCategoryPage('php')

      await waitFor(() => {
        expect(screen.getByText(/3 articles/)).toBeInTheDocument()
        expect(screen.getByText(/5 articles/)).toBeInTheDocument()
      })
    })

    it('does NOT render sub-category section when there are no sub-categories', async () => {
      setupFetchForSlug('empty-cat', mockEmptyCategoryData)
      renderCategoryPage('empty-cat')

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Empty Cat')
      })

      expect(screen.queryByText(/sub-categories/i)).not.toBeInTheDocument()
    })
  })

  describe('Article list', () => {
    it('renders article titles as links to /article/{uri}', async () => {
      setupFetchForSlug('php', mockPageData)
      renderCategoryPage('php')

      await waitFor(() => {
        const introLink = screen.getByRole('link', { name: 'Intro to PHP' })
        expect(introLink).toHaveAttribute('href', '/article/intro-php')

        const arraysLink = screen.getByRole('link', { name: 'PHP Arrays' })
        expect(arraysLink).toHaveAttribute('href', '/article/php-arrays')
      })
    })

    it('shows "No articles found" message when category has no articles', async () => {
      setupFetchForSlug('empty-cat', mockEmptyCategoryData)
      renderCategoryPage('empty-cat')

      await waitFor(() => {
        expect(screen.getByText(/no articles found in this category/i)).toBeInTheDocument()
      })
    })

    it('does NOT show pagination when total ≤ per_page', async () => {
      setupFetchForSlug('php', mockPageData)
      renderCategoryPage('php')

      await waitFor(() => {
        expect(screen.getByText('Intro to PHP')).toBeInTheDocument()
      })

      expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
    })

    it('shows pagination controls when total > per_page', async () => {
      setupFetchForSlug('php', mockPaginatedData)
      renderCategoryPage('php')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument()
      })
    })

    it('Previous button is disabled on first page', async () => {
      setupFetchForSlug('php', mockPaginatedData)
      renderCategoryPage('php')

      await waitFor(() => {
        const prev = screen.getByRole('button', { name: /previous page/i })
        expect(prev).toBeDisabled()
      })
    })

    it('shows page indicator', async () => {
      setupFetchForSlug('php', mockPaginatedData)
      renderCategoryPage('php')

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument()
      })
    })
  })

  describe('404 / redirect handling', () => {
    it('redirects to /categories for invalid slug (404)', async () => {
      setupFetchForSlug('nonexistent-category', null, 404)
      renderCategoryPage('nonexistent-category')

      await waitFor(() => {
        // After 404, the component redirects to /categories
        // The MemoryRouter will show the /categories route
        expect(screen.getByText('Categories Index')).toBeInTheDocument()
      })
    })
  })

  describe('Loading state', () => {
    it('renders loading skeleton initially', () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})))
      renderCategoryPage('php')

      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })
})
