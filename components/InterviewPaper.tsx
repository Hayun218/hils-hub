'use client';
// 면담 일지 (별지 8)를 A4 한 장처럼 쓴다. 제목·지도 단계는 자동, 지도 면담은 비공개 (제38조).
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { DEMO_TODAY, guidanceCount, interviewTitle, stageFor } from '@/lib/rules';
import type { InterviewKind, StudentRecord } from '@/lib/types';
import { ArtLink } from './ui';
import CellInput from './CellInput';

const KINDS: InterviewKind[] = ['정기', '학습', '지도'];
const SUBJECTS = ['국어', '영어', '수학', '사고력·독서', '영성', '기초교과'];

interface Draft { studentId: string; kind: InterviewKind; subject: string; date: string; author: string; place: string; story: string; guidance: string; promise: string; follow: string }

const fromRecord = (r: StudentRecord): Draft => ({
  studentId: r.studentId, kind: (r.data.kind as InterviewKind) || '정기', subject: String(r.data.subject || '영어'), date: r.date, author: r.author,
  place: String(r.data.place || ''), story: String(r.data.story || ''), guidance: String(r.data.guidance || r.data.summary || ''), promise: String(r.data.promise || ''), follow: String(r.data.follow || ''),
});

export default function InterviewPaper({ record, studentId, initialKind, onSaved }: { record?: StudentRecord; studentId?: string; initialKind?: InterviewKind; onSaved: (msg: string, id: string) => void }) {
  const hub = useHub();
  const auth = useAuth();
  const blank = (): Draft => ({ studentId: studentId || '', kind: initialKind || '정기', subject: '영어', date: DEMO_TODAY, author: auth.me?.teacherId || hub.teachers.find(t => t.homeroomFor)?.id || '', place: '', story: '', guidance: '', promise: '', follow: '' });
  const [d, setD] = useState<Draft>(record ? fromRecord(record) : blank());
  useEffect(() => { setD(record ? fromRecord(record) : blank()); }, [record?.id, studentId]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<Draft>) => setD(x => ({ ...x, ...p }));

  const s = hub.students.find(x => x.id === d.studentId);
  const count = s ? guidanceCount(hub.records, s.id) : 0;
  const st = stageFor(count);
  const lastInc = s && hub.records.filter(r => r.studentId === s.id && r.type === 'incident').sort((a, z) => z.date.localeCompare(a.date))[0];
  const step = record?.data.step ? Number(record.data.step) : st?.step || 1;
  const reason = String(record?.data.reason || lastInc?.data.reason || '사유');
  const title = s ? interviewTitle(d.kind, s.name, d.date, { subject: d.subject, step, reason }) : '학생을 고르세요';
  const students = hub.students.filter(x => x.status === '재학' || x.status === '체험입학').sort((a, b) => a.name.localeCompare(b.name));
  const auto = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = 'auto'; el.style.height = `${Math.max(el.scrollHeight, 120)}px`; } };
  // 지도 면담은 지도 사유(별지 4)가 생긴 뒤 그 단계에 맞춰 한다 (제33조 제2항·제3항)
  const noReason = d.kind === '지도' && !st && !record;
  const ok = !!s && !noReason && (d.story.trim() || d.guidance.trim());

  const save = () => {
    if (!s) return;
    const data = { kind: d.kind, ...(d.kind === '학습' ? { subject: d.subject } : {}), ...(d.kind === '지도' ? { step, reason } : {}), place: d.place, story: d.story, guidance: d.guidance, promise: d.promise, follow: d.follow };
    if (record) {
      hub.updateRecord(record.id, { studentId: s.id, date: d.date, title, author: d.author, private: d.kind === '지도', data });
      onSaved(`저장했습니다: ${title}`, record.id);
    } else {
      const [r] = hub.addRecord({ studentId: s.id, type: 'interview', date: d.date, title, author: d.author, private: d.kind === '지도', data });
      onSaved(`면담 일지를 저장했습니다: ${title}${d.kind === '지도' ? ' (비공개)' : ''}`, r.id);
      setD(blank());
    }
  };

  return (
    <div className="paper">
      <div className="paper-no">별지 8</div>
      <h1 className="paper-title">면 담 일 지</h1>
      <div className="paper-sub">{title}</div>

      <table className="paper-table">
        <tbody>
          <tr>
            <th>학생</th>
            <td>
              <select value={d.studentId} onChange={e => set({ studentId: e.target.value })} aria-label="학생">
                <option value="">선택</option>
                {students.map(x => <option key={x.id} value={x.id}>{x.name}{guidanceCount(hub.records, x.id) ? ` · 지도 ${guidanceCount(hub.records, x.id)}건` : ''}</option>)}
              </select>
            </td>
            <th>구분</th>
            <td>
              <div className="paper-choices">
                {KINDS.map(k => (
                  <button key={k} type="button" className={d.kind === k ? 'on' : ''} onClick={() => set({ kind: k })} title={k === '지도' ? '지도 사유(별지 4)가 있을 때 그 단계에 맞춰 하는 면담 (제33조)' : undefined}>{k}</button>
                ))}
                {d.kind === '학습' && <select value={d.subject} onChange={e => set({ subject: e.target.value })} aria-label="과목">{SUBJECTS.map(x => <option key={x}>{x}</option>)}</select>}
              </div>
            </td>
          </tr>
          <tr>
            <th>날짜</th>
            <td><input type="date" value={d.date} onChange={e => set({ date: e.target.value })} aria-label="날짜" /></td>
            <th>면담자</th>
            <td>
              <select value={d.author} onChange={e => set({ author: e.target.value })} aria-label="면담자">
                <option value="">선택</option>
                {hub.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </td>
          </tr>
          <tr>
            <th>장소</th>
            <td colSpan={3}><CellInput value={d.place} onChange={e => set({ place: e.target.value })} placeholder="예: 3층 상담실" aria-label="장소" /></td>
          </tr>
          {noReason && s && (
            <tr className="no-print">
              <th>지도 단계</th>
              <td colSpan={3}>
                <div className="callout gold small" style={{ margin: 0 }}>
                  {s.name} 학생은 이번 학년도 지도 사유가 없습니다. 지도 면담은 지도 사유가 생겼을 때 그 단계(1단계 담임 → 2단계 목사 → 3단계 학부모 → 4단계 학교장)에 맞춰 합니다 <ArtLink no={33} />.
                  <div style={{ marginTop: 6 }}><Link className="btn sm primary" href={`/records/life?sheet=incident&student=${s.id}`}>생활·훈육 기록지(별지 4)에 지도 사유 쓰기 →</Link></div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>지도 사유 없이 생활·학습 이야기를 나눈 것이면 정기 면담이나 학습 면담으로 남기세요.</div>
                </div>
              </td>
            </tr>
          )}
          {d.kind === '지도' && st && (
            <tr>
              <th>지도 단계</th>
              <td colSpan={3}>{st.label} · 면담 담당 {st.who} · 사유 {reason} · 학년도 누적 {count}건 <ArtLink no={33} /></td>
            </tr>
          )}
        </tbody>
      </table>

      <section className="paper-sec">
        <h2>학생의 이야기</h2>
        <textarea ref={auto} value={d.story} onChange={e => { auto(e.target); set({ story: e.target.value }); }} placeholder="학생이 한 말을 가능한 그대로 적습니다" aria-label="학생의 이야기" />
      </section>
      <section className="paper-sec">
        <h2>교사의 권면과 지도</h2>
        <textarea ref={auto} value={d.guidance} onChange={e => { auto(e.target); set({ guidance: e.target.value }); }} placeholder="감정이 아닌 말씀을 기준으로 한 권면, 칭찬할 점과 바로잡을 점" aria-label="교사의 권면과 지도" />
      </section>
      <section className="paper-sec">
        <h2>합의한 내용과 다음 약속</h2>
        <textarea ref={auto} value={d.promise} onChange={e => { auto(e.target); set({ promise: e.target.value }); }} placeholder="학생이 스스로 정한 약속, 확인 방법과 날짜" aria-label="합의한 내용과 다음 약속" />
      </section>
      <table className="paper-table">
        <tbody><tr><th>후속 조치</th><td><CellInput value={d.follow} onChange={e => set({ follow: e.target.value })} placeholder="담당 · 확인 예정일 · 결과" aria-label="후속 조치" /></td></tr></tbody>
      </table>

      <div className="paper-actions no-print">
        {d.kind === '지도' && <span className="tiny muted">지도 면담은 비공개 기록입니다 (제38조 제2항)</span>}
        <button className="btn" onClick={() => window.print()}>인쇄</button>
        <button className="btn primary" onClick={save} disabled={!ok}>{record ? '고친 내용 저장' : '면담 일지 저장'}</button>
      </div>
    </div>
  );
}
