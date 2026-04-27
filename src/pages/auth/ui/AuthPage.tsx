import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Database, Lock, Mail, User } from 'lucide-react';
import { toast } from 'sonner';
import { login, register } from '@/shared/api/auth';
import { useAuthStore } from '@/shared/auth/store';

export function AuthPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const title = useMemo(() => (mode === 'login' ? 'Sign in' : 'Create account'), [mode]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const authMutation = useMutation({
    mutationFn: async () => {
      if (mode === 'login') {
        return login({ email, password });
      }

      return register({ email, password, name: name.trim() || undefined });
    },
    onSuccess: (data) => {
      setSession({ token: data.accessToken, user: data.user });
      toast.success(mode === 'login' ? 'Signed in' : 'Account created');
      navigate('/', { replace: true });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Authentication failed');
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    authMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Database className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500">SQL Schema Designer</p>
              <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            {mode === 'login'
              ? 'Enter your credentials to access your projects.'
              : 'Create a new account to store projects in PostgreSQL.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {mode === 'register' && (
            <label className="block">
              <span className="text-xs text-gray-500 mb-1 block">Name</span>
              <div className="relative">
                <User className="size-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Product manager"
                  className="w-full h-10 rounded-lg border border-gray-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </label>
          )}

          <label className="block">
            <span className="text-xs text-gray-500 mb-1 block">Email</span>
            <div className="relative">
              <Mail className="size-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                required
                className="w-full h-10 rounded-lg border border-gray-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs text-gray-500 mb-1 block">Password</span>
            <div className="relative">
              <Lock className="size-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                required
                minLength={8}
                className="w-full h-10 rounded-lg border border-gray-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={authMutation.isPending}
            className="w-full h-10 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {authMutation.isPending ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="w-full h-10 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
          >
            {mode === 'login' ? 'Need account? Register' : 'Have account? Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
