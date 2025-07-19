import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@schooltools/shared-auth'
import Login from './pages/Login.tsx'
import Dashboard from './pages/Dashboard.tsx'
import SchoolSetup from './pages/SchoolSetup.tsx'
import SchoolManagement from './pages/SchoolManagement.tsx'
import AuthRedirectHandler from './components/auth/AuthRedirectHandler'

function App() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/auth-redirect" element={<AuthRedirectHandler />} />
      <Route path="/school-setup" element={isAuthenticated ? <SchoolSetup /> : <Navigate to="/login" replace />} />
      <Route path="/school/:schoolSlug/manage" element={isAuthenticated ? <SchoolManagement /> : <Navigate to="/login" replace />} />
      <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App 