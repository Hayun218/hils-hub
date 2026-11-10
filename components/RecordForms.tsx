'use client';
// 학생 기록 입력 폼 (학생 상세, 면담 일지, 생활 기록 화면이 함께 쓴다)
// 별지 2 체험 입학 진단, 별지 4 생활·훈육 기록(지도 사유), 별지 8 면담 일지, 별표 8 상점·벌점
import Link from 'next/link';
import { useState } from 'react';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import type { RecordType, Student, StudentRecord } from '@/lib/types';
import { DEMO_TODAY, MERIT_ITEMS, DEMERIT_ITEMS, demeritsInQuarter, guidanceCount, interviewTitle, quarterOf, stageFor } from '@/lib/rules';
import { Badge, ArtLink, FormLink } from './ui';

export const TYPE_LABEL: Record<RecordType, string> = {
  diagnosis: '진단', level: '레벨', reading: '독서', merit: '상점', demerit: '벌점', incident: '지도 사유', interview: '면담',
};
export const TYPE_TONE: Record<RecordType, 'green' | 'gold' | 'orange' | 'red' | 'deep' | 'line'> = {
  diagnosis: 'gold', level: 'deep', reading: 'green', merit: 'green', demerit: 'orange', incident: 'red', interview: 'line',
};

export function RecordItem({ r, showStudent }: { r: StudentRecord; showStudent?: boolean }) {
  const hub = useHub();
  const d = r.data;
  const detail =
    r.type === 'merit' || r.type === 'demerit' ? `${r.type === 'merit' ? '+' : '−'}${d.points}점 · ${d.area}${d.action ? ` · ${d.action}` : ''}`
    : r.type === 'incident' ? `${d.reason} · ${d.step}단계 · ${d.fact}`
    : r.type === 'interview' ? [d.story, d.guidance, d.summary, d.promise && `합의: ${d.promise}`].filter(Boolean).join(' / ')
    : r.type === 'level' ? `${d.subject} ${d.from || '-'} → ${d.to}`
    : r.type === 'reading' ? `${d.category}${d.report ? ' · 보고서 제출' : ''}`
    : r.type === 'diagnosis' ? Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(' / ')
    : '';
  return (
    <li>
      <span className="date">{r.date}</span>
      <div>
        <div className="row" style={{ gap: 6 }}>
          <Badge tone={TYPE_TONE[r.type]}>{TYPE_LABEL[r.type]}</Badge>
          {showStudent && <Link href={`/students/${r.studentId}`} className="small" style={{ fontWeight: 500 }}>{hub.students.find(x => x.id === r.studentId)?.name}</Link>}
          <span className="ttl">{r.title}</span>
          {r.private && <Badge tone="line">비공개</Badge>}
        </div>
        <div className="small" style={{ marginTop: 2 }}>{detail}</div>
        <div className="meta">{hub.teacherName(r.author)}</div>
      </div>
    </li>
  );
}

// ───────── 입력 폼 ─────────

