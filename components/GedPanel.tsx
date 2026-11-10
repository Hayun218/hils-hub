'use client';
// 검정고시 응시 기록 (초졸·중졸·고졸 각각). 성적표는 드라이브 링크나 작은 파일로 남긴다.
import { useState } from 'react';
import { useHub } from '@/lib/store';
import { DEMO_TODAY } from '@/lib/rules';
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
const MAX_FILE = 1024 * 1024; // 시안: 1MB까지 브라우저에 저장

export const gedAverage = (g: GedExam) => {
  const vals = GED_SUBJECTS[g.level].map(k => g.scores[k]).filter(v => v !== undefined && v !== '').map(Number).filter(x => !Number.isNaN(x));
  return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
};

export default function GedPanel({ s }: { s: Student }) {
  const hub = useHub();
  const [open, setOpen] = useState<string | null>(null);
  const exams = hub.gedExams.filter(g => g.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date));
  const levels = LEVELS.filter(l => (s.gedLevels || []).includes(l) || exams.some(e => e.level === l));

  const add = (level: GedLevel) => {
    const g: GedExam = { id: hub.newId('ge'), studentId: s.id, level, round: `${DEMO_TODAY.slice(0, 4)}년 제1회`, date: DEMO_TODAY, status: '응시 예정', scores: {} };
    hub.saveGed(g); setOpen(g.id);
  };

  return (
    <div className="card">
      <div className="spread">
        <h3 style={{ margin: 0 }}>검정고시</h3>
        <div className="row" style={{ gap: 4 }}>
          {LEVELS.map(l => (
            <label key={l} className="check small"><input type="checkbox" checked={(s.gedLevels || []).includes(l)}
              onChange={e => hub.updateStudent(s.id, { gedLevels: e.target.checked ? [...(s.gedLevels || []), l] : (s.gedLevels || []).filter(x => x !== l) })} /> {l} 응시</label>
          ))}
        </div>
      </div>
      {levels.length === 0 && <p className="small muted" style={{ marginBottom: 0 }}>응시하는 검정고시를 체크하면 회차별 성적과 성적표를 남길 수 있습니다.</p>}
      {levels.map(level => {
        const list = exams.filter(e => e.level === level);
        const passed = list.some(e => e.status === '합격');
        return (
          <div key={level} className="ged-level">
            <div className="spread">
              <b>{level} 검정고시 {passed && <Badge tone="green">합격</Badge>}</b>
              <button className="btn sm" onClick={() => add(level)}>+ 응시 기록</button>
            </div>
            {list.length === 0 && <p className="tiny muted" style={{ margin: '4px 0 0' }}>기록 없음</p>}
            {list.map(g => <ExamRow key={g.id} g={g} open={open === g.id} onToggle={() => setOpen(open === g.id ? null : g.id)} />)}
          </div>
        );
      })}
    </div>
  );
}

function ExamRow({ g, open, onToggle }: { g: GedExam; open: boolean; onToggle: () => void }) {
  const hub = useHub();
  const up = (p: Partial<GedExam>) => hub.saveGed({ ...g, ...p });
  const avg = gedAverage(g);
  const [err, setErr] = useState('');
  const onFile = (f?: File) => {
    setErr('');
    if (!f) return;
    if (f.size > MAX_FILE) { setErr('1MB가 넘는 파일은 드라이브에 올리고 링크를 넣어 주세요'); return; }
    const rd = new FileReader();
    rd.onload = () => up({ reportFile: { name: f.name, type: f.type, dataUrl: String(rd.result) } });
    rd.readAsDataURL(f);
  };
  return (
    <div className="ged-exam">
      <button className="ged-head" onClick={onToggle}>
        <span>{g.round} · {g.date}</span>
        <span className="row" style={{ gap: 6 }}>
          {avg !== null && <span className="tiny muted">평균 {avg.toFixed(1)}</span>}
          {(g.reportUrl || g.reportFile) && <span className="tiny muted">성적표 ✓</span>}
          <Badge tone={TONE[g.status]}>{g.status}</Badge>
        </span>
      </button>
      {open && (
        <div className="stack" style={{ marginTop: 8 }}>
          <div className="grid g3">
            <label className="field">회차<input value={g.round} onChange={e => up({ round: e.target.value })} /></label>
            <label className="field">시험일<input type="date" value={g.date} onChange={e => up({ date: e.target.value })} /></label>
            <label className="field">결과<select value={g.status} onChange={e => up({ status: e.target.value as GedStatus })}>{STATUSES.map(x => <option key={x}>{x}</option>)}</select></label>
          </div>
          <div className="ged-scores">
            {GED_SUBJECTS[g.level].map(k => (
              <label key={k} className="field">{k}<input className="input score" inputMode="numeric" value={g.scores[k] || ''} onChange={e => up({ scores: { ...g.scores, [k]: e.target.value } })} /></label>
            ))}
          </div>
          <label className="field">선택 과목 이름<input value={g.electives || ''} onChange={e => up({ electives: e.target.value })} placeholder="예: 도덕, 미술" /></label>
          <div className="grid g2">
            <label className="field">성적표 링크 (드라이브)<input value={g.reportUrl || ''} onChange={e => up({ reportUrl: e.target.value })} placeholder="https://drive.google.com/…" /></label>
            <div className="field">성적표 파일 (1MB 이하)
              <div className="row">
                {g.reportFile ? <><a href={g.reportFile.dataUrl} download={g.reportFile.name} className="small">{g.reportFile.name}</a><button className="btn sm" onClick={() => up({ reportFile: undefined })}>빼기</button></>
                  : <input type="file" accept="image/*,application/pdf" onChange={e => onFile(e.target.files?.[0])} />}
              </div>
              {err && <span className="tiny" style={{ color: 'var(--red)' }}>{err}</span>}
            </div>
          </div>
          <p className="tiny muted" style={{ margin: 0 }}>합격 기준(평균·과목 합격)은 그해 시행 공고로 확인합니다.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn sm warn" onClick={() => { if (confirm('이 응시 기록을 지울까요?')) hub.removeGed(g.id); }}>지우기</button>
          </div>
        </div>
      )}
    </div>
  );
}
