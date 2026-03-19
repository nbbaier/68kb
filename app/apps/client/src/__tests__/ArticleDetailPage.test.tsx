import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { vi, beforeEach, describe, it, expect } from 'vitest'
import { ArticleDetailPage } from '../pages/ArticleDetailPage'
import { MockAuthProvider } from './test-utils'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockArticle = {
  articleId: 1,
  articleUri: 'hello-world',
  articleTitle: 'Hello World',
  articleKeywords: 'hello, world',
  articleDescription: '<p>This is the <strong>full content</strong> of the article.</p>',
  articleShortDesc: 'A short description of hello world.',
  articleDate: 1000000,
  articleModified: 1100000,
  articleDisplay: 'y',
  articleHits: 42,
  articleAuthor: 1,
  categories: [
    { catId: 1, catName: 'Tech', catUri: 'tech' },
    { catId: 2, catName: 'Programming', catUri: 'programming' },
  ],
  attachments: [
    {
      attachId: 1,
      attachFile: 'document.pdf',
      attachTitle: 'My Document',
      attachType: 'application/pdf',
      attachSize: '12345',
    },
  ],
  glossaryTerms: [
    { gTerm: 'content', gDefinition: 'The information contained in an article or document.' },
  ],
}

const mockArticleNoAttachments = {
  ...mockArticle,
  articleId: 2,
  articleUri: 'no-attachments',
  articleTitle: 'No Attachments Article',
  attachments: [],
  glossaryTerms: [],
}

// ---------------------------------------------------------------------------
// fetch mock
// ---------------------------------------------------------------------------

function setupFetchMock(
  articleData: typeof mockArticle | null,
  status = 200,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      // Hit counter
      if (
        typeof url === 'string' &&
        url.includes('/hit') &&
        options?.method === 'POST'
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: { hits: (articleData?.articleHits ?? 0) + 1 } }),
        })
      }
      // Article detail
      if (typeof url === 'string' && url.includes('/api/articles/')) {
        if (status === 404 || articleData === null) {
          return Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'Article not found' }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: articleData }),
        })
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      })
    }),
  )
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderArticleDetailPage(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/article/${slug}`]}>
      <MockAuthProvider>
        <Routes>
          <Route path="/article/:slug" element={<ArticleDetailPage />} />
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

describe('ArticleDetailPage', () => {
  describe('Article renders correctly', () => {
    it('renders article title as h1', async () => {
      setupFetchMock(mockArticle)
      renderArticleDetailPage('hello-world')

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello World')
      })
    })

    it('renders full article HTML content', async () => {
      setupFetchMock(mockArticle)
      renderArticleDetailPage('hello-world')

      await waitFor(() => {
        // Check text content is rendered (HTML is parsed, not escaped)
        expect(screen.getByText(/full content/i)).toBeInTheDocument()
      })
    })

    it('renders last modified date with label', async () => {
      setupFetchMock(mockArticle)
      renderArticleDetailPage('hello-world')

      await waitFor(() => {
        expect(screen.getByText('Last Updated:')).toBeInTheDocument()
      })
    })

    it('renders view count', async () => {
      setupFetchMock(mockArticle)
      renderArticleDetailPage('hello-world')

      await waitFor(() => {
        expect(screen.getByText('Views:')).toBeInTheDocument()
        expect(screen.getByText('42')).toBeInTheDocument()
      })
    })
  })

  describe('Categories', () => {
    it('renders category links', async () => {
      setupFetchMock(mockArticle)
      renderArticleDetailPage('hello-world')

      await waitFor(() => {
        const techLink = screen.getByRole('link', { name: 'Tech' })
        expect(techLink).toBeInTheDocument()
        expect(techLink).toHaveAttribute('href', '/categories/tech')

        const progLink = screen.getByRole('link', { name: 'Programming' })
        expect(progLink).toBeInTheDocument()
        expect(progLink).toHaveAttribute('href', '/categories/programming')
      })
    })
  })

  describe('Attachments', () => {
    it('renders attachments section when attachments exist', async () => {
      setupFetchMock(mockArticle)
      renderArticleDetailPage('hello-world')

      await waitFor(() => {
        // fieldset legend text
        expect(screen.getByText('Attachments')).toBeInTheDocument()
        const link = screen.getByRole('link', { name: /my document/i })
        expect(link).toBeInTheDocument()
      })
    })

    it('does NOT render attachments section when no attachments', async () => {
      setupFetchMock(mockArticleNoAttachments)
      renderArticleDetailPage('no-attachments')

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
          'No Attachments Article',
        )
      })

      expect(screen.queryByText('Attachments')).not.toBeInTheDocument()
    })
  })

  describe('404 handling', () => {
    it('renders 404 state for non-existent article', async () => {
      setupFetchMock(null, 404)
      renderArticleDetailPage('non-existent-slug')

      await waitFor(() => {
        expect(screen.getByText('Article not found')).toBeInTheDocument()
        expect(screen.getByText(/exist or is not available/i)).toBeInTheDocument()
      })
    })
  })

  describe('Loading state', () => {
    it('renders loading skeleton initially', () => {
      // Don't resolve fetch immediately
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => new Promise(() => {})),
      )
      renderArticleDetailPage('hello-world')
      // Loading skeleton elements should be visible
      const pulsers = document.querySelectorAll('.animate-pulse')
      expect(pulsers.length).toBeGreaterThan(0)
    })
  })

  describe('Hit counter', () => {
    it('calls hit endpoint on page load', async () => {
      setupFetchMock(mockArticle)
      renderArticleDetailPage('hello-world')

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      })

      const fetchMock = vi.mocked(fetch)
      const hitCalls = fetchMock.mock.calls.filter(
        ([url, opts]) =>
          typeof url === 'string' &&
          url.includes('/hit') &&
          opts?.method === 'POST',
      )
      expect(hitCalls.length).toBeGreaterThan(0)
    })
  })
})
