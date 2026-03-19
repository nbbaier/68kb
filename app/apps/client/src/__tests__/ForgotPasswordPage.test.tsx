import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage'
import { MockAuthProvider } from './test-utils'

type ForgotOptions = {
  forgotPassword?: (email: string) => Promise<string>
}

function renderForgotPasswordPage(options: ForgotOptions = {}) {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <MockAuthProvider options={{ forgotPassword: options.forgotPassword }}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MockAuthProvider>
    </MemoryRouter>,
  )
}

describe('ForgotPasswordPage', () => {
  it('renders the forgot password form with email field', () => {
    renderForgotPasswordPage()

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('has a link back to login', () => {
    renderForgotPasswordPage()

    const backLink = screen.getByRole('link', { name: /back to sign in/i })
    expect(backLink).toBeInTheDocument()
    expect(backLink).toHaveAttribute('href', '/login')
  })

  it('shows validation error for empty email', async () => {
    renderForgotPasswordPage()

    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument()
    })
  })

  it('shows validation error for invalid email format', async () => {
    renderForgotPasswordPage()

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'not-valid' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(
      () => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  })

  it('shows success message after valid email submission', async () => {
    const successMsg =
      'If that email address is in our database, we will send you a password reset link.'
    const mockForgotPassword = vi.fn().mockResolvedValue(successMsg)
    renderForgotPasswordPage({ forgotPassword: mockForgotPassword })

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText(successMsg)).toBeInTheDocument()
    })
  })

  it('shows the same success message for unknown email (no enumeration)', async () => {
    const successMsg =
      'If that email address is in our database, we will send you a password reset link.'
    const mockForgotPassword = vi.fn().mockResolvedValue(successMsg)
    renderForgotPasswordPage({ forgotPassword: mockForgotPassword })

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'nonexistent@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      // Same message regardless of email existence
      expect(screen.getByText(successMsg)).toBeInTheDocument()
    })
  })
})
