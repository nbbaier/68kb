import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Trash2Icon, ImageIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CategoryWithDepth = {
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

type CategoryDetail = {
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
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  uri: z
    .string()
    .regex(
      /^[a-zA-Z0-9_-]*$/,
      'URI may only contain letters, numbers, hyphens, and underscores',
    )
    .or(z.literal(''))
    .optional()
    .default(''),
  description: z.string().default(''),
  display: z.enum(['yes', 'no']).default('yes'),
  allowAds: z.enum(['yes', 'no']).default('yes'),
  parent: z.string().default('0'),
  keywords: z.string().default(''),
  order: z
    .string()
    .default('0')
    .refine(
      (v) => v === '' || !isNaN(Number(v)),
      'Order must be a numeric value',
    ),
})

type CategoryFormValues = z.infer<typeof categorySchema>

// ---------------------------------------------------------------------------
// ParentSelect — hierarchical parent dropdown
// ---------------------------------------------------------------------------

type ParentSelectProps = {
  categories: CategoryWithDepth[]
  value: string
  onChange: (value: string) => void
  excludeId?: number
}

function ParentSelect({ categories, value, onChange, excludeId }: ParentSelectProps) {
  // Ensure categories is always an array (defensive against async loading)
  const safeCategories = Array.isArray(categories) ? categories : []
  // Filter out the current category (can't be its own parent) and its descendants
  const excluded = new Set<number>()
  if (excludeId !== undefined) {
    // Add the excludeId and traverse to find all descendants
    const addDescendants = (id: number) => {
      excluded.add(id)
      for (const cat of safeCategories) {
        if (cat.catParent === id && !excluded.has(cat.catId)) {
          addDescendants(cat.catId)
        }
      }
    }
    addDescendants(excludeId)
  }

  const filtered = safeCategories.filter((c) => !excluded.has(c.catId))

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Parent category">
        <SelectValue placeholder="No Parent (root)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="0">No Parent (root)</SelectItem>
        {filtered.map((cat) => (
          <SelectItem key={cat.catId} value={String(cat.catId)}>
            {cat.depth > 0 && (
              <span className="text-muted-foreground">{'»'.repeat(cat.depth)} </span>
            )}
            {cat.catName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ---------------------------------------------------------------------------
// ImageSection — image preview + upload + delete
// ---------------------------------------------------------------------------

type ImageSectionProps = {
  catId?: number
  existingImage: string
  onImageDeleted: () => void
  imageFile: File | null
  onImageFileChange: (file: File | null) => void
}

function ImageSection({
  catId,
  existingImage,
  onImageDeleted,
  imageFile,
  onImageFileChange,
}: ImageSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteImage = async () => {
    if (!catId) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/categories/${catId}/image`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        toast.error(json.error ?? 'Failed to delete image')
        return
      }
      onImageDeleted()
      toast.success('Image deleted')
    } catch {
      toast.error('Failed to delete image')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Existing image preview */}
      {existingImage && (
        <div className="flex items-start gap-4">
          <div className="rounded-md border overflow-hidden bg-muted/20">
            <img
              src={`/uploads/categories/${existingImage}`}
              alt="Category image"
              className="max-h-32 max-w-48 object-contain"
              aria-label="Current category image"
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{existingImage}</p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteImage}
              disabled={isDeleting}
              aria-label="Delete image"
            >
              <Trash2Icon className="size-4 mr-2" />
              {isDeleting ? 'Deleting…' : 'Delete Image'}
            </Button>
          </div>
        </div>
      )}

      {/* Upload new image */}
      {!existingImage && (
        <div className="flex items-center gap-3">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/gif,image/jpeg,image/png"
            onChange={(e) => onImageFileChange(e.target.files?.[0] ?? null)}
            className="max-w-sm"
            aria-label="Upload category image"
          />
          {imageFile && (
            <p className="text-sm text-muted-foreground">
              Selected: {imageFile.name}
            </p>
          )}
        </div>
      )}
      {existingImage && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Upload a new image to replace the existing one:
          </p>
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/gif,image/jpeg,image/png"
            onChange={(e) => onImageFileChange(e.target.files?.[0] ?? null)}
            className="max-w-sm"
            aria-label="Replace category image"
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Allowed types: GIF, JPG, PNG. Maximum size: 100KB.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AdminCategoryFormPage — main component
// ---------------------------------------------------------------------------

export function AdminCategoryFormPage() {
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const duplicateId = searchParams.get('duplicateId')
  const isEdit = !!id
  const isDuplicate = !isEdit && !!duplicateId
  const catId = id ? parseInt(id, 10) : null
  const dupId = duplicateId ? parseInt(duplicateId, 10) : null

  // State
  const [isLoading, setIsLoading] = useState(isEdit || isDuplicate)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [allCategories, setAllCategories] = useState<CategoryWithDepth[]>([])
  const [existingImage, setExistingImage] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)

  // React Hook Form
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      uri: '',
      description: '',
      display: 'yes',
      allowAds: 'yes',
      parent: '0',
      keywords: '',
      order: '0',
    },
  })

  // -------------------------------------------------------------------------
  // Load categories for parent dropdown
  // -------------------------------------------------------------------------
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const res = await fetch('/api/admin/categories', { credentials: 'include' })
        if (res.ok) {
          const json: { data: CategoryWithDepth[] } = await res.json()
          setAllCategories(json.data)
        }
      } catch {
        // Non-critical: parent dropdown may be empty
      }
    }
    fetchAll()
  }, [])

  // -------------------------------------------------------------------------
  // Load existing category data (edit or duplicate mode)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isEdit && !isDuplicate) return

    const fetchCategory = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const endpoint = isDuplicate
          ? `/api/admin/categories/${dupId}/duplicate`
          : `/api/admin/categories/${catId}`

        const res = await fetch(endpoint, { credentials: 'include' })
        if (!res.ok) {
          const json = await res.json() as { error?: string }
          throw new Error(json.error ?? 'Failed to load category')
        }
        const json: { data: CategoryDetail } = await res.json()
        const cat = json.data

        // Derive the last URI segment for the form input
        const uriSegment = cat.catUri ? cat.catUri.split('/').at(-1) ?? cat.catUri : ''

        form.reset({
          name: cat.catName,
          uri: uriSegment,
          description: cat.catDescription ?? '',
          display: cat.catDisplay === 'yes' ? 'yes' : 'no',
          allowAds: cat.catAllowads === 'yes' ? 'yes' : 'no',
          parent: String(cat.catParent ?? 0),
          keywords: cat.catKeywords ?? '',
          order: String(cat.catOrder ?? 0),
        })

        // In edit mode, show existing image
        if (isEdit && cat.catImage) {
          setExistingImage(cat.catImage)
        }
        // In duplicate mode, don't carry over the image
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load category')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCategory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catId, dupId, isEdit, isDuplicate])

  // -------------------------------------------------------------------------
  // Form submission
  // -------------------------------------------------------------------------
  const onSubmit = async (values: CategoryFormValues) => {
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.set('name', values.name)
      formData.set('uri', values.uri ?? '')
      formData.set('description', values.description ?? '')
      formData.set('display', values.display)
      formData.set('allowAds', values.allowAds)
      formData.set('parent', values.parent)
      formData.set('keywords', values.keywords ?? '')
      formData.set('order', values.order ?? '0')

      if (imageFile) {
        formData.set('image', imageFile)
      }

      const url = isEdit
        ? `/api/admin/categories/${catId}`
        : '/api/admin/categories'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        credentials: 'include',
        body: formData,
      })

      const json = await res.json() as { data?: CategoryDetail; error?: string }

      if (!res.ok) {
        toast.error(json.error ?? 'Failed to save category')
        return
      }

      toast.success(isEdit ? 'Category updated successfully' : 'Category created successfully')

      // Redirect to grid
      navigate('/admin/categories')
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // -------------------------------------------------------------------------
  // Page heading
  // -------------------------------------------------------------------------
  let pageTitle = 'Add Category'
  if (isEdit) pageTitle = 'Edit Category'
  else if (isDuplicate) pageTitle = 'Duplicate Category'

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/categories">Back to Categories</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{pageTitle}</h1>
        <Button variant="outline" asChild>
          <Link to="/admin/categories">Back to Categories</Link>
        </Button>
      </div>

      {/* Form */}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          encType="multipart/form-data"
          className="space-y-5"
        >
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Name <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    placeholder="Category name"
                    aria-required="true"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* URI */}
          <FormField
            control={form.control}
            name="uri"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URI Slug</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    placeholder="auto-generated from name"
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Only letters, numbers, hyphens, and underscores. Leave blank to auto-generate from name.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <textarea
                    {...field}
                    rows={4}
                    placeholder="Category description"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:outline-none resize-y"
                    aria-label="Category description"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Display */}
          <FormField
            control={form.control}
            name="display"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger aria-label="Display">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Allow Ads */}
          <FormField
            control={form.control}
            name="allowAds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Allow Ads</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger aria-label="Allow Ads">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Parent Category */}
          <FormField
            control={form.control}
            name="parent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parent Category</FormLabel>
                <FormControl>
                  <ParentSelect
                    categories={allCategories}
                    value={field.value}
                    onChange={field.onChange}
                    excludeId={isEdit && catId ? catId : undefined}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Keywords */}
          <FormField
            control={form.control}
            name="keywords"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Keywords</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    placeholder="Comma-separated keywords"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Order */}
          <FormField
            control={form.control}
            name="order"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Order</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    placeholder="0"
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Display order (lower numbers appear first).
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />

          {/* Image */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Category Image</h3>
            </div>
            <ImageSection
              catId={catId ?? undefined}
              existingImage={existingImage}
              onImageDeleted={() => setExistingImage('')}
              imageFile={imageFile}
              onImageFileChange={setImageFile}
            />
          </div>

          <Separator />

          {/* Submit */}
          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEdit ? 'Update Category' : 'Create Category'}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to="/admin/categories">Cancel</Link>
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
