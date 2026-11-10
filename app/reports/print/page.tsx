'use client';
import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useHub } from '@/lib/store';
import { periodLabel } from '@/lib/reports';
import ReportSheet from '@/components/ReportSheet';

function PrintAll() {
  const hub = useHub();
  const period = useSearchParams().get('period') || '';
  const order = hub.students.filter(s => s.status === '재학').sort((a, b) => b.birthYear - a.birthYear || a.name.localeCompare(b.name)).map(s => s.id);
  const list = hub.reports
    .filter(r => r.period === period && r.status !== '작성중')
    .sort((a, b) => order.indexOf(a.studentId) - order.indexOf(b.studentId));
  return (
    <div className="page">
      <div className="spread no-print" style={{ marginBottom: 16 }}>
        <div><Link href="/reports" className="small">← 목록</Link><h1 style={{ margin: '4px 0 0', fontSize: 20, color: 'var(--deep)' }}>{periodLabel(period)} 보고서 {list.length}장</h1></div>
        <button className="btn primary" onClick={() => window.print()} disabled={!list.length}>인쇄 · PDF</button>
      </div>
      {list.length === 0 && <p className="muted">검토 완료나 발송 상태인 보고서가 없습니다.</p>}
      {list.map(r => <div key={r.id} className="re-paper page-break"><ReportSheet report={r} /></div>)}
    </div>
  );
}

export default function PrintPage() {
  return <Suspense><PrintAll /></Suspense>;
}
