import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type AdminUserGroup = {
  groupId: number
  groupName: string
  groupDescription: string
  memberCount: number
}

export function AdminUserGroupsPage() {
  const [groups, setGroups] = useState<AdminUserGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null)

  const fetchGroups = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/usergroups', { credentials: 'include' })
      if (!res.ok) {
        throw new Error('Failed to load user groups')
      }
      const json = await res.json() as { data: AdminUserGroup[] }
      setGroups(json.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load user groups')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  async function handleDelete(group: AdminUserGroup) {
    setDeletingGroupId(group.groupId)
    try {
      const res = await fetch(`/api/admin/usergroups/${group.groupId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok) {
        throw new Error(json?.error ?? 'Failed to delete group')
      }
      toast.success('User group deleted')
      await fetchGroups()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete group')
    } finally {
      setDeletingGroupId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Groups</h1>
        <Button asChild>
          <Link to="/admin/usergroups/new">Add User Group</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading user groups…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No user groups found.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Members</TableHead>
                <TableHead className="w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.groupId}>
                  <TableCell>{group.groupId}</TableCell>
                  <TableCell>
                    <Link
                      to={`/admin/usergroups/${group.groupId}/edit`}
                      className="font-medium text-primary hover:underline"
                    >
                      {group.groupName}
                    </Link>
                  </TableCell>
                  <TableCell>{group.groupDescription}</TableCell>
                  <TableCell>{group.memberCount}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/admin/usergroups/${group.groupId}/edit`}>Edit</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={group.groupId <= 5 || deletingGroupId === group.groupId}
                      onClick={() => handleDelete(group)}
                    >
                      {deletingGroupId === group.groupId ? 'Deleting…' : 'Delete'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
