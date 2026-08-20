'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import AppLayout from '../../src/components/Layout';
import { useAuthStore } from '../../src/store/authStore';

export default function ProtectedLayout({ children }) {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const initialized = useAuthStore((state) => state.initialized);
  const fetchMe = useAuthStore((state) => state.fetchMe);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (initialized && !token) router.replace('/login');
  }, [initialized, router, token]);

  if (!initialized || !token) {
    return <div className="min-h-screen grid place-items-center text-slate-600">Loading your secure session…</div>;
  }

  return <AppLayout>{children}</AppLayout>;
}
