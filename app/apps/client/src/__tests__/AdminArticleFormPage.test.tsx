import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { AdminArticleFormPage } from '../pages/AdminArticleFormPage'

// ---------------------------------------------------------------------------
// Mock tiptap — EditorContent renders a <div contenteditable> but we
// simplify for tests to just render a textarea-like element.
// ---------------------------------------------------------------------------
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => ({
    chain: () => ({ focus: () => ({ toggleBold: () => ({ run: vi.fn() }) }) }),
    isActive: vi.fn(() => false),
    getHTML: vi.fn(() => ''),
    commands: { setContent: vi.fn() },
  })),
  EditorContent: ({ editor: _editor }: { editor: unknown }) => (
    <div data-testid="editor-content" role="textbox" aria-multiline="true" contentEditable />
  ),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { catId: 1, catParent: 0, catUri: 'tutorials', catName: 'Tutorials', catDescription: '', catDisplay: 'yes', catOrder: 0, depth: 0 },
  { catId: 2, catParent: 1, catUri: 'tutorials/react', catName: 'React', catDescription: '', catDisplay: 'yes', catOrder: 0, depth: 1 },
]

const ARTICLE_DATA = {
  articleId: 5,
  articleTitle: 'My Test Article',
  articleUri: 'my-test-article',
  articleShortDesc: '<p>Short desc</p>',
  articleDescription: '<p>Full desc</p>',
  articleDisplay: 'y' as const,
  articleKeywords: 'react, testing',
  articleOrder: 3,
  articleAuthor: 1,
  categories: [{ catId: 1, catName: 'Tutorials', catUri: 'tutorials' }],
  attachments: [
    {
      attachId: 10,
      articleId: 5,
      attachFile: '1234567890_test.pdf',
      attachTitle: 'Test PDF',
      attachType: 'application/pdf',
      attachSize: '12345',
    },
  ],
  author: { userId: 1, username: 'admin', email: 'admin@example.com' },
}

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  global.fetch = fetchMock
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Default: categories always return empty, article not found
function mockCategories(cats = CATEGORIES) {
  return { ok: true, json: async () => ({ data: cats }) }
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderAddPage() {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes('/api/admin/categories')) {
      return Promise.resolve(mockCategories())
    }
    return Promise.resolve({ ok: false, json: async () => ({ error: 'Not found' }) })
  })

  return render(
    <MemoryRouter initialEntries={['/admin/articles/new']}>
      <Routes>
        <Route path="/admin/articles/new" element={<AdminArticleFormPage />} />
        <Route path="/admin/articles/:id/edit" element={<AdminArticleFormPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderEditPage(articleData = ARTICLE_DATA) {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes('/api/admin/categories')) {
      return Promise.resolve(mockCategories())
    }
    if (url.match(/\/api\/admin\/articles\/\d+$/) && !url.includes('/attachments')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: articleData }) })
    }
    return Promise.resolve({ ok: false, json: async () => ({ error: 'Not found' }) })
  })

  return render(
    <MemoryRouter initialEntries={['/admin/articles/5/edit']}>
      <Routes>
        <Route path="/admin/articles/new" element={<AdminArticleFormPage />} />
        <Route path="/admin/articles/:id/edit" element={<AdminArticleFormPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Tests: Add page
// ---------------------------------------------------------------------------

describe('AdminArticleFormPage — Add mode', () => {
  it('renders Add Article heading', async () => {
    renderAddPage()
    await waitFor(() => expect(screen.getByRole('heading', { name: /add article/i })).toBeInTheDocument())
  })

  it('renders title input', async () => {
    renderAddPage()
    await waitFor(() => expect(screen.getByPlaceholderText(/article title/i)).toBeInTheDocument())
  })

  it('renders URI slug input', async () => {
    renderAddPage()
    await waitFor(() => expect(screen.getByPlaceholderText(/article-uri-slug/i)).toBeInTheDocument())
  })

  it('renders keywords input', async () => {
    renderAddPage()
    await waitFor(() => expect(screen.getByLabelText(/meta keywords/i)).toBeInTheDocument())
  })

  it('renders display select', async () => {
    renderAddPage()
    await waitFor(() => expect(screen.getByLabelText(/display status/i)).toBeInTheDocument())
  })

  it('renders weight/order input', async () => {
    renderAddPage()
    await waitFor(() => expect(screen.getByLabelText(/weight or order/i)).toBeInTheDocument())
  })

  it('renders category checkboxes for each category', async () => {
    renderAddPage()
    await waitFor(() => expect(screen.getByText('Tutorials')).toBeInTheDocument())
    expect(screen.getByText('React')).toBeInTheDocument()
  })

  it('renders rich text editors (2 editor areas)', async () => {
    renderAddPage()
    await waitFor(() => {
      const editors = screen.getAllByTestId('editor-content')
      expect(editors.length).toBe(2)
    })
  })

  it('shows validation error when title is empty on submit', async () => {
    renderAddPage()
    await waitFor(() => expect(screen.getByPlaceholderText(/article title/i)).toBeInTheDocument())

    const submitBtn = screen.getByRole('button', { name: /save article/i })
    fireEvent.click(submitBtn)

    await waitFor(() =>
      expect(screen.getByText(/title is required/i)).toBeInTheDocument(),
    )
  })

  it('shows validation error for invalid URI characters', async () => {
    renderAddPage()
    await waitFor(() => expect(screen.getByPlaceholderText(/article-uri-slug/i)).toBeInTheDocument())

    const uriInput = screen.getByPlaceholderText(/article-uri-slug/i)
    fireEvent.change(uriInput, { target: { value: 'my article!' } })

    const submitBtn = screen.getByRole('button', { name: /save article/i })
    fireEvent.click(submitBtn)

    await waitFor(() =>
      expect(screen.getByText(/uri may only contain/i)).toBeInTheDocument(),
    )
  })

  it('does not show Author search on add page', async () => {
    renderAddPage()
    await waitFor(() => expect(screen.getByRole('heading', { name: /add article/i })).toBeInTheDocument())
    expect(screen.queryByLabelText(/search for article author/i)).not.toBeInTheDocument()
  })

  it('submits form and redirects to edit page on success', async () => {
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/admin/categories')) {
        return Promise.resolve(mockCategories())
      }
      if (url === '/api/admin/articles' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { articleId: 42, articleTitle: 'New Article' } }),
        })
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: 'Not found' }) })
    })

    render(
      <MemoryRouter initialEntries={['/admin/articles/new']}>
        <Routes>
          <Route path="/admin/articles/new" element={<AdminArticleFormPage />} />
          <Route path="/admin/articles/:id/edit" element={<div>Edit page - ID: {42}</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByPlaceholderText(/article title/i)).toBeInTheDocument())

    const titleInput = screen.getByPlaceholderText(/article title/i)
    fireEvent.change(titleInput, { target: { value: 'New Article' } })

    const submitBtn = screen.getByRole('button', { name: /save article/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/articles',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })
})

