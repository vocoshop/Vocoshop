'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminIndex() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      router.push('/super-admin/dashboard');
    } else {
      router.push('/admin/login');
    }
  }, []);

  return null;
}
