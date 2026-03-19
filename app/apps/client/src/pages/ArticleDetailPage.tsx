import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ArticleCategory = {
  catId: number
  catName: string
  catUri: string
}

type ArticleAttachment = {
  attachId: number
  attachFile: string
  attachTitle: string
  attachType: string
  attachSize: string
}

type GlossaryTerm = {
  gTerm: string
  gDefinition: string
}

type ArticleDetail = {
  articleId: number
  articleUri: string
  articleTitle: string
  articleKeywords: string
  articleDescription: string
  articleShortDesc: string
  articleDate: number
  articleModified: number
  articleDisplay: string
  articleHits: number
  articleAuthor: number
  categories: ArticleCategory[]
  attachments: ArticleAttachment[]
  glossaryTerms: GlossaryTerm[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(timestamp: number): string {
  if (!timestamp) return ''
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatFileSize(sizeStr: string): string {
  const bytes = parseInt(sizeStr, 10)
  if (isNaN(bytes)) return sizeStr
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Set or update a <meta> tag in <head> by name.
 */
function setMetaTag(name: string, content: string): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * Apply glossary tooltips to rendered article content.
 *
 * Processes text nodes in the article DOM (not inside existing <a> tags)
 * and wraps the FIRST occurrence of each glossary term with a tooltip anchor.
 * Sorted by term length descending so longer terms take precedence.
 */
function applyGlossaryTooltips(
  container: HTMLElement,
  terms: GlossaryTerm[],
): void {
  if (terms.length === 0) return

  // Sort terms by length descending (longer terms first)
  const sorted = [...terms].sort((a, b) => b.gTerm.length - a.gTerm.length)

  /**
   * Collect all current text nodes inside container that are NOT
   * inside an <a> element.
   */
  function getTextNodes(): Text[] {
    const nodes: Text[] = []
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      let parent = node.parentElement
      let insideLink = false
      while (parent && parent !== container) {
        if (parent.tagName === 'A') {
          insideLink = true
          break
        }
        parent = parent.parentElement
      }
      if (!insideLink) nodes.push(node as Text)
      node = walker.nextNode()
    }
    return nodes
  }

  // For each term, find and wrap the first occurrence across all text nodes
  for (const term of sorted) {
    const key = term.gTerm.toLowerCase()
    const textNodes = getTextNodes()

    for (const textNode of textNodes) {
      const text = textNode.textContent ?? ''
      const idx = text.toLowerCase().indexOf(key)
      if (idx === -1) continue

      // Found first occurrence of this term
      const before = text.slice(0, idx)
      const match = text.slice(idx, idx + term.gTerm.length)
      const after = text.slice(idx + term.gTerm.length)

      const frag = document.createDocumentFragment()
      if (before) frag.appendChild(document.createTextNode(before))

      const anchor = document.createElement('a')
      anchor.className = 'tooltip'
      const defTrunc =
        term.gDefinition.length > 75
          ? term.gDefinition.slice(0, 75)
          : term.gDefinition
      anchor.title = `${term.gTerm} - ${defTrunc}`
      anchor.href = `/glossary/term/${encodeURIComponent(term.gTerm)}`
      anchor.textContent = match
      frag.appendChild(anchor)

      if (after) frag.appendChild(document.createTextNode(after))

      textNode.parentNode?.replaceChild(frag, textNode)
      break // Only first occurrence of this term; move to next term
    }
  }
}

// ---------------------------------------------------------------------------
// Article content renderer with glossary tooltips
// ---------------------------------------------------------------------------

function ArticleContent({
  html,
  glossaryTerms,
}: {
  html: string
  glossaryTerms: GlossaryTerm[]
}) {
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contentRef.current) return
    applyGlossaryTooltips(contentRef.current, glossaryTerms)
    // Only re-run when the article HTML or glossary terms change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, glossaryTerms])

  return (
    <div
      ref={contentRef}
      className="prose prose-slate max-w-none article-content"
      // Article description is stored as HTML in the database.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ---------------------------------------------------------------------------
// 404 inline component (within public layout)
// ---------------------------------------------------------------------------

function ArticleNotFound() {
  return (
    <div className="py-12 text-center space-y-4">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <h2 className="text-2xl font-semibold text-foreground">Article not found</h2>
      <p className="text-muted-foreground">
        The article you&apos;re looking for doesn&apos;t exist or is not available.
      </p>
      <Link
        to="/"
        className="inline-block mt-2 text-primary hover:underline"
      >
        ← Back to home
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ArticleDetailPage
// ---------------------------------------------------------------------------

export function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [article, setArticle] = useState<ArticleDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  // Track whether hit has been counted for current article to avoid double-counting
  const hitCountedRef = useRef<string | null>(null)

  const incrementHit = useCallback(async (articleId: number) => {
    try {
      const res = await fetch(`/api/articles/${articleId}/hit`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        const json = await res.json() as { data?: { hits: number } }
        const newHits = json.data?.hits
        if (typeof newHits === 'number') {
          setArticle((prev) => prev ? { ...prev, articleHits: newHits } : prev)
        }
      }
    } catch {
      // Non-critical — silently ignore
    }
  }, [])

  useEffect(() => {
    if (!slug) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setLoading(true)
    setNotFound(false)
    setArticle(null)

    fetch(`/api/articles/${encodeURIComponent(slug)}`, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        if (!res.ok) {
          setNotFound(true)
          return
        }
        const json = await res.json()
        const data = json.data as ArticleDetail
        setArticle(data)

        // Set page <title> and meta tags
        document.title = `${data.articleTitle} — 68kb`
        if (data.articleKeywords) {
          setMetaTag('keywords', data.articleKeywords)
        }
        if (data.articleShortDesc) {
          // Strip any HTML tags from short_desc for the meta description
          const tmp = document.createElement('div')
          tmp.innerHTML = data.articleShortDesc
          setMetaTag('description', tmp.textContent ?? '')
        }

        // Increment hit counter once per article load
        if (hitCountedRef.current !== slug) {
          hitCountedRef.current = slug
          incrementHit(data.articleId)
        }
      })
      .catch(() => {
        setNotFound(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [slug, incrementHit])

  // Restore default title on unmount
  useEffect(() => {
    return () => {
      document.title = '68kb'
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-2/3 bg-muted/40 rounded animate-pulse" />
        <div className="h-4 w-full bg-muted/40 rounded animate-pulse" />
        <div className="h-4 w-full bg-muted/40 rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-muted/40 rounded animate-pulse" />
      </div>
    )
  }

  if (notFound) {
    return <ArticleNotFound />
  }

  if (!article) return null

  return (
    <article className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Title */}
      {/* ------------------------------------------------------------------ */}
      <h1 className="text-3xl font-bold text-foreground">{article.articleTitle}</h1>

      {/* ------------------------------------------------------------------ */}
      {/* Article meta info: modified date, hit count */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-b pb-4">
        {article.articleModified > 0 && (
          <span>
            <span className="font-medium">Last Updated:</span>{' '}
            {formatDate(article.articleModified)}
          </span>
        )}
        <span>
          <span className="font-medium">Views:</span>{' '}
          {article.articleHits}
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Full HTML content with glossary tooltips */}
      {/* ------------------------------------------------------------------ */}
      <ArticleContent html={article.articleDescription} glossaryTerms={article.glossaryTerms} />

      {/* ------------------------------------------------------------------ */}
      {/* Categories */}
      {/* ------------------------------------------------------------------ */}
      {article.categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t text-sm">
          <span className="font-medium text-muted-foreground">Categories:</span>
          {article.categories.map((cat, idx) => (
            <span key={cat.catId}>
              <Link
                to={`/categories/${cat.catUri}`}
                className="text-primary hover:underline"
              >
                {cat.catName}
              </Link>
              {idx < article.categories.length - 1 && (
                <span className="text-muted-foreground">,</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Attachments — only rendered when article has attachments */}
      {/* ------------------------------------------------------------------ */}
      {article.attachments.length > 0 && (
        <fieldset className="border rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold text-foreground">
            Attachments
          </legend>
          <ul className="space-y-2 mt-2">
            {article.attachments.map((att) => (
              <li key={att.attachId} className="flex items-center gap-3 text-sm">
                <a
                  href={`/uploads/${article.articleId}/${att.attachFile}`}
                  className="text-primary hover:underline font-medium"
                  download
                >
                  {att.attachTitle || att.attachFile}
                </a>
                <span className="text-muted-foreground">
                  ({att.attachType || 'file'},{' '}
                  {formatFileSize(att.attachSize)})
                </span>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </article>
  )
}
