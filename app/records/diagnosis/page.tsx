'use client';
// 진단평가 (제20조, 제25조 제2항, 별표 7 제4호): 문해력·영어·수학. 입학 첫 주와 매년 1쿼터 첫 주(정기)에 보고,
// 그 밖에는 학생이 쿼터별 담임 정기 면담에서 신청하고 담임이 시행을 정하면 추가로 본다 (학기마다 1회까지).
// 회차별로 문항지와 결과를 학년도별로 보관하고, 판정 레벨을 학생 레벨에 반영한다.
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useHub } from '@/lib/store';
import { DEMO_TODAY, gradeLabel } from '@/lib/rules';
import { DIAG_GUIDE, DIAG_ROUNDS, DIAG_SUBJECTS, ROUND_LABEL, currentOf, extraThisSemester, lastResult, newExam, semesterLabel } from '@/lib/diagnosis';
import { deleteFile, openFile, putFile } from '@/lib/fileStore';
import type { DiagRound, DiagSubject, DiagnosticExam, Student } from '@/lib/types';
import { ArtLink, Badge, PageHead } from '@/components/ui';
import CellInput from '@/components/CellInput';

type Tab = '진단평가 기록' | '학생별 이력' | '운영 기준';
const TONE: Record<DiagSubject, 'green' | 'gold' | 'deep'> = { 문해력: 'gold', 영어: 'green', 수학: 'deep' };

export default function DiagnosisPage() {
  const hub = useHub();
  const [tab, setTab] = useState<Tab>('진단평가 기록');
  const [openId, setOpenId] = useState<string | null>(null);
  const exam = hub.diagnostics.find(d => d.id === openId);
  if (exam) return <ExamSheet exam={exam} onBack={() => setOpenId(null)} />;
  return (
    <div className="page wide">
      <PageHead
        title="진단평가"
        desc={<>문해력·영어·수학. 입학 첫 주와 매년 1쿼터 첫 주에 봅니다. 레벨을 다시 편성받고 싶은 학생은 쿼터별 담임 면담에서 신청하고, 담임이 시행을 정하면 학기마다 한 번까지 추가로 봅니다. 배운 범위를 보는 단원평가(성적 입력)와 달리 학년 범위 전체에서 출발선과 빈 곳을 찾고, 결과로 레벨을 정합니다 <ArtLink no={20} /> <Link className="ref" href="/hakchik#bp7">별표 7</Link></>}
      />
      <div className="tabs">{(['진단평가 기록', '학생별 이력', '운영 기준'] as Tab[]).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === '진단평가 기록' && <Archive onOpen={setOpenId} />}
      {tab === '학생별 이력' && <History />}
      {tab === '운영 기준' && <Guide />}
    </div>
  );
}

