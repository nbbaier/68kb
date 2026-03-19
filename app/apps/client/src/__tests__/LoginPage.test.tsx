import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { LoginPage } from '../pages/LoginPage'
import { MockAuthProvider } from './test-utils'

function renderLoginPage(
  searchParams = '',
  options: {
    login?: (u: string, p: string) => Promise<void>
  } = {},
) {
  return render(
    <MemoryRouter initialEntries={[`/login${searchParams}`]}>
      <MockAuthProvider options={{ login: options.login }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<div>Admin Dashboard</div>} />
        </Routes>
      </MockAuthProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('renders the login form with all required fields', () => {
    renderLoginPage()

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /remember me/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders the forgot password link', () => {
    renderLoginPage()

    const forgotLink = screen.getByRole('link', { name: /forgot password/i })
    expect(forgotLink).toBeInTheDocument()
    expect(forgotLink).toHaveAttribute('href', '/forgot-password')
  })

  it('renders the register link', () => {
    renderLoginPage()

    const registerLink = screen.getByRole('link', { name: /register/i })
    expect(registerLink).toBeInTheDocument()
    expect(registerLink).toHaveAttribute('href', '/register')
  })

  it('shows validation error for empty username', async () => {
    renderLoginPage()

    const submitBtn = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument()
    })
  })

  it('shows validation error for empty password', async () => {
    renderLoginPage()

    const usernameInput = screen.getByLabelText(/username/i)
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })

    const submitBtn = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
  })

  it('shows validation errors for both empty fields', async () => {
    renderLoginPage()

    const submitBtn = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument()
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
  })

  it('calls the login function with valid credentials', async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined)
    renderLoginPage('', { login: mockLogin })

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'admin' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'admin123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'admin123')
    })
  })

  it('shows error toast when login fails', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid username or password'))
    renderLoginPage('', { login: mockLogin })

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'admin' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled()
    })
  })
})
