import { useState, useEffect } from 'react'
import { Link } from 'react-router'
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
import { CopyIcon, Trash2Icon } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CategoryWithDepth = {
  catId: number
  catParent: number
  catUri: string
  catName: string
  catDescription: string
  catAllowads: string
  catDisplay: string
  catOrder: number
  catImage: string
  catKeywords: string
  depth: number
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function AdminCategoriesPage() {
  const [cats, setCats] = useState<CategoryWithDepth[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/categories', { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load categories')
        const json: { data: CategoryWithDepth[] } = await res.json()
        setCats(json.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }
    fetchCategories()
  }, [])

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Button asChild>
          <Link to="/admin/categories/new">Add Category</Link>
        </Button>
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
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Allow Ads</TableHead>
              <TableHead>Display</TableHead>
              <TableHead>Duplicate</TableHead>
              <TableHead>Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : cats.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No categories found. Add your first category to get started.
                </TableCell>
              </TableRow>
            ) : (
              cats.map((cat) => (
                <TableRow key={cat.catId}>
                  {/* Title with tree indentation */}
                  <TableCell>
                    <span
                      className="inline-flex items-center gap-1"
                      style={{ paddingLeft: `${cat.depth * 1.5}rem` }}
                    >
                      {cat.depth > 0 && (
                        <span className="text-muted-foreground select-none" aria-hidden>
                          {'»'.repeat(cat.depth)}
                        </span>
                      )}
                      <Link
                        to={`/admin/categories/${cat.catId}/edit`}
                        className="font-medium text-primary hover:underline"
                      >
                        {cat.catName}
                      </Link>
                    </span>
                  </TableCell>

                  {/* Allow Ads */}
                  <TableCell>
                    <Badge variant={cat.catAllowads === 'yes' ? 'default' : 'secondary'}>
                      {cat.catAllowads === 'yes' ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>

                  {/* Display */}
                  <TableCell>
                    <Badge variant={cat.catDisplay === 'yes' ? 'default' : 'secondary'}>
                      {cat.catDisplay === 'yes' ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>

                  {/* Duplicate */}
                  <TableCell>
                    <Link
                      to={`/admin/categories/new?duplicateId=${cat.catId}`}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={`Duplicate ${cat.catName}`}
                    >
                      <CopyIcon className="size-3.5" />
                      Duplicate
                    </Link>
                  </TableCell>

                  {/* Delete */}
                  <TableCell>
                    <Link
                      to={`/admin/categories/${cat.catId}/delete`}
                      className="inline-flex items-center gap-1 text-sm text-destructive hover:text-destructive/80 transition-colors"
                      aria-label={`Delete ${cat.catName}`}
                    >
                      <Trash2Icon className="size-3.5" />
                      Delete
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
