'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';

/** 학칙 편집 권한이 있는 교직원에게만 보인다 */
export default function EditButton() {
  const auth = useAuth();
  if (!can(auth.me, 'hakchik')) return null;
  return <Link className="btn primary" href="/hakchik/edit">편집</Link>;
}
