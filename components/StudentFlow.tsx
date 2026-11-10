'use client';
// 학생 상세 맨 위: 입학 서류 카드, 학생 여정(누르면 전체 흐름), 재학이 아닐 때 기록 묶음.
import Link from 'next/link';
import { useState } from 'react';
import { useHub } from '@/lib/store';
import { DEMO_TODAY, journeyIndex, JOURNEY, quarterOf } from '@/lib/rules';
import { periodOf } from '@/lib/reports';
import { studentArchive, type ArchiveMode } from '@/lib/archive';
import { downloadBlob } from '@/lib/formDocx';
import type { FormRecord, Student } from '@/lib/types';
import { Badge, ArtLink } from './ui';

const latest = (fs: FormRecord[]) => [...fs].sort((a, b) => (a.status === '완료' ? -1 : 1) - (b.status === '완료' ? -1 : 1) || b.date.localeCompare(a.date))[0];

function DocCard({ s, no, title, desc }: { s: Student; no: number; title: string; desc: string }) {
  const hub = useHub();
  const f = latest(hub.forms.filter(x => x.studentId === s.id && x.formNo === no));
  return (
    <div className={`card doc-card${f?.status === '완료' ? ' done' : ''}`}>
      <div className="spread">
        <div>
          <div className="tiny muted">별지 {no}</div>
          <b style={{ fontSize: 15, color: 'var(--deep)' }}>{title}</b>
        </div>
        {f ? <Badge tone={f.status === '완료' ? 'green' : 'gold'}>{f.status === '완료' ? '제출 완료' : '작성 중'}</Badge> : <Badge tone="line">미제출</Badge>}
      </div>
      <p className="tiny muted" style={{ margin: '4px 0 8px' }}>{f ? `${f.date} · ${f.author}` : desc}</p>
      <div className="row">
        {f ? <Link className="btn sm" href={`/forms/${no}?open=${f.id}`}>열기</Link> : <Link className="btn sm primary" href={`/forms/${no}?new=1&student=${s.id}`}>작성</Link>}
      </div>
    </div>
  );
}

type Step = { label: string; done: boolean; href?: string; note?: string };

function useFlow(s: Student): { stage: string; art?: number; steps: Step[] }[] {
  const hub = useHub();
  const form = (no: number) => latest(hub.forms.filter(x => x.studentId === s.id && x.formNo === no));
  const done = (no: number) => form(no)?.status === '완료';
  const fhref = (no: number) => (form(no) ? `/forms/${no}?open=${form(no)!.id}` : `/forms/${no}?new=1&student=${s.id}`);
  const recs = hub.records.filter(r => r.studentId === s.id);
  const ji = journeyIndex(s);
  const period = periodOf(DEMO_TODAY);
  const rep = hub.reports.find(r => r.studentId === s.id && r.period === period);
  const q = quarterOf(DEMO_TODAY);
  return [
    { stage: '입학 문의 · 면담', art: 28, steps: [
      { label: '입학 문의', done: true },
      { label: '학생·학부모 면담 (별지 8)', done: recs.some(r => r.type === 'interview') || ji >= 2, href: '/records/interviews' },
    ] },
    { stage: '입학 원서 제출', art: 28, steps: [
      { label: '입학원서·학부모 질문지 (별지 9)', done: done(9), href: fhref(9) },
      { label: '자기소개서 (별지 10)', done: done(10), href: fhref(10) },
    ] },
    { stage: '체험 입학 3주', art: 28, steps: [
      { label: '주차별 진단 (별지 2)', done: recs.filter(r => r.type === 'diagnosis').length >= 3 || ji >= 2, note: `${recs.filter(r => r.type === 'diagnosis').length}/3주`, href: `/students/${s.id}` },
      { label: '최종 심사 (전 교사와 학교장)', done: done(2) || ji >= 2, href: fhref(2) },
    ] },
    { stage: '정식 입학', art: 28, steps: [
      { label: '학부모 서약서 및 동의서 (별지 11)', done: done(11), href: fhref(11) },
      { label: '학생 기록 수집·이용 동의', done: s.consent },
      { label: '전자기기 제출 (제31조 제2항)', done: s.devicesSubmitted },
      { label: '입학일·출발선 레벨', done: !!s.admittedAt, note: s.admittedAt },
    ] },
    { stage: '재학', art: 35, steps: [
      { label: '담임 배정', done: !!s.homeroom, note: s.homeroom ? hub.teacherName(s.homeroom) : undefined },
      { label: `${q}쿼터 정기 면담`, done: recs.some(r => r.type === 'interview' && r.data.kind === '정기' && quarterOf(r.date) === q), href: '/records/interviews' },
      { label: `${q}쿼터 학습 진도 보고서 (별지 3)`, done: !!rep && rep.status !== '작성중', note: rep?.status, href: '/reports' },
    ] },
    { stage: '졸업 심사 · 졸업', art: 30, steps: [
      { label: '졸업 심사표 (별지 5)', done: done(5), href: fhref(5) },
      { label: s.status === '퇴교' ? `퇴교 (${s.leaveType || ''})` : '졸업', done: s.status === '졸업' || s.status === '퇴교', note: s.statusDate },
      { label: '기록 묶음 보관 (드라이브 링크)', done: !!s.archiveUrl },
    ] },
  ];
}

