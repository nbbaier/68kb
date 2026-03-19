import { Link } from 'react-router'

// ---------------------------------------------------------------------------
// SearchNoResultsPage — /search/no-results
//
// Shown when a search returns zero results, has an invalid/expired hash,
// or empty keywords are submitted.
// ---------------------------------------------------------------------------

export function SearchNoResultsPage() {
  return (
    <div className="max-w-lg">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-4">
        <ol className="flex items-center gap-1">
          <li>
            <Link to="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <Link to="/search" className="hover:text-foreground transition-colors">
              Search
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="text-foreground font-medium">
            No Results
          </li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold mb-4">No Results Found</h1>

      <p className="text-muted-foreground mb-6">
        Your search did not match any articles. Please try different keywords or browse the{' '}
        <Link to="/categories" className="text-primary hover:underline">
          categories
        </Link>
        .
      </p>

      <Link
        to="/search"
        className="inline-block rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Search Again
      </Link>
    </div>
  )
}
