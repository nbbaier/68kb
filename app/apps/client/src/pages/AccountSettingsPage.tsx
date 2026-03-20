import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AccountData = {
  userId: number
  userUsername: string
  userEmail: string
  userGroup: number
  userJoinDate: number
  userLastLogin: number
}

function formatDate(timestamp: number): string {
  if (!timestamp) return 'Never'
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function AccountSettingsPage() {
  const navigate = useNavigate()
  const { refetch } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [account, setAccount] = useState<AccountData | null>(null)
  const [userUsername, setUserUsername] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userPassword, setUserPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    fetch('/api/auth/account', { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) {
          navigate('/login', { replace: true })
          return null
        }
        if (!res.ok) {
          throw new Error('Failed to load account settings')
        }
        return res.json() as Promise<{ data: AccountData }>
      })
      .then((json) => {
        if (!json) return
        setAccount(json.data)
        setUserUsername(json.data.userUsername)
        setUserEmail(json.data.userEmail)
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to load account settings')
      })
      .finally(() => setIsLoading(false))
  }, [navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)

    try {
      const res = await fetch('/api/auth/account', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userUsername,
          userEmail,
          userPassword,
          confirmPassword,
        }),
      })

      const json = await res.json() as { data?: AccountData; error?: string }
      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to update account')
      }

      setAccount(json.data ?? null)
      setUserPassword('')
      setConfirmPassword('')
      await refetch()
      toast.success('Account settings updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update account')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account Settings</h1>
        <p className="text-sm text-muted-foreground">
          Update your username, email address, and password.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading account settings…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-4" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="userUsername">Username</Label>
            <Input
              id="userUsername"
              value={userUsername}
              onChange={(e) => setUserUsername(e.target.value)}
              placeholder="Username"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="userEmail">Email</Label>
            <Input
              id="userEmail"
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="Email address"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="userPassword">New Password</Label>
            <Input
              id="userPassword"
              type="password"
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
            />
          </div>

          {account && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p>Member since: {formatDate(account.userJoinDate)}</p>
              <p>Last login: {formatDate(account.userLastLogin)}</p>
            </div>
          )}

          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save Changes'}
          </Button>
        </form>
      )}
    </div>
  )
}
