'use client';
// 대시보드 주기별 할 일: 매일(출석) · 쿼터마다(정기 면담 제35조 제3항, 성적, 학습 진도 보고서 제29조)
// · 학기마다 6월·12월(학교생활기록부, 졸업·수료 지표 점검 제16조 제5항). 담임 계정이면 내 담임 학생만 센다. 초등 포함.
import Link from 'next/link';
import { useHub } from '@/lib/store';
import { quarterOf } from '@/lib/rules';
import { quarterRange } from '@/lib/weeks';
import { periodOf } from '@/lib/reports';
import { reviewedThisSemester, semesterEnd, semesterOf } from '@/lib/graduation';
import type { Student } from '@/lib/types';

const dday = (today: string, end: string) => {
  const n = Math.round((new Date(end).getTime() - new Date(today).getTime()) / 86400000);
  return n === 0 ? 'D-day' : n > 0 ? `D-${n}` : `D+${-n}`;
};

interface Item { label: string; left: number; total: number; href: string; note?: string }

export default function CadenceTodos({ students, today, scope }: { students: Student[]; today: string; scope: string }) {
  const hub = useHub();
  const q = quarterOf(today);
  const year = today.slice(0, 4);
  const qr = quarterRange(hub.calendar, q);
  const qEnd = qr?.end || `${year}-${String(q * 3).padStart(2, '0')}-${q === 1 || q === 4 ? 31 : 30}`;
  const inQ = (d: string) => d.startsWith(year) && quarterOf(d) === q;
  const sem = semesterOf(today);
  const sEnd = semesterEnd(today);
  const n = students.length;
  const count = (f: (s: Student) => boolean) => students.filter(f).length;
  const period = periodOf(today);

  const daily: Item[] = [
    { label: '출석 체크', total: n, left: count(s => !hub.attendance[today]?.[s.id]), href: '/records/attendance' },
  ];
  const quarterly: Item[] = [
    { label: '정기 면담 (담임)', total: n, href: '/records/interviews',
      left: count(s => !hub.records.some(r => r.studentId === s.id && r.type === 'interview' && r.data.kind === '정기' && inQ(r.date))) },
    { label: '성적 입력', total: n, href: '/records/grades', note: '이번 쿼터 성적이 하나도 없는 학생',
      left: count(s => !hub.grades.some(g => inQ(g.date) && g.scores[s.id] && Object.values(g.scores[s.id]).some(v => String(v).trim()))) },
    { label: '학습 진도 보고서', total: n, href: '/reports', note: '검토·발송 전',
      left: count(s => { const r = hub.reports.find(x => x.studentId === s.id && x.period === period); return !r || r.status === '작성중'; }) },
  ];
  const semesterly: Item[] = [
    { label: '학교생활기록부', total: n, href: '/records/schoolrecord', note: '이번 학기에 고친 기록이 없는 학생',
      left: count(s => !hub.schoolRecords.some(d => d.studentId === s.id && d.year === Number(year) && semesterOf(d.updatedAt.slice(0, 10)) === sem)) },
    { label: '졸업·수료 지표 점검', total: n, href: '/students/graduation', note: '제16조 제5항',
      left: count(s => !reviewedThisSemester(hub, s.id, today)) },
  ];

  return (
    <div className="card cadence">
      <div className="spread"><h2 style={{ margin: 0 }}>주기별 할 일</h2><span className="tiny muted">{scope} {n}명 기준</span></div>
      <div className="cadence-grid">
        <Col title="매일" due="오늘" items={daily} />
        <Col title={`${q}쿼터`} due={`${qEnd.slice(5).replace('-', '/')}까지 · ${dday(today, qEnd)}`} items={quarterly} />
        <Col title={`${sem.endsWith('1') ? '1' : '2'}학기 (${sem.endsWith('1') ? '6월' : '12월'} 말)`} due={`${sEnd.slice(5).replace('-', '/')}까지 · ${dday(today, sEnd)}`} items={semesterly} />
      </div>
    </div>
  );
}

function Col({ title, due, items }: { title: string; due: string; items: Item[] }) {
  return (
    <div className="cadence-col">
      <div className="cadence-head"><b>{title}</b><span className="tiny muted">{due}</span></div>
      {items.map(i => (
        <Link key={i.label} href={i.href} className="cadence-item" title={i.note}>
          <span>{i.label}</span>
          {i.left ? <span className="chip todo-chip gold">{i.left}명 남음</span> : <span className="tiny" style={{ color: 'var(--green)' }}>✓ 완료</span>}
          <span className="cadence-bar"><span style={{ width: `${i.total ? Math.round(((i.total - i.left) / i.total) * 100) : 0}%` }} /></span>
        </Link>
      ))}
    </div>
  );
}
