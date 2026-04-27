import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from './store';

export function useRequireAuth() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return { isAuthenticated };
}
