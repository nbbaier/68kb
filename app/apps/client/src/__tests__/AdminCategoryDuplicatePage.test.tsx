import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { AdminCategoryDuplicatePage } from '../pages/AdminCategoryDuplicatePage'

// ---------------------------------------------------------------------------
// Mock sonner toast
// ---------------------------------------------------------------------------

const toastError = vi.fn()
const toastSuccess = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    error: (msg: string) => toastError(msg),
    success: (msg: string) => toastSuccess(msg),
  },
}))

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  global.fetch = fetchMock
  toastError.mockClear()
  toastSuccess.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Helper: track current location after navigation
// ---------------------------------------------------------------------------

let capturedPath = ''

function LocationCapture() {
  const location = useLocation()
  capturedPath = location.pathname + location.search
  return null
}

function renderDuplicatePage(id: string) {
  capturedPath = ''
  return render(
    <MemoryRouter initialEntries={[`/admin/categories/${id}/duplicate`]}>
      <Routes>
        <Route
          path="/admin/categories/:id/duplicate"
          element={<AdminCategoryDuplicatePage />}
        />
        <Route path="/admin/categories" element={<LocationCapture />} />
        <Route path="/admin/categories/new" element={<LocationCapture />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminCategoryDuplicatePage', () => {
  describe('Non-numeric ID', () => {
    it('redirects to /admin/categories and shows error toast for non-numeric id "abc"', async () => {
      renderDuplicatePage('abc')

      await waitFor(() => {
        expect(capturedPath).toBe('/admin/categories')
      })
      expect(toastError).toHaveBeenCalledWith('Invalid category ID')
      // Should NOT call fetch for non-numeric IDs
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('redirects to /admin/categories and shows error toast for "0"', async () => {
      renderDuplicatePage('0')

      await waitFor(() => {
        expect(capturedPath).toBe('/admin/categories')
      })
      expect(toastError).toHaveBeenCalledWith('Invalid category ID')
    })

    it('redirects to /admin/categories for negative id "-1"', async () => {
      renderDuplicatePage('-1')

      await waitFor(() => {
        expect(capturedPath).toBe('/admin/categories')
      })
      expect(toastError).toHaveBeenCalledWith('Invalid category ID')
    })
  })

  describe('Numeric ID — category not found (API returns 404)', () => {
    it('redirects to /admin/categories with toast when API returns 404', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Category not found' }),
      })

      renderDuplicatePage('99999')

      await waitFor(() => {
        expect(capturedPath).toBe('/admin/categories')
      })
      expect(toastError).toHaveBeenCalledWith('Category not found')
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/categories/99999/duplicate'),
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    it('redirects to /admin/categories when API returns 500', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      })

      renderDuplicatePage('42')

      await waitFor(() => {
        expect(capturedPath).toBe('/admin/categories')
      })
      expect(toastError).toHaveBeenCalledWith('Category not found')
    })

    it('redirects to /admin/categories when fetch throws (network error)', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network failure'))

      renderDuplicatePage('5')

      await waitFor(() => {
        expect(capturedPath).toBe('/admin/categories')
      })
      expect(toastError).toHaveBeenCalledWith('Failed to load category')
    })
  })

  describe('Valid numeric ID — category exists', () => {
    it('redirects to /admin/categories/new?duplicateId=:id when API returns 200', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            catId: 1,
            catName: 'Test Category',
            catUri: 'test-category',
            catParent: 0,
            catDescription: '',
            catAllowads: 'yes',
            catDisplay: 'yes',
            catOrder: 0,
            catImage: '',
            catKeywords: '',
            catPromo: '',
          },
        }),
      })

      renderDuplicatePage('1')

      await waitFor(() => {
        expect(capturedPath).toBe('/admin/categories/new?duplicateId=1')
      })
      expect(toastError).not.toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/categories/1/duplicate'),
        expect.objectContaining({ credentials: 'include' }),
      )
    })
  })
})