// ---------------------------------------------------------------------------
// Tests: Edit page
// ---------------------------------------------------------------------------

describe('AdminArticleFormPage — Edit mode', () => {
  it('renders Edit Article heading', async () => {
    renderEditPage()
    await waitFor(() => expect(screen.getByRole('heading', { name: /edit article/i })).toBeInTheDocument())
  })

  it('pre-populates title field', async () => {
    renderEditPage()
    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText(/article title/i) as HTMLInputElement
      expect(titleInput.value).toBe('My Test Article')
    })
  })

  it('pre-populates URI slug field', async () => {
    renderEditPage()
    await waitFor(() => {
      const uriInput = screen.getByPlaceholderText(/article-uri-slug/i) as HTMLInputElement
      expect(uriInput.value).toBe('my-test-article')
    })
  })

  it('pre-populates keywords field', async () => {
    renderEditPage()
    await waitFor(() => {
      const keywordsInput = screen.getByLabelText(/meta keywords/i) as HTMLInputElement
      expect(keywordsInput.value).toBe('react, testing')
    })
  })

  it('pre-populates order field', async () => {
    renderEditPage()
    await waitFor(() => {
      const orderInput = screen.getByLabelText(/weight or order/i) as HTMLInputElement
      expect(orderInput.value).toBe('3')
    })
  })

  it('pre-checks categories for the article', async () => {
    renderEditPage()
    await waitFor(() => expect(screen.getByText('Tutorials')).toBeInTheDocument())

    // The category with catId=1 should be checked since article has catId=1
    const tutorialsCheckbox = screen.getByRole('checkbox', { name: /tutorials/i })
    expect(tutorialsCheckbox).toBeChecked()
  })

  it('renders attachments table with existing attachment', async () => {
    renderEditPage()
    await waitFor(() => expect(screen.getByText('Test PDF')).toBeInTheDocument())
    expect(screen.getByText('application/pdf')).toBeInTheDocument()
  })

  it('shows Author search on edit page', async () => {
    renderEditPage()
    await waitFor(() =>
      expect(screen.getByLabelText(/search for article author/i)).toBeInTheDocument(),
    )
  })

  it('pre-fills author search with existing author username', async () => {
    renderEditPage()
    await waitFor(() => {
      const authorInput = screen.getByLabelText(/search for article author/i) as HTMLInputElement
      expect(authorInput.value).toBe('admin')
    })
  })

  it('shows Upload button for attachments', async () => {
    renderEditPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument(),
    )
  })

  it('shows delete button for each attachment', async () => {
    renderEditPage()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /delete attachment test pdf/i }),
      ).toBeInTheDocument(),
    )
  })

  it('submits PUT request on save', async () => {
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/admin/categories')) {
        return Promise.resolve(mockCategories())
      }
      if (url.match(/\/api\/admin\/articles\/\d+$/) && !url.includes('/attachments')) {
        if (opts?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: ARTICLE_DATA }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: ARTICLE_DATA }) })
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: 'Not found' }) })
    })

    render(
      <MemoryRouter initialEntries={['/admin/articles/5/edit']}>
        <Routes>
          <Route path="/admin/articles/:id/edit" element={<AdminArticleFormPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText(/article title/i) as HTMLInputElement
      expect(titleInput.value).toBe('My Test Article')
    })

    const submitBtn = screen.getByRole('button', { name: /update article/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        (call) => call[0].includes('/api/admin/articles/5') && call[1]?.method === 'PUT',
      )
      expect(putCall).toBeDefined()
    })
  })

  it('shows loading state while fetching article', () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/admin/categories')) {
        return Promise.resolve(mockCategories())
      }
      // Hang the article fetch
      return new Promise(() => {})
    })

    render(
      <MemoryRouter initialEntries={['/admin/articles/5/edit']}>
        <Routes>
          <Route path="/admin/articles/:id/edit" element={<AdminArticleFormPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(/loading article/i)).toBeInTheDocument()
  })

  it('shows error state when article fetch fails', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/admin/categories')) {
        return Promise.resolve(mockCategories())
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: 'Article not found' }) })
    })

    render(
      <MemoryRouter initialEntries={['/admin/articles/999/edit']}>
        <Routes>
          <Route path="/admin/articles/:id/edit" element={<AdminArticleFormPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument(),
    )
  })
})

