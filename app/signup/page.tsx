'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { AuthLayout, AuthWelcome } from '@/components/ui';

const ROLE = 'architect';

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleGoogleSignup = async () => {
    setErrorMsg('');
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?requested_role=${ROLE}`,
      },
    });
    if (error) {
      setErrorMsg(error.message);
      setGoogleLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (!agreed) {
      setErrorMsg('Please accept the Terms of Service to continue.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            requested_role: ROLE,
            mobile_number: mobileNumber || '',
          },
        },
      });

      if (error) {
        const isSignupDisabled =
          error.code === 'signup_disabled' ||
          /signups? not allowed/i.test(error.message || '');

        if (isSignupDisabled) {
          throw new Error(
            'New sign-ups are currently closed. Please contact your studio admin to get an account created for you.'
          );
        }
        throw new Error(error.message);
      }
      if (!data.user) throw new Error('Something went wrong creating your account.');

      setSubmitted(true);
      setTimeout(() => router.push('/architect/dashboard'), 2200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong.');
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthWelcome
        title={`Welcome to LightMap${name ? `, ${name.split(' ')[0]}` : ''}!`}
        subtitle="Your account is ready. Taking you to your dashboard..."
      />
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Get your studio started with LightMap"
      footer={
        <p className="text-center text-sm text-neutral-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-amber-700 hover:text-amber-800">
            Sign in
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
        onClick={handleGoogleSignup}
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
        <span className="text-xs text-neutral-400">or sign up with email</span>
        <div className="flex-1 h-px bg-neutral-200" />
      </div>

      <form onSubmit={handleSignup} className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-neutral-600 mb-2">
            Full Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-amber-500 transition-colors"
            placeholder="Jane Doe"
          />
        </div>

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
          <label htmlFor="mobile" className="block text-xs font-medium text-neutral-600 mb-2">
            Mobile Number <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <input
            type="tel"
            id="mobile"
            name="mobile"
            autoComplete="tel"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-amber-500 transition-colors"
            placeholder="+91 98765 43210"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-medium text-neutral-600 mb-2">
            Password
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

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-amber-500 rounded cursor-pointer"
          />
          <span className="text-xs text-neutral-500 leading-relaxed">
            I agree to the <span className="text-amber-700 font-medium">Terms of Service</span> and{' '}
            <span className="text-amber-700 font-medium">Privacy Policy</span>
          </span>
        </label>

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
              <span>Creating Account...</span>
            </span>
          ) : (
            'Create Account'
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
