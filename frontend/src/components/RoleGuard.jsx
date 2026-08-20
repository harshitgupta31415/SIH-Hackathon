'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '../store/authStore';

export default function RoleGuard({ roles, children }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const allowed = roles.includes(user?.role);

  useEffect(() => {
    if (user && !allowed) router.replace('/');
  }, [allowed, router, user]);

  if (!allowed) return null;
  return children;
}
