import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Separator } from '@/components/ui/separator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserGroup = {
  groupId: number
  groupName: string
}

type UserData = {
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

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const addUserSchema = z
  .object({
    userUsername: z
      .string()
      .min(1, 'Username is required')
      .regex(/^[a-zA-Z0-9]+$/, 'Username must be alphanumeric (letters and digits only)'),
    userEmail: z.string().min(1, 'Email address is required').email('Please enter a valid email address'),
    userGroup: z.string().min(1, 'User group is required'),
    userPassword: z.string().min(1, 'Password is required'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.userPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

const editUserSchema = z
  .object({
    userUsername: z
      .string()
      .min(1, 'Username is required')
      .regex(/^[a-zA-Z0-9]+$/, 'Username must be alphanumeric (letters and digits only)'),
    userEmail: z.string().min(1, 'Email address is required').email('Please enter a valid email address'),
    userGroup: z.string().min(1, 'User group is required'),
    userPassword: z.string().optional().default(''),
    confirmPassword: z.string().optional().default(''),
  })
  .refine(
    (data) => {
      if (data.userPassword) {
        return data.userPassword === data.confirmPassword
      }
      return true
    },
    {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    },
  )

type AddUserFormValues = z.infer<typeof addUserSchema>
type EditUserFormValues = z.infer<typeof editUserSchema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gravatarUrl(hash: string, size = 80): string {
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`
}

function formatDate(timestamp: number): string {
  if (!timestamp) return 'Never'
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// AdminUserFormPage — /admin/users/new and /admin/users/:id/edit
// ---------------------------------------------------------------------------

export function AdminUserFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  // State for loaded user and groups
  const [userData, setUserData] = useState<UserData | null>(null)
  const [groups, setGroups] = useState<UserGroup[]>([])
  const [isLoadingData, setIsLoadingData] = useState(isEdit)
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false)
  const [currentApiKey, setCurrentApiKey] = useState('')

  // Build form with appropriate schema
  const addForm = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      userUsername: '',
      userEmail: '',
      userGroup: '',
      userPassword: '',
      confirmPassword: '',
    },
  })

  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      userUsername: '',
      userEmail: '',
      userGroup: '',
      userPassword: '',
      confirmPassword: '',
    },
  })

  const form = isEdit ? editForm : addForm

  // -------------------------------------------------------------------------
  // Fetch groups
  // -------------------------------------------------------------------------

  useEffect(() => {
    fetch('/api/admin/usergroups', { credentials: 'include' })
      .then((res) => res.json())
      .then((json: { data: UserGroup[] }) => setGroups(json.data))
      .catch(() => toast.error('Failed to load user groups'))
  }, [])

  // -------------------------------------------------------------------------
  // Load existing user for edit
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isEdit || !id) return

    if (!/^\d+$/.test(id)) {
      toast.error('Invalid user ID')
      navigate('/admin/users', { replace: true })
      return
    }

    const numId = parseInt(id, 10)

    setIsLoadingData(true)
    fetch(`/api/admin/users/${numId}`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 404 || res.status === 400) {
          toast.error('User not found')
          navigate('/admin/users', { replace: true })
          return null
        }
        if (!res.ok) throw new Error('Failed to load user')
        return res.json() as Promise<{ data: UserData }>
      })
      .then((json) => {
        if (json) {
          setUserData(json.data)
          setCurrentApiKey(json.data.userApiKey)
          editForm.reset({
            userUsername: json.data.userUsername,
            userEmail: json.data.userEmail,
            userGroup: String(json.data.userGroup),
            userPassword: '',
            confirmPassword: '',
          })
        }
      })
      .catch(() => {
        toast.error('Failed to load user')
        navigate('/admin/users', { replace: true })
      })
      .finally(() => setIsLoadingData(false))
  }, [id, isEdit, navigate, editForm])

  // -------------------------------------------------------------------------
  // Regenerate API key
  // -------------------------------------------------------------------------

  const handleRegenerateApiKey = async () => {
    if (!id) return
    setIsRegeneratingKey(true)
    try {
      const res = await fetch(`/api/admin/users/${id}/reset-api-key`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? 'Failed to regenerate API key')
      }
      const json = await res.json() as { data: { userApiKey: string } }
      setCurrentApiKey(json.data.userApiKey)
      toast.success('API key regenerated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate API key')
    } finally {
      setIsRegeneratingKey(false)
    }
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const onSubmit = async (values: AddUserFormValues | EditUserFormValues) => {
    const url = isEdit ? `/api/admin/users/${id!}` : '/api/admin/users'
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const body: Record<string, unknown> = {
        userUsername: values.userUsername,
        userEmail: values.userEmail,
        userGroup: Number(values.userGroup),
      }

      if (isEdit) {
        const ev = values as EditUserFormValues
        if (ev.userPassword) {
          body.userPassword = ev.userPassword
          body.confirmPassword = ev.confirmPassword
        } else {
          body.userPassword = ''
          body.confirmPassword = ''
        }
      } else {
        const av = values as AddUserFormValues
        body.userPassword = av.userPassword
        body.confirmPassword = av.confirmPassword
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? 'Failed to save user')
      }

      toast.success(isEdit ? 'User updated' : 'User created')
      navigate('/admin/users')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save user')
    }
  }

  // -------------------------------------------------------------------------
  // Render — loading state
  // -------------------------------------------------------------------------

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        Loading…
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const isBanned = userData?.userGroup === 4

  return (
    <div className="flex gap-6">
      {/* ------------------------------------------------------------------ */}
      {/* Main form */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 min-w-0">
        {/* Breadcrumb / header */}
        <div className="mb-6">
          <Link
            to="/admin/users"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Users
          </Link>
          <h1 className="text-2xl font-bold mt-2">
            {isEdit ? 'Edit User' : 'Add User'}
          </h1>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit as Parameters<typeof form.handleSubmit>[0])}
            noValidate
            className="space-y-6"
          >
            {/* Username */}
            <FormField
              control={form.control}
              name="userUsername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Username <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter username (letters and digits only)"
                      {...field}
                      autoFocus={!isEdit}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="userEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Email Address <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="user@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* User Group */}
            <FormField
              control={form.control}
              name="userGroup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    User Group <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger aria-label="User group">
                        <SelectValue placeholder="Select a group…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.groupId} value={String(g.groupId)}>
                          {g.groupName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Password */}
            <FormField
              control={form.control}
              name="userPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Password {!isEdit && <span className="text-destructive">*</span>}
                    {isEdit && (
                      <span className="text-muted-foreground text-xs ml-1">(leave blank to keep current)</span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={isEdit ? 'Leave blank to keep current password' : 'Enter password'}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Confirm Password */}
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Confirm Password {!isEdit && <span className="text-destructive">*</span>}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Confirm password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? 'Saving…'
                  : isEdit
                    ? 'Update User'
                    : 'Add User'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/users')}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sidebar (edit only) */}
      {/* ------------------------------------------------------------------ */}
      {isEdit && userData && (
        <aside className="w-64 shrink-0 space-y-4">
          {/* Gravatar + user info */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={gravatarUrl(userData.gravatarHash, 64)}
                alt={`Gravatar for ${userData.userUsername}`}
                width={64}
                height={64}
                className="rounded-full"
                aria-label={`Gravatar for ${userData.userUsername}`}
              />
              <div className="min-w-0">
                <p className="font-semibold truncate">{userData.userUsername}</p>
                <p className="text-sm text-muted-foreground truncate">{userData.userEmail}</p>
              </div>
            </div>

            <Separator />

            <dl className="text-sm space-y-1">
              <div>
                <dt className="text-muted-foreground">Joined</dt>
                <dd>{formatDate(userData.userJoinDate)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last Login</dt>
                <dd>{formatDate(userData.userLastLogin)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Group</dt>
                <dd>{userData.groupName ?? '—'}</dd>
              </div>
            </dl>
          </div>

          {/* API Key */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <h3 className="text-sm font-semibold">API Key</h3>
            <p className="text-xs font-mono break-all text-muted-foreground">
              {currentApiKey || '—'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleRegenerateApiKey}
              disabled={isRegeneratingKey}
              aria-label="Regenerate API key"
            >
              {isRegeneratingKey ? 'Regenerating…' : 'Regenerate API Key'}
            </Button>
          </div>

          {/* Banned user: delete content link */}
          {isBanned && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-destructive">Banned User</h3>
              <p className="text-xs text-muted-foreground">
                This user is banned. You can remove all content they created.
              </p>
              <Link
                to={`/admin/users/${userData.userId}/delete-content`}
                className="text-sm text-destructive hover:underline font-medium"
              >
                Delete All Content
              </Link>
            </div>
          )}
        </aside>
      )}
    </div>
  )
}
