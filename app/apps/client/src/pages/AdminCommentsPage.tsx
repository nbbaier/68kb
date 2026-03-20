import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

type CommentStatus = '0' | '1' | 'spam'

type AdminComment = {
  commentId: number
  commentArticleId: number
  commentAuthor: string
  commentAuthorEmail: string
  commentDate: number
  commentContent: string
  commentApproved: CommentStatus
  articleTitle: string
  articleUri: string
}

function formatDate(timestamp: number): string {
  if (!timestamp) return ''
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getStatusLabel(status: CommentStatus): string {
  if (status === '1') return 'Approved'
  if (status === '0') return 'Pending'
  return 'Spam'
}

function getStatusClass(status: CommentStatus): string {
  if (status === '1') return 'text-green-700 bg-green-100'
  if (status === '0') return 'text-amber-700 bg-amber-100'
  return 'text-red-700 bg-red-100'
}

export function AdminCommentsPage() {
  const [comments, setComments] = useState<AdminComment[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'all' | CommentStatus>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const hasPrev = page > 1
  const hasNext = page * limit < total

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', String(limit))
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (search.trim()) params.set('search', search.trim())
    return params.toString()
  }, [limit, page, search, statusFilter])

  const loadComments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/comments?${queryString}`, { credentials: 'include' })
      const json = await res.json().catch(() => null) as {
        data?: AdminComment[]
        total?: number
        error?: string
      } | null

      if (!res.ok || !json?.data) {
        throw new Error(json?.error ?? 'Failed to load comments')
      }

      setComments(json.data)
      setTotal(json.total ?? 0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load comments')
      setComments([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  async function updateStatus(commentId: number, status: CommentStatus) {
    setBusyId(commentId)
    try {
      const res = await fetch(`/api/admin/comments/${commentId}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok) throw new Error(json?.error ?? 'Failed to update status')
      setComments((prev) =>
        prev.map((entry) => (entry.commentId === commentId ? { ...entry, commentApproved: status } : entry)),
      )
      toast.success('Comment status updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteComment(commentId: number) {
    setBusyId(commentId)
    try {
      const res = await fetch(`/api/admin/comments/${commentId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok) throw new Error(json?.error ?? 'Failed to delete comment')

      setComments((prev) => prev.filter((entry) => entry.commentId !== commentId))
      setTotal((prev) => Math.max(0, prev - 1))
      toast.success('Comment deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete comment')
    } finally {
      setBusyId(null)
    }
  }

  function applySearch() {
    setPage(1)
    setSearch(searchInput.trim())
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Comments</h1>
          <p className="text-sm text-muted-foreground">
            Moderate article comments and spam queue.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | CommentStatus)
              setPage(1)
            }}
            className="h-9 rounded border bg-background px-2"
          >
            <option value="all">All</option>
            <option value="0">Pending</option>
            <option value="1">Approved</option>
            <option value="spam">Spam</option>
          </select>
        </label>

        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Search</span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applySearch()
            }}
            placeholder="Author, email, article title, content"
            className="h-9 rounded border bg-background px-2"
          />
        </label>

        <button
          type="button"
          onClick={applySearch}
          className="h-9 rounded bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          Apply
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-10 animate-pulse rounded bg-muted/50" />
          <div className="h-10 animate-pulse rounded bg-muted/50" />
          <div className="h-10 animate-pulse rounded bg-muted/50" />
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
          No comments found for current filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Author</th>
                <th className="px-3 py-2 font-medium">Article</th>
                <th className="px-3 py-2 font-medium">Comment</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {comments.map((item) => {
                const isBusy = busyId === item.commentId
                return (
                  <tr key={item.commentId} className="border-t align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{item.commentAuthor}</div>
                      <div className="text-xs text-muted-foreground">{item.commentAuthorEmail}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(item.commentDate)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Link to={`/article/${item.articleUri}`} className="text-primary hover:underline">
                        {item.articleTitle}
                      </Link>
                    </td>
                    <td className="max-w-[460px] px-3 py-2">
                      <p className="line-clamp-4 whitespace-pre-wrap">{item.commentContent}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${getStatusClass(item.commentApproved)}`}>
                        {getStatusLabel(item.commentApproved)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => updateStatus(item.commentId, '1')}
                          className="rounded border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => updateStatus(item.commentId, '0')}
                          className="rounded border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                        >
                          Pending
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => updateStatus(item.commentId, 'spam')}
                          className="rounded border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                        >
                          Spam
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => deleteComment(item.commentId)}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {total} total
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border px-3 py-1.5 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-3 py-1.5 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
