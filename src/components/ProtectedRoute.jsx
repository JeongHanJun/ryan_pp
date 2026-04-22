import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function ProtectedRoute({ children }) {
  const { user, booted } = useAuthStore();

  // Still hydrating on boot: render nothing briefly to avoid a flash redirect.
  if (!booted) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
