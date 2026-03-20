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

export type AdminUser = {
  userId: number
  userUsername: string
  userEmail: string
  userGroup: number
  userJoinDate: number
  userLastLogin: number
  userApiKey: string
  groupName: string | null
  gravatarHash: string
}

type UsersResponse = {
  data: AdminUser[]
  total: number
  page: number
}

type SortField = 'username' | 'email' | 'joinDate' | 'lastLogin' | 'group'

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

function gravatarUrl(hash: string, size = 32): string {
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

function buildColumns(
  onSortChange: (field: SortField) => void,
  sort: SortField,
  order: 'asc' | 'desc',
): ColumnDef<AdminUser>[] {
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
      id: 'username',
      header: () => <SortableHeader field="username" label="Username" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <img
            src={gravatarUrl(row.original.gravatarHash)}
            alt={`Gravatar for ${row.original.userUsername}`}
            width={32}
            height={32}
            className="rounded-full shrink-0"
            aria-label={`Gravatar for ${row.original.userUsername}`}
          />
          <Link
            to={`/admin/users/${row.original.userId}/edit`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.userUsername}
          </Link>
        </div>
      ),
    },
    {
      accessorKey: 'userJoinDate',
      header: () => <SortableHeader field="joinDate" label="Join Date" />,
      cell: ({ row }) => formatDate(row.original.userJoinDate),
    },
    {
      accessorKey: 'userLastLogin',
      header: () => <SortableHeader field="lastLogin" label="Last Login" />,
      cell: ({ row }) =>
        row.original.userLastLogin ? formatDate(row.original.userLastLogin) : '—',
    },
    {
      id: 'group',
      header: () => <SortableHeader field="group" label="User Group" />,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.groupName ?? '—'}</span>
      ),
    },
  ]
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10

export function AdminUsersPage() {
  // Server-side state
  const [usersList, setUsersList] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Query state
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortField>('username')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')

  // Row selection
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // -------------------------------------------------------------------------
  // Fetch users from API
  // -------------------------------------------------------------------------

  const fetchUsers = useCallback(async () => {
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

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        throw new Error('Failed to load users')
      }
      const json: UsersResponse = await res.json()
      setUsersList(json.data)
      setTotal(json.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [page, sort, order, search])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

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
  // Table setup
  // -------------------------------------------------------------------------

  const columns = buildColumns(handleSortChange, sort, order)

  const table = useReactTable({
    data: usersList,
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
    getRowId: (row) => String(row.userId),
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
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/users/failed-logins">Failed Logins</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/usergroups">User Groups</Link>
          </Button>
          <Button asChild>
            <Link to="/admin/users/new">Add User</Link>
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <Input
          type="search"
          placeholder="Search users by username or email…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-sm"
          aria-label="Search users"
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
                  {search ? 'No users match your search.' : 'No users found. Add your first user to get started.'}
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
              ? `${Object.keys(rowSelection).length} of ${total} user(s) selected`
              : `${total} user(s) total`}
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
