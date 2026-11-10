'use client';
// 검정고시 응시 기록 (초졸·중졸·고졸 각각). 학생별 학력 기록으로 남긴다 (졸업 지표는 이 기록을 읽기만 한다).
// 성적표를 올리면 회차·과목별 점수표를 채운다: 글자가 있는 PDF는 브라우저에서 바로 읽고(lib/gedParse.ts, AI 없음),
// 사진·스캔본만 AI(/api/ai/ged)로 읽는다. 파일은 IndexedDB(lib/fileStore.ts)에 둔다.
import { useState } from 'react';
import { useHub } from '@/lib/store';
import { DEMO_TODAY } from '@/lib/rules';
import { openFile, putFile, deleteFile } from '@/lib/fileStore';
import { pdfRead } from '@/lib/pdfText';
import { parseGed } from '@/lib/gedParse';
import type { GedExam, GedLevel, GedStatus, Student } from '@/lib/types';
import { Badge } from './ui';

/** 시험 과목 (선택 과목은 학생마다 다르게 적는다). 합격 기준은 시행 공고로 확인 */
export const GED_SUBJECTS: Record<GedLevel, string[]> = {
  초졸: ['국어', '수학', '사회', '과학', '선택1', '선택2'],
  중졸: ['국어', '수학', '영어', '사회', '과학', '선택'],
  고졸: ['국어', '수학', '영어', '사회', '과학', '한국사', '선택'],
};
const LEVELS: GedLevel[] = ['초졸', '중졸', '고졸'];
const STATUSES: GedStatus[] = ['응시 예정', '합격', '불합격', '일부 과목 합격'];
const TONE: Record<GedStatus, 'gold' | 'green' | 'red' | 'orange'> = { '응시 예정': 'gold', 합격: 'green', 불합격: 'red', '일부 과목 합격': 'orange' };
const PASS = 60; // 과목 합격 기준 (일반적으로 60점 이상, 그해 공고로 확인)

const num = (v?: string) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
export const gedAverage = (g: GedExam) => {
  const vals = GED_SUBJECTS[g.level].map(k => num(g.scores[k])).filter((x): x is number => x !== null);
  return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
};
const hasFile = (g: GedExam) => !!(g.reportFileId || g.reportFile || g.reportUrl);

interface Parsed { level: GedLevel; round: string; date: string; status: GedStatus; scores: { subject: string; score: string }[]; electives: string }