export default function StudentTop({ s }: { s: Student }) {
  const hub = useHub();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const flow = useFlow(s);
  const ji = journeyIndex(s);
  const leaving = s.status !== '재학' && s.status !== '체험입학' && s.status !== '문의';

  const zip = async (mode: ArchiveMode) => {
    setBusy(true);
    try { downloadBlob(await studentArchive(s, hub, mode), `${s.name}_학생기록${mode === '전달' ? '_전달용' : ''}_${DEMO_TODAY}.zip`); } finally { setBusy(false); }
  };

  return (
    <div className="stack" style={{ marginBottom: 16 }}>
      <div className="grid g2">
        <DocCard s={s} no={9} title="입학원서 · 학부모 질문지" desc="입학 원서 제출 시 (제28조 제1항 제3호)" />
        <DocCard s={s} no={11} title="학부모 서약서 및 동의서" desc="정식 입학 전 (제28조 제4항·제6항)" />
      </div>

      <div className="card">
        <button className="journey-btn" onClick={() => setOpen(!open)} aria-expanded={open} title="눌러서 전체 흐름 보기">
          <div className="journey">
            {JOURNEY.map((j, i) => <div key={j} className={`st ${i < ji ? 'done' : ''} ${i === ji ? 'now' : ''}`}>{j}</div>)}
          </div>
          <span className="tiny muted">{open ? '접기 ▴' : '전체 흐름 보기 ▾'}</span>
        </button>
        {open && (
          <div className="flow-steps">
            {flow.map(st => (
              <div key={st.stage} className="flow-stage">
                <div className="spread"><b>{st.stage}</b>{st.art && <ArtLink no={st.art} />}</div>
                <ul>
                  {st.steps.map(x => (
                    <li key={x.label} className={x.done ? 'ok' : ''}>
                      <span className="mark">{x.done ? '✓' : '○'}</span>
                      {x.href ? <Link href={x.href}>{x.label}</Link> : <span>{x.label}</span>}
                      {x.note && <span className="tiny muted"> · {x.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {leaving && (
        <div className="card archive-card">
          <div className="spread">
            <div>
              <b>기록 보관</b> <span className="tiny muted">{s.status}{s.leaveType ? ` · ${s.leaveType}` : ''} {s.statusDate || ''}</span>
              <p className="small muted" style={{ margin: '4px 0 0' }}>학교 보관용은 모든 기록을 담고, 면담 일지·지도 사유는 &lsquo;면담·지도기록_비공개&rsquo; 폴더에 따로 둡니다. 교직원 전용 드라이브에 올리고 링크를 남깁니다. 졸업생·학부모에게는 면담·지도 기록을 뺀 전달용을 보냅니다 (제38조 제2항).</p>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn primary" onClick={() => zip('보관')} disabled={busy}>{busy ? '만드는 중…' : '학교 보관용 ZIP'}</button>
              <button className="btn" onClick={() => zip('전달')} disabled={busy} title="면담·지도 기록과 원자료를 뺀 묶음">졸업생 전달용 ZIP</button>
            </div>
          </div>
          <label className="field" style={{ marginTop: 10 }}>드라이브 링크
            <input value={s.archiveUrl || ''} placeholder="https://drive.google.com/…" onChange={e => hub.updateStudent(s.id, { archiveUrl: e.target.value || undefined, archivedAt: e.target.value ? (s.archivedAt || DEMO_TODAY) : undefined })} />
          </label>
          {s.archiveUrl && <a className="small" href={s.archiveUrl} target="_blank" rel="noreferrer">보관한 기록 열기 ↗</a>}
        </div>
      )}
    </div>
  );
}
