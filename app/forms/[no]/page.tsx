import fs from 'node:fs';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { FORMS } from '@/lib/forms';
import FormWorkspace from './FormWorkspace';

export const dynamic = 'force-dynamic';

export default async function FormPage({ params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const f = FORMS.find(x => String(x.no) === no);
  if (!f) notFound();
  const md = fs.readFileSync(path.join(process.cwd(), 'content', 'forms', `byeolji-${f.no}.md`), 'utf8');
  return <Suspense><FormWorkspace no={f.no} md={md} /></Suspense>;
}
