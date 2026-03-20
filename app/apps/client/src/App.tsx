import { BrowserRouter, Routes, Route } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { AuthGuard } from '@/components/AuthGuard'
import { AdminLayout } from '@/components/AdminLayout'
import { PublicLayout } from '@/components/PublicLayout'
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
import { AdminCategoryDuplicatePage } from '@/pages/AdminCategoryDuplicatePage'
import { HomePage } from '@/pages/HomePage'
import { ArticleDetailPage } from '@/pages/ArticleDetailPage'
import { CategoriesIndexPage } from '@/pages/CategoriesIndexPage'
import { CategoryDetailPage } from '@/pages/CategoryDetailPage'
import { GlossaryPage } from '@/pages/GlossaryPage'
import { AdminGlossaryPage } from '@/pages/AdminGlossaryPage'
import { AdminGlossaryFormPage } from '@/pages/AdminGlossaryFormPage'
import { AdminUsersPage } from '@/pages/AdminUsersPage'
import { AdminUserFormPage } from '@/pages/AdminUserFormPage'
import { SearchPage } from '@/pages/SearchPage'
import { SearchResultsPage } from '@/pages/SearchResultsPage'
import { SearchNoResultsPage } from '@/pages/SearchNoResultsPage'
import { PublicUserProfilePage } from '@/pages/PublicUserProfilePage'
import { AccountSettingsPage } from '@/pages/AccountSettingsPage'
import { AdminUserGroupsPage } from '@/pages/AdminUserGroupsPage'
import { AdminUserGroupFormPage } from '@/pages/AdminUserGroupFormPage'
import { AdminFailedLoginsPage } from '@/pages/AdminFailedLoginsPage'
import { AdminSettingsPage } from '@/pages/AdminSettingsPage'
import { AdminThemesPage } from '@/pages/AdminThemesPage'
import { AdminModulesPage } from '@/pages/AdminModulesPage'
import { AdminUtilitiesPage } from '@/pages/AdminUtilitiesPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ---------------------------------------------------------------- */}
          {/* Public site — wrapped in PublicLayout */}
          {/* ---------------------------------------------------------------- */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/article/:slug" element={<ArticleDetailPage />} />
            <Route path="/categories" element={<CategoriesIndexPage />} />
            <Route path="/categories/*" element={<CategoryDetailPage />} />
            <Route path="/glossary" element={<GlossaryPage />} />
            <Route path="/glossary/term/:letter" element={<GlossaryPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/search/results/:hash" element={<SearchResultsPage />} />
            <Route path="/search/no-results" element={<SearchNoResultsPage />} />
            <Route path="/users/profile/:username" element={<PublicUserProfilePage />} />
          </Route>

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
          {/* Authenticated non-admin/shared account route */}
          {/* ---------------------------------------------------------------- */}
          <Route
            path="/account"
            element={
              <AuthGuard>
                <AccountSettingsPage />
              </AuthGuard>
            }
          />

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
            <Route path="categories/:id/duplicate" element={<AdminCategoryDuplicatePage />} />
            {/* Glossary routes */}
            <Route path="kb/glossary" element={<AdminGlossaryPage />} />
            <Route path="kb/glossary/add" element={<AdminGlossaryFormPage />} />
            <Route path="kb/glossary/edit/:id" element={<AdminGlossaryFormPage />} />

            {/* Users routes */}
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/new" element={<AdminUserFormPage />} />
            <Route path="users/:id/edit" element={<AdminUserFormPage />} />
            <Route path="users/failed-logins" element={<AdminFailedLoginsPage />} />
            <Route path="usergroups" element={<AdminUserGroupsPage />} />
            <Route path="usergroups/new" element={<AdminUserGroupFormPage />} />
            <Route path="usergroups/:id/edit" element={<AdminUserGroupFormPage />} />
            <Route
              path="modules"
              element={<AdminModulesPage />}
            />
            <Route
              path="themes"
              element={<AdminThemesPage />}
            />
            <Route
              path="settings"
              element={<AdminSettingsPage />}
            />
            <Route
              path="utilities"
              element={<AdminUtilitiesPage />}
            />
            <Route
              path="account"
              element={<AccountSettingsPage />}
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
