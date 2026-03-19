import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { NotFoundPage } from '../pages/NotFoundPage'

function renderNotFoundPage() {
  return render(
    <MemoryRouter initialEntries={['/some/unknown/path']}>
      <NotFoundPage />
    </MemoryRouter>,
  )
}

describe('NotFoundPage', () => {
  it('renders a 404 heading', () => {
    renderNotFoundPage()
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('renders a friendly message', () => {
    renderNotFoundPage()
    expect(screen.getByText(/page not found/i)).toBeInTheDocument()
  })

  it('renders a Go home link', () => {
    renderNotFoundPage()
    const homeLink = screen.getByRole('link', { name: /go home/i })
    expect(homeLink).toBeInTheDocument()
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('renders a Sign in link', () => {
    renderNotFoundPage()
    const loginLink = screen.getByRole('link', { name: /sign in/i })
    expect(loginLink).toBeInTheDocument()
    expect(loginLink).toHaveAttribute('href', '/login')
  })
})
