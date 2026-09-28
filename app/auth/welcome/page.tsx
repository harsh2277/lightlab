'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthWelcome } from '@/components/ui';

function dashboardForRole(role: string | null) {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'designer') return '/designer/dashboard';
  return '/architect/dashboard';
}

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const name = searchParams.get('name') || '';
  const role = searchParams.get('role');

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(dashboardForRole(role));
    }, 2200);
    return () => clearTimeout(timer);
  }, [router, role]);

  const firstName = name.split(' ')[0];

  return (
    <AuthWelcome
      title={firstName ? `Welcome, ${firstName}!` : 'Welcome to Lightmaps!'}
      subtitle="You're signed in. Taking you to your dashboard..."
    />
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <WelcomeContent />
    </Suspense>
  );
}