export default function GedPanel({ s }: { s: Student }) {
  const hub = useHub();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const exams = hub.gedExams.filter(g => g.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date));
  const levels = LEVELS.filter(l => (s.gedLevels || []).includes(l) || exams.some(e => e.level === l));

  const add = (level: GedLevel) => {
    const g: GedExam = { id: hub.newId('ge'), studentId: s.id, level, round: `${DEMO_TODAY.slice(0, 4)}년 제1회`, date: DEMO_TODAY, status: '응시 예정', scores: {} };
    hub.saveGed(g); setOpen(g.id);
  };

  // 성적표 올리기: 파일을 저장하고 읽어 새 응시 기록을 만든다. PDF 글 → 규칙으로, 안 되면 AI, 그래도 안 되면 파일만 붙인 기록
  const upload = async (f?: File) => {
    if (!f) return;
    setBusy(true); setMsg(null);
    const fileId = await putFile(f);
    const base: GedExam = { id: hub.newId('ge'), studentId: s.id, level: levels[0] || '고졸', round: '', date: DEMO_TODAY, status: '응시 예정', scores: {}, reportFileId: fileId, reportFileName: f.name };
    const keep = (level: GedLevel) => { if (!(s.gedLevels || []).includes(level)) hub.updateStudent(s.id, { gedLevels: [...(s.gedLevels || []), level] }); };
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
      const p = await pdfRead(f).then(r => parseGed(r.text, levels[0], r.items)).catch(() => null);
      if (p && p.found) {
        const g: GedExam = { ...base, level: p.level, round: p.round || base.round, date: p.date || base.date, status: p.status, scores: p.scores, electives: p.electives || undefined };
        hub.saveGed(g); setOpen(g.id); keep(p.level);
        setMsg({ ok: true, text: `PDF에서 ${p.level} ${p.round || ''} 점수 ${p.found}과목을 읽었습니다. 성적표와 맞는지 확인하고 빈 칸은 채워 주세요.` });
        setBusy(false); return;
      }
    }
    try {
      const fd = new FormData(); fd.append('file', f);
      const r = await fetch('/api/ai/ged', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) {
        hub.saveGed(base); setOpen(base.id);
        setMsg({ ok: false, text: `${j.error || '성적표를 읽지 못했습니다'} 파일은 붙여 두었으니 점수를 직접 입력하세요.` });
      } else {
        const p = j as Parsed;
        const g: GedExam = { ...base, level: p.level, round: p.round || base.round, date: p.date || base.date, status: p.status, electives: p.electives || undefined, scores: Object.fromEntries(p.scores.map(x => [x.subject, x.score])) };
        hub.saveGed(g); setOpen(g.id); keep(p.level);
        setMsg({ ok: true, text: `${p.level} ${p.round} 성적을 AI로 읽었습니다 (사진·스캔본). 표의 점수가 성적표와 맞는지 확인하세요.` });
      }
    } catch {
      hub.saveGed(base); setOpen(base.id);
      setMsg({ ok: false, text: 'AI 서버에 연결하지 못했습니다. 파일은 붙여 두었으니 점수를 직접 입력하세요.' });
    }
    setBusy(false);
  };

  return (
    <div className="card">
      <div className="spread">
        <h3 style={{ margin: 0 }}>검정고시</h3>
        <label className="btn sm primary" style={{ cursor: 'pointer' }}>{busy ? '읽는 중…' : '성적표 올리기 (자동 읽기)'}
          <input type="file" accept="image/*,application/pdf" hidden disabled={busy} onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      <div className="row" style={{ gap: 10, marginTop: 6 }}>
        <span className="tiny muted">응시 대상</span>
        {LEVELS.map(l => (
          <label key={l} className="check small"><input type="checkbox" checked={(s.gedLevels || []).includes(l)}
            onChange={e => hub.updateStudent(s.id, { gedLevels: e.target.checked ? [...(s.gedLevels || []), l] : (s.gedLevels || []).filter(x => x !== l) })} /> {l}</label>
        ))}
      </div>
      {msg && <div className={`callout small ${msg.ok ? '' : 'red'}`} style={{ marginTop: 8 }}>{msg.text}</div>}
      {levels.length === 0 && <p className="small muted" style={{ marginBottom: 0 }}>성적증명서 PDF를 올리면 회차와 과목별 점수를 읽어 표로 남깁니다 (사진·스캔본은 AI로 읽음). 응시 대상을 체크해 두면 응시 예정 기록도 만들 수 있습니다.</p>}
      {levels.map(level => {
        const list = exams.filter(e => e.level === level);
        const passed = list.some(e => e.status === '합격');
        return (
          <div key={level} className="ged-level">
            <div className="spread">
              <b>{level} 검정고시 {passed && <Badge tone="green">합격</Badge>}</b>
              <button className="btn sm" onClick={() => add(level)}>+ 직접 입력</button>
            </div>
            {list.length === 0 ? <p className="tiny muted" style={{ margin: '4px 0 0' }}>기록 없음</p> : <ScoreTable level={level} list={list} onOpen={id => setOpen(open === id ? null : id)} openId={open} />}
            {list.filter(g => g.id === open).map(g => <ExamEdit key={g.id} g={g} onClose={() => setOpen(null)} />)}
          </div>
        );
      })}
    </div>
  );
}

