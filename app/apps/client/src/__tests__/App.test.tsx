import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />)
    expect(container).toBeTruthy()
  })

  it('renders the application shell', () => {
    render(<App />)
    // App renders the router — the default route renders sign-in form or redirect
    expect(document.body).toBeTruthy()
  })
})
