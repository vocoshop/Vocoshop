'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminIndex() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      router.push('/admin/candidatures');
    } else {
      router.push('/admin/login');
    }
  }, []);

  return null;
}
