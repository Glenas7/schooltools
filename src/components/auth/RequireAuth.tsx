import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface RequireAuthProps {
  children: JSX.Element;
  adminOnly?: boolean;
}

const RequireAuth = ({ children, adminOnly = false }: RequireAuthProps) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  console.log('[RequireAuth] Check auth. loading:', loading, 'isAuthenticated:', isAuthenticated, 'location:', location.pathname);

  // Wait for auth loading to complete before making any redirect decisions
  if (loading) {
    console.log('[RequireAuth] Auth still loading, showing loading screen');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('[RequireAuth] Not authenticated after loading completed, redirecting to login');
    // Redirect to login page if not authenticated
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log('[RequireAuth] Authenticated, allowing access');

  // For adminOnly routes, we'll let the individual pages handle their own school admin checks
  // since this component may be used outside of SchoolProvider context
  // Pages that need admin access should implement their own school admin checks

  return children;
};

export default RequireAuth;
