import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

type PermissionValue = 'y' | 'n'

type UserGroupFormState = {
  groupName: string
  groupDescription: string
  canViewSite: PermissionValue
  canAccessAdmin: PermissionValue
  canManageArticles: PermissionValue
  canDeleteArticles: PermissionValue
  canManageUsers: PermissionValue
  canManageCategories: PermissionValue
  canDeleteCategories: PermissionValue
  canManageSettings: PermissionValue
  canManageUtilities: PermissionValue
  canManageThemes: PermissionValue
  canManageModules: PermissionValue
}

const DEFAULT_STATE: UserGroupFormState = {
  groupName: '',
  groupDescription: '',
  canViewSite: 'y',
  canAccessAdmin: 'n',
  canManageArticles: 'n',
  canDeleteArticles: 'n',
  canManageUsers: 'n',
  canManageCategories: 'n',
  canDeleteCategories: 'n',
  canManageSettings: 'n',
  canManageUtilities: 'n',
  canManageThemes: 'n',
  canManageModules: 'n',
}

const CORE_PERMISSION_FIELDS: Array<{ key: keyof UserGroupFormState; label: string }> = [
  { key: 'canViewSite', label: 'Can View Site' },
  { key: 'canAccessAdmin', label: 'Can Access Admin' },
]

const ADMIN_PERMISSION_FIELDS: Array<{ key: keyof UserGroupFormState; label: string }> = [
  { key: 'canManageArticles', label: 'Manage Articles' },
  { key: 'canDeleteArticles', label: 'Delete Articles' },
  { key: 'canManageUsers', label: 'Manage Users' },
  { key: 'canManageCategories', label: 'Manage Categories' },
  { key: 'canDeleteCategories', label: 'Delete Categories' },
  { key: 'canManageSettings', label: 'Manage Settings' },
  { key: 'canManageUtilities', label: 'Manage Utilities' },
  { key: 'canManageThemes', label: 'Manage Themes' },
  { key: 'canManageModules', label: 'Manage Modules' },
]

// ---------------------------------------------------------------------------
// Permission radio row component
// ---------------------------------------------------------------------------