/** 회차 × 과목 점수표 */
function ScoreTable({ level, list, onOpen, openId }: { level: GedLevel; list: GedExam[]; onOpen: (id: string) => void; openId: string | null }) {
  const subs = GED_SUBJECTS[level];
  return (
    <div style={{ overflowX: 'auto', marginTop: 6 }}>
      <table className="t small ged-table">
        <thead><tr><th>회차</th>{subs.map(k => <th key={k}>{k}</th>)}<th>평균</th><th>결과</th><th>성적표</th></tr></thead>
        <tbody>
          {list.map(g => {
            const avg = gedAverage(g);
            return (
              <tr key={g.id} className={`clickable${openId === g.id ? ' on' : ''}`} onClick={() => onOpen(g.id)}>
                <td><b>{g.round || '회차 미정'}</b><div className="tiny muted">{g.date}</div></td>
                {subs.map(k => {
                  const v = g.scores[k]; const n = num(v);
                  return <td key={k} className={n === null ? 'muted' : n >= PASS ? 'ged-pass' : 'ged-fail'}>{v || '-'}</td>;
                })}
                <td><b>{avg === null ? '-' : avg.toFixed(1)}</b></td>
                <td><Badge tone={TONE[g.status]}>{g.status}</Badge></td>
                <td onClick={e => e.stopPropagation()}>
                  {g.reportFileId ? <button className="linklike tiny" onClick={() => openFile(g.reportFileId!, g.reportFileName || '성적표')}>열기</button>
                    : g.reportFile ? <a className="tiny" href={g.reportFile.dataUrl} download={g.reportFile.name}>열기</a>
                      : g.reportUrl ? <a className="tiny" href={g.reportUrl} target="_blank" rel="noreferrer">링크</a> : <span className="tiny muted">-</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {list.some(g => g.electives) && <p className="tiny muted" style={{ margin: '2px 0 0' }}>선택 과목: {[...new Set(list.map(g => g.electives).filter(Boolean))].join(' / ')}</p>}
    </div>
  );
}

function ExamEdit({ g, onClose }: { g: GedExam; onClose: () => void }) {
  const hub = useHub();
  const up = (p: Partial<GedExam>) => hub.saveGed({ ...g, ...p });
  const attach = async (f?: File) => {
    if (!f) return;
    if (g.reportFileId) await deleteFile(g.reportFileId);
    up({ reportFileId: await putFile(f), reportFileName: f.name, reportFile: undefined });
  };
  return (
    <div className="ged-exam stack" style={{ marginTop: 8 }}>
      <div className="grid g3">
        <label className="field">회차<input value={g.round} onChange={e => up({ round: e.target.value })} placeholder="2027년 제1회" /></label>
        <label className="field">시험일<input type="date" value={g.date} onChange={e => up({ date: e.target.value })} /></label>
        <label className="field">결과<select value={g.status} onChange={e => up({ status: e.target.value as GedStatus })}>{STATUSES.map(x => <option key={x}>{x}</option>)}</select></label>
      </div>
      <div className="ged-scores">
        {GED_SUBJECTS[g.level].map(k => (
          <label key={k} className="field">{k}<input className="input score" value={g.scores[k] || ''} onChange={e => up({ scores: { ...g.scores, [k]: e.target.value } })} /></label>
        ))}
      </div>
      <div className="grid g2">
        <label className="field">선택 과목 이름<input value={g.electives || ''} onChange={e => up({ electives: e.target.value })} placeholder="예: 도덕, 미술" /></label>
        <label className="field">성적표 링크 (드라이브)<input value={g.reportUrl || ''} onChange={e => up({ reportUrl: e.target.value })} placeholder="https://drive.google.com/…" /></label>
      </div>
      <div className="row">
        <span className="small">성적표 파일: {g.reportFileName || g.reportFile?.name || '없음'}</span>
        <label className="btn sm" style={{ cursor: 'pointer' }}>{g.reportFileId || g.reportFile ? '바꾸기' : '붙이기'}<input type="file" accept="image/*,application/pdf" hidden onChange={e => { attach(e.target.files?.[0]); e.target.value = ''; }} /></label>
        <span style={{ flex: 1 }} />
        <button className="btn sm warn" onClick={async () => { if (!confirm('이 응시 기록을 지울까요?')) return; if (g.reportFileId) await deleteFile(g.reportFileId); hub.removeGed(g.id); onClose(); }}>지우기</button>
        <button className="btn sm" onClick={onClose}>닫기</button>
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>합격 기준(과목 {PASS}점 이상, 평균 {PASS}점 이상 등)은 그해 시행 공고로 확인합니다. 면제·기합격 과목은 점수 칸에 그대로 적습니다.</p>
    </div>
  );
}
