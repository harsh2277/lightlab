'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { AuthLayout, AuthWelcome } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [welcomeName, setWelcomeName] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setErrorMsg(error.message);
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Sign in with password
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error('No user data returned.');
      }

      // 2. Fetch user profile to verify role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, name')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error('Unable to verify user role.');
      }

      // 3. Show a brief welcome screen, then redirect depending on role
      const dashboardPath =
        profile.role === 'admin'
          ? '/admin/dashboard'
          : profile.role === 'architect'
          ? '/architect/dashboard'
          : profile.role === 'designer'
          ? '/designer/dashboard'
          : null;

      if (!dashboardPath) {
        await supabase.auth.signOut();
        throw new Error('Access Denied: You are not authorized to access this portal.');
      }

      setWelcomeName(profile.name || data.user.email?.split('@')[0] || '');
      setTimeout(() => router.push(dashboardPath), 2200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong.');
      setLoading(false);
    }
  };

  if (welcomeName !== null) {
    return (
      <AuthWelcome
        title={welcomeName ? `Welcome back, ${welcomeName.split(' ')[0]}!` : 'Welcome back!'}
        subtitle="You're signed in. Taking you to your dashboard..."
      />
    );
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your LightMap account to continue"
      footer={
        <p className="text-center text-sm text-neutral-500">
          New to LightMap?{' '}
          <Link href="/signup" className="font-medium text-amber-700 hover:text-amber-800">
            Create an account
          </Link>
        </p>
      }
    >
      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-start space-x-3 text-red-800 text-sm">
          <i className="bx bx-error-circle text-lg text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-3 py-3 border border-neutral-200 rounded-md text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {googleLoading ? (
          <svg className="animate-spin h-5 w-5 text-neutral-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 01-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.88-3c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.92H1.3v3.09A11.998 11.998 0 0012 24z" />
            <path fill="#FBBC05" d="M5.31 14.32A7.2 7.2 0 014.9 12c0-.8.14-1.58.4-2.32V6.59H1.3A11.998 11.998 0 000 12c0 1.94.47 3.77 1.3 5.41l4.01-3.09z" />
            <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.6 4.6 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.3 6.59l4.01 3.09C6.25 6.85 8.89 4.75 12 4.75z" />
          </svg>
        )}
        <span>{googleLoading ? 'Redirecting...' : 'Continue with Google'}</span>
      </button>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-neutral-200" />
        <span className="text-xs text-neutral-400">or sign in with email</span>
        <div className="flex-1 h-px bg-neutral-200" />
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-neutral-600 mb-2">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-amber-500 transition-colors"
            placeholder="user@example.com"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="current-password" className="block text-xs font-medium text-neutral-600">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs font-medium text-amber-700 hover:text-amber-800">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="current-password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-4 pr-12 py-3 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-amber-500 transition-colors"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <i className={`bx ${showPassword ? 'bx-hide' : 'bx-show'} text-lg`} />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 mt-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
        >
          {loading ? (
            <span className="flex items-center justify-center space-x-2">
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Signing In...</span>
            </span>
          ) : (
            'Sign In'
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
