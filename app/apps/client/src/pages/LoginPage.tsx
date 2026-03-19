import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/admin'

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
      rememberMe: false,
    },
  })

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login(values.username, values.password)
      toast.success('Signed in successfully')
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      toast.error(message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">68kb Knowledge Base</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your username"
                        autoComplete="username"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <input
                        id="remember-me"
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={field.value ?? false}
                        onChange={field.onChange}
                      />
                      <label
                        htmlFor="remember-me"
                        className="text-sm text-muted-foreground cursor-pointer select-none"
                      >
                        Remember me
                      </label>
                    </div>
                  )}
                />
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </Form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="text-primary underline-offset-4 hover:underline"
            >
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