function Archive({ onOpen }: { onOpen: (id: string) => void }) {
  const hub = useHub();
  const [subject, setSubject] = useState<DiagSubject>('영어');
  const [round, setRound] = useState<DiagRound>('정기');
  const [date, setDate] = useState(DEMO_TODAY);
  const years = [...new Set(hub.diagnostics.map(d => d.date.slice(0, 4)))].sort().reverse();
  const [year, setYear] = useState(years[0] || DEMO_TODAY.slice(0, 4));
  const list = hub.diagnostics.filter(d => d.date.startsWith(year)).sort((a, b) => b.date.localeCompare(a.date));

  const create = () => {
    const ids = round === '정기' ? hub.students.filter(s => s.status === '재학').map(s => s.id) : [];
    const d = newExam(hub.newId('dg'), subject, round, date, ids);
    d.teacher = hub.teachers.find(t => t.subjects?.some(x => (subject === '문해력' ? /국어|독서/ : new RegExp(subject)).test(x)))?.id || '';
    hub.saveDiagnostic(d);
    onOpen(d.id);
  };
  return (
    <div className="stack">
      <div className="card row">
        <b style={{ color: 'var(--deep)' }}>새 진단평가</b>
        <div className="seg">{DIAG_SUBJECTS.map(x => <button key={x} className={subject === x ? 'on' : ''} onClick={() => setSubject(x)}>{x}</button>)}</div>
        <select className="input" value={round} onChange={e => setRound(e.target.value as DiagRound)} aria-label="회차">{DIAG_ROUNDS.map(r => <option key={r} value={r}>{ROUND_LABEL[r]}</option>)}</select>
        <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="날짜" />
        <button className="btn primary" onClick={create}>만들기</button>
        <span className="tiny muted">정기는 재학생 전체가 들어가고, 추가·입학은 응시 학생을 골라 넣습니다.</span>
      </div>
      <div className="row">
        <div className="seg">{(years.length ? years : [year]).map(y => <button key={y} className={year === y ? 'on' : ''} onClick={() => setYear(y)}>{y}학년도</button>)}</div>
      </div>
      {list.length === 0 ? <div className="card muted">이 학년도의 진단평가가 없습니다.</div> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="t">
            <thead><tr><th>날짜</th><th>과목</th><th>진단평가</th><th>회차</th><th>담당</th><th>응시</th><th>판정</th><th>레벨 변화</th><th>문항지</th></tr></thead>
            <tbody>
              {list.map(d => {
                const judged = d.students.filter(id => d.results[id]?.level).length;
                const moved = d.subject === '문해력' ? 0 : d.students.filter(id => { const r = d.results[id]; const prev = lastResult(hub, id, d.subject, d.date); return r?.level && prev && prev.level !== r.level; }).length;
                return (
                  <tr key={d.id} className="clickable" onClick={() => onOpen(d.id)}>
                    <td>{d.date}</td>
                    <td><Badge tone={TONE[d.subject]}>{d.subject}</Badge></td>
                    <td><b>{d.title}</b> <span className="tiny muted">{d.form}</span></td>
                    <td className="small">{d.round}</td>
                    <td className="small">{hub.teacherName(d.teacher)}</td>
                    <td>{d.students.length}명</td>
                    <td>{judged}/{d.students.length}</td>
                    <td>{d.subject === '문해력' ? '-' : moved ? <Badge tone="gold">{moved}명</Badge> : <span className="tiny muted">없음</span>}</td>
                    <td className="small">{d.files.length ? `${d.files.length}개` : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ExamSheet({ exam: d, onBack }: { exam: DiagnosticExam; onBack: () => void }) {
  const hub = useHub();
  const g = DIAG_GUIDE[d.subject];
  const up = (p: Partial<DiagnosticExam>) => hub.saveDiagnostic({ ...d, ...p });
  const students = d.students.map(id => hub.students.find(s => s.id === id)).filter((s): s is Student => !!s).sort((a, b) => a.birthYear - b.birthYear || a.name.localeCompare(b.name));
  const others = hub.students.filter(s => s.status === '재학' && !d.students.includes(s.id));
  const setRes = (sid: string, p: Partial<DiagnosticExam['results'][string]>) =>
    up({ results: { ...d.results, [sid]: { ...(d.results[sid] || { scores: {}, level: '' }), ...p } } });
  const levelField = d.subject === '영어' ? 'enLevel' : d.subject === '수학' ? 'mathLevel' : null;
  /** 판정 레벨을 학생 레벨에 반영 (여러 명이면 결과를 한 번에 저장한다) */
  const apply = (list: Student[]) => {
    if (!levelField) return;
    const results = { ...d.results };
    for (const s of list) {
      const r = results[s.id];
      if (!r?.level) continue;
      const from = s[levelField] || '';
      if (from !== r.level) {
        hub.updateStudent(s.id, { [levelField]: r.level });
        hub.addRecord({ studentId: s.id, type: 'level', date: d.date, title: `${d.subject} 레벨 ${from || '없음'} → ${r.level} (진단평가)`, author: d.teacher, private: false, data: { subject: d.subject, from, to: r.level, exam: d.title } });
      }
      results[s.id] = { ...r, applied: true };
    }
    up({ results });
  };
  const pending = levelField ? students.filter(s => d.results[s.id]?.level && !d.results[s.id]?.applied) : [];
  // 추가 진단평가 (제20조 제3항): 그 쿼터의 담임 정기 면담(또는 학습 면담) 기록이 있는지, 같은 학기에 이미 봤는지
  const qOf = (x: string) => `${x.slice(0, 4)}-${Math.ceil(Number(x.slice(5, 7)) / 3)}`;
  const talked = (sid: string) => hub.records.some(r => r.studentId === sid && r.type === 'interview' && (r.data.kind === '정기' || r.data.kind === '학습') && r.date <= d.date && qOf(r.date) === qOf(d.date));
  const addFiles = async (fs: FileList | null) => {
    if (!fs) return;
    const added = [];
    for (const f of [...fs]) added.push({ id: await putFile(f), name: f.name });
    up({ files: [...d.files, ...added] });
  };

  return (
    <div className="page wide">
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn sm" onClick={onBack}>← 목록</button>
        <span style={{ flex: 1 }} />
        <button className="btn sm warn" onClick={async () => { if (!confirm(`'${d.title}'을(를) 지울까요? 결과도 함께 지워집니다.`)) return; for (const f of d.files) await deleteFile(f.id); hub.removeDiagnostic(d.id); onBack(); }}>지우기</button>
      </div>
      <div className="card">
        <div className="grid g3">
          <label className="field">진단평가<input value={d.title} onChange={e => up({ title: e.target.value })} /></label>
          <label className="field">날짜<input type="date" value={d.date} onChange={e => up({ date: e.target.value })} /></label>
          <label className="field">회차<select value={d.round} onChange={e => up({ round: e.target.value as DiagRound })}>{DIAG_ROUNDS.map(r => <option key={r} value={r}>{ROUND_LABEL[r]}</option>)}</select></label>
          <label className="field">장소<input value={d.place} onChange={e => up({ place: e.target.value })} /></label>
          <label className="field">담당 교사<select value={d.teacher} onChange={e => up({ teacher: e.target.value })}><option value="">선택</option>{hub.teachers.filter(t => t.role !== '학교장' && t.role !== '목사').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="field">문항지<select value={d.form} onChange={e => up({ form: e.target.value as DiagnosticExam['form'] })}><option>가형</option><option>나형</option></select></label>
        </div>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>방법: {g.method} · {g.time} · 결과: {g.result}</p>
        <div className="row" style={{ marginTop: 8 }}>
          <b className="small">문항지·정답</b>
          {d.files.map(f => (
            <span key={f.id} className="chip">
              <button className="linklike small" onClick={() => openFile(f.id, f.name)}>{f.name}</button>
              <button className="sr-del" title="빼기" onClick={async () => { await deleteFile(f.id); up({ files: d.files.filter(x => x.id !== f.id) }); }}>×</button>
            </span>
          ))}
          <label className="btn sm" style={{ cursor: 'pointer' }}>+ 파일 올리기<input type="file" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} /></label>
          <span className="tiny muted">정기와 추가 진단평가는 가형·나형을 나눠 씁니다 (별표 7 제4호 ③)</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, marginTop: 12, overflowX: 'auto' }}>
        <div className="spread" style={{ padding: '12px 16px' }}>
          <h3 style={{ margin: 0 }}>결과 {students.filter(s => d.results[s.id]?.level).length}/{students.length}명</h3>
          <div className="row">
            {others.length > 0 && (
              <select className="input compact" value="" onChange={e => e.target.value && up({ students: [...d.students, e.target.value] })} aria-label="응시 학생 추가">
                <option value="">+ 응시 학생</option>{others.map(s => <option key={s.id} value={s.id}>{s.name} ({s.classGroup})</option>)}
              </select>
            )}
            {pending.length > 0 && <button className="btn sm primary" onClick={() => apply(pending)}>판정 레벨 모두 반영 ({pending.length})</button>}
          </div>
        </div>
        <table className="t diag-table">
          <thead>
            <tr>
              <th>학생</th>{d.round === '추가' && <th title="제20조 제3항: 쿼터별 담임 정기 면담에서 신청, 담임이 시행 결정. 학기마다 1회까지">담임 면담 · 학기 1회</th>}<th>지금</th>
              {d.sections.map(x => <th key={x}>{x}</th>)}
              <th>판정</th>{d.subject === '수학' && <th>빈 단원</th>}<th>메모</th>{levelField && <th>반영</th>}<th />
            </tr>
          </thead>
          <tbody>
            {students.map(s => {
              const r = d.results[s.id] || { scores: {}, level: '' };
              const cur = currentOf(hub, s.id, d.subject);
              const changed = levelField && r.level && r.level !== (s[levelField] || '');
              return (
                <tr key={s.id}>
                  <td><Link href={`/students/${s.id}`}><b>{s.name}</b></Link><div className="tiny muted">{s.classGroup} · {gradeLabel(s.birthYear)}</div></td>
                  {d.round === '추가' && <td>
                    {talked(s.id) ? <Badge tone="green">면담 ✓</Badge> : <Link className="tiny" href="/records/interviews">면담 기록 필요</Link>}
                    {extraThisSemester(hub, s.id, d.subject, d.date, d.id) && <div><Badge tone="red">이번 학기 이미 응시</Badge></div>}
                  </td>}
                  <td className="small">{cur || '-'}</td>
                  {d.sections.map(x => <td key={x}><CellInput className="input compact score" value={r.scores[x] || ''} onChange={e => setRes(s.id, { scores: { ...r.scores, [x]: e.target.value }, applied: false })} aria-label={x} /></td>)}
                  <td>
                    <select className={`input compact${changed ? ' diag-moved' : ''}`} value={r.level} onChange={e => setRes(s.id, { level: e.target.value, applied: false })} aria-label="판정">
                      <option value="">-</option>{g.levels.map(l => <option key={l}>{l}</option>)}
                    </select>
                  </td>
                  {d.subject === '수학' && <td><CellInput className="input compact" value={r.gaps || ''} onChange={e => setRes(s.id, { gaps: e.target.value })} placeholder="예: 분수의 나눗셈" aria-label="빈 단원" /></td>}
                  <td><CellInput className="input compact" value={r.note || ''} onChange={e => setRes(s.id, { note: e.target.value })} aria-label="메모" /></td>
                  {levelField && <td>{r.applied ? <span className="tiny" style={{ color: 'var(--green)' }}>✓ 반영</span> : r.level ? <button className="btn sm" onClick={() => apply([s])}>{changed ? `${s[levelField] || '없음'} → ${r.level}` : '확인'}</button> : null}</td>}
                  <td><button className="sr-del" title="응시 학생에서 빼기" onClick={() => { const { [s.id]: _, ...rest } = d.results; void _; up({ students: d.students.filter(x => x !== s.id), results: rest }); }}>×</button></td>
                </tr>
              );
            })}
            {students.length === 0 && <tr><td colSpan={d.sections.length + 6} className="muted" style={{ textAlign: 'center', padding: 20 }}>응시 학생을 넣으세요{d.round === '추가' ? ' (정기 면담에서 신청하고 담임이 시행을 정한 학생, 제20조 제3항)' : ''}</td></tr>}
          </tbody>
        </table>
        <p className="tiny muted" style={{ padding: '8px 14px', margin: 0 }}>
          {levelField ? '판정 레벨을 반영하면 학생 레벨이 바뀌고 생활 기록에 레벨 이동이 남습니다. ' : '문해력은 4단계 판정을 남기고 레벨은 바꾸지 않습니다. '}
          진단평가 결과는 학습 진도 보고서의 평가 결과에 넣지 않습니다 (제20조 제4항). 쿼터 목표와 함께 그 주 안에 학생·학부모와 공유합니다.
        </p>
      </div>
    </div>
  );
}

function History() {
  const hub = useHub();
  const active = hub.students.filter(s => s.status === '재학').sort((a, b) => a.birthYear - b.birthYear || a.name.localeCompare(b.name));
  const [sid, setSid] = useState(active[0]?.id || '');
  const rows = useMemo(() => hub.diagnostics.filter(d => d.results[sid]).sort((a, b) => a.date.localeCompare(b.date)), [hub.diagnostics, sid]);
  const s = hub.students.find(x => x.id === sid);
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <select className="input" value={sid} onChange={e => setSid(e.target.value)} aria-label="학생">{active.map(x => <option key={x.id} value={x.id}>{x.name} ({x.classGroup})</option>)}</select>
        {s && <span className="small muted">지금 영어 {s.enLevel || '-'} · 수학 {s.mathLevel || '-'} · 문해력 {currentOf(hub, s.id, '문해력') || '-'}</span>}
      </div>
      <table className="t">
        <thead><tr><th>학기</th><th>날짜</th><th>과목</th><th>회차</th><th>영역별</th><th>판정</th><th>빈 단원·메모</th></tr></thead>
        <tbody>
          {rows.map(d => {
            const r = d.results[sid];
            return (
              <tr key={d.id}>
                <td className="small">{semesterLabel(d.date)}</td><td>{d.date}</td>
                <td><Badge tone={TONE[d.subject]}>{d.subject}</Badge></td><td className="small">{d.round}</td>
                <td className="tiny">{d.sections.map(x => `${x} ${r.scores[x] || '-'}`).join(' · ')}</td>
                <td><b>{r.level || '-'}</b></td><td className="small">{[r.gaps, r.note].filter(Boolean).join(' / ')}</td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>진단평가 기록이 없습니다</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Guide() {
  return (
    <div className="card">
      <h3>진단평가 운영 (별표 7 제4호, 초안)</h3>
      <table className="t">
        <thead><tr><th>진단평가</th><th>시기</th><th>방법</th><th>시간·장소</th><th>담당</th><th>결과</th></tr></thead>
        <tbody>
          {DIAG_SUBJECTS.map(k => {
            const g = DIAG_GUIDE[k];
            return <tr key={k}><td><b>{k}</b></td><td className="small">입학 첫 주, 매년 1쿼터 첫 주 (추가: 학생 신청 · 담임 결정, 학기마다 1회까지)</td><td className="small">{g.method}</td><td className="small">{g.time}<br />{g.place}</td><td className="small">{g.teacher}</td><td className="small">{g.result}</td></tr>;
          })}
        </tbody>
      </table>
      <ul className="small" style={{ lineHeight: 1.8 }}>
        <li>입학 첫 주(체험 입학 1주차)에 보고, 재학생은 원칙적으로 매년 1쿼터 첫 주에 모두 봅니다. 오전 블록에서 치르고 코어 수업을 하루 넘게 쓰지 않습니다.</li>
        <li>레벨을 다시 편성받고 싶은 학생은 쿼터마다 하는 담임 정기 면담에서 신청하고, 시행 여부는 담임이 정합니다. 학생 1인당 학기(6개월)마다 1회까지이며, 레벨 이동은 다음 쿼터 첫 주에 합니다 (제20조 제3항).</li>
        <li>정기와 추가 진단평가는 가형·나형을 나눠 쓰고, 문항지와 결과는 이 화면에 학년도별로 보관합니다.</li>
        <li>단원평가(배운 범위의 성취)는 성적 입력에, 진단평가(학년 범위 전체의 출발선)는 여기에 남깁니다.</li>
      </ul>
    </div>
  );
}
