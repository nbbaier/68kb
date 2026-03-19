import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  it('renders the application heading', () => {
    render(<App />)
    expect(screen.getByText('68kb Knowledge Base')).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    const { container } = render(<App />)
    expect(container).toBeTruthy()
  })
})
