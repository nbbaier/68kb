import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { LogoutPage } from '../pages/LogoutPage'
import { MockAuthProvider } from './test-utils'

describe('LogoutPage', () => {
  it('renders signing out message while processing', () => {
    const mockLogout = vi.fn().mockReturnValue(new Promise(() => {})) // never resolves

    render(
      <MemoryRouter initialEntries={['/logout']}>
        <MockAuthProvider options={{ logout: mockLogout }}>
          <Routes>
            <Route path="/logout" element={<LogoutPage />} />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Signing out…')).toBeInTheDocument()
  })

  it('calls logout on mount and redirects to /login', async () => {
    const mockLogout = vi.fn().mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/logout']}>
        <MockAuthProvider options={{ logout: mockLogout }}>
          <Routes>
            <Route path="/logout" element={<LogoutPage />} />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledOnce()
    })

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument()
    })
  })

  it('redirects to /login even if logout throws an error (idempotent)', async () => {
    const mockLogout = vi.fn().mockRejectedValue(new Error('Network error'))

    render(
      <MemoryRouter initialEntries={['/logout']}>
        <MockAuthProvider options={{ logout: mockLogout }}>
          <Routes>
            <Route path="/logout" element={<LogoutPage />} />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledOnce()
    })

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument()
    })
  })
})