function PermissionRadio({
  fieldKey,
  label,
  value,
  disabled,
  onChange,
}: {
  fieldKey: string
  label: string
  value: PermissionValue
  disabled?: boolean
  onChange: (val: PermissionValue) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm">{label}</span>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as PermissionValue)}
        disabled={disabled}
        className="flex flex-row gap-4"
        aria-label={label}
      >
        <div className="flex items-center gap-1.5">
          <RadioGroupItem value="y" id={`${fieldKey}-yes`} />
          <Label htmlFor={`${fieldKey}-yes`} className="cursor-pointer font-normal">
            Yes
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <RadioGroupItem value="n" id={`${fieldKey}-no`} />
          <Label htmlFor={`${fieldKey}-no`} className="cursor-pointer font-normal">
            No
          </Label>
        </div>
      </RadioGroup>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main form page
// ---------------------------------------------------------------------------

export function AdminUserGroupFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [isLoading, setIsLoading] = useState(isEdit)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<UserGroupFormState>(DEFAULT_STATE)
  const [groupId, setGroupId] = useState<number | null>(null)

  const isSystemAdminsGroup = useMemo(() => groupId === 1, [groupId])
  const showAdminOptions = form.canAccessAdmin === 'y' || isSystemAdminsGroup

  useEffect(() => {
    if (!isEdit || !id) return
    if (!/^\d+$/.test(id)) {
      toast.error('Invalid group ID')
      navigate('/admin/usergroups', { replace: true })
      return
    }

    fetch(`/api/admin/usergroups/${id}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => null) as { error?: string } | null
          throw new Error(json?.error ?? 'Failed to load user group')
        }
        return res.json() as Promise<{ data: UserGroupFormState & { groupId: number } }>
      })
      .then((json) => {
        setForm({
          groupName: json.data.groupName,
          groupDescription: json.data.groupDescription,
          canViewSite: json.data.canViewSite,
          canAccessAdmin: json.data.canAccessAdmin,
          canManageArticles: json.data.canManageArticles,
          canDeleteArticles: json.data.canDeleteArticles,
          canManageUsers: json.data.canManageUsers,
          canManageCategories: json.data.canManageCategories,
          canDeleteCategories: json.data.canDeleteCategories,
          canManageSettings: json.data.canManageSettings,
          canManageUtilities: json.data.canManageUtilities,
          canManageThemes: json.data.canManageThemes,
          canManageModules: json.data.canManageModules,
        })
        setGroupId(json.data.groupId)
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to load user group')
        navigate('/admin/usergroups', { replace: true })
      })
      .finally(() => setIsLoading(false))
  }, [id, isEdit, navigate])

  function setPermission(key: keyof UserGroupFormState, val: PermissionValue) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    try {
      if (!form.groupName.trim()) {
        throw new Error('Group name is required')
      }
      if (!form.groupDescription.trim()) {
        throw new Error('Group description is required')
      }

      const url = isEdit ? `/api/admin/usergroups/${id}` : '/api/admin/usergroups'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const json = await res.json().catch(() => null) as { error?: string; data?: { groupId: number } } | null
      if (!res.ok) {
        throw new Error(json?.error ?? 'Failed to save user group')
      }

      toast.success(isEdit ? 'User group updated' : 'User group created')
      if (isEdit) {
        navigate('/admin/usergroups', { replace: true })
      } else {
        const newId = json?.data?.groupId
        if (newId) {
          navigate(`/admin/usergroups/${newId}/edit`, { replace: true })
        } else {
          navigate('/admin/usergroups', { replace: true })
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save user group')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isEdit ? 'Edit User Group' : 'Add User Group'}</h1>
        <Button variant="outline" asChild>
          <Link to="/admin/usergroups">Back to User Groups</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading user group…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border bg-card p-4" noValidate>
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="groupName">
              Group Name <em className="text-destructive">*</em>
            </Label>
            <Input
              id="groupName"
              value={form.groupName}
              onChange={(e) => setForm((prev) => ({ ...prev, groupName: e.target.value }))}
              required
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="groupDescription">
              Description <em className="text-destructive">*</em>
            </Label>
            <Input
              id="groupDescription"
              value={form.groupDescription}
              onChange={(e) => setForm((prev) => ({ ...prev, groupDescription: e.target.value }))}
              required
            />
          </div>

          {/* Permissions — only shown for non-system-admin groups */}
          {!isSystemAdminsGroup && (
            <>
              {/* Core permissions */}
              <div className="space-y-1 rounded-md border p-3">
                <h2 className="mb-2 text-sm font-semibold">Core Permissions</h2>
                {CORE_PERMISSION_FIELDS.map((field) => (
                  <PermissionRadio
                    key={field.key}
                    fieldKey={field.key}
                    label={field.label}
                    value={form[field.key] as PermissionValue}
                    onChange={(val) => setPermission(field.key, val)}
                  />
                ))}
              </div>

              {/* Admin-specific permissions — visible only when can_access_admin = y */}
              {showAdminOptions && (
                <div id="admin_options" className="space-y-1 rounded-md border p-3">
                  <h2 className="mb-2 text-sm font-semibold">Admin Permissions</h2>
                  {ADMIN_PERMISSION_FIELDS.map((field) => (
                    <PermissionRadio
                      key={field.key}
                      fieldKey={field.key}
                      label={field.label}
                      value={form[field.key] as PermissionValue}
                      onChange={(val) => setPermission(field.key, val)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Note for group 1 */}
          {isSystemAdminsGroup && (
            <p className="text-sm text-muted-foreground">
              Site Admins (group 1) have all permissions and cannot be modified. Only the name and
              description can be updated.
            </p>
          )}

          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save User Group'}
          </Button>
        </form>
      )}
    </div>
  )
}