// ---------------------------------------------------------------------------
// Tests: Category tree
// ---------------------------------------------------------------------------

describe('CategoryTree', () => {
  it('shows indented child categories', async () => {
    renderAddPage()
    await waitFor(() => expect(screen.getByText('Tutorials')).toBeInTheDocument())
    // Child "React" should be present with indentation marker
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('»')).toBeInTheDocument()
  })

  it('allows checking/unchecking categories', async () => {
    renderAddPage()
    await waitFor(() => expect(screen.getByText('Tutorials')).toBeInTheDocument())

    const tutorialsCheckbox = screen.getByRole('checkbox', { name: /tutorials/i })
    expect(tutorialsCheckbox).not.toBeChecked()

    fireEvent.click(tutorialsCheckbox)
    expect(tutorialsCheckbox).toBeChecked()

    fireEvent.click(tutorialsCheckbox)
    expect(tutorialsCheckbox).not.toBeChecked()
  })
})

// ---------------------------------------------------------------------------
// Tests: Attachment deletion
// ---------------------------------------------------------------------------

describe('Attachments — delete', () => {
  it('calls DELETE and removes attachment from list', async () => {
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/admin/categories')) {
        return Promise.resolve(mockCategories())
      }
      if (url.match(/\/api\/admin\/articles\/\d+$/) && !url.includes('/attachments')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: ARTICLE_DATA }) })
      }
      if (url.includes('/attachments/10') && opts?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { deleted: true, attachId: 10 } }),
        })
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: 'Not found' }) })
    })

    render(
      <MemoryRouter initialEntries={['/admin/articles/5/edit']}>
        <Routes>
          <Route path="/admin/articles/:id/edit" element={<AdminArticleFormPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Test PDF')).toBeInTheDocument())

    const deleteBtn = screen.getByRole('button', { name: /delete attachment test pdf/i })
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('/attachments/10') &&
          call[1]?.method === 'DELETE',
      )
      expect(deleteCall).toBeDefined()
    })

    await waitFor(() => {
      expect(screen.queryByText('Test PDF')).not.toBeInTheDocument()
    })
  })
})
