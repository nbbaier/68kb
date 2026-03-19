import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { toast } from 'sonner'

/**
 * AdminCategoryDuplicatePage
 *
 * Handles the /admin/categories/:id/duplicate route.
 * - If :id is non-numeric or invalid, redirects to /admin/categories with an error flash.
 * - If :id is a valid number, redirects to /admin/categories/new?duplicateId=:id to pre-fill the add form.
 */
export function AdminCategoryDuplicatePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    const numId = id ? parseInt(id, 10) : NaN

    if (!id || isNaN(numId) || numId <= 0) {
      // Non-numeric or invalid ID — redirect to grid with error flash
      toast.error('Invalid category ID')
      navigate('/admin/categories', { replace: true })
      return
    }

    // Valid numeric ID — redirect to the add form with duplicateId query param
    navigate(`/admin/categories/new?duplicateId=${numId}`, { replace: true })
  }, [id, navigate])

  // Render nothing while redirecting
  return null
}
