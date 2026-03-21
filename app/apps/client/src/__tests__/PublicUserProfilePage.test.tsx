import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { MockAuthProvider } from './test-utils'
import { PublicUserProfilePage } from '../pages/PublicUserProfilePage'

function renderProfilePage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MockAuthProvider>
        <Routes>
          <Route path="/" element={<div>Home route</div>} />
          <Route path="/users/profile" element={<PublicUserProfilePage />} />
          <Route path="/users/profile/:username" element={<PublicUserProfilePage />} />
        </Routes>
      </MockAuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PublicUserProfilePage', () => {
  it('redirects to home when username is missing (VAL-USER-051)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    renderProfilePage('/users/profile')

    await waitFor(() => {
      expect(screen.getByText('Home route')).toBeInTheDocument()
    })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('renders extra fields with formatted date values (VAL-USER-052)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            userId: 1,
            username: 'admin',
            userGroup: 1,
            groupName: 'Site Admins',
            userJoinDate: 1_700_000_000,
            userLastLogin: 1_700_100_000,
            extraFields: [
              {
                key: 'birthday',
                name: 'Birthday',
                fieldType: 'date',
                value: '946728000',
                formattedValue: 'January 1, 2000',
              },
            ],
          },
        }),
      }),
    )

    renderProfilePage('/users/profile/admin')

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument()
      expect(screen.getByText('Site Admins')).toBeInTheDocument()
      expect(screen.getByText('Birthday:')).toBeInTheDocument()
      expect(screen.getByText('January 1, 2000')).toBeInTheDocument()
    })

    expect(screen.queryByText('946728000')).not.toBeInTheDocument()
  })

  it('shows an error message when profile is not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'User not found' }),
      }),
    )

    renderProfilePage('/users/profile/missing')

    await waitFor(() => {
      expect(screen.getByText('User profile not found')).toBeInTheDocument()
    })
  })
})
