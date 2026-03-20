import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import { toast } from 'sonner'
import { Trash2Icon, UploadIcon, SearchIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CategoryWithDepth = {
  catId: number
  catParent: number
  catUri: string
  catName: string
  catDescription: string
  catDisplay: string
  catOrder: number
  depth: number
}

type Attachment = {
  attachId: number
  articleId: number
  attachFile: string
  attachTitle: string
  attachType: string
  attachSize: string
}

type AuthorSearchResult = {
  userId: number
  username: string
  email: string
}

type ArticleData = {
  articleId: number
  articleTitle: string
  articleUri: string
  articleShortDesc: string
  articleDescription: string
  articleDisplay: 'y' | 'n'
  articleKeywords: string
  articleOrder: number
  articleAuthor: number
  categories: Array<{ catId: number; catName: string; catUri: string }>
  attachments: Attachment[]
  author: AuthorSearchResult | null
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const articleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  uri: z
    .string()
    .regex(/^[a-zA-Z0-9_-]*$/, 'URI may only contain letters, numbers, hyphens, and underscores'),
  shortDesc: z.string(),
  description: z.string(),
  display: z.enum(['y', 'n']),
  keywords: z.string(),
  order: z
    .string()
    .refine(
      (v) => v === '' || !isNaN(Number(v)),
      'Order must be a numeric value',
    ),
  categories: z.array(z.number()),
})

type ArticleFormValues = z.infer<typeof articleSchema>

// ---------------------------------------------------------------------------
// RichTextEditor — Tiptap wrapper compatible with react-hook-form
// ---------------------------------------------------------------------------

type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  minHeight?: string
  placeholder?: string
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

