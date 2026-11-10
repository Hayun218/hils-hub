'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useHub } from '@/lib/store';
import { DEMO_TODAY, SCHOOL_YEAR, gradeLabel } from '@/lib/rules';
import { currentItems } from '@/lib/roadmaps';
import { filled, newReport, periodLabel, periodOf, quarterPeriods } from '@/lib/reports';
import { useOpenReport } from '@/components/useOpenReport';
import type { ProgressReport, Student } from '@/lib/types';
import { PageHead, Badge } from '@/components/ui';
import ReportSettings from '@/components/ReportSettings';

const TONE = { 작성중: 'gold', 검토완료: 'green', 발송: 'deep' } as const;
const CLASSES = ['전체', '어니스트반', '드림반', '콜링반'];
type Tab = '학생별' | '과목별' | '기도제목';

export default function ReportsPage() {
  const hub = useHub();
  const [period, setPeriod] = useState(periodOf(DEMO_TODAY));
  const [tab, setTab] = useState<Tab>('학생별');
  const [cls, setCls] = useState('전체');
  const open = useOpenReport(period);
  const active = hub.students.filter(s => s.status === '재학');
  const shown = active.filter(s => cls === '전체' || s.classGroup === cls).sort((a, b) => b.birthYear - a.birthYear || a.name.localeCompare(b.name));
  const reportOf = (s: Student) => hub.reports.find(r => r.studentId === s.id && r.period === period);
  const months = quarterPeriods(SCHOOL_YEAR);
  const done = active.filter(s => reportOf(s) && reportOf(s)!.status !== '작성중').length;

  const createAll = () => {
    active.forEach(s => { if (!reportOf(s)) hub.saveReport(newReport(s, period, hub.newId('rp'), hub.reportTemplate, hub.roadmaps)); });
  };

  return (
    <div className="page">
      <PageHead
        title="학습 진도 보고서"
        desc={<>학부모에게 쿼터마다 보내는 보고서 (제29조, 별지 3). 로드맵·평가 결과·상점·벌점은 학생 기록에서 이어지고, 교사는 과목 평가만 씁니다.</>}
        right={<>
          <select className="input" value={period} onChange={e => setPeriod(e.target.value)} aria-label="보고 쿼터">
            {months.map(m => <option key={m} value={m}>{periodLabel(m)}</option>)}
          </select>
          <Link className="btn" href={`/reports/print?period=${period}`}>검토 완료분 인쇄</Link>
          <button className="btn primary" onClick={createAll}>이번 쿼터 보고서 모두 만들기</button>
        </>}
      />
      <ReportSettings />

      <div className="card spread" style={{ marginBottom: 14 }}>
        <div>
          <div className="tiny muted">{periodLabel(period)} 진행</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--deep)' }}>{done} / {active.length}명 검토 완료</div>
        </div>
        <div className="bar" style={{ flex: 1, maxWidth: 420 }}><span style={{ width: `${active.length ? (done / active.length) * 100 : 0}%` }} /></div>
        <div className="row">
          {(['작성중', '검토완료', '발송'] as const).map(st => <Badge key={st} tone={TONE[st]}>{st} {hub.reports.filter(r => r.period === period && r.status === st).length}</Badge>)}
          <Badge tone="line">미작성 {active.filter(s => !reportOf(s)).length}</Badge>
        </div>
      </div>

      <div className="tabs">
        {(['학생별', '과목별', '기도제목'] as Tab[]).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === '과목별' ? '과목별 일괄 작성' : t}</button>)}
      </div>

      {tab !== '기도제목' && (
        <div className="seg" style={{ marginBottom: 12 }}>
          {CLASSES.map(c => <button key={c} className={cls === c ? 'on' : ''} onClick={() => setCls(c)}>{c}</button>)}
        </div>
      )}

      {tab === '학생별' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="t">
            <thead><tr><th>이름</th><th>반</th><th>학년</th><th>지금 배우는 것</th><th>과목 평가</th><th>상태</th><th /></tr></thead>
            <tbody>
              {shown.map(s => {
                const r = reportOf(s);
                const p = hub.progress[s.id];
                const now = hub.roadmaps.flatMap(rm => currentItems(rm, p));
                return (
                  <tr key={s.id}>
                    <td><button className="linklike" onClick={() => open(s)}>{s.name}</button></td>
                    <td className="small">{s.classGroup || s.schoolLevel}</td>
                    <td className="small">{gradeLabel(s.birthYear)}</td>
                    <td className="small">{now.length ? `${now.slice(0, 2).join(', ')}${now.length > 2 ? ` 외 ${now.length - 2}` : ''}` : <span className="muted">로드맵 미입력</span>}</td>
                    <td className="small">{r ? `${filled(r)} / ${r.comments.length}` : '-'}</td>
                    <td>{r ? <Badge tone={TONE[r.status]}>{r.status}</Badge> : <Badge tone="line">미작성</Badge>}</td>
                    <td style={{ textAlign: 'right' }}><button className={`btn sm${r ? '' : ' primary'}`} onClick={() => open(s)}>{r ? '열기' : '작성'}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === '과목별' && <BySubject period={period} students={shown} />}

      {tab === '기도제목' && (
        <div className="card">
          <h3>{periodLabel(period)} 기도제목</h3>
          <p className="small muted" style={{ marginTop: -6 }}>이 쿼터 모든 보고서 아래에 함께 들어갑니다.</p>
          <textarea className="input" style={{ width: '100%', minHeight: 160 }} value={hub.prayers[period] || ''} onChange={e => hub.setPrayer(period, e.target.value)} aria-label="기도제목" />
        </div>
      )}
    </div>
  );
}

/** 과목 담당 교사가 한 과목의 평가를 학생 전체에 대해 한 화면에서 쓴다 */
function BySubject({ period, students }: { period: string; students: Student[] }) {
  const hub = useHub();
  const subjects = useMemo(() => {
    const set = new Set<string>(['국어', '영어', '수학', '통합사회 / 통합과학', '한자', '미술', '비교과']);
    hub.reports.filter(r => r.period === period).forEach(r => r.comments.forEach(c => set.add(c.subject)));
    return [...set];
  }, [hub.reports, period]);
  const [subject, setSubject] = useState(subjects[0]);
  const [bulk, setBulk] = useState('');

  const write = (s: Student, text: string) => {
    let r: ProgressReport | undefined = hub.reports.find(x => x.studentId === s.id && x.period === period);
    if (!r) r = newReport(s, period, hub.newId('rp'), hub.reportTemplate, hub.roadmaps);
    if (r.status === '발송') return;
    const has = r.comments.some(c => c.subject === subject);
    const comments = has ? r.comments.map(c => (c.subject === subject ? { ...c, text } : c)) : [...r.comments, { subject, text }];
    hub.saveReport({ ...r, comments });
  };
  const textOf = (s: Student) => hub.reports.find(x => x.studentId === s.id && x.period === period)?.comments.find(c => c.subject === subject)?.text || '';
  const fillEmpty = () => { if (bulk.trim()) students.forEach(s => { if (!textOf(s).trim()) write(s, bulk); }); };

  return (
    <div className="stack">
      <div className="card row">
        <label className="field" style={{ minWidth: 200 }}>과목
          <select value={subject} onChange={e => setSubject(e.target.value)}>{subjects.map(x => <option key={x}>{x}</option>)}</select>
        </label>
        <label className="field" style={{ flex: 1, minWidth: 260 }}>같은 문구 (반 전체 수업 소개 등)
          <input value={bulk} onChange={e => setBulk(e.target.value)} placeholder="예: 개념 수업을 자료 화면과 함께 진행해 집중도가 높아졌습니다." />
        </label>
        <button className="btn" style={{ alignSelf: 'flex-end' }} onClick={fillEmpty} disabled={!bulk.trim()}>빈 칸에 모두 넣기</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="t">
          <thead><tr><th style={{ width: 120 }}>이름</th><th>{subject} 평가</th></tr></thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id}>
                <td><b>{s.name}</b><div className="tiny muted">{gradeLabel(s.birthYear)}</div></td>
                <td><textarea className="input" style={{ width: '100%', minHeight: 64 }} value={textOf(s)} onChange={e => write(s, e.target.value)} aria-label={`${s.name} ${subject} 평가`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