export function AuthorDate({ author, setAuthor, date, setDate }: { author: string; setAuthor: (v: string) => void; date: string; setDate: (v: string) => void }) {
  const hub = useHub();
  return (
    <div className="grid g2">
      <label className="field">기록 교사<select value={author} onChange={e => setAuthor(e.target.value)}><option value="">선택</option>{hub.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="field">날짜<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
    </div>
  );
}

function useBase(s: Student) {
  const hub = useHub();
  const auth = useAuth();
  // 기록 교사 기본값: 로그인한 교직원과 연결된 교사 → 담임 → 첫 교사
  const [author, setAuthor] = useState(auth.me?.teacherId || s.homeroom || hub.teachers[0]?.id || '');
  const [date, setDate] = useState(DEMO_TODAY);
  return { author, setAuthor, date, setDate };
}

export function MeritForm({ s, onDone }: { s: Student; onDone: (m: string) => void }) {
  const hub = useHub();
  const b = useBase(s);
  const [kind, setKind] = useState<'merit' | 'demerit'>('merit');
  const [q1Only, setQ1Only] = useState(true);
  const items = (kind === 'merit' ? MERIT_ITEMS : DEMERIT_ITEMS).filter(i => !q1Only || i.q1);
  const [idx, setIdx] = useState(0);
  const item = items[Math.min(idx, items.length - 1)];
  const [points, setPoints] = useState<number | null>(null);
  const pts = points ?? item.points;
  const triggers = kind === 'demerit' ? (item.area === '공동체' ? '제32조 행동' : item.area === '전자기기' ? '전자기기' : '') : '';
  const before = demeritsInQuarter(hub.records, s.id, quarterOf(b.date));
  const action = kind === 'demerit' ? (item as { action?: string }).action : undefined; // 별표 8 즉시 조치

  const save = () => {
    const created = hub.addRecord({
      studentId: s.id, type: kind, date: b.date, title: item.label, author: b.author, private: false,
      data: { points: pts, area: item.area, ...(triggers ? { triggers } : {}), ...(action ? { action } : {}) },
    });
    const inc = created.filter(r => r.type === 'incident');
    if (inc.length) {
      const st = stageFor(guidanceCount(hub.records, s.id) + inc.length)!;
      onDone(`벌점 ${pts}점 기록. 지도 사유 ${inc.length}건이 자동으로 생겼습니다 → ${st.label} (${st.who}). 그 주 안에 면담하고 '면담 일지'에 기록하세요.`);
    } else onDone(`${kind === 'merit' ? '상점' : '벌점'} ${pts}점을 기록했습니다.${action ? ` 즉시 조치: ${action}.` : ''} 학생에게 그 자리에서 이유를 말해 주세요 (별표 8 운영 원칙 ②).`);
    setPoints(null);
  };

  return (
    <div className="stack">
      <div className="spread">
        <div className="seg">
          <button className={kind === 'merit' ? 'on' : ''} onClick={() => { setKind('merit'); setIdx(0); setPoints(null); }}>상점</button>
          <button className={kind === 'demerit' ? 'on' : ''} onClick={() => { setKind('demerit'); setIdx(0); setPoints(null); }}>벌점</button>
        </div>
        <label className="check small"><input type="checkbox" checked={q1Only} onChange={e => { setQ1Only(e.target.checked); setIdx(0); }} /> 1쿼터 적용 항목만 (부칙 제4조)</label>
      </div>
      <label className="field">기준 (별표 8)
        <select value={idx} onChange={e => { setIdx(Number(e.target.value)); setPoints(null); }}>
          {items.map((i, n) => <option key={i.label} value={n}>[{i.area}] {i.label} · {i.points}점{(i as { action?: string }).action ? ` · ${(i as { action?: string }).action}` : ''}</option>)}
        </select>
      </label>
      <div className="grid g2">
        <label className="field">점수<input type="number" min={1} max={5} value={pts} onChange={e => setPoints(Number(e.target.value))} /></label>
        <div />
      </div>
      <AuthorDate {...b} />
      {kind === 'demerit' && (
        <div className="callout small">
          {triggers
            ? <>이 항목은 그 자체로 <b>지도 사유 1건</b>입니다 (제33조 제1항). 저장하면 지도 사유가 함께 기록됩니다.</>
            : <>이번 쿼터 벌점 {before}점 → 저장 후 {before + pts}점. {Math.floor((before + pts) / 5) > Math.floor(before / 5) ? <b>5점 단위를 넘어 지도 사유 1건이 자동 생성됩니다.</b> : `5점마다 지도 사유 1건.`}</>}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" onClick={save}>기록</button></div>
    </div>
  );
}

export function InterviewForm({ s, onDone }: { s: Student; onDone: (m: string) => void }) {
  const hub = useHub();
  const b = useBase(s);
  const count = guidanceCount(hub.records, s.id);
  const st = stageFor(count);
  const lastInc = hub.records.filter(r => r.studentId === s.id && r.type === 'incident').sort((a, z) => z.date.localeCompare(a.date))[0];
  const [kind, setKind] = useState<'정기' | '학습' | '지도'>('정기');
  const [subject, setSubject] = useState('영어');
  const [story, setStory] = useState('');
  const [guidance, setGuidance] = useState('');
  const [promise, setPromise] = useState('');
  const [follow, setFollow] = useState('');
  const step = st?.step || 1;
  const reason = String(lastInc?.data.reason || '사유');
  const title = interviewTitle(kind, s.name, b.date, { subject, step, reason });

  const save = () => {
    hub.addRecord({
      studentId: s.id, type: 'interview', date: b.date, title, author: b.author, private: kind === '지도',
      data: { kind, ...(kind === '학습' ? { subject } : {}), ...(kind === '지도' ? { step, reason } : {}), story, guidance, promise, follow },
    });
    setStory(''); setGuidance(''); setPromise(''); setFollow('');
    onDone(`면담 일지를 저장했습니다: ${title}${kind === '지도' ? ' (비공개)' : ''}`);
  };

  return (
    <div className="stack">
      <div className="spread">
        <div className="seg">{(['정기', '학습', '지도'] as const).map(k => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)} disabled={k === '지도' && !st}>{k} 면담</button>)}</div>
        <FormLink no={8} />
      </div>
      {kind === '학습' && <label className="field">과목<select value={subject} onChange={e => setSubject(e.target.value)}>{['영어', '수학', '사고력·독서', '영성', '기초교과'].map(x => <option key={x}>{x}</option>)}</select></label>}
      {kind === '지도' && st && <div className="callout red small">학년도 누적 지도 사유 {count}건 → <b>{st.label}</b> · 면담 담당: {st.who} · 최근 사유: {reason} <ArtLink no={33} /></div>}
      <div className="field">제목 (자동)<div className="input" style={{ background: 'var(--g10)', fontWeight: 500 }}>{title}</div></div>
      <AuthorDate {...b} />
      <label className="field">학생의 이야기<textarea value={story} onChange={e => setStory(e.target.value)} /></label>
      <label className="field">교사의 권면과 지도<textarea value={guidance} onChange={e => setGuidance(e.target.value)} /></label>
      <div className="grid g2">
        <label className="field">합의한 내용<input value={promise} onChange={e => setPromise(e.target.value)} /></label>
        <label className="field">후속 조치<input value={follow} onChange={e => setFollow(e.target.value)} /></label>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" onClick={save}>면담 일지 저장</button></div>
    </div>
  );
}

export function IncidentForm({ s, onDone }: { s: Student; onDone: (m: string) => void }) {
  const hub = useHub();
  const b = useBase(s);
  const [reason, setReason] = useState<'제32조 행동' | '전자기기' | '기타'>('제32조 행동');
  const [fact, setFact] = useState('');
  const [safety, setSafety] = useState(false);
  const next = stageFor(guidanceCount(hub.records, s.id) + 1)!;

  const save = () => {
    if (!fact.trim()) return;
    hub.addRecord({ studentId: s.id, type: 'incident', date: b.date, title: `${reason} 지도 사유`, author: b.author, private: true, data: { reason, fact, step: next.step, safety } });
    setFact(''); setSafety(false);
    onDone(`지도 사유를 기록했습니다 → ${next.label} (${next.who}). 그 주 안에 면담하세요.${safety ? ' 안전 사안: 오늘 보호자에게 알리세요 (제33조 제4항).' : ''}`);
  };

  return (
    <div className="stack">
      <div className="spread"><span className="small muted">발견한 교사가 당일 기록 · 비공개</span><FormLink no={4} /></div>
      <label className="field">지도 사유 (제33조 제1항)
        <select value={reason} onChange={e => setReason(e.target.value as typeof reason)}>
          <option value="제32조 행동">제32조 제2항의 행동 (욕설·폭력·심한 장난·무리 짓기 등)</option>
          <option value="전자기기">전자기기 위반 적발 (제31조 제2항)</option>
          <option value="기타">기타</option>
        </select>
      </label>
      <label className="field">사실 기록 (언제·어디서·무엇을, 판단 없이)<textarea value={fact} onChange={e => setFact(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={safety} onChange={e => setSafety(e.target.checked)} /> 안전 관련 사안 (당일 보호자 알림)</label>
      <AuthorDate {...b} />
      <div className="callout red small">저장하면 학년도 누적 {guidanceCount(hub.records, s.id) + 1}건 → <b>{next.label}</b> · 담당 {next.who}</div>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" onClick={save} disabled={!fact.trim()}>지도 사유 기록</button></div>
    </div>
  );
}

export function ReadingForm({ s, onDone }: { s: Student; onDone: (m: string) => void }) {
  const hub = useHub();
  const b = useBase(s);
  const [book, setBook] = useState('');
  const [category, setCategory] = useState('교과');
  const [report, setReport] = useState(true);
  const save = () => {
    if (!book.trim()) return;
    hub.addRecord({ studentId: s.id, type: 'reading', date: b.date, title: book, author: b.author, private: false, data: { book, category, report } });
    if (report && s.status === '재학') hub.addRecord({ studentId: s.id, type: 'merit', date: b.date, title: '독서 보고서 제출', author: b.author, private: false, data: { points: 1, area: '사고력·독서' } });
    setBook('');
    onDone(`독서 기록: ${book}${report ? ' · 독서 보고서 상점 +1' : ''}`);
  };
  return (
    <div className="stack">
      <label className="field">책 제목<input value={book} onChange={e => setBook(e.target.value)} /></label>
      <div className="grid g2">
        <label className="field">분류<select value={category} onChange={e => setCategory(e.target.value)}>{['교과', '영성', '진로', '자유'].map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={report} onChange={e => setReport(e.target.checked)} /> 독서 보고서 제출 (제19조)</label>
      </div>
      <AuthorDate {...b} />
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" onClick={save} disabled={!book.trim()}>기록</button></div>
    </div>
  );
}

export const LEVELS: Record<string, string[]> = { 영어: ['EN-E', 'EN-MH', 'EN-B', 'EN-A'], 수학: ['초등', 'M-C', 'M-B', 'M-A'] };

export function LevelForm({ s, onDone }: { s: Student; onDone: (m: string) => void }) {
  const hub = useHub();
  const b = useBase(s);
  const [subject, setSubject] = useState<'영어' | '수학'>('영어');
  const from = subject === '영어' ? s.enLevel : s.mathLevel;
  const [to, setTo] = useState('');
  const day = Number(b.date.slice(8, 10));
  const firstWeek = [1, 4, 7, 10].includes(Number(b.date.slice(5, 7))) && day <= 9;
  const save = () => {
    if (!to || to === from) return;
    hub.addRecord({ studentId: s.id, type: 'level', date: b.date, title: `${subject} 레벨 ${from || '-'} → ${to}`, author: b.author, private: false, data: { subject, from: from || '', to } });
    hub.updateStudent(s.id, subject === '영어' ? { enLevel: to } : { mathLevel: to });
    if (LEVELS[subject].indexOf(to) > LEVELS[subject].indexOf(from || '')) hub.addRecord({ studentId: s.id, type: 'merit', date: b.date, title: '레벨 상향', author: b.author, private: false, data: { points: 3, area: '학습' } });
    onDone(`${subject} 레벨을 ${to}(으)로 바꾸고 이동 이력을 남겼습니다 (별표 7 ⑤).`);
    setTo('');
  };
  return (
    <div className="stack">
      {!firstWeek && <div className="callout gold small">레벨 이동은 매 쿼터 첫 주에만 합니다 (<Link href="/hakchik#art20">제20조 제2항</Link>). 시연을 위해 기록은 허용합니다.</div>}
      <div className="grid g2">
        <label className="field">과목<select value={subject} onChange={e => { setSubject(e.target.value as '영어' | '수학'); setTo(''); }}><option>영어</option><option>수학</option></select></label>
        <label className="field">현재 → 변경
          <select value={to} onChange={e => setTo(e.target.value)}>
            <option value="">{from || '-'} → 선택</option>
            {LEVELS[subject].filter(l => l !== from).map(l => <option key={l}>{l}</option>)}
          </select>
        </label>
      </div>
      <AuthorDate {...b} />
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" onClick={save} disabled={!to}>레벨 변경</button></div>
    </div>
  );
}

export function DiagnosisForm({ s, onDone }: { s: Student; onDone: (m: string) => void }) {
  const hub = useHub();
  const b = useBase(s);
  const [v, setV] = useState({ 영어: '', 수학: '', 영성: '', 공동체: '' });
  const week = hub.records.filter(r => r.studentId === s.id && r.type === 'diagnosis').length + 1;
  const save = () => {
    hub.addRecord({ studentId: s.id, type: 'diagnosis', date: b.date, title: `체험 입학 ${week}주차 진단`, author: b.author, private: false, data: Object.fromEntries(Object.entries(v).filter(([, x]) => x)) });
    setV({ 영어: '', 수학: '', 영성: '', 공동체: '' });
    onDone(`${week}주차 진단을 기록했습니다. 3주 진단 후 교사회 심사를 거쳐 '입학 처리'를 누르세요.`);
  };
  return (
    <div className="stack">
      <div className="spread"><span className="small muted">체험 입학 3주 동안 주마다 기록</span><FormLink no={2} /></div>
      {(Object.keys(v) as (keyof typeof v)[]).map(k => (
        <label key={k} className="field">{k}<input value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} placeholder={k === '영어' ? '예: 듣기·쉐도잉 가능 (EN-MH 예상)' : ''} /></label>
      ))}
      <AuthorDate {...b} />
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" onClick={save}>{week}주차 진단 저장</button></div>
    </div>
  );
}

