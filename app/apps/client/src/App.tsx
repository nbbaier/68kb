import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { AuthGuard } from '@/components/AuthGuard'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AdminDashboardPage } from '@/pages/AdminDashboardPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public auth pages — redirect to /admin if already logged in */}
          <Route
            path="/login"
            element={
              <AuthGuard redirectIfAuthenticated="/admin">
                <LoginPage />
              </AuthGuard>
            }
          />
          <Route
            path="/register"
            element={
              <AuthGuard redirectIfAuthenticated="/admin">
                <RegisterPage />
              </AuthGuard>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <AuthGuard redirectIfAuthenticated="/admin">
                <ForgotPasswordPage />
              </AuthGuard>
            }
          />

          {/* Protected admin routes */}
          <Route
            path="/admin"
            element={
              <AuthGuard>
                <AdminDashboardPage />
              </AuthGuard>
            }
          />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/admin" replace />} />

          {/* 404 catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
