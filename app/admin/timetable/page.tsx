'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useHub } from '@/lib/store';
import { DEFAULT_CONDITIONS, generateTimetable, type TimetableConditions } from '@/lib/generators';
import { DAY_NAMES, checkRules, dur, fromGenerated, fromMin, groupPresets, layoutDay, newBlock, toMin, type Issue } from '@/lib/timetable';
import type { TimetableBlock } from '@/lib/types';
import { PageHead, ArtLink, Badge } from '@/components/ui';
import PosterHeader from '@/components/PosterHeader';
import ArchiveBar from '@/components/ArchiveBar';
import { DEMO_TODAY, quarterOf } from '@/lib/rules';
import { LandscapePage, usePrintFit } from '@/components/usePrintFit';

const SCREEN_PPM = 1.1; // 화면: 1분당 px
const SNAP = 5;
const SUBJECT_CLS: Record<string, string> = { 영어: 'c-en', 수학: 'c-ma', '예배자 학교': 'c-wo', '사고력·독서': 'c-rd', 기초교과: 'c-ba', 프로젝트: 'c-pj', 점심: 'c-fx', '고정 일과': 'c-fx' };

interface Drag { id: string; mode: 'move' | 'resize'; x: number; y: number; day: number; start: number; end: number; moved: boolean }

