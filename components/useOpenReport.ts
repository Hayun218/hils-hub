'use client';
import { useRouter } from 'next/navigation';
import { useHub } from '@/lib/store';
import { newReport } from '@/lib/reports';
import type { Student } from '@/lib/types';

/** 학생의 그달 보고서를 연다. 없으면 새로 만든다. */
export function useOpenReport(period: string) {
  const hub = useHub();
  const router = useRouter();
  return (s: Student) => {
    const found = hub.reports.find(r => r.studentId === s.id && r.period === period);
    if (found) return router.push(`/reports/${found.id}`);
    const r = newReport(s, period, hub.newId('rp'), hub.reportTemplate, hub.roadmaps);
    hub.saveReport(r);
    router.push(`/reports/${r.id}`);
  };
}

