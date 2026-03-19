import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { ArrowUpIcon, ArrowDownIcon, ArrowUpDownIcon } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArticleCategory = {
  catId: number
  catName: string
}

export type Article = {
  articleId: number
  articleTitle: string
  articleUri: string
  articleDate: number
  articleModified: number
  articleDisplay: 'y' | 'n'
  articleOrder: number
  categories: ArticleCategory[]
}

type ArticlesResponse = {
  data: Article[]
  total: number
  page: number
}

type SortField = 'date' | 'title' | 'modified' | 'display' | 'order'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

function buildColumns(onSortChange: (field: SortField) => void, sort: SortField, order: 'asc' | 'desc'): ColumnDef<Article>[] {
  function SortableHeader({ field, label }: { field: SortField; label: string }) {
    const isActive = sort === field
    return (
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onSortChange(field)}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {isActive ? (
          order === 'asc' ? (
            <ArrowUpIcon className="size-3.5" />
          ) : (
            <ArrowDownIcon className="size-3.5" />
          )
        ) : (
          <ArrowUpDownIcon className="size-3.5 opacity-40" />
        )}
      </button>
    )
  }

  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() ? 'indeterminate' : false)
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'articleTitle',
      header: () => <SortableHeader field="title" label="Title" />,
      cell: ({ row }) => (
        <Link
          to={`/admin/articles/${row.original.articleId}/edit`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.articleTitle}
        </Link>
      ),
    },
    {
      id: 'categories',
      header: 'Categories',
      cell: ({ row }) => {
        const cats = row.original.categories
        if (!cats || cats.length === 0) return <span className="text-muted-foreground">—</span>
        return <span>{cats.map((c) => c.catName).join(', ')}</span>
      },
    },
    {
      accessorKey: 'articleDate',
      header: () => <SortableHeader field="date" label="Date Added" />,
      cell: ({ row }) => formatDate(row.original.articleDate),
    },
    {
      accessorKey: 'articleModified',
      header: () => <SortableHeader field="modified" label="Date Edited" />,
      cell: ({ row }) => formatDate(row.original.articleModified),
    },
    {
      accessorKey: 'articleDisplay',
      header: () => <SortableHeader field="display" label="Display" />,
      cell: ({ row }) => {
        const isActive = row.original.articleDisplay === 'y'
        return (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        )
      },
    },
  ]
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10

export function AdminArticlesPage() {
  // Server-side state
  const [articles, setArticles] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Query state
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortField>('date')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')

  // Row selection
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // -------------------------------------------------------------------------
  // Fetch articles from API
  // -------------------------------------------------------------------------

  const fetchArticles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sort,
        order,
      })
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/articles?${params.toString()}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        throw new Error('Failed to load articles')
      }
      const json: ArticlesResponse = await res.json()
      setArticles(json.data)
      setTotal(json.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [page, sort, order, search])

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  // -------------------------------------------------------------------------
  // Sort toggle
  // -------------------------------------------------------------------------

  const handleSortChange = (field: SortField) => {
    if (sort === field) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(field)
      setOrder('asc')
    }
    setPage(1)
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  // -------------------------------------------------------------------------
  // Table setup
  // -------------------------------------------------------------------------

  const columns = buildColumns(handleSortChange, sort, order)

  const table = useReactTable({
    data: articles,
    columns,
    state: {
      sorting: [] as SortingState,
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
    getRowId: (row) => String(row.articleId),
  })

  // -------------------------------------------------------------------------
  // Pagination helpers
  // -------------------------------------------------------------------------

  function getPageNumbers(): (number | 'ellipsis')[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const pages: (number | 'ellipsis')[] = [1]
    if (page > 3) pages.push('ellipsis')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i)
    }
    if (page < totalPages - 2) pages.push('ellipsis')
    pages.push(totalPages)
    return pages
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Articles</h1>
        <Button asChild>
          <Link to="/admin/articles/new">Add Article</Link>
        </Button>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <Input
          type="search"
          placeholder="Search articles…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-sm"
          aria-label="Search articles"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {search && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setPage(1)
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {/* Error state */}
      {error && (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {search ? 'No articles match your search.' : 'No articles found. Add your first article to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer: count + pagination */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {Object.keys(rowSelection).length > 0
              ? `${Object.keys(rowSelection).length} of ${total} article(s) selected`
              : `${total} article(s) total`}
          </p>

          {totalPages > 1 && (
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-disabled={page === 1}
                    className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>

                {getPageNumbers().map((p, idx) =>
                  p === 'ellipsis' ? (
                    <PaginationItem key={`ellipsis-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        isActive={p === page}
                        onClick={() => setPage(p)}
                        className="cursor-pointer"
                        aria-label={`Page ${p}`}
                        aria-current={p === page ? 'page' : undefined}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-disabled={page === totalPages}
                    className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </div>
  )
}
