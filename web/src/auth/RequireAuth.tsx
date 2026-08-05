import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';

export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6 text-ink-faint">Loading…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
