import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';
import { ScreenSkeleton } from '../ui/Skeleton';

export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <ScreenSkeleton />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
