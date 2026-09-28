import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 sm:p-10">

          <div className="mb-6 text-left">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{title}</h1>
            <p className="text-sm text-neutral-500 mt-1.5">{subtitle}</p>
          </div>

          {children}
        </div>

        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  );
}
