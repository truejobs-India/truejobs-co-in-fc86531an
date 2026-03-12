import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types/database';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, roles, hasRole, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Priority redirect: employers/admins should not see the job_seeker dashboard
  if (allowedRoles?.includes('job_seeker') && !allowedRoles?.includes('employer')) {
    if (hasRole('admin')) {
      return <Navigate to="/admin" replace />;
    }
    if (hasRole('employer')) {
      // For profile-like routes, send to company profile; otherwise employer dashboard
      const employerRedirect = location.pathname === '/profile' ? '/employer/company' : '/employer/dashboard';
      return <Navigate to={employerRedirect} replace />;
    }
  }

  // Redirect employers away from candidate-only pages (like /profile)
  if (!allowedRoles && hasRole('employer')) {
    const candidateOnlyPaths = ['/profile'];
    if (candidateOnlyPaths.includes(location.pathname)) {
      return <Navigate to="/employer/company" replace />;
    }
  }

  // Check if user has ANY of the allowed roles
  if (allowedRoles && !allowedRoles.some(role => hasRole(role))) {
    // Redirect to appropriate dashboard based on highest priority role
    if (hasRole('admin')) {
      return <Navigate to="/admin" replace />;
    } else if (hasRole('employer')) {
      return <Navigate to="/employer/dashboard" replace />;
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
