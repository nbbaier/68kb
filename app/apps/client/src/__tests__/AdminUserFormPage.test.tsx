import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { AdminUserFormPage } from '../pages/AdminUserFormPage'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUserData = {
  userId: 2,
  userUsername: 'johndoe',
  userEmail: 'john@example.com',
  userGroup: 2,
  userJoinDate: 1700000000,
  userLastLogin: 1700100000,
  userApiKey: 'johnapikey1234567890abcdef123456',
  groupName: 'Registered',
  gravatarHash: 'abc123def456',
}

const mockGroups = [
  { groupId: 1, groupName: 'Site Admins' },
  { groupId: 2, groupName: 'Registered' },
  { groupId: 3, groupName: 'Pending' },
  { groupId: 4, groupName: 'Banned' },
  { groupId: 5, groupName: 'Guest' },
]

const bannedUserData = {
  ...mockUserData,
  userGroup: 4,
  groupName: 'Banned',
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
// Render helpers
// ---------------------------------------------------------------------------

function renderAddPage() {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: mockGroups }),
  })
  return render(
    <MemoryRouter initialEntries={['/admin/users/new']}>
      <Routes>
        <Route path="/admin/users/new" element={<AdminUserFormPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderEditPage(userId = 2) {
  // Groups fetch fires first (empty deps []), user data fetch fires second
  fetchMock
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: mockGroups }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: mockUserData }) })
  return render(
    <MemoryRouter initialEntries={[`/admin/users/${userId}/edit`]}>
      <Routes>
        <Route path="/admin/users/:id/edit" element={<AdminUserFormPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderEditPageBanned(userId = 3) {
  // Groups fetch fires first (empty deps []), user data fetch fires second
  fetchMock
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: mockGroups }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: bannedUserData }) })
  return render(
    <MemoryRouter initialEntries={[`/admin/users/${userId}/edit`]}>
      <Routes>
        <Route path="/admin/users/:id/edit" element={<AdminUserFormPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminUserFormPage — Add mode', () => {
  it('renders Add User heading', async () => {
    renderAddPage()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('heading', { name: /add user/i })).toBeInTheDocument()
  })

  it('renders username, email, group, password, confirm fields', async () => {
    renderAddPage()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
  })

  it('shows validation error for empty username on submit', async () => {
    renderAddPage()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const submitBtn = screen.getByRole('button', { name: /add user/i })
    fireEvent.click(submitBtn)

    await waitFor(() =>
      expect(screen.getByText(/username is required/i)).toBeInTheDocument(),
    )
  })

  it('shows validation error for invalid username format', async () => {
    renderAddPage()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const usernameInput = screen.getByLabelText(/username/i)
    fireEvent.change(usernameInput, { target: { value: 'bad user!' } })

    const submitBtn = screen.getByRole('button', { name: /add user/i })
    fireEvent.click(submitBtn)

    await waitFor(() =>
      expect(screen.getByText(/alphanumeric/i)).toBeInTheDocument(),
    )
  })

  it('shows validation error for password mismatch', async () => {
    renderAddPage()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const usernameInput = screen.getByLabelText(/username/i)
    fireEvent.change(usernameInput, { target: { value: 'validuser' } })

    const passwordInput = screen.getByLabelText(/^password/i)
    fireEvent.change(passwordInput, { target: { value: 'password123' } })

    const confirmInput = screen.getByLabelText(/confirm password/i)
    fireEvent.change(confirmInput, { target: { value: 'different456' } })

    const submitBtn = screen.getByRole('button', { name: /add user/i })
    fireEvent.click(submitBtn)

    await waitFor(() =>
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument(),
    )
  })
})

describe('AdminUserFormPage — Edit mode', () => {
  it('renders Edit User heading', async () => {
    renderEditPage()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /edit user/i })).toBeInTheDocument(),
    )
  })

  it('pre-populates username and email fields', async () => {
    renderEditPage()
    await waitFor(() =>
      expect(screen.getByDisplayValue('johndoe')).toBeInTheDocument(),
    )
    expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument()
  })

  it('shows sidebar with Gravatar image', async () => {
    renderEditPage()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /edit user/i })).toBeInTheDocument(),
    )
    // Sidebar gravatar
    const gravatarImgs = screen.getAllByRole('img', { name: /gravatar/i })
    expect(gravatarImgs.length).toBeGreaterThanOrEqual(1)
  })

  it('shows API key in sidebar', async () => {
    renderEditPage()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /edit user/i })).toBeInTheDocument(),
    )
    expect(screen.getByText('johnapikey1234567890abcdef123456')).toBeInTheDocument()
  })

  it('shows Regenerate API Key button', async () => {
    renderEditPage()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /edit user/i })).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /regenerate api key/i })).toBeInTheDocument()
  })

  it('does NOT show delete content link for non-banned user', async () => {
    renderEditPage()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /edit user/i })).toBeInTheDocument(),
    )
    expect(screen.queryByText(/delete all content/i)).not.toBeInTheDocument()
  })
})

describe('AdminUserFormPage — Banned user', () => {
  it('shows Delete All Content link for banned user', async () => {
    renderEditPageBanned()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /edit user/i })).toBeInTheDocument(),
    )
    expect(screen.getByText(/delete all content/i)).toBeInTheDocument()
  })
})
