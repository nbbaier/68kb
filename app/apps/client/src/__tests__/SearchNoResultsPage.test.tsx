import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { MockAuthProvider } from './test-utils'
import { SearchNoResultsPage } from '../pages/SearchNoResultsPage'

function renderNoResultsPage() {
  return render(
    <MemoryRouter initialEntries={['/search/no-results']}>
      <MockAuthProvider>
        <Routes>
          <Route path="/search/no-results" element={<SearchNoResultsPage />} />
          <Route path="/search" element={<div>Search page</div>} />
        </Routes>
      </MockAuthProvider>
    </MemoryRouter>,
  )
}

describe('SearchNoResultsPage', () => {
  it('renders a no results message', () => {
    renderNoResultsPage()
    expect(screen.getByRole('heading', { name: /no results found/i })).toBeInTheDocument()
  })

  it('shows "Search Again" link to /search', () => {
    renderNoResultsPage()
    const link = screen.getByRole('link', { name: /search again/i })
    expect(link).toHaveAttribute('href', '/search')
  })
})
