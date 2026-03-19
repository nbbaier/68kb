import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const glossarySchema = z.object({
  gTerm: z.string().min(1, 'Term is required'),
  gDefinition: z.string().default(''),
})

type GlossaryFormValues = z.infer<typeof glossarySchema>

// ---------------------------------------------------------------------------
// AdminGlossaryFormPage — /admin/kb/glossary/add and /admin/kb/glossary/edit/:id
// ---------------------------------------------------------------------------

export function AdminGlossaryFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const form = useForm<GlossaryFormValues>({
    resolver: zodResolver(glossarySchema),
    defaultValues: {
      gTerm: '',
      gDefinition: '',
    },
  })

  const { reset, formState } = form

  // -------------------------------------------------------------------------
  // Load existing term for edit
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isEdit || !id) return

    // Strictly validate: ID must be all digits (reject e.g. "1abc", "abc", "1.5")
    if (!/^\d+$/.test(id)) {
      toast.error('Invalid glossary term ID')
      navigate('/admin/kb/glossary', { replace: true })
      return
    }

    const numId = parseInt(id, 10)

    fetch(`/api/admin/glossary/${numId}`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 404 || res.status === 400) {
          toast.error('Glossary term not found')
          navigate('/admin/kb/glossary', { replace: true })
          return null
        }
        if (!res.ok) throw new Error('Failed to load glossary term')
        return res.json() as Promise<{ data: { gId: number; gTerm: string; gDefinition: string } }>
      })
      .then((json) => {
        if (json) {
          reset({
            gTerm: json.data.gTerm,
            gDefinition: json.data.gDefinition,
          })
        }
      })
      .catch(() => {
        toast.error('Failed to load glossary term')
        navigate('/admin/kb/glossary', { replace: true })
      })
  }, [id, isEdit, reset, navigate])

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const onSubmit = async (values: GlossaryFormValues) => {
    const url = isEdit ? `/api/admin/glossary/${id!}` : '/api/admin/glossary'
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          gTerm: values.gTerm.trim(),
          gDefinition: values.gDefinition.trim(),
        }),
      })

      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? 'Failed to save glossary term')
      }

      toast.success(isEdit ? 'Glossary term updated' : 'Glossary term created')
      navigate('/admin/kb/glossary')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save glossary term')
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-xl">
      {/* Breadcrumb / header */}
      <div className="mb-6">
        <Link
          to="/admin/kb/glossary"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Glossary
        </Link>
        <h1 className="text-2xl font-bold mt-2">
          {isEdit ? 'Edit Glossary Term' : 'Add Glossary Term'}
        </h1>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="space-y-6"
        >
          {/* Term field */}
          <FormField
            control={form.control}
            name="gTerm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Term <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter the glossary term…"
                    {...field}
                    autoFocus
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Definition field */}
          <FormField
            control={form.control}
            name="gDefinition"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Definition</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter the definition…"
                    rows={5}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={formState.isSubmitting}
            >
              {formState.isSubmitting
                ? 'Saving…'
                : isEdit
                  ? 'Update Term'
                  : 'Add Term'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/kb/glossary')}
              disabled={formState.isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
