import { BrowserRouter, Routes, Route } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { AuthGuard } from '@/components/AuthGuard'
import { AdminLayout } from '@/components/AdminLayout'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { LogoutPage } from '@/pages/LogoutPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AdminDashboardPage } from '@/pages/AdminDashboardPage'
import { AdminArticlesPage } from '@/pages/AdminArticlesPage'
import { AdminArticleFormPage } from '@/pages/AdminArticleFormPage'
import { AdminCategoriesPage } from '@/pages/AdminCategoriesPage'
import { AdminCategoryFormPage } from '@/pages/AdminCategoryFormPage'
import { AdminCategoryDeletePage } from '@/pages/AdminCategoryDeletePage'
import { HomePage } from '@/pages/HomePage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ---------------------------------------------------------------- */}
          {/* Public site */}
          {/* ---------------------------------------------------------------- */}
          <Route path="/" element={<HomePage />} />

          {/* ---------------------------------------------------------------- */}
          {/* Auth pages — redirect to /admin if already logged in */}
          {/* ---------------------------------------------------------------- */}
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

          {/* ---------------------------------------------------------------- */}
          {/* Logout route — accessible with or without session, always redirects to /login */}
          {/* ---------------------------------------------------------------- */}
          <Route path="/logout" element={<LogoutPage />} />

          {/* ---------------------------------------------------------------- */}
          {/* Protected admin routes — all wrapped in AdminLayout */}
          {/* ---------------------------------------------------------------- */}
          <Route
            path="/admin"
            element={
              <AuthGuard requireAdmin>
                <AdminLayout />
              </AuthGuard>
            }
          >
            {/* Default admin page: /admin → Dashboard */}
            <Route index element={<AdminDashboardPage />} />

            {/* Articles routes */}
            <Route path="articles" element={<AdminArticlesPage />} />
            <Route path="articles/new" element={<AdminArticleFormPage />} />
            <Route path="articles/:id/edit" element={<AdminArticleFormPage />} />

            {/* Categories routes */}
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="categories/new" element={<AdminCategoryFormPage />} />
            <Route path="categories/:id/edit" element={<AdminCategoryFormPage />} />
            <Route path="categories/:id/delete" element={<AdminCategoryDeletePage />} />
            <Route
              path="users"
              element={<div className="p-4 text-muted-foreground">Users — coming soon</div>}
            />
            <Route
              path="modules"
              element={<div className="p-4 text-muted-foreground">Modules — coming soon</div>}
            />
            <Route
              path="settings"
              element={<div className="p-4 text-muted-foreground">Settings — coming soon</div>}
            />
            <Route
              path="account"
              element={<div className="p-4 text-muted-foreground">Account settings — coming soon</div>}
            />
          </Route>

          {/* ---------------------------------------------------------------- */}
          {/* 404 catch-all */}
          {/* ---------------------------------------------------------------- */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
