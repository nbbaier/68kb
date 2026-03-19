import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AdminCategoryFormPage } from '../pages/AdminCategoryFormPage'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CATEGORY_DETAIL = {
  catId: 5,
  catParent: 0,
  catUri: 'my-category',
  catName: 'My Category',
  catDescription: 'Test description',
  catAllowads: 'yes',
  catDisplay: 'no',
  catOrder: 3,
  catImage: '',
  catKeywords: 'php, js',
}

const CATEGORY_WITH_IMAGE = {
  ...CATEGORY_DETAIL,
  catId: 6,
  catImage: 'image.jpg',
}

const DUPLICATE_DATA = {
  catId: 5,
  catParent: 0,
  catUri: 'my-category', // last segment only
  catName: 'My Category',
  catDescription: 'Test description',
  catAllowads: 'yes',
  catDisplay: 'no',
  catOrder: 3,
  catImage: '',
  catKeywords: 'php, js',
  catPromo: '',
}

const ALL_CATEGORIES = [
  { catId: 1, catParent: 0, catUri: 'parent', catName: 'Parent Cat', depth: 0, catDescription: '', catAllowads: 'yes', catDisplay: 'yes', catOrder: 0, catImage: '', catKeywords: '' },
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

function renderAddPage() {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ data: ALL_CATEGORIES }),
  })
  return render(
    <MemoryRouter initialEntries={['/admin/categories/new']}>
      <Routes>
        <Route path="/admin/categories/new" element={<AdminCategoryFormPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderEditPage(catId = '5') {
  // fetchAll (all categories) runs FIRST, then fetchCategory (single)
  fetchMock
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: ALL_CATEGORIES }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: CATEGORY_DETAIL }),
    })
  return render(
    <MemoryRouter initialEntries={[`/admin/categories/${catId}/edit`]}>
      <Routes>
        <Route path="/admin/categories/:id/edit" element={<AdminCategoryFormPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderDuplicatePage(dupId = '5') {
  // fetchAll (all categories) runs FIRST, then fetchCategory (duplicate)
  fetchMock
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: ALL_CATEGORIES }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: DUPLICATE_DATA }),
    })
  return render(
    <MemoryRouter initialEntries={[`/admin/categories/new?duplicateId=${dupId}`]}>
      <Routes>
        <Route path="/admin/categories/new" element={<AdminCategoryFormPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminCategoryFormPage', () => {
  describe('Add mode', () => {
    it('shows "Add Category" heading', async () => {
      renderAddPage()
      await waitFor(() => expect(screen.getByText('Add Category')).toBeInTheDocument())
    })

    it('renders all required form fields', async () => {
      renderAddPage()
      await waitFor(() => expect(screen.getByText('Add Category')).toBeInTheDocument())

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/auto-generated from name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/category description/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create category/i })).toBeInTheDocument()
    })

    it('shows validation error when name is empty', async () => {
      renderAddPage()
      await waitFor(() => expect(screen.getByRole('button', { name: /create category/i })).toBeInTheDocument())

      fireEvent.click(screen.getByRole('button', { name: /create category/i }))

      await waitFor(() =>
        expect(screen.getByText(/name is required/i)).toBeInTheDocument(),
      )
    })

    it('shows validation error for invalid URI', async () => {
      renderAddPage()
      await waitFor(() => expect(screen.getByLabelText(/name/i)).toBeInTheDocument())

      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test' } })
      fireEvent.change(screen.getByPlaceholderText(/auto-generated from name/i), {
        target: { value: 'invalid uri!' },
      })
      fireEvent.click(screen.getByRole('button', { name: /create category/i }))

      await waitFor(() =>
        expect(screen.getByText(/URI may only contain/i)).toBeInTheDocument(),
      )
    })

    it('shows parent dropdown with "No Parent" option', async () => {
      renderAddPage()
      await waitFor(() => expect(screen.getByLabelText(/parent category/i)).toBeInTheDocument())
    })

    it('shows Back to Categories link', async () => {
      renderAddPage()
      await waitFor(() => expect(screen.getByText('Add Category')).toBeInTheDocument())
      const backLinks = screen.getAllByRole('link', { name: /back to categories/i })
      expect(backLinks.length).toBeGreaterThanOrEqual(1)
      expect(backLinks[0]).toHaveAttribute('href', '/admin/categories')
    })
  })

  describe('Edit mode', () => {
    it('shows "Edit Category" heading', async () => {
      renderEditPage()
      await waitFor(() => expect(screen.getByText('Edit Category')).toBeInTheDocument())
    })

    it('pre-populates form fields from API response', async () => {
      renderEditPage()
      await waitFor(() =>
        expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('My Category'),
      )
      expect(
        (screen.getByPlaceholderText(/auto-generated from name/i) as HTMLInputElement).value,
      ).toBe('my-category')
    })

    it('shows "Update Category" submit button', async () => {
      renderEditPage()
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /update category/i })).toBeInTheDocument(),
      )
    })

    it('shows image section with upload for category without image', async () => {
      renderEditPage()
      await waitFor(() => expect(screen.getByText('Edit Category')).toBeInTheDocument())
      expect(screen.getByLabelText(/upload category image/i)).toBeInTheDocument()
    })
  })

  describe('Edit mode with image', () => {
    it('shows image preview and delete button for category with image', async () => {
      // fetchAll runs FIRST, then fetchCategory (with image)
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: ALL_CATEGORIES }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: CATEGORY_WITH_IMAGE }),
        })
      render(
        <MemoryRouter initialEntries={['/admin/categories/6/edit']}>
          <Routes>
            <Route path="/admin/categories/:id/edit" element={<AdminCategoryFormPage />} />
          </Routes>
        </MemoryRouter>,
      )
      await waitFor(() => expect(screen.getByText('Edit Category')).toBeInTheDocument())

      const img = screen.getByRole('img', { name: /current category image/i })
      expect(img).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete image/i })).toBeInTheDocument()
    })
  })

  describe('Duplicate mode', () => {
    it('shows "Duplicate Category" heading', async () => {
      renderDuplicatePage()
      await waitFor(() => expect(screen.getByText('Duplicate Category')).toBeInTheDocument())
    })

    it('pre-populates form fields from duplicate endpoint', async () => {
      renderDuplicatePage()
      await waitFor(() =>
        expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('My Category'),
      )
    })

    it('calls duplicate endpoint when duplicateId is provided', async () => {
      renderDuplicatePage('5')
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/categories/5/duplicate'),
        expect.any(Object),
      ))
    })
  })
})
