import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AdminUsersPage, type AdminUser } from '../pages/AdminUsersPage'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeUser = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  userId: 1,
  userUsername: 'testuser',
  userEmail: 'test@example.com',
  userGroup: 1,
  userJoinDate: 1700000000,
  userLastLogin: 1700100000,
  userApiKey: 'testapikey12345678901234567890ab',
  groupName: 'Site Admins',
  gravatarHash: 'abc123def456',
  ...overrides,
})

const USERS: AdminUser[] = [
  makeUser({ userId: 1, userUsername: 'admin', userEmail: 'admin@example.com', userGroup: 1, groupName: 'Site Admins' }),
  makeUser({ userId: 2, userUsername: 'johndoe', userEmail: 'john@example.com', userGroup: 2, groupName: 'Registered' }),
  makeUser({ userId: 3, userUsername: 'janedoe', userEmail: 'jane@example.com', userGroup: 2, groupName: 'Registered', gravatarHash: 'different123' }),
]

function makeResponse(users: AdminUser[], total?: number, page = 1) {
  return {
    data: users,
    total: total ?? users.length,
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
    <MemoryRouter initialEntries={['/admin/users']}>
      <AdminUsersPage />
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminUsersPage', () => {
  describe('Initial render', () => {
    it('shows Add User button linking to /admin/users/new', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(USERS),
      })
      renderPage()
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

      const addButton = screen.getByRole('link', { name: /add user/i })
      expect(addButton).toBeInTheDocument()
      expect(addButton).toHaveAttribute('href', '/admin/users/new')
    })

    it('renders loading state initially', () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(USERS),
      })
      renderPage()
      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('renders users in the table after loading', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(USERS),
      })
      renderPage()
      await waitFor(() => expect(screen.getByText('admin')).toBeInTheDocument())
      expect(screen.getByText('johndoe')).toBeInTheDocument()
      expect(screen.getByText('janedoe')).toBeInTheDocument()
    })

    it('renders Gravatar images for each user', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(USERS),
      })
      renderPage()
      await waitFor(() => expect(screen.getByText('admin')).toBeInTheDocument())
      const gravatarImages = screen.getAllByRole('img', { name: /gravatar/i })
      expect(gravatarImages.length).toBeGreaterThanOrEqual(USERS.length)
    })

    it('renders group names in the table', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(USERS),
      })
      renderPage()
      await waitFor(() => expect(screen.getAllByText('Site Admins').length).toBeGreaterThan(0))
      expect(screen.getAllByText('Registered').length).toBeGreaterThan(0)
    })

    it('shows empty state message when no users', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse([]),
      })
      renderPage()
      await waitFor(() => expect(screen.getByText(/no users found/i)).toBeInTheDocument())
    })

    it('shows error state when fetch fails', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'))
      renderPage()
      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    })
  })

  describe('Search', () => {
    it('renders search input', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(USERS),
      })
      renderPage()
      expect(screen.getByRole('searchbox', { hidden: true })).toBeInTheDocument()
    })

    it('submits search and re-fetches data', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => makeResponse(USERS) })
        .mockResolvedValueOnce({ ok: true, json: async () => makeResponse([USERS[0]]) })

      renderPage()
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

      const searchInput = screen.getByPlaceholderText(/search users/i)
      fireEvent.change(searchInput, { target: { value: 'admin' } })
      fireEvent.submit(searchInput.closest('form')!)

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      const lastCall = fetchMock.mock.calls[1][0] as string
      expect(lastCall).toContain('search=admin')
    })
  })

  describe('Sorting', () => {
    it('renders sortable column headers', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(USERS),
      })
      renderPage()
      await waitFor(() => expect(screen.getByText('admin')).toBeInTheDocument())
      // Check for sortable Username header
      expect(screen.getByRole('button', { name: /sort by username/i })).toBeInTheDocument()
    })
  })

  describe('Pagination', () => {
    it('shows total count', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => makeResponse(USERS, 3),
      })
      renderPage()
      await waitFor(() => expect(screen.getByText(/3 user/i)).toBeInTheDocument())
    })
  })
})
