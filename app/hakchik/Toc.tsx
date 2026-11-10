'use client';
import { useState } from 'react';
import type { TocItem } from '@/lib/markdown';

export default function Toc({ items }: { items: TocItem[] }) {
  const [q, setQ] = useState('');
  const shown = q ? items.filter(i => i.label.includes(q)) : items.filter(i => i.level === 2 || /^(제\d+조|\[별표)/.test(i.label));
  return (
    <nav className="toc">
      <input className="input" placeholder="조문 찾기 (예: 전자기기)" value={q} onChange={e => setQ(e.target.value)} />
      {shown.map(i => (
        <a key={i.id} href={`#${i.id}`} className={`l${i.level}`}>{i.label.replace(/^\[별표 (\d+)\]/, '별표 $1 ·')}</a>
      ))}
    </nav>
  );
}