export default function TimetablePage() {
  const hub = useHub();
  const blocks = hub.timetable;
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState('전체');
  const [days, setDays] = useState(5);
  const [evening, setEvening] = useState(false);
  const [gen, setGen] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [ghost, setGhost] = useState<{ day: number; start: number; end: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const presets = useMemo(() => groupPresets(hub.students), [hub.students]);
  // 보기: 전체 / 반·레벨 / 학생(공통 또는 개인 시간표) / 교사
  const viewPreset = presets.find(p => p.name === view);
  const viewTeacher = view.startsWith('t:') ? view.slice(2) : null;
  const viewStudent = view.startsWith('s:') ? view.slice(2) : null;
  const student = viewStudent ? hub.students.find(s => s.id === viewStudent) : undefined;
  const personal = !!viewStudent && blocks.some(b => b.owner === viewStudent);
  const locked = personal && student?.personalTimetable === '고정';
  const scope = personal ? blocks.filter(b => b.owner === viewStudent) : blocks.filter(b => !b.owner);
  const issues = useMemo(() => checkRules(scope, hub.students, hub.teachers), [scope, hub.students, hub.teachers]);
  const issueOf = (id: string) => issues.filter(i => i.id === id);
  const visible = scope.filter(b => b.day < days && (view === '전체' || personal ? true
    : viewStudent ? b.students.includes(viewStudent)
    : viewTeacher ? b.teacher === viewTeacher
    : !!viewPreset && b.students.some(id => viewPreset.students.includes(id))));
  const [printing, setPrinting] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  // 인쇄할 때는 수업이 있는 시간만 잘라 그리고, 그 크기를 A4 가로 한 장에 맞춘다
  usePrintFit(sheetRef, { onBefore: () => flushSync(() => setPrinting(true)), onAfter: () => setPrinting(false) });
  const shown = visible;
  const fitStart = shown.length ? Math.floor(Math.min(...shown.map(b => toMin(b.start))) / 60) * 60 : toMin('08:00');
  const fitEnd = shown.length ? Math.ceil(Math.max(...shown.map(b => toMin(b.end))) / 60) * 60 : toMin('18:00');
  const startMin = printing ? fitStart : toMin('08:00');
  const endMin = printing ? fitEnd : toMin(evening ? '24:00' : '18:30');
  const PPM = SCREEN_PPM;
  const height = (endMin - startMin) * PPM;

  // 개인 시간표: 공통 시간표에서 이 학생 수업을 복사해 따로 고치고, 고정하면 잠근다
  const makePersonal = () => {
    if (!student) return;
    const mine = blocks.filter(b => !b.owner && b.students.includes(student.id)).map(b => ({ ...b, id: newBlock(0, '09:00', presets[0]).id, owner: student.id }));
    commit([...blocks, ...mine]);
    hub.updateStudent(student.id, { personalTimetable: '편집 중' });
  };
  const dropPersonal = () => {
    if (!student || !confirm(`${student.name} 개인 시간표를 지울까요? 공통 시간표는 그대로입니다.`)) return;
    commit(blocks.filter(b => b.owner !== student.id));
    hub.updateStudent(student.id, { personalTimetable: undefined });
  };
  // 되돌리기: 모든 변경을 commit으로 하고 이전 상태를 쌓는다
  const [past, setPast] = useState<TimetableBlock[][]>([]);
  const [future, setFuture] = useState<TimetableBlock[][]>([]);
  const commit = (next: TimetableBlock[]) => { setPast(p => [...p.slice(-49), blocks]); setFuture([]); hub.setTimetable(next); };
  const undo = () => { const prev = past[past.length - 1]; if (!prev) return; setPast(past.slice(0, -1)); setFuture(f => [blocks, ...f]); hub.setTimetable(prev); };
  const redo = () => { const next = future[0]; if (!next) return; setFuture(future.slice(1)); setPast(p => [...p, blocks]); hub.setTimetable(next); };
  const update = (id: string, patch: Partial<TimetableBlock>) => commit(blocks.map(b => (b.id === id ? { ...b, ...patch } : b)));
  const remove = (id: string) => { commit(blocks.filter(b => b.id !== id)); setSel(null); };
  const clip = useRef<TimetableBlock | null>(null);
  const [slot, setSlot] = useState<{ day: number; min: number } | null>(null); // 빈 곳을 누른 자리 (붙여넣을 곳)
  const [note, setNote] = useState('');
  const paste = () => {
    const c = clip.current;
    if (!c) return;
    const len = dur(c);
    const at = slot || { day: Math.min(days - 1, c.day + 1), min: toMin(c.start) };
    if (locked) return;
    const b = { ...c, id: newBlock(0, '09:00', presets[0]).id, day: at.day, start: fromMin(at.min), end: fromMin(at.min + len), owner: personal ? student!.id : undefined };
    commit([...blocks, b]);
    setSel(b.id); setSlot(null);
    setNote(`${DAY_NAMES[b.day]} ${b.start}에 붙여넣었습니다`);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && k === 'y') { e.preventDefault(); redo(); }
      else if (mod && k === 'c' && sel) { const b = blocks.find(x => x.id === sel); if (b) { clip.current = b; setNote(`${b.subject} 블록을 복사했습니다. 빈 곳을 누르고 ⌘V로 붙여넣습니다`); } }
      else if (mod && k === 'v') { e.preventDefault(); paste(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !locked) { e.preventDefault(); remove(sel); }
      else if (e.key === 'Escape') { setSel(null); setSlot(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => { if (note) { const t = setTimeout(() => setNote(''), 2500); return () => clearTimeout(t); } }, [note]);
  const cur = blocks.find(b => b.id === sel);

  // 끌어서 옮기기·늘리기
  useEffect(() => {
    if (!drag) return;
    const colW = () => { const g = gridRef.current; return g ? (g.getBoundingClientRect().width - 56) / days : 100; };
    const snap = (m: number) => Math.round(m / SNAP) * SNAP;
    const move = (e: PointerEvent) => {
      const dy = (e.clientY - drag.y) / PPM, dx = e.clientX - drag.x;
      if (Math.abs(dx) + Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
      if (drag.mode === 'move') {
        const dd = Math.max(-drag.day, Math.min(days - 1 - drag.day, Math.round(dx / colW())));
        const len = drag.end - drag.start;
        const s = Math.max(startMin, Math.min(endMin - len, snap(drag.start + dy)));
        setGhost({ day: drag.day + dd, start: s, end: s + len });
      } else {
        setGhost({ day: drag.day, start: drag.start, end: Math.max(drag.start + 15, Math.min(endMin, snap(drag.end + dy))) });
      }
    };
    const up = () => {
      if (drag.moved && ghost) update(drag.id, { day: ghost.day, start: fromMin(ghost.start), end: fromMin(ghost.end) });
      else setSel(drag.id);
      setDrag(null); setGhost(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  });

  const begin = (e: React.PointerEvent, b: TimetableBlock, mode: Drag['mode']) => {
    e.stopPropagation(); e.preventDefault();
    if (locked) { setSel(b.id); return; } // 고정한 개인 시간표는 보기만
    setDrag({ id: b.id, mode, x: e.clientX, y: e.clientY, day: b.day, start: toMin(b.start), end: toMin(b.end), moved: false });
    setGhost({ day: b.day, start: toMin(b.start), end: toMin(b.end) });
  };
  const addAt = (day: number, e: React.MouseEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const m = Math.round((startMin + y / PPM) / 15) * 15;
    if (locked) return;
    const g = student ? { name: student.name, students: [student.id] } : viewPreset || presets[0];
    const b = { ...newBlock(day, fromMin(m), g), ...(personal ? { owner: student!.id } : {}) };
    commit([...blocks, b]);
    setSel(b.id);
  };

  const hours = Array.from({ length: Math.floor((endMin - startMin) / 60) + 1 }, (_, i) => startMin + i * 60);

  return (
    <div className="page wide print-solo">
      <LandscapePage />
      <PageHead
        title="시간표"
        desc={<>학칙 기준(75분 블록, 휴식 15분, 별표 5 시간)으로 자동 생성한 뒤 직접 고칩니다. 학칙과 다르게 고칠 수 있지만 권장하지 않으며, 다른 곳은 오른쪽 검사에 표시됩니다 <ArtLink no={26} /> <Link className="chip" href="/hakchik#bp5">별표 5</Link></>}
        right={<>
          <ArchiveBar kind="timetable" year={Number(DEMO_TODAY.slice(0, 4))} label={`${DEMO_TODAY.slice(0, 4)}학년도 ${quarterOf(DEMO_TODAY)}쿼터 시간표`} current={blocks} onRestore={d => commit(d as TimetableBlock[])} />
          <button className="btn" onClick={() => window.print()}>인쇄</button>
          <button className="btn primary" onClick={() => setGen(true)}>학칙 기준으로 자동 생성</button>
        </>}
      />

      <div className="card tt-bar no-print">
        <label className="field" style={{ minWidth: 200 }}>보기
          <select value={view} onChange={e => { setView(e.target.value); setSel(null); }}>
            <option value="전체">전체</option>
            <optgroup label="반 · 레벨">{presets.filter(p => p.name !== '전체' && p.students.length > 1).map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</optgroup>
            <optgroup label="학생 (개인 시간표)">{hub.students.filter(s => s.status === '재학').sort((a, b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={`s:${s.id}`}>{s.name}{blocks.some(b => b.owner === s.id) ? ` · 개인${s.personalTimetable === '고정' ? '(고정)' : ''}` : ''}</option>)}</optgroup>
            <optgroup label="교사">{hub.teachers.map(t => <option key={t.id} value={`t:${t.id}`}>{t.name}</option>)}</optgroup>
          </select>
        </label>
        {student && (
          <div className="row personal-bar">
            {personal ? <>
              <Badge tone={locked ? 'deep' : 'gold'}>개인 시간표 · {locked ? '고정' : '편집 중'}</Badge>
              <button className="btn sm" onClick={() => hub.updateStudent(student.id, { personalTimetable: locked ? '편집 중' : '고정' })}>{locked ? '수정' : '고정'}</button>
              <button className="btn sm warn" onClick={dropPersonal}>삭제</button>
            </> : <button className="btn sm primary" onClick={makePersonal}>개인 시간표 만들기</button>}
          </div>
        )}
        <div className="seg">{[5, 6, 7].map(n => <button key={n} className={days === n ? 'on' : ''} onClick={() => setDays(n)}>월–{DAY_NAMES[n - 1]}</button>)}</div>
        <label className="check small"><input type="checkbox" checked={evening} onChange={e => setEvening(e.target.checked)} /> 저녁 시간까지 (야간 자율학습)</label>
        <span className="xl-tools" style={{ marginLeft: 'auto' }}>
          <button onClick={undo} disabled={!past.length} title="되돌리기 (⌘/Ctrl+Z)">↶</button>
          <button onClick={redo} disabled={!future.length} title="다시 실행 (⌘/Ctrl+Shift+Z)">↷</button>
        </span>
        <span className="tiny muted">{note || '더블클릭: 새 블록 · 끌기: 옮기기 · 아래 끝: 시간 · ⌘C·⌘V 복사·붙여넣기 · Delete 삭제'}</span>
      </div>

      {blocks.length === 0 ? (
        <div className="card empty-cta">
          <h3>아직 시간표가 없습니다</h3>
          <p className="small muted">학생 명단의 학교급·레벨과 교사 과목으로 학칙에 맞는 시간표를 먼저 만들고, 필요한 곳만 고치세요.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => setGen(true)}>학칙 기준으로 자동 생성</button>
            <button className="btn" onClick={() => { const b = newBlock(0, '09:00', presets[0]); commit([b]); setSel(b.id); }}>빈 시간표에서 시작</button>
          </div>
        </div>
      ) : (
        <div className="tt-layout print-target">
          <div ref={sheetRef} className={`card tt-card poster print-sheet${printing ? ' printing' : ''}`}>
            <PosterHeader name={`${view === '전체' ? '전체' : viewTeacher ? `${hub.teacherName(viewTeacher)} 선생님` : student ? student.name : view} 일과 스케줄표`} sub="HILS DAILY TIMETABLE" />
            <div className="tt-head" style={{ gridTemplateColumns: `56px repeat(${days}, minmax(0, 1fr))` }}>
              <div />{DAY_NAMES.slice(0, days).map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="tt-grid" ref={gridRef} style={{ gridTemplateColumns: `56px repeat(${days}, minmax(0, 1fr))`, height }}>
              <div className="tt-axis">
                {hours.map(h => <div key={h} style={{ top: (h - startMin) * PPM }}>{fromMin(h)}</div>)}
              </div>
              {Array.from({ length: days }, (_, d) => {
                const dayBlocks = visible.filter(b => b.day === d && toMin(b.end) > startMin && toMin(b.start) < endMin);
                const pos = layoutDay(dayBlocks);
                return (
                  <div key={d} className="tt-col" onDoubleClick={e => addAt(d, e)}
                    onClick={e => { if (e.target !== e.currentTarget) return; const y = e.clientY - e.currentTarget.getBoundingClientRect().top; setSlot({ day: d, min: Math.round((startMin + y / PPM) / 15) * 15 }); setSel(null); }}>
                    {slot && slot.day === d && <div className="tt-slot" style={{ top: (slot.min - startMin) * PPM }} />}
                    {hours.map(h => <div key={h} className="tt-line" style={{ top: (h - startMin) * PPM }} />)}
                    {dayBlocks.map(b => {
                      const p = pos.get(b.id)!;
                      const g = drag?.id === b.id && ghost ? ghost : null;
                      if (g && g.day !== d) return null;
                      const s = g ? g.start : toMin(b.start), e = g ? g.end : toMin(b.end);
                      const bad = issueOf(b.id);
                      return (
                        <div key={b.id}
                          className={`tt-block ${SUBJECT_CLS[b.subject] || 'c-etc'}${sel === b.id ? ' sel' : ''}${bad.some(i => i.level === '겹침') ? ' conflict' : bad.length ? ' warn' : ''}${g ? ' dragging' : ''}`}
                          style={{ top: (s - startMin) * PPM, height: Math.max(18, (e - s) * PPM - 2), left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`, width: `calc(${100 / p.lanes}% - 4px)` }}
                          onPointerDown={ev => begin(ev, b, 'move')}
                          onDoubleClick={ev => ev.stopPropagation()}
                          title={`${b.subject} · ${b.group}${bad.length ? `\n⚠ ${bad.map(i => i.text).join('\n⚠ ')}` : ''}`}>
                          <b>{b.subject}</b>
                          <span>{fromMin(s)}–{fromMin(e)}</span>
                          {(e - s) >= 45 && <span className="who">{b.group}{b.teacher ? ` · ${hub.teacherName(b.teacher)}` : ''}</span>}
                          <i className="tt-resize" onPointerDown={ev => begin(ev, b, 'resize')} />
                        </div>
                      );
                    })}
                    {drag && ghost && ghost.day === d && !dayBlocks.some(b => b.id === drag.id) && (
                      <div className="tt-block dragging c-etc" style={{ top: (ghost.start - startMin) * PPM, height: (ghost.end - ghost.start) * PPM - 2, left: 2, right: 2 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="tt-side no-print">
            {cur && locked ? <div className="card stack"><h3 style={{ margin: 0 }}>{cur.subject}</h3><p className="small muted" style={{ margin: 0 }}>{DAY_NAMES[cur.day]} {cur.start}–{cur.end} · {cur.group}</p><p className="small" style={{ margin: 0 }}>고정한 개인 시간표입니다. 고치려면 위에서 '수정'을 누르세요.</p></div>
              : cur ? <BlockEditor b={cur} presets={presets} issues={issueOf(cur.id)} onChange={p => update(cur.id, p)} onRemove={() => remove(cur.id)}
              onCopy={() => { const c = { ...cur, id: newBlock(0, '09:00', presets[0]).id }; commit([...blocks, c]); setSel(c.id); }} onClose={() => setSel(null)} />
              : <Checks issues={issues} blocks={blocks} onPick={setSel} />}
          </aside>
        </div>
      )}

      {gen && <Generate onClose={() => setGen(false)} hasBlocks={blocks.length > 0} onApply={commit} />}
    </div>
  );
}

function BlockEditor({ b, presets, issues, onChange, onRemove, onCopy, onClose }: {
  b: TimetableBlock; presets: { name: string; students: string[] }[]; issues: Issue[];
  onChange: (p: Partial<TimetableBlock>) => void; onRemove: () => void; onCopy: () => void; onClose: () => void;
}) {
  const hub = useHub();
  const m = dur(b);
  return (
    <div className="card stack">
      <div className="spread"><h3 style={{ margin: 0 }}>블록 편집</h3><button className="btn sm" onClick={onClose}>닫기</button></div>
      <label className="field">과목 · 활동<input value={b.subject} onChange={e => onChange({ subject: e.target.value })} list="subjects" /></label>
      <datalist id="subjects">{['영어', '수학', '사고력·독서', '기초교과', '예배자 학교', '프로젝트', '자습', '체력단련', '검정고시', '고정 일과', '점심'].map(x => <option key={x} value={x} />)}</datalist>
      <label className="field">대상
        <select value={presets.some(p => p.name === b.group) ? b.group : ''} onChange={e => { const p = presets.find(x => x.name === e.target.value); if (p) onChange({ group: p.name, students: p.students }); }}>
          {!presets.some(p => p.name === b.group) && <option value="">{b.group}</option>}
          {presets.map(p => <option key={p.name} value={p.name}>{p.name} ({p.students.length}명)</option>)}
        </select>
      </label>
      <label className="field">교사
        <select value={b.teacher || ''} onChange={e => onChange({ teacher: e.target.value || undefined })}>
          <option value="">없음</option>{hub.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <div className="grid g3">
        <label className="field">요일<select value={b.day} onChange={e => onChange({ day: Number(e.target.value) })}>{DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
        <label className="field">시작<input type="time" step={300} value={b.start} onChange={e => e.target.value && onChange({ start: e.target.value })} /></label>
        <label className="field">끝<input type="time" step={300} value={b.end} onChange={e => e.target.value && onChange({ end: e.target.value })} /></label>
      </div>
      <div className="row">
        <span className="small muted">{m}분</span>
        {m !== 75 && <button className="btn sm" onClick={() => onChange({ end: fromMin(toMin(b.start) + 75) })}>75분으로 맞추기</button>}
      </div>
      <label className="field">장소<input value={b.room || ''} onChange={e => onChange({ room: e.target.value })} placeholder="예: 2층 러닝센터" /></label>
      <label className="field">메모<input value={b.note || ''} onChange={e => onChange({ note: e.target.value })} /></label>
      <label className="check small"><input type="checkbox" checked={!!b.fixed} onChange={e => onChange({ fixed: e.target.checked })} /> 고정 일과 (학칙 검사에서 뺌)</label>
      {issues.map((i, k) => <div key={k} className={`callout small ${i.level === '겹침' ? 'red' : 'gold'}`}>{i.text}</div>)}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn sm" onClick={onCopy}>복제</button>
        <button className="btn sm warn" onClick={onRemove}>삭제</button>
      </div>
    </div>
  );
}

function Checks({ issues, blocks, onPick }: { issues: Issue[]; blocks: TimetableBlock[]; onPick: (id: string) => void }) {
  const conflicts = issues.filter(i => i.level === '겹침');
  const rules = issues.filter(i => i.level === '학칙');
  const lessons = blocks.filter(b => !b.fixed);
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>학칙 검사</h3>
      <div className="row">
        <Badge tone={conflicts.length ? 'red' : 'green'}>겹침 {conflicts.length}</Badge>
        <Badge tone={rules.length ? 'gold' : 'green'}>학칙과 다름 {rules.length}</Badge>
        <Badge tone="line">수업 {lessons.length}블록</Badge>
      </div>
      {issues.length === 0 && <p className="small muted">학칙 기준에 맞습니다.</p>}
      <ul className="issue-list">
        {[...conflicts, ...rules].slice(0, 40).map((i, k) => (
          <li key={k}><button className={i.level === '겹침' ? 'red' : ''} onClick={() => onPick(i.id)}>{i.text}</button></li>
        ))}
      </ul>
      <p className="tiny muted" style={{ margin: 0 }}>학칙: 블록 75분, 블록 사이 휴식 15분, 오전 09:00–12:00, 오후 13:30–18:00 (초등 15:00). 블록을 누르면 편집합니다.</p>
    </div>
  );
}

function Generate({ onClose, hasBlocks, onApply }: { onClose: () => void; hasBlocks: boolean; onApply: (b: TimetableBlock[]) => void }) {
  const hub = useHub();
  const [c, setC] = useState<TimetableConditions>(DEFAULT_CONDITIONS);
  const [seed, setSeed] = useState(0);
  const res = useMemo(() => generateTimetable(hub.students, hub.teachers, c, seed), [hub.students, hub.teachers, c, seed]);
  const num = (k: keyof TimetableConditions, label: string) => (
    <label className="field">{label}<input type="number" min={0} max={8} value={c[k] as number} onChange={e => setC({ ...c, [k]: Number(e.target.value) })} /></label>
  );
  const apply = () => {
    if (hasBlocks && !confirm('지금 시간표를 지우고 새로 만들까요? (⌘Z로 되돌릴 수 있습니다)')) return;
    onApply(fromGenerated(res, hub.students));
    onClose();
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>학칙 기준으로 자동 생성</h2>
        <p className="small muted" style={{ marginTop: 0 }}>학교급·레벨(별표 7)과 교사 과목으로 75분 블록을 배치하고, 교사가 겹치지 않게 합니다.</p>
        <div className="stack">
          <div className="seg">{(['집중학습', '프로젝트'] as const).map(q => <button key={q} className={c.quarterType === q ? 'on' : ''} onClick={() => setC({ ...c, quarterType: q })}>{q} 쿼터</button>)}</div>
          <div className="tiny muted">중고등 · 주당 블록</div>
          <div className="grid g4">{num('english', '영어 (레벨별)')}{num('math', '수학 (레벨별)')}{num('reading', '사고력·독서')}{num('basics', '기초교과')}</div>
          <div className="tiny muted">초등 · 주당 블록</div>
          <div className="grid g4">{num('elemEnglish', '영어')}{num('elemMath', '수학')}{num('elemReading', '사고력·독서')}{num('minGroup', '레벨 최소 인원')}</div>
          {res.warnings.slice(0, 5).map(w => <div key={w} className="callout gold small">{w}</div>)}
          <div className="small muted">수업 {res.lessons.length}블록 · 레벨 그룹 {res.groups.filter(g => g.lane === '영어 레벨' || g.lane === '수학 레벨').length}개</div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <button className="btn" onClick={() => setSeed(seed + 1)}>다른 배치</button>
          <div className="row"><button className="btn" onClick={onClose}>취소</button><button className="btn primary" onClick={apply}>이대로 만들기</button></div>
        </div>
      </div>
    </div>
  );
}
