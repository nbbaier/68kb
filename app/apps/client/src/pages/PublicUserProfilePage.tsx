import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

type PublicUserProfile = {
  userId: number
  username: string
  userGroup: number
  groupName: string
  userJoinDate: number
  userLastLogin: number
}

function formatDate(timestamp: number): string {
  if (!timestamp) return 'Never'
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function PublicUserProfilePage() {
  const { username } = useParams<{ username: string }>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<PublicUserProfile | null>(null)

  useEffect(() => {
    if (!username) {
      setError('User not found')
      setIsLoading(false)
      return
    }

    fetch(`/api/users/profile/${encodeURIComponent(username)}`, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 404) {
          throw new Error('User profile not found')
        }
        if (!res.ok) {
          const json = await res.json().catch(() => null) as { error?: string } | null
          throw new Error(json?.error ?? 'Failed to load profile')
        }
        return res.json() as Promise<{ data: PublicUserProfile }>
      })
      .then((json) => {
        setProfile(json.data)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [username])

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading profile…</p>
  }

  if (error || !profile) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">User Profile</h1>
        <p className="text-sm text-destructive">{error ?? 'User profile not found'}</p>
        <Link to="/" className="text-sm text-primary hover:underline">
          Back to home
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">User Profile</h1>
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <p>
          <span className="font-medium">Username:</span> {profile.username}
        </p>
        <p>
          <span className="font-medium">Group:</span> {profile.groupName}
        </p>
        <p>
          <span className="font-medium">Joined:</span> {formatDate(profile.userJoinDate)}
        </p>
        <p>
          <span className="font-medium">Last Login:</span> {formatDate(profile.userLastLogin)}
        </p>
      </div>
    </div>
  )
}
