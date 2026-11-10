'use client';
// 학사일정: 2027 학사일정 포스터(reference/calendar)와 같은 모양의 월별 목록. 줄을 눌러 바로 고친다.
import { useEffect, useRef, useState } from 'react';
import { LandscapePage, usePrintFit } from '@/components/usePrintFit';
import { useHub } from '@/lib/store';
import { fmtRange, type EventKind } from '@/lib/calendar';
import type { CalendarEvent } from '@/lib/types';
import { ArtLink } from '@/components/ui';

const KINDS: EventKind[] = ['학사', '방학', '휴일', '행사', '검정고시', '상담'];
const THEMES = [
  { id: 'green', name: '2027 기본 (초록)', desc: '지금 쓰는 2027학년도 학사일정 디자인' },
  { id: 'wave', name: '포스터판 (파랑)', desc: '왼쪽에 표어 영역이 있는 2027 포스터판' },
  { id: 'mono', name: '흑백 인쇄용', desc: '게시판·가정통신문에 붙이기 좋은 흑백 목록' },
];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const red = (k: EventKind) => k === '휴일' || k === '방학';

export default function CalendarPage() {
  const hub = useHub();
  const list = hub.calendar;
  const theme = hub.calendarTheme || 'green';
  const [editId, setEditId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  // 학년도: 데이터가 있는 해는 편집 목록, 원본 이미지만 있는 해는 이미지로 (자료가 없는 해는 뺀다)
  const dataYears = [...new Set(list.map(e => Number(e.start.slice(0, 4))))];
  const [images, setImages] = useState<{ year: number; image?: string; pdf?: string }[]>([]);
  useEffect(() => { fetch('/api/calendar-archive').then(r => r.json()).then(j => setImages(j.years || [])).catch(() => {}); }, []);
  const years = [...new Set([...dataYears, ...images.map(i => i.year)])].sort((a, b) => b - a);
  const [year, setYear] = useState(2027);
  const nextYear = Math.max(...dataYears, 2027) + 1;
  const img = !dataYears.includes(year) ? images.find(i => i.year === year) : undefined;
  const startNext = () => {
    const prev = Math.max(...dataYears);
    if (!confirm(`${prev}학년도 일정을 복사해 ${prev + 1}학년도를 시작할까요? 요일이 바뀌니 날짜를 꼭 확인하세요.`)) return;
    const shift = (d?: string) => (d ? `${Number(d.slice(0, 4)) + 1}${d.slice(4)}` : undefined);
    const copy = list.filter(e => e.start.startsWith(String(prev))).map(e => ({ ...e, id: hub.newId('ev'), start: shift(e.start)!, end: shift(e.end) }));
    commit([...list, ...copy]);
    setYear(prev + 1);
  };
  const sheetRef = useRef<HTMLDivElement>(null);
  usePrintFit(sheetRef, { onBefore: () => setEditId(null) });
  const [past, setPast] = useState<CalendarEvent[][]>([]);
  const [future, setFuture] = useState<CalendarEvent[][]>([]);
  const commit = (next: CalendarEvent[]) => { setPast(p => [...p.slice(-49), list]); setFuture([]); hub.setCalendar(next); };
  const undo = () => { const p = past[past.length - 1]; if (!p) return; setPast(past.slice(0, -1)); setFuture(f => [list, ...f]); hub.setCalendar(p); };
  const redo = () => { const n = future[0]; if (!n) return; setFuture(future.slice(1)); setPast(p => [...p, list]); hub.setCalendar(n); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'Escape') setEditId(null);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const up = (id: string, p: Partial<CalendarEvent>) => commit(list.map(e => (e.id === id ? { ...e, ...p } : e)));
  const add = (m: number) => {
    const e: CalendarEvent = { id: hub.newId('ev'), start: `${year}-${String(m).padStart(2, '0')}-01`, title: '새 일정', kind: '행사' };
    commit([...list, e]); setEditId(e.id);
  };
  const ofMonth = (m: number) => list.filter(e => Number(e.start.slice(5, 7)) === m && e.start.startsWith(String(year))).sort((a, b) => a.start.localeCompare(b.start));
  const half = (ms: number[]) => ms.map(m => (
    <div key={m} className="cal-row">
      <div className="cal-m">{m}월</div>
      <ul className="cal-ev">
        {ofMonth(m).map(e => (
          <li key={e.id} className={`cal-line${red(e.kind) ? ' holiday' : ''}${editId === e.id ? ' editing' : ''}`} onClick={() => setEditId(editId === e.id ? null : e.id)} title="눌러서 고치기">
            <span className="d">{fmtRange(e)}</span>
            <span className="t">{e.title}{e.note && <em> ({e.note})</em>}</span>
            {editId === e.id && (
              <div className="cal-pop no-print" onClick={x => x.stopPropagation()}>
                <div className="cal-pop-row">
                  <label>날짜<input type="date" value={e.start} onChange={x => up(e.id, { start: x.target.value })} /></label>
                  <label>끝<input type="date" value={e.end || ''} onChange={x => up(e.id, { end: x.target.value || undefined })} /></label>
                  <label>구분<select value={e.kind} onChange={x => up(e.id, { kind: x.target.value as EventKind })}>{KINDS.map(k => <option key={k}>{k}</option>)}</select></label>
                </div>
                <label>일정<input value={e.title} onChange={x => up(e.id, { title: x.target.value })} autoFocus /></label>
                <label>비고<input value={e.note || ''} onChange={x => up(e.id, { note: x.target.value || undefined })} placeholder="귀가, 해당 학생 등" /></label>
                <div className="cal-pop-actions">
                  <button className="btn sm warn" onClick={() => { commit(list.filter(x => x.id !== e.id)); setEditId(null); }}>삭제</button>
                  <button className="btn sm primary" onClick={() => setEditId(null)}>완료</button>
                </div>
              </div>
            )}
          </li>
        ))}
        <li className="cal-add no-print"><button onClick={() => add(m)}>+ 일정</button></li>
      </ul>
    </div>
  ));

  return (
    <div className="page wide print-solo">
      <LandscapePage />
      <div className="spread no-print" style={{ marginBottom: 12 }}>
        <div className="row">
          <label className="year-pick" title="이전 학년도 내역을 고릅니다">
            <select value={year} onChange={e => { setYear(Number(e.target.value)); setEditId(null); }} aria-label="학년도">
              {years.map(y => <option key={y} value={y}>{y}학년도{!dataYears.includes(y) ? ' · 지난 원본' : ''}</option>)}
            </select>
          </label>
          <button className="btn sm" onClick={startNext} title="작년 일정을 복사해 새 학년도 시작">+ {nextYear}학년도</button>
          <span className="small muted">{img ? '지난 학년도 원본 (보기만)' : '줄을 누르면 고칩니다 · 빨간 글씨는 휴일·방학'} <ArtLink no={24} /> <ArtLink no={27} /></span>
        </div>
        <div className="row">
          <span className="xl-tools"><button onClick={undo} disabled={!past.length} title="되돌리기 (⌘Z)">↶</button><button onClick={redo} disabled={!future.length} title="다시 실행 (⌘⇧Z)">↷</button></span>
          <button className="btn" disabled title="나중에 공공데이터포털 특일 정보(한국천문연구원) API로 공휴일·대체공휴일을 불러옵니다">공휴일 불러오기 (준비 중)</button>
          {!img && <button className="btn" onClick={() => setPicking(true)}>디자인 변경</button>}
          <button className="btn primary" onClick={() => window.print()}>인쇄</button>
        </div>
      </div>

      {img ? (
        <div className="print-target"><div ref={sheetRef} className="cal-archive print-sheet">
          <img src={img.image} alt={`${year}학년도 학사일정`} />
          {img.pdf && <a className="small no-print" href={img.pdf} target="_blank" rel="noreferrer">원본 PDF 열기 ↗</a>}
        </div></div>
      ) : (
      <div className="print-target"><div ref={sheetRef} className={`cal-poster print-sheet theme-${theme}`}>
        {theme === 'wave' && <div className="cal-side"><img src="/hils-logo.png" alt="" /><p>하나님의 임재와 영광을<br />운반하게 하소서!</p></div>}
        <div className="cal-main">
          <div className="cal-title"><img src="/hils-logo.png" alt="" /><h1>HILS {year}학년도 학사일정</h1></div>
          <div className="cal-cols">
            <div>{half(MONTHS.slice(0, 6))}</div>
            <div>{half(MONTHS.slice(6))}</div>
          </div>
        </div>
      </div></div>
      )}

      {picking && (
        <div className="modal-bg no-print" onClick={() => setPicking(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>디자인 제안</h2>
            <p className="small muted" style={{ marginTop: 0 }}>일정 내용은 그대로 두고 모양만 바꿉니다.</p>
            <div className="stack">
              {THEMES.map(t => (
                <label key={t.id} className={`choice-card${theme === t.id ? ' on' : ''}`} style={{ minWidth: 0 }}>
                  <input type="radio" checked={theme === t.id} onChange={() => hub.setCalendar(list, t.id)} />
                  <b>{t.name}</b><span className="tiny muted">{t.desc}</span>
                </label>
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}><button className="btn primary" onClick={() => setPicking(false)}>닫기</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
