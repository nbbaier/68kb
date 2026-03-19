/**
 * Cross-cutting concern tests:
 *  - VAL-XCUT-001: XSS payloads rendered as escaped text (not executed)
 *  - VAL-XCUT-002: Hidden categories absent from public views (API returns only visible)
 *  - VAL-XCUT-003: Responsive layout — mobile hamburger menu accessible, sidebar stacks on mobile
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { MockAuthProvider } from './test-utils'
import { SearchResultsPage } from '../pages/SearchResultsPage'
import { PublicLayout } from '../components/PublicLayout'

// ---------------------------------------------------------------------------
// VAL-XCUT-001: XSS Protection — Search results page
// ---------------------------------------------------------------------------

describe('VAL-XCUT-001: XSS protection — keywords rendered as text, not HTML', () => {
  const xssPayload = '<script>alert("xss")</script>'
  const encodedPayload = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
  const validHash = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/search/results/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            data: {
              articles: [
                {
                  articleId: 1,
                  articleUri: 'test-article',
                  articleTitle: 'Test Article',
                  articleShortDesc: 'A test article',
                  articleDate: 1000000,
                  articleHits: 0,
                },
              ],
              total: 1,
              page: 1,
              limit: 10,
              keywords: xssPayload,
              categoryId: null,
            },
          }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    }))
  })

  it('renders XSS payload as escaped text, not as HTML', async () => {
    render(
      <MemoryRouter initialEntries={[`/search/results/${validHash}`]}>
        <MockAuthProvider>
          <Routes>
            <Route path="/search/results/:hash" element={<SearchResultsPage />} />
            <Route path="/search/no-results" element={<div>No results</div>} />
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      // The page should show the search results heading
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    })

    // The XSS payload should appear as literal text, not as executed HTML
    // React renders it as a text node, so the script tag is visible as text, not executed
    const summaryRegion = screen.getByText(/results? for/i)
    const parentContent = summaryRegion.closest('p')?.textContent ?? summaryRegion.textContent ?? ''

    // The payload should be in the text content (as literal chars, not HTML)
    expect(parentContent).toContain('<script>')

    // No actual script elements should have been injected by the XSS payload
    expect(document.querySelectorAll('script[data-xss]').length).toBe(0)

    // The raw payload should not appear as innerHTML that gets parsed
    // i.e., the script tag text is text node content, not a DOM <script> element
    const scriptElements = Array.from(document.querySelectorAll('script'))
    const injectedScripts = scriptElements.filter(
      (el) => el.textContent?.includes('alert("xss")'),
    )
    expect(injectedScripts.length).toBe(0)
  })

  it('article titles with HTML entities rendered as text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/search/results/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            data: {
              articles: [
                {
                  articleId: 1,
                  articleUri: 'xss-title',
                  articleTitle: '<img src=x onerror="alert(1)">Title',
                  articleShortDesc: '',
                  articleDate: 1000000,
                  articleHits: 0,
                },
              ],
              total: 1,
              page: 1,
              limit: 10,
              keywords: 'test',
              categoryId: null,
            },
          }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    }))

    render(
      <MemoryRouter initialEntries={[`/search/results/${validHash}`]}>
        <MockAuthProvider>
          <Routes>
            <Route path="/search/results/:hash" element={<SearchResultsPage />} />
            <Route path="/search/no-results" element={<div>No results</div>} />
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    })

    // No img element with onerror handler should be injected
    const imgElements = Array.from(document.querySelectorAll('img[onerror]'))
    expect(imgElements.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// VAL-XCUT-002: Hidden categories — public layout sidebar only shows visible categories
// ---------------------------------------------------------------------------

describe('VAL-XCUT-002: Sidebar shows only categories returned by API (already filtered server-side)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/settings/public')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { siteName: 'Test KB' } }),
        })
      }
      if (url.includes('/api/categories')) {
        // API returns only visible categories (hidden ones filtered server-side)
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              { catId: 1, catParent: 0, catUri: 'php', catName: 'PHP', catDescription: '', depth: 0, articleCount: 5 },
              { catId: 2, catParent: 0, catUri: 'javascript', catName: 'JavaScript', catDescription: '', depth: 0, articleCount: 3 },
              // Note: 'Hidden Category' is NOT returned by the API since cat_display != 'yes'
            ],
          }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    }))
  })

  function renderLayout(path = '/') {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <MockAuthProvider>
          <Routes>
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<div>Home</div>} />
            </Route>
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    )
  }

  it('sidebar displays categories returned by the API', async () => {
    renderLayout()

    // Wait for categories to load via async fetch
    await waitFor(() => {
      const phpLinks = screen.getAllByRole('link').filter(
        (l) => l.getAttribute('href') === '/categories/php',
      )
      expect(phpLinks.length).toBeGreaterThan(0)
    })

    // Visible categories should appear (checked via href)
    const allLinks = screen.getAllByRole('link')
    expect(allLinks.some((l) => l.getAttribute('href') === '/categories/php')).toBe(true)
    expect(allLinks.some((l) => l.getAttribute('href') === '/categories/javascript')).toBe(true)
    // Hidden category (filtered by API) should NOT appear
    expect(allLinks.some((l) => l.getAttribute('href') === '/categories/hidden-category')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// VAL-XCUT-003: Responsive layout — mobile navigation accessible
// ---------------------------------------------------------------------------

describe('VAL-XCUT-003: Responsive layout — mobile navigation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/settings/public')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { siteName: 'Test KB' } }),
        })
      }
      if (url.includes('/api/categories')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    }))
  })

  function renderLayout(path = '/') {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <MockAuthProvider>
          <Routes>
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<div>Home content</div>} />
              <Route path="categories" element={<div>Categories content</div>} />
              <Route path="search" element={<div>Search content</div>} />
            </Route>
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    )
  }

  it('renders a hamburger/menu toggle button for mobile', () => {
    renderLayout()
    // Mobile menu toggle button should be present in DOM (hidden via CSS on larger screens)
    const menuButton = screen.getByRole('button', { name: /open menu|close menu|toggle menu/i })
    expect(menuButton).toBeInTheDocument()
  })

  it('mobile nav is not visible (collapsed) by default', () => {
    renderLayout()
    // By default, mobile nav menu content should not be in the DOM
    // The hamburger toggles visibility
    const mobileNav = document.getElementById('mobile-nav')
    // It may not exist until opened, or be hidden
    // Assert the nav items count (desktop nav is hidden via CSS, so test DOM presence)
    // The mobile nav should only be shown after clicking
    expect(mobileNav).not.toBeInTheDocument()
  })

  it('clicking hamburger button opens mobile navigation', () => {
    renderLayout()
    const menuButton = screen.getByRole('button', { name: /open menu/i })
    fireEvent.click(menuButton)

    // After clicking, the mobile nav should be present
    const mobileNav = document.getElementById('mobile-nav')
    expect(mobileNav).toBeInTheDocument()

    // Nav links should be accessible
    const navLinks = Array.from(mobileNav!.querySelectorAll('a'))
    const navHrefs = navLinks.map((l) => l.getAttribute('href'))
    expect(navHrefs).toContain('/')
    expect(navHrefs).toContain('/categories')
    expect(navHrefs).toContain('/glossary')
    expect(navHrefs).toContain('/search')
  })

  it('clicking hamburger button again closes the mobile navigation', () => {
    renderLayout()
    const menuButton = screen.getByRole('button', { name: /open menu/i })

    // Open
    fireEvent.click(menuButton)
    expect(document.getElementById('mobile-nav')).toBeInTheDocument()

    // Close
    fireEvent.click(screen.getByRole('button', { name: /close menu/i }))
    expect(document.getElementById('mobile-nav')).not.toBeInTheDocument()
  })

  it('main navigation links present in desktop nav (aria-label Main navigation)', () => {
    renderLayout()
    // Desktop nav is in DOM even if hidden via CSS class 'hidden sm:flex'
    const desktopNav = screen.getByRole('navigation', { name: /main navigation/i })
    expect(desktopNav).toBeInTheDocument()

    // All four nav items should be present in desktop nav
    const links = Array.from(desktopNav.querySelectorAll('a'))
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/categories')
    expect(hrefs).toContain('/glossary')
    expect(hrefs).toContain('/search')
  })

  it('sidebar has responsive class applied (stacks on mobile, side-by-side on md+)', () => {
    renderLayout()
    // Find the aside element (sidebar)
    const aside = document.querySelector('aside')
    expect(aside).not.toBeNull()
    // Verify responsive CSS classes applied — full width on mobile, fixed width on md+
    expect(aside?.className).toMatch(/w-full/)
    expect(aside?.className).toMatch(/md:w-56/)
  })

  it('main content layout has flex-col on mobile and flex-row on md+', () => {
    renderLayout()
    // The wrapper div containing main + aside should have responsive flex direction
    const main = document.querySelector('main')
    const wrapper = main?.parentElement
    expect(wrapper?.className).toMatch(/flex-col/)
    expect(wrapper?.className).toMatch(/md:flex-row/)
  })
})
