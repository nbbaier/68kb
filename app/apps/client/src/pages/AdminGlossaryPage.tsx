import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowUpIcon, ArrowDownIcon, ArrowUpDownIcon } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GlossaryTerm = {
  gId: number
  gTerm: string
  gDefinition: string
}

type GlossaryResponse = {
  data: GlossaryTerm[]
  total: number
  page: number
}

type SortField = 'term' | 'definition'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen)}…`
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

function buildColumns(
  onSortChange: (field: SortField) => void,
  sort: SortField,
  order: 'asc' | 'desc',
): ColumnDef<GlossaryTerm>[] {
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
      accessorKey: 'gTerm',
      header: () => <SortableHeader field="term" label="Term" />,
      cell: ({ row }) => (
        <Link
          to={`/admin/kb/glossary/edit/${row.original.gId}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.gTerm}
        </Link>
      ),
    },
    {
      accessorKey: 'gDefinition',
      header: () => <SortableHeader field="definition" label="Definition" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {truncate(row.original.gDefinition, 50)}
        </span>
      ),
    },
  ]
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20

export function AdminGlossaryPage() {
  // Server-side state
  const [terms, setTerms] = useState<GlossaryTerm[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Query state
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortField>('term')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')

  // Row selection
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  // Bulk action state
  const [bulkAction, setBulkAction] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // -------------------------------------------------------------------------
  // Fetch terms from API
  // -------------------------------------------------------------------------

  const fetchTerms = useCallback(async () => {
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

      const res = await fetch(`/api/admin/glossary?${params.toString()}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        throw new Error('Failed to load glossary terms')
      }
      const json: GlossaryResponse = await res.json()
      setTerms(json.data)
      setTotal(json.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [page, sort, order, search])

  useEffect(() => {
    fetchTerms()
  }, [fetchTerms])

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
    setRowSelection({})
  }

  // -------------------------------------------------------------------------
  // Bulk delete
  // -------------------------------------------------------------------------

  const handleBulkAction = async () => {
    if (bulkAction !== 'delete') return

    const selectedIds = Object.keys(rowSelection).map(Number)
    if (selectedIds.length === 0) {
      toast.error('No terms selected')
      return
    }

    setIsDeleting(true)
    try {
      const res = await fetch('/api/admin/glossary', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: selectedIds }),
      })

      if (!res.ok) {
        throw new Error('Failed to delete terms')
      }

      toast.success(`${selectedIds.length} term(s) deleted`)
      setRowSelection({})
      setBulkAction('')
      await fetchTerms()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete terms')
    } finally {
      setIsDeleting(false)
    }
  }

  // -------------------------------------------------------------------------
  // Table setup
  // -------------------------------------------------------------------------

  const columns = buildColumns(handleSortChange, sort, order)

  const table = useReactTable({
    data: terms,
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
    getRowId: (row) => String(row.gId),
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

  const selectedCount = Object.keys(rowSelection).length

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Glossary</h1>
        <Button asChild>
          <Link to="/admin/kb/glossary/add">Add Term</Link>
        </Button>
      </div>

      {/* Search bar + bulk action */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <Input
            type="search"
            placeholder="Search terms…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="max-w-sm"
            aria-label="Search glossary terms"
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
                setRowSelection({})
              }}
            >
              Clear
            </Button>
          )}
        </form>

        {/* Bulk action controls */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">
              {selectedCount} selected
            </span>
            <Select value={bulkAction} onValueChange={setBulkAction}>
              <SelectTrigger className="w-36" aria-label="Bulk action">
                <SelectValue placeholder="Action…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delete">Delete</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkAction}
              disabled={!bulkAction || isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Update'}
            </Button>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
        >
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
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {search
                    ? 'No terms match your search.'
                    : 'No glossary terms found. Add your first term to get started.'}
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
            {selectedCount > 0
              ? `${selectedCount} of ${total} term(s) selected`
              : `${total} term(s) total`}
          </p>

          {totalPages > 1 && (
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-disabled={page === 1}
                    className={
                      page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                    }
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
                    className={
                      page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                    }
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