function RichTextEditor({
  value,
  onChange,
  minHeight = '120px',
  placeholder = '',
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'underline text-primary' },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: [
          'w-full rounded-b-md border-x border-b border-input bg-transparent px-3 py-2 text-sm outline-none',
          'focus:outline-none',
          ariaInvalid ? 'border-destructive' : '',
        ]
          .filter(Boolean)
          .join(' '),
        // Use inline style for dynamic min-height so Tailwind doesn't need to generate min-h-[...] at build time
        style: `min-height: ${minHeight}`,
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
        ...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {}),
        ...(ariaInvalid !== undefined ? { 'aria-invalid': String(ariaInvalid) } : {}),
        role: 'textbox',
        'aria-multiline': 'true',
        placeholder,
      },
    },
  })

  // Sync value when form is reset (e.g. after article data loads)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [value, editor])

  return (
    <div
      className={[
        'rounded-md border border-input',
        ariaInvalid ? 'border-destructive' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 border-b border-input bg-muted/40 px-2 py-1 rounded-t-md">
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBold().run()}
          isActive={editor?.isActive('bold') ?? false}
          title="Bold"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          isActive={editor?.isActive('italic') ?? false}
          title="Italic"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleCode().run()}
          isActive={editor?.isActive('code') ?? false}
          title="Inline Code"
        >
          <code>{'<>'}</code>
        </ToolbarButton>
        <Separator orientation="vertical" className="h-6 mx-0.5" />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          isActive={editor?.isActive('bulletList') ?? false}
          title="Bullet List"
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          isActive={editor?.isActive('orderedList') ?? false}
          title="Ordered List"
        >
          1. List
        </ToolbarButton>
        <Separator orientation="vertical" className="h-6 mx-0.5" />
        <ToolbarButton
          onClick={() => {
            const prev = editor?.getAttributes('link').href ?? ''
            const url = window.prompt('Enter URL:', prev)
            if (url === null) return
            if (url === '') {
              editor?.chain().focus().unsetLink().run()
            } else {
              editor?.chain().focus().setLink({ href: url }).run()
            }
          }}
          isActive={editor?.isActive('link') ?? false}
          title="Link"
        >
          Link
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          isActive={editor?.isActive('codeBlock') ?? false}
          title="Code Block"
        >
          {'{ }'}
        </ToolbarButton>
        <Separator orientation="vertical" className="h-6 mx-0.5" />
        <ToolbarButton
          onClick={() => editor?.chain().focus().undo().run()}
          isActive={false}
          title="Undo"
        >
          ↩
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().redo().run()}
          isActive={false}
          title="Redo"
        >
          ↪
        </ToolbarButton>
      </div>
      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
}: {
  onClick: () => void
  isActive: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        'rounded px-2 py-0.5 text-xs font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// CategoryTree — renders categories as indented checkboxes
// ---------------------------------------------------------------------------

type CategoryTreeProps = {
  categories: CategoryWithDepth[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
}

function CategoryTree({ categories, selectedIds, onChange }: CategoryTreeProps) {
  const handleToggle = (catId: number, checked: boolean) => {
    if (checked) {
      onChange([...selectedIds, catId])
    } else {
      onChange(selectedIds.filter((id) => id !== catId))
    }
  }

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">No categories available.</p>
  }

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border border-input p-3">
      {categories.map((cat) => (
        <div
          key={cat.catId}
          className="flex items-center gap-2"
          style={{ paddingLeft: `${cat.depth * 1.25}rem` }}
        >
          <Checkbox
            id={`cat-${cat.catId}`}
            checked={selectedIds.includes(cat.catId)}
            onCheckedChange={(checked) => handleToggle(cat.catId, !!checked)}
          />
          <label
            htmlFor={`cat-${cat.catId}`}
            className="text-sm cursor-pointer select-none"
          >
            {cat.depth > 0 && <span className="text-muted-foreground mr-1">{'»'.repeat(cat.depth)}</span>}
            {cat.catName}
          </label>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AuthorSearch — AJAX user search with dropdown
// ---------------------------------------------------------------------------

type AuthorSearchProps = {
  authorId: number
  authorName: string
  onSelect: (userId: number, username: string) => void
}

function AuthorSearch({ authorId, authorName, onSelect }: AuthorSearchProps) {
  const [query, setQuery] = useState(authorName)
  const [results, setResults] = useState<AuthorSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setResults([])
      setShowDropdown(false)
      return
    }
    setIsSearching(true)
    try {
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const json: { data: AuthorSearchResult[] } = await res.json()
        setResults(json.data)
        setShowDropdown(json.data.length > 0)
      }
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      doSearch(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
            }}
            placeholder="Search by username or email…"
            aria-label="Search for article author"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
          />
          {isSearching && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              <SearchIcon className="size-3.5 animate-pulse" />
            </span>
          )}
        </div>
        {authorId > 0 && (
          <span className="text-sm text-muted-foreground">
            ID: {authorId}
          </span>
        )}
      </div>
      {showDropdown && (
        <div
          role="listbox"
          aria-label="Author search results"
          className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover shadow-md"
        >
          {results.map((user) => (
            <button
              key={user.userId}
              type="button"
              role="option"
              aria-selected={user.userId === authorId}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
              onClick={() => {
                onSelect(user.userId, user.username)
                setQuery(user.username)
                setShowDropdown(false)
              }}
            >
              <span className="font-medium">{user.username}</span>
              <span className="text-muted-foreground">{user.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AttachmentsSection — table of existing attachments + upload form
// ---------------------------------------------------------------------------

type AttachmentsSectionProps = {
  articleId: number
  attachments: Attachment[]
  onAttachmentDeleted: (attachId: number) => void
  onAttachmentUploaded: (attachment: Attachment) => void
}

function AttachmentsSection({
  articleId,
  attachments,
  onAttachmentDeleted,
  onAttachmentUploaded,
}: AttachmentsSectionProps) {
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDelete = async (attachId: number) => {
    try {
      const res = await fetch(`/api/admin/articles/${articleId}/attachments/${attachId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        toast.error(json.error ?? 'Failed to delete attachment')
        return
      }
      onAttachmentDeleted(attachId)
      toast.success('Attachment deleted')
    } catch {
      toast.error('Failed to delete attachment')
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.set('title', uploadTitle || uploadFile.name)
      formData.set('file', uploadFile)

      const res = await fetch(`/api/admin/articles/${articleId}/attachments`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const json = await res.json() as { data?: Attachment; error?: string }
      if (!res.ok) {
        const errMsg = json.error ?? 'Upload failed'
        setUploadError(errMsg)
        toast.error(errMsg)
        return
      }

      if (json.data) {
        onAttachmentUploaded(json.data)
        toast.success('Attachment uploaded successfully')
        setUploadTitle('')
        setUploadFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    } catch {
      const errMsg = 'Upload failed. Please try again.'
      setUploadError(errMsg)
      toast.error(errMsg)
    } finally {
      setIsUploading(false)
    }
  }

  function formatSize(sizeStr: string): string {
    const size = parseInt(sizeStr, 10)
    if (isNaN(size)) return sizeStr
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      {/* Existing attachments */}
      {attachments.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {attachments.map((att) => (
                <TableRow key={att.attachId}>
                  <TableCell className="font-medium">{att.attachTitle}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{att.attachFile}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{att.attachType}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatSize(att.attachSize)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete attachment ${att.attachTitle}`}
                      onClick={() => handleDelete(att.attachId)}
                    >
                      <Trash2Icon className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      )}

      {/* Upload section — uses a div (not form) to avoid nesting inside the outer article form */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Upload New Attachment</h4>
        {uploadError && (
          <p role="alert" className="text-sm text-destructive">
            {uploadError}
          </p>
        )}
        <div className="flex gap-3 flex-wrap">
          <Input
            type="text"
            placeholder="Attachment title (optional)"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            className="max-w-xs"
            aria-label="Attachment title"
          />
          <div className="flex items-center gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="max-w-xs"
              aria-label="Choose file to upload"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={!uploadFile || isUploading}
            onClick={handleUpload}
          >
            <UploadIcon className="size-4 mr-2" />
            {isUploading ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AdminArticleFormPage — main component
// ---------------------------------------------------------------------------

export function AdminArticleFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEdit = !!id
  const articleId = id ? parseInt(id, 10) : null

  // State
  const [isLoading, setIsLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState<CategoryWithDepth[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])

  // Author state (edit only)
  const [authorId, setAuthorId] = useState(0)
  const [authorName, setAuthorName] = useState('')

  // Pending attachment (for new article — upload after creation)
  const [pendingUploadTitle, setPendingUploadTitle] = useState('')
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null)
  const pendingFileRef = useRef<HTMLInputElement>(null)

  // Form setup
  const form = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      title: '',
      uri: '',
      shortDesc: '',
      description: '',
      display: 'n',
      keywords: '',
      order: '0',
      categories: [],
    },
  })

  // -------------------------------------------------------------------------
  // Fetch categories
  // -------------------------------------------------------------------------
  useEffect(() => {
    fetch('/api/admin/categories', { credentials: 'include' })
      .then((r) => r.json())
      .then((json: { data: CategoryWithDepth[] }) => setCategories(json.data))
      .catch(() => {/* silently ignore — form still usable without categories */})
  }, [])

  // -------------------------------------------------------------------------
  // Fetch article data (edit mode)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isEdit || !articleId) return

    setIsLoading(true)
    fetch(`/api/admin/articles/${articleId}`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) {
          const json = await r.json() as { error?: string }
          throw new Error(json.error ?? 'Failed to load article')
        }
        return r.json() as Promise<{ data: ArticleData }>
      })
      .then(({ data }) => {
        form.reset({
          title: data.articleTitle,
          uri: data.articleUri,
          shortDesc: data.articleShortDesc,
          description: data.articleDescription,
          display: data.articleDisplay,
          keywords: data.articleKeywords,
          order: String(data.articleOrder),
          categories: data.categories.map((c) => c.catId),
        })
        setAttachments(data.attachments ?? [])
        if (data.author) {
          setAuthorId(data.author.userId)
          setAuthorName(data.author.username)
        } else {
          setAuthorId(data.articleAuthor)
          setAuthorName('')
        }
      })
      .catch((err: Error) => {
        setLoadError(err.message)
      })
      .finally(() => setIsLoading(false))
  }, [isEdit, articleId, form])

  // -------------------------------------------------------------------------
  // Submit handler
  // -------------------------------------------------------------------------
  const onSubmit = async (values: ArticleFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = {
        title: values.title,
        uri: values.uri || undefined,
        shortDesc: values.shortDesc ?? '',
        description: values.description ?? '',
        display: values.display,
        keywords: values.keywords ?? '',
        order: values.order ? parseInt(values.order, 10) : 0,
        categories: values.categories,
        author: authorId > 0 ? authorId : undefined,
      }

      const url = isEdit ? `/api/admin/articles/${articleId}` : '/api/admin/articles'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json() as { data?: { articleId: number }; error?: string }

      if (!res.ok) {
        toast.error(json.error ?? 'Failed to save article')
        return
      }

      const savedId = isEdit ? articleId! : (json.data as { articleId: number }).articleId

      // Upload pending attachment for new article
      if (!isEdit && pendingUploadFile) {
        const formData = new FormData()
        formData.set('title', pendingUploadTitle || pendingUploadFile.name)
        formData.set('file', pendingUploadFile)
        const uploadRes = await fetch(`/api/admin/articles/${savedId}/attachments`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })
        if (!uploadRes.ok) {
          const uploadJson = await uploadRes.json() as { error?: string }
          // Article was created successfully, but the file upload failed — show error
          toast.error(uploadJson.error ?? 'File upload failed')
          navigate(`/admin/articles/${savedId}/edit`)
          return
        }
      }

      toast.success(isEdit ? 'Article updated successfully' : 'Article created successfully')
      navigate(`/admin/articles/${savedId}/edit`)
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground" aria-live="polite">
        Loading article…
      </div>
    )
  }

  if (loadError) {
    return (
      <div role="alert" className="p-8 text-center text-destructive">
        {loadError}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {isEdit ? 'Edit Article' : 'Add Article'}
        </h1>
        <Button variant="ghost" asChild>
          <Link to="/admin/articles">← Back to Articles</Link>
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
          {/* ---------------------------------------------------------------- */}
          {/* Title */}
          {/* ---------------------------------------------------------------- */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Title <span aria-hidden="true" className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Article title"
                    aria-required="true"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ---------------------------------------------------------------- */}
          {/* URI Slug */}
          {/* ---------------------------------------------------------------- */}
          <FormField
            control={form.control}
            name="uri"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URI Slug</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="article-uri-slug (leave blank to auto-generate)"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ---------------------------------------------------------------- */}
          {/* Short Description — WYSIWYG */}
          {/* ---------------------------------------------------------------- */}
          <FormField
            control={form.control}
            name="shortDesc"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Short Description</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    minHeight="80px"
                    placeholder="Brief summary of the article…"
                    aria-label="Short description editor"
                    aria-invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ---------------------------------------------------------------- */}
          {/* Full Description — WYSIWYG (taller) */}
          {/* ---------------------------------------------------------------- */}
          <FormField
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Full Description</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    minHeight="240px"
                    placeholder="Full article content…"
                    aria-label="Full description editor"
                    aria-invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ---------------------------------------------------------------- */}
          {/* Row: Display + Order */}
          {/* ---------------------------------------------------------------- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Display */}
            <FormField
              control={form.control}
              name="display"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full" aria-label="Display status">
                        <SelectValue placeholder="Select display status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="y">Yes</SelectItem>
                      <SelectItem value="n">No</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Weight / Order */}
            <FormField
              control={form.control}
              name="order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weight / Order</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      placeholder="0"
                      aria-label="Weight or order"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Meta Keywords */}
          {/* ---------------------------------------------------------------- */}
          <FormField
            control={form.control}
            name="keywords"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meta Keywords</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="keyword1, keyword2, keyword3"
                    aria-label="Meta keywords"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ---------------------------------------------------------------- */}
          {/* Categories */}
          {/* ---------------------------------------------------------------- */}
          <FormField
            control={form.control}
            name="categories"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categories</FormLabel>
                <FormControl>
                  <CategoryTree
                    categories={categories}
                    selectedIds={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ---------------------------------------------------------------- */}
          {/* Author search (edit only) */}
          {/* ---------------------------------------------------------------- */}
          {isEdit && (
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Author
              </label>
              <AuthorSearch
                authorId={authorId}
                authorName={authorName}
                onSelect={(uid, uname) => {
                  setAuthorId(uid)
                  setAuthorName(uname)
                }}
              />
            </div>
          )}

          <Separator />

          {/* ---------------------------------------------------------------- */}
          {/* Attachments (edit mode: full section; add mode: single upload) */}
          {/* ---------------------------------------------------------------- */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold">Attachments</h3>
            {isEdit && articleId ? (
              <AttachmentsSection
                articleId={articleId}
                attachments={attachments}
                onAttachmentDeleted={(attachId) =>
                  setAttachments((prev) => prev.filter((a) => a.attachId !== attachId))
                }
                onAttachmentUploaded={(att) => setAttachments((prev) => [...prev, att])}
              />
            ) : (
              /* On new article: allow attaching a file that gets uploaded after creation */
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  You can upload an attachment after saving the article. Or provide one now:
                </p>
                <div className="flex gap-3 flex-wrap">
                  <Input
                    type="text"
                    placeholder="Attachment title (optional)"
                    value={pendingUploadTitle}
                    onChange={(e) => setPendingUploadTitle(e.target.value)}
                    className="max-w-xs"
                    aria-label="Attachment title"
                  />
                  <Input
                    ref={pendingFileRef}
                    type="file"
                    onChange={(e) => setPendingUploadFile(e.target.files?.[0] ?? null)}
                    className="max-w-xs"
                    aria-label="Choose file to upload"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ---------------------------------------------------------------- */}
          {/* Submit button */}
          {/* ---------------------------------------------------------------- */}
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={isSubmitting}
              aria-label={isEdit ? 'Update article' : 'Save article'}
            >
              {isSubmitting ? 'Saving…' : isEdit ? 'Update Article' : 'Save Article'}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link to="/admin/articles">Cancel</Link>
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
