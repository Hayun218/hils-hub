'use client';
import { useState } from 'react';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { DEMO_TODAY, gradeLabel } from '@/lib/rules';
import { GED_COLUMNS } from '@/lib/reports';
import type { GradeKind, GradeSheet } from '@/lib/types';
import { PageHead, Badge } from '@/components/ui';

const KINDS: GradeKind[] = ['단원평가', '영단어', '검정고시 진단평가', '모의고사', '기타'];
const SUBJECTS = ['국어', '영어', '수학', '통합사회 / 통합과학', '한자', '검정고시', '기타'];
const CLASSES = ['어니스트반', '드림반', '콜링반'];

export default function GradesPage() {
  const hub = useHub();
  const [kind, setKind] = useState<GradeKind | '전체'>('전체');
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const list = hub.grades.filter(g => kind === '전체' || g.kind === kind).sort((a, b) => b.date.localeCompare(a.date));
  const cur = hub.grades.find(g => g.id === sel);

  return (
    <div className="page">
      <PageHead
        title="성적 입력"
        desc="단원평가, 영단어, 검정고시 진단평가 점수를 넣으면 그 쿼터 학습 진도 보고서에 자동으로 들어갑니다."
        right={<button className="btn primary" onClick={() => setAdding(true)}>+ 새 평가</button>}
      />
      <div className="grid" style={{ gridTemplateColumns: '320px minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: 10, borderBottom: '1px solid var(--line)' }}>
            <select className="input" style={{ width: '100%' }} value={kind} onChange={e => setKind(e.target.value as GradeKind | '전체')} aria-label="평가 종류">
              <option value="전체">전체 평가</option>{KINDS.map(k => <option key={k}>{k}</option>)}
            </select>
          </div>
          <ul className="sheet-list">
            {list.map(g => {
              const n = g.students.filter(id => Object.values(g.scores[id] || {}).some(v => v)).length;
              return (
                <li key={g.id}>
                  <button className={sel === g.id ? 'on' : ''} onClick={() => setSel(g.id)}>
                    <span><b>{g.title}</b><span className="tiny muted"> · {g.subject}</span></span>
                    <span className="tiny muted">{g.kind} · {g.date} · {n}/{g.students.length}명</span>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="muted small" style={{ padding: 16 }}>평가가 없습니다. 오른쪽 위 "새 평가"로 만드세요.</li>}
          </ul>
        </div>
        {cur ? <ScoreSheet g={cur} onDelete={() => { hub.removeGrade(cur.id); setSel(null); }} /> : <div className="card muted small">왼쪽에서 평가를 고르거나 새 평가를 만드세요.</div>}
      </div>
      {adding && <NewSheet onClose={id => { setAdding(false); if (id) setSel(id); }} />}
    </div>
  );
}

function ScoreSheet({ g, onDelete }: { g: GradeSheet; onDelete: () => void }) {
  const hub = useHub();
  const name = (id: string) => hub.students.find(s => s.id === id);
  const setScore = (sid: string, col: string, v: string) =>
    hub.saveGrade({ ...g, scores: { ...g.scores, [sid]: { ...(g.scores[sid] || {}), [col]: v } } });
  const avg = (col: string) => {
    const xs = g.students.map(id => Number(g.scores[id]?.[col])).filter(x => !Number.isNaN(x) && x > 0);
    return xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '-';
  };
  return (
    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
      <div className="spread" style={{ padding: '14px 16px' }}>
        <div>
          <div className="row"><b style={{ fontSize: 16, color: 'var(--deep)' }}>{g.title}</b><Badge tone="line">{g.kind}</Badge></div>
          <div className="tiny muted">{g.subject} · {g.date}{g.max ? ` · 만점 ${g.max}` : ''}</div>
        </div>
        <button className="btn sm warn" onClick={() => { if (confirm('이 평가와 점수를 지울까요?')) onDelete(); }}>삭제</button>
      </div>
      <table className="t">
        <thead><tr><th>이름</th>{g.columns.map(c => <th key={c} className="num">{c}</th>)}</tr></thead>
        <tbody>
          {g.students.map(id => {
            const s = name(id);
            if (!s) return null;
            return (
              <tr key={id}>
                <td><b>{s.name}</b> <span className="tiny muted">{gradeLabel(s.birthYear)}</span></td>
                {g.columns.map(c => (
                  <td key={c} className="num">
                    <input className="input score" inputMode="numeric" value={g.scores[id]?.[c] || ''} onChange={e => setScore(id, c, e.target.value)} aria-label={`${s.name} ${c}`} />
                  </td>
                ))}
              </tr>
            );
          })}
          <tr><td className="muted small">평균</td>{g.columns.map(c => <td key={c} className="num small muted">{avg(c)}</td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}

function NewSheet({ onClose }: { onClose: (id?: string) => void }) {
  const hub = useHub();
  const auth = useAuth();
  const [kind, setKind] = useState<GradeKind>('단원평가');
  const [subject, setSubject] = useState('수학');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(DEMO_TODAY);
  const [max, setMax] = useState(100);
  const [classes, setClasses] = useState<string[]>(CLASSES);
  const active = hub.students.filter(s => s.status === '재학');
  const targets = kind === '검정고시 진단평가'
    ? active.filter(s => s.gedThisQuarter || s.schoolLevel === '중고등').filter(s => !s.classGroup || classes.includes(s.classGroup))
    : active.filter(s => !s.classGroup || classes.includes(s.classGroup));
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const on = (id: string) => picked[id] ?? true;

  const create = () => {
    const g: GradeSheet = {
      id: hub.newId('g'), kind, subject: kind === '검정고시 진단평가' ? '검정고시' : subject, title: title.trim() || `${subject} ${kind}`, date,
      columns: kind === '검정고시 진단평가' ? GED_COLUMNS : ['점수'], max: kind === '검정고시 진단평가' ? 100 : max || undefined,
      students: targets.filter(s => on(s.id)).map(s => s.id), scores: {}, author: auth.me?.teacherId,
    };
    hub.saveGrade(g);
    onClose(g.id);
  };

  return (
    <div className="modal-bg" onClick={() => onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>새 평가</h2>
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="seg">{KINDS.map(k => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{k}</button>)}</div>
          <div className="grid g2">
            {kind !== '검정고시 진단평가' && <label className="field">과목<select value={subject} onChange={e => setSubject(e.target.value)}>{SUBJECTS.map(x => <option key={x}>{x}</option>)}</select></label>}
            <label className="field">{kind === '검정고시 진단평가' ? '회차' : '평가 이름'}
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === '검정고시 진단평가' ? '예: 24-1회차' : kind === '영단어' ? '예: Word Building 1015' : '예: 수와 연산 3-2 4단원 분수 1회'} />
            </label>
            <label className="field">날짜<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            {kind !== '검정고시 진단평가' && <label className="field">만점<input type="number" value={max} onChange={e => setMax(Number(e.target.value))} /></label>}
          </div>
          <div className="row">
            <span className="small muted">대상 반</span>
            {CLASSES.map(c => <label key={c} className="check small"><input type="checkbox" checked={classes.includes(c)} onChange={e => setClasses(e.target.checked ? [...classes, c] : classes.filter(x => x !== c))} /> {c}</label>)}
          </div>
          <div className="pick">
            {targets.map(s => <label key={s.id} className="check small"><input type="checkbox" checked={on(s.id)} onChange={e => setPicked({ ...picked, [s.id]: e.target.checked })} /> {s.name}</label>)}
          </div>
          {kind === '검정고시 진단평가' && <p className="tiny muted" style={{ margin: 0 }}>점수 칸: {GED_COLUMNS.join(' · ')}. 보고서에는 그 쿼터까지의 회차가 누적으로 들어갑니다.</p>}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn" onClick={() => onClose()}>취소</button>
          <button className="btn primary" onClick={create} disabled={!targets.some(s => on(s.id))}>만들고 점수 입력</button>
        </div>
      </div>
    </div>
  );
}
