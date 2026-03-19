import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { RegisterPage } from '../pages/RegisterPage'
import { MockAuthProvider } from './test-utils'

type RegisterOptions = {
  register?: (u: string, e: string, p: string) => Promise<void>
}

function renderRegisterPage(options: RegisterOptions = {}) {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <MockAuthProvider options={{ register: options.register }}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/admin" element={<div>Admin Dashboard</div>} />
        </Routes>
      </MockAuthProvider>
    </MemoryRouter>,
  )
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/username/i), {
    target: { value: 'newuser' },
  })
  fireEvent.change(screen.getByLabelText(/^email/i), {
    target: { value: 'newuser@example.com' },
  })
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'password123' },
  })
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: 'password123' },
  })
}

describe('RegisterPage', () => {
  it('renders the registration form with all 4 required fields', () => {
    renderRegisterPage()

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('has a link back to the login page', () => {
    renderRegisterPage()

    const loginLink = screen.getByRole('link', { name: /sign in/i })
    expect(loginLink).toBeInTheDocument()
    expect(loginLink).toHaveAttribute('href', '/login')
  })

  it('shows validation errors for all empty fields on submit', async () => {
    renderRegisterPage()

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument()
      expect(screen.getByText('Email is required')).toBeInTheDocument()
      expect(screen.getByText('Password is required')).toBeInTheDocument()
      expect(screen.getByText('Please confirm your password')).toBeInTheDocument()
    })
  })

  it('shows validation error for invalid email format', async () => {
    renderRegisterPage()

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'testuser' },
    })
    fireEvent.change(screen.getByLabelText(/^email/i), {
      target: { value: 'not-an-email' },
    })
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(
      () => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  })

  it('shows error when passwords do not match', async () => {
    renderRegisterPage()

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'testuser' },
    })
    fireEvent.change(screen.getByLabelText(/^email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'different123' },
    })

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })
  })

  it('calls register with correct data when form is valid', async () => {
    const mockRegister = vi.fn().mockResolvedValue(undefined)
    renderRegisterPage({ register: mockRegister })

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'newuser',
        'newuser@example.com',
        'password123',
      )
    })
  })

  it('shows duplicate username error from server', async () => {
    const err = new Error('Validation failed') as Error & {
      fieldErrors?: Record<string, string>
    }
    err.fieldErrors = { username: 'Username already in use' }
    const mockRegister = vi.fn().mockRejectedValue(err)
    renderRegisterPage({ register: mockRegister })

    fillValidForm()
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'admin' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Username already in use')).toBeInTheDocument()
    })
  })

  it('shows duplicate email error from server', async () => {
    const err = new Error('Validation failed') as Error & {
      fieldErrors?: Record<string, string>
    }
    err.fieldErrors = { email: 'Email already in use' }
    const mockRegister = vi.fn().mockRejectedValue(err)
    renderRegisterPage({ register: mockRegister })

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Email already in use')).toBeInTheDocument()
    })
  })
})
