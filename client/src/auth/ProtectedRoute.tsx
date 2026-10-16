import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { Role } from '../../../shared/contracts';
import { SessionGate } from '../components/SessionGate';

export function ProtectedRoute({ role }: { role?: Role }) {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'loading' || status === 'unavailable') return <SessionGate />;
  if (!user) return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
export function GuestRoute() {
  const { user, status } = useAuth();
  if (status === 'loading' || status === 'unavailable') return <SessionGate />;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
