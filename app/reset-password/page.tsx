'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { AuthLayout, AuthWelcome } from '@/components/ui';

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function establishSession() {
      // Supabase's password-reset email links can carry the session in one of two
      // shapes depending on the project's auth flow setting:
      //  - PKCE: a `?code=...` query param that must be exchanged for a session.
      //  - Implicit: a `#access_token=...&refresh_token=...&type=recovery` hash.
      // Without handling both, getSession() below never finds a session and a
      // perfectly valid link is incorrectly reported as expired.
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('Reset link code exchange failed:', error.message);
        }
      } else if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) {
            console.error('Reset link session setup failed:', error.message);
          }
        }
      }

      const { data } = await supabase.auth.getSession();
      setReady(true);
      if (!data.session) setInvalidLink(true);
    }

    establishSession();
  }, [supabase]);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => router.push('/login'), 2200);
    return () => clearTimeout(timer);
  }, [done, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      await supabase.auth.signOut();
      setDone(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong.');
      setLoading(false);
    }
  };

  if (done) {
    return <AuthWelcome title="Password updated!" subtitle="Please sign in again with your new password." />;
  }

  if (!ready) return null;

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a new password for your Lightmaps account"
    >
      {invalidLink ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-start space-x-3 text-red-800 text-sm">
          <i className="bx bx-error-circle text-lg text-red-600 flex-shrink-0" />
          <span>This reset link is invalid or has expired. Please request a new one from the forgot password page.</span>
        </div>
      ) : (
        <>
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-start space-x-3 text-red-800 text-sm">
              <i className="bx bx-error-circle text-lg text-red-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-neutral-600 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-12 py-3 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-amber-500 transition-colors"
                  placeholder="At least 8 characters"
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

            <div>
              <label htmlFor="confirm-password" className="block text-xs font-medium text-neutral-600 mb-2">
                Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirm-password"
                name="confirm-password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-amber-500 transition-colors"
                placeholder="Re-enter your new password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              {loading ? (
                <span className="flex items-center justify-center space-x-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Updating...</span>
                </span>
              ) : (
                'Update Password'
              )}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
