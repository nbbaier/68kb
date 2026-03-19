import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GlossaryTerm = {
  gId: number
  gTerm: string
  gDefinition: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// ---------------------------------------------------------------------------
// Sanitize HTML — strips all tags, returning plain text only.
// Used to safely render glossary definitions without XSS risk.
// ---------------------------------------------------------------------------

function stripTags(html: string): string {
  if (!html) return ''
  if (typeof document === 'undefined') {
    // Fallback for non-browser environments (e.g., SSR/tests)
    return html.replace(/<[^>]*>/g, '')
  }
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent ?? ''
}

// ---------------------------------------------------------------------------
// A-Z navigation bar
// ---------------------------------------------------------------------------

function AZBar({ activeLetter }: { activeLetter: string | undefined }) {
  return (
    <nav aria-label="Glossary A-Z navigation" className="mb-6">
      <ul className="flex flex-wrap gap-1">
        {LETTERS.map((letter) => {
          const isActive = activeLetter?.toUpperCase() === letter
          return (
            <li key={letter}>
              <Link
                to={`/glossary/term/${letter.toLowerCase()}`}
                className={[
                  'inline-block w-8 h-8 text-center text-sm font-medium rounded transition-colors leading-8',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-primary hover:text-primary-foreground',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
              >
                {letter}
              </Link>
            </li>
          )
        })}
        <li>
          <Link
            to="/glossary/term/sym"
            className={[
              'inline-block px-2 h-8 text-center text-sm font-medium rounded transition-colors leading-8',
              activeLetter === 'sym'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-primary hover:text-primary-foreground',
            ].join(' ')}
            aria-current={activeLetter === 'sym' ? 'page' : undefined}
          >
            #
          </Link>
        </li>
        <li>
          <Link
            to="/glossary"
            className={[
              'inline-block px-2 h-8 text-center text-sm font-medium rounded transition-colors leading-8',
              !activeLetter
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-primary hover:text-primary-foreground',
            ].join(' ')}
            aria-current={!activeLetter ? 'page' : undefined}
          >
            All
          </Link>
        </li>
      </ul>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Term list
// ---------------------------------------------------------------------------

function TermList({ terms }: { terms: GlossaryTerm[] }) {
  if (terms.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4">
        No glossary terms found for this selection.
      </p>
    )
  }

  return (
    <dl className="space-y-4">
      {terms.map((term) => (
        <div key={term.gId} id={`term-${term.gTerm.toLowerCase().replace(/\s+/g, '-')}`}>
          <dt className="text-base font-semibold text-foreground">
            <a
              href={`#term-${term.gTerm.toLowerCase().replace(/\s+/g, '-')}`}
              className="hover:underline"
            >
              {term.gTerm}
            </a>
          </dt>
          <dd className="mt-1 text-sm text-muted-foreground pl-4">
            {stripTags(term.gDefinition)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

// ---------------------------------------------------------------------------
// GlossaryPage — /glossary and /glossary/term/:letter
// ---------------------------------------------------------------------------

export function GlossaryPage() {
  const { letter } = useParams<{ letter: string }>()
  const [terms, setTerms] = useState<GlossaryTerm[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Determine title
  let pageTitle = 'Glossary'
  if (letter) {
    if (letter === 'sym') {
      pageTitle = 'Glossary — Symbols & Numbers'
    } else if (/^[a-z]$/i.test(letter)) {
      pageTitle = `Glossary — ${letter.toUpperCase()}`
    }
  }

  useEffect(() => {
    document.title = pageTitle
  }, [pageTitle])

  useEffect(() => {
    setIsLoading(true)
    setError(null)

    const url = letter ? `/api/glossary/term/${encodeURIComponent(letter)}` : '/api/glossary'

    fetch(url, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load glossary')
        return res.json() as Promise<{ data: GlossaryTerm[] }>
      })
      .then((json) => {
        setTerms(json.data)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load glossary')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [letter])

  return (
    <div>
      {/* Page title */}
      <h1 className="text-2xl font-bold mb-4">Glossary</h1>

      {/* A-Z navigation bar */}
      <AZBar activeLetter={letter} />

      {/* Content */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <>
          {letter && (
            <p className="text-sm text-muted-foreground mb-4">
              {letter === 'sym'
                ? 'Showing terms starting with symbols or numbers.'
                : `Showing terms starting with "${letter.toUpperCase()}".`}
            </p>
          )}
          <TermList terms={terms} />
        </>
      )}
    </div>
  )
}
