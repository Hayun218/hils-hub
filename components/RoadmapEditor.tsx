'use client';
// 커리큘럼 설계: 로드맵 틀을 엑셀처럼 표에서 바로 고친다.
//   셀 끌기 → 범위 선택 → 입력(또는 Enter) → 병합 셀(항목) 만들기
//   항목 끌기 → 옮기기 / 오른쪽·아래 가장자리 끌기 → 범위 늘리기·줄이기
//   항목 더블클릭 → 이름 바꾸기 / 선택 후 × 또는 Delete → 지우기
//   열·행 머리글 오른쪽 클릭(또는 ▾) → 삽입·삭제·이름 바꾸기
//   Shift+클릭 → 범위 넓히기 / 범위 오른쪽 클릭 → 셀 병합 · 병합 해제 · 지우기
//   ⌘/Ctrl+Z 되돌리기, ⌘/Ctrl+Shift+Z·Ctrl+Y 다시 실행, ⌘/Ctrl+C·V 복사·붙여넣기
import { useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from 'react';
import type { RoadmapDef, RoadmapItem } from '@/lib/types';

type Rect = { r0: number; c0: number; r1: number; c1: number };
type Sel = { kind: 'item'; id: string } | ({ kind: 'range' } & Rect) | null;
type Drag = { mode: 'select' | 'move' | 'right' | 'bottom' | 'corner'; start: { r: number; c: number }; id?: string; base?: Rect; moved: boolean };
type Menu = { x: number; y: number; kind: 'col' | 'row' | 'item' | 'range'; index: number; id?: string } | null;
type Editing = { kind: 'item'; id: string } | { kind: 'new'; rect: Rect; text: string } | { kind: 'col'; index: number } | { kind: 'row'; index: number } | null;

const rectOf = (i: RoadmapItem): Rect => ({ r0: i.r[0], c0: i.c[0], r1: i.r[1], c1: i.c[1] });
const norm = (a: { r: number; c: number }, b: { r: number; c: number }): Rect => ({ r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c), r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c) });
const hits = (a: Rect, b: Rect) => a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1;

export default function RoadmapEditor({ rm, onChange, newId }: { rm: RoadmapDef; onChange: (rm: RoadmapDef) => void; newId: () => string }) {
  const [sel, setSel] = useState<Sel>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [preview, setPreview] = useState<Rect | null>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [flash, setFlash] = useState('');
  const [past, setPast] = useState<RoadmapDef[]>([]);
  const [future, setFuture] = useState<RoadmapDef[]>([]);
  const [anchor, setAnchor] = useState<{ r: number; c: number } | null>(null);
  const clip = useRef('');
  const wrap = useRef<HTMLDivElement>(null);
  const nCols = rm.cols.length;
  const spans = rm.rowLabels.map(l => l.r[1] - l.r[0] + 1);

  useEffect(() => { setSel(null); setEditing(null); setMenu(null); setPast([]); setFuture([]); }, [rm.id]);
  useEffect(() => { if (flash) { const t = setTimeout(() => setFlash(''), 2200); return () => clearTimeout(t); } }, [flash]);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);

  // ── 구조 바꾸기 ──
  // 모든 변경은 되돌리기 기록을 남긴다
  const save = (patch: Partial<RoadmapDef>) => { setPast(p => [...p.slice(-49), rm]); setFuture([]); onChange({ ...rm, ...patch }); };
  const undo = () => { const prev = past[past.length - 1]; if (!prev) return; setPast(past.slice(0, -1)); setFuture(f => [rm, ...f]); onChange(prev); setSel(null); };
  const redo = () => { const next = future[0]; if (!next) return; setFuture(future.slice(1)); setPast(p => [...p, rm]); onChange(next); setSel(null); };
  const inside = (r: Rect) => rm.items.filter(i => i.r[0] >= r.r0 && i.r[1] <= r.r1 && i.c[0] >= r.c0 && i.c[1] <= r.c1);
  const crossing = (r: Rect) => rm.items.filter(i => hits(rectOf(i), r) && !inside(r).includes(i));
  const selRect = (): Rect | null => (sel?.kind === 'range' ? sel : sel?.kind === 'item' ? (() => { const it = rm.items.find(i => i.id === sel.id); return it ? rectOf(it) : null; })() : null);
  const merge = () => {
    const r = selRect();
    if (!r || (r.r0 === r.r1 && r.c0 === r.c1)) { setFlash('두 칸 이상을 고른 뒤 병합합니다'); return; }
    if (crossing(r).length) { setFlash('범위 밖으로 걸친 항목이 있어 병합할 수 없습니다'); return; }
    const ins = inside(r).sort((a, b) => a.r[0] - b.r[0] || a.c[0] - b.c[0]);
    if (ins.length > 1 && !confirm('병합하면 왼쪽 위 항목의 이름만 남습니다. 병합할까요?')) return;
    const keep = ins[0];
    const merged: RoadmapItem = keep ? { ...keep, r: [r.r0, r.r1], c: [r.c0, r.c1] } : { id: `${rm.id}-${newId()}`, label: '새 항목', r: [r.r0, r.r1], c: [r.c0, r.c1] };
    save({ items: [...rm.items.filter(i => !ins.includes(i)), merged] });
    setSel({ kind: 'item', id: merged.id });
    if (!keep) setEditing({ kind: 'item', id: merged.id });
  };
  const unmerge = () => {
    const it = sel?.kind === 'item' ? rm.items.find(i => i.id === sel.id) : undefined;
    if (!it || (it.r[0] === it.r[1] && it.c[0] === it.c[1])) { setFlash('병합된 항목을 고르세요'); return; }
    setItem(it.id, { r0: it.r[0], c0: it.c[0], r1: it.r[0], c1: it.c[0] });
  };
  const clearRange = (r: Rect) => { const ins = inside(r); if (ins.length) { save({ items: rm.items.filter(i => !ins.includes(i)) }); setSel(null); } };
  const fits = (r: Rect, except?: string) => r.r0 >= 0 && r.c0 >= 0 && r.r1 < rm.rows && r.c1 < nCols && !rm.items.some(i => i.id !== except && hits(rectOf(i), r));
  const setItem = (id: string, r: Rect) => save({ items: rm.items.map(i => (i.id === id ? { ...i, r: [r.r0, r.r1], c: [r.c0, r.c1] } : i)) });
  const removeItem = (id: string) => { save({ items: rm.items.filter(i => i.id !== id) }); setSel(null); };
  const relabel = (sp: number[], labels: string[]) => { let r = 0; return sp.map((n, k) => { const x = { label: labels[k], r: [r, r + n - 1] as [number, number] }; r += n; return x; }); };

  const insertCol = (at: number) => save({
    cols: [...rm.cols.slice(0, at), '새 열', ...rm.cols.slice(at)],
    items: rm.items.map(i => ({ ...i, c: [i.c[0] >= at ? i.c[0] + 1 : i.c[0], i.c[1] >= at ? i.c[1] + 1 : i.c[1]] as [number, number] })),
  });
  const deleteCol = (at: number) => {
    if (nCols <= 1) return;
    save({
      cols: rm.cols.filter((_, j) => j !== at),
      items: rm.items.filter(i => !(i.c[0] === at && i.c[1] === at)).map(i => ({ ...i, c: [i.c[0] > at ? i.c[0] - 1 : i.c[0], i.c[1] >= at ? i.c[1] - 1 : i.c[1]] as [number, number] })),
    });
  };
  const shiftRows = (items: RoadmapItem[], at: number, n: number) => items.map(i => ({ ...i, r: [i.r[0] >= at ? i.r[0] + n : i.r[0], i.r[1] >= at ? i.r[1] + n : i.r[1]] as [number, number] }));
  const dropRows = (items: RoadmapItem[], a: number, b: number) => {
    const k = b - a + 1;
    return items.filter(i => !(i.r[0] >= a && i.r[1] <= b)).map(i => ({ ...i, r: [i.r[0] > b ? i.r[0] - k : i.r[0] >= a ? a : i.r[0], i.r[1] > b ? i.r[1] - k : i.r[1] >= a ? Math.max(a - 1, i.r[0] >= a ? a : i.r[0]) : i.r[1]] as [number, number] }));
  };
  const labels = rm.rowLabels.map(l => l.label);
  const addGroup = (g: number, after: boolean) => {
    const at = after ? rm.rowLabels[g].r[1] + 1 : rm.rowLabels[g].r[0];
    const k = after ? g + 1 : g;
    const sp = [...spans.slice(0, k), 1, ...spans.slice(k)];
    save({ rowLabels: relabel(sp, [...labels.slice(0, k), '새 영역', ...labels.slice(k)]), rows: rm.rows + 1, items: shiftRows(rm.items, at, 1) });
  };
  const addLine = (g: number) => {
    const at = rm.rowLabels[g].r[1] + 1;
    save({ rowLabels: relabel(spans.map((n, k) => (k === g ? n + 1 : n)), labels), rows: rm.rows + 1, items: shiftRows(rm.items, at, 1) });
  };
  const removeLine = (g: number) => {
    if (spans[g] <= 1) return;
    const at = rm.rowLabels[g].r[1];
    save({ rowLabels: relabel(spans.map((n, k) => (k === g ? n - 1 : n)), labels), rows: rm.rows - 1, items: dropRows(rm.items, at, at) });
  };
  const deleteGroup = (g: number) => {
    if (rm.rowLabels.length <= 1) return;
    const [a, b] = rm.rowLabels[g].r;
    save({ rowLabels: relabel(spans.filter((_, k) => k !== g), labels.filter((_, k) => k !== g)), rows: rm.rows - (b - a + 1), items: dropRows(rm.items, a, b) });
  };

  // ── 끌기 ──
  const cellAt = (x: number, y: number) => {
    const el = document.elementsFromPoint(x, y).find(e => (e as HTMLElement).dataset?.cell);
    if (!el) return null;
    const [r, c] = (el as HTMLElement).dataset.cell!.split('-').map(Number);
    return { r, c };
  };
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const p = cellAt(e.clientX, e.clientY);
      if (!p) return;
      if (p.r !== drag.start.r || p.c !== drag.start.c) drag.moved = true;
      const b = drag.base!;
      const dr = p.r - drag.start.r, dc = p.c - drag.start.c;
      setPreview(
        drag.mode === 'select' ? norm(drag.start, p)
          : drag.mode === 'move' ? { r0: b.r0 + dr, c0: b.c0 + dc, r1: b.r1 + dr, c1: b.c1 + dc }
          : { r0: b.r0, c0: b.c0, r1: drag.mode === 'right' ? b.r1 : Math.max(b.r0, p.r), c1: drag.mode === 'bottom' ? b.c1 : Math.max(b.c0, p.c) },
      );
    };
    const up = () => {
      const p = preview;
      if (drag.mode === 'select') {
        if (p) setSel({ kind: 'range', ...p });
      } else if (drag.id) {
        if (drag.moved && p) {
          if (fits(p, drag.id)) setItem(drag.id, p); else setFlash('다른 항목과 겹치거나 표 밖이라 옮기지 않았습니다');
        }
        setSel({ kind: 'item', id: drag.id });
      }
      setDrag(null); setPreview(null);
      wrap.current?.focus();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  });

  const startCell = (e: RPointerEvent, r: number, c: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setEditing(null);
    if (e.shiftKey && anchor) { setSel({ kind: 'range', ...norm(anchor, { r, c }) }); wrap.current?.focus(); return; }
    setAnchor({ r, c });
    setDrag({ mode: 'select', start: { r, c }, base: { r0: r, c0: c, r1: r, c1: c }, moved: false });
    setPreview({ r0: r, c0: c, r1: r, c1: c });
  };
  const zone = (e: RPointerEvent | RMouseEvent, el: HTMLElement): Drag['mode'] => {
    const b = el.getBoundingClientRect();
    const right = b.right - e.clientX < 7, bottom = b.bottom - e.clientY < 7;
    return right && bottom ? 'corner' : right ? 'right' : bottom ? 'bottom' : 'move';
  };
  const startItem = (e: RPointerEvent<HTMLDivElement>, it: RoadmapItem) => {
    if (e.button !== 0 || (editing?.kind === 'item' && editing.id === it.id)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.shiftKey && anchor) {
      const r = norm(anchor, { r: it.r[1], c: it.c[1] });
      setSel({ kind: 'range', r0: Math.min(r.r0, it.r[0]), c0: Math.min(r.c0, it.c[0]), r1: r.r1, c1: r.c1 });
      wrap.current?.focus();
      return;
    }
    setAnchor({ r: it.r[0], c: it.c[0] });
    const mode = zone(e, e.currentTarget);
    // 끌기 시작점: 가장자리면 그 끝 칸, 아니면 누른 칸
    const p = cellAt(e.clientX, e.clientY) || { r: it.r[0], c: it.c[0] };
    setDrag({ mode, start: mode === 'move' ? p : { r: it.r[1], c: it.c[1] }, id: it.id, base: rectOf(it), moved: false });
    setPreview(rectOf(it));
    setSel({ kind: 'item', id: it.id });
  };

  // ── 키보드 ──
  const onKey = (e: RKeyboardEvent) => {
    if (editing) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 'c' && sel?.kind === 'item') { clip.current = rm.items.find(i => i.id === sel.id)?.label || ''; setFlash('복사했습니다'); return; }
    if (mod && e.key.toLowerCase() === 'v' && clip.current) {
      e.preventDefault();
      if (sel?.kind === 'item') save({ items: rm.items.map(i => (i.id === sel.id ? { ...i, label: clip.current } : i)) });
      else if (sel?.kind === 'range') {
        const rect = { r0: sel.r0, c0: sel.c0, r1: sel.r1, c1: sel.c1 };
        if (fits(rect)) { const it = { id: `${rm.id}-${newId()}`, label: clip.current, r: [rect.r0, rect.r1] as [number, number], c: [rect.c0, rect.c1] as [number, number] }; save({ items: [...rm.items, it] }); setSel({ kind: 'item', id: it.id }); }
        else setFlash('고른 범위에 이미 항목이 있습니다');
      }
      return;
    }
    if (sel?.kind === 'range' && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); clearRange(sel); return; }
    if (sel?.kind === 'item' && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); removeItem(sel.id); return; }
    if (sel?.kind === 'item' && (e.key === 'Enter' || e.key === 'F2')) { e.preventDefault(); setEditing({ kind: 'item', id: sel.id }); return; }
    if (e.key === 'Escape') { setSel(null); return; }
    if (sel?.kind === 'range') {
      if (e.key.startsWith('Arrow') && sel.r0 === sel.r1 && sel.c0 === sel.c1) {
        e.preventDefault();
        const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key as 'ArrowUp'] || [0, 0];
        const r = Math.max(0, Math.min(rm.rows - 1, sel.r0 + d[0])), c = Math.max(0, Math.min(nCols - 1, sel.c0 + d[1]));
        const it = rm.items.find(i => hits(rectOf(i), { r0: r, c0: c, r1: r, c1: c }));
        setSel(it ? { kind: 'item', id: it.id } : { kind: 'range', r0: r, c0: c, r1: r, c1: c });
        return;
      }
      if (e.key === 'Enter' || (e.key.length === 1 && !mod)) {
        const rect = { r0: sel.r0, c0: sel.c0, r1: sel.r1, c1: sel.c1 };
        if (!fits(rect)) { setFlash('고른 범위에 이미 항목이 있습니다'); return; }
        e.preventDefault();
        setEditing({ kind: 'new', rect, text: e.key.length === 1 ? e.key : '' });
      }
    }
  };
  const commitNew = (text: string) => {
    if (editing?.kind !== 'new') return;
    const t = text.trim();
    if (t) {
      const it: RoadmapItem = { id: `${rm.id}-${newId()}`, label: t, r: [editing.rect.r0, editing.rect.r1], c: [editing.rect.c0, editing.rect.c1] };
      save({ items: [...rm.items, it] });
      setSel({ kind: 'item', id: it.id });
    }
    setEditing(null);
    wrap.current?.focus();
  };

  const pos = (r: Rect) => ({ gridRow: `${r.r0 + 2} / ${r.r1 + 3}`, gridColumn: `${r.c0 + 2} / ${r.c1 + 3}` });
  const openMenu = (e: RMouseEvent, m: Omit<NonNullable<Menu>, 'x' | 'y'>) => {
    e.preventDefault(); e.stopPropagation();
    const b = wrap.current!.getBoundingClientRect();
    setMenu({ ...m, x: e.clientX - b.left, y: e.clientY - b.top });
  };
  const rangeSel = sel?.kind === 'range' ? sel : null;
  const selItem = sel?.kind === 'item' ? sel.id : null;
  const grid = { gridTemplateColumns: `minmax(74px, 0.9fr) repeat(${nCols}, minmax(0, 1fr)) 26px` };

  return (
    <div className="xl" ref={wrap} tabIndex={0} onKeyDown={onKey}>
      <div className={`rm-grid xl-grid${drag ? ' dragging' : ''}`} style={grid}>
        <div className="rm-h xl-corner" style={{ gridRow: 1, gridColumn: 1 }} />
        {rm.cols.map((c, i) => (
          <div key={i} className="rm-h xl-head" style={{ gridRow: 1, gridColumn: i + 2 }}
            onDoubleClick={() => setEditing({ kind: 'col', index: i })} onContextMenu={e => openMenu(e, { kind: 'col', index: i })}>
            {editing?.kind === 'col' && editing.index === i
              ? <input className="xl-input" autoFocus defaultValue={c} onBlur={e => { save({ cols: rm.cols.map((x, j) => (j === i ? e.target.value || x : x)) }); setEditing(null); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }} aria-label="열 이름" />
              : <>{c}<button className="xl-tri" aria-label={`${c} 열 메뉴`} onPointerDown={e => e.stopPropagation()} onClick={e => openMenu(e, { kind: 'col', index: i })}>▾</button></>}
          </div>
        ))}
        <button className="xl-add col" style={{ gridRow: 1, gridColumn: nCols + 2 }} onClick={() => insertCol(nCols)} title="열 추가">+</button>

        {rm.rowLabels.map((l, g) => (
          <div key={g} className="rm-row xl-rowhead" style={{ gridRow: `${l.r[0] + 2} / ${l.r[1] + 3}`, gridColumn: 1 }}
            onDoubleClick={() => setEditing({ kind: 'row', index: g })} onContextMenu={e => openMenu(e, { kind: 'row', index: g })}>
            {editing?.kind === 'row' && editing.index === g
              ? <input className="xl-input" autoFocus defaultValue={l.label} onBlur={e => { save({ rowLabels: rm.rowLabels.map((x, k) => (k === g ? { ...x, label: e.target.value || x.label } : x)) }); setEditing(null); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }} aria-label="영역 이름" />
              : <>{l.label}<button className="xl-tri" aria-label={`${l.label} 영역 메뉴`} onPointerDown={e => e.stopPropagation()} onClick={e => openMenu(e, { kind: 'row', index: g })}>▾</button></>}
          </div>
        ))}
        <button className="xl-add row" style={{ gridRow: rm.rows + 2, gridColumn: 1 }} onClick={() => addGroup(rm.rowLabels.length - 1, true)} title="영역 추가">+ 영역</button>

        {Array.from({ length: rm.rows }, (_, r) => Array.from({ length: nCols }, (_, c) => (
          <div key={`${r}-${c}`} data-cell={`${r}-${c}`} className="rm-empty xl-cell" style={pos({ r0: r, c0: c, r1: r, c1: c })}
            onPointerDown={e => startCell(e, r, c)}
            onContextMenu={e => {
              const inSel = rangeSel && r >= rangeSel.r0 && r <= rangeSel.r1 && c >= rangeSel.c0 && c <= rangeSel.c1;
              if (!inSel) setSel({ kind: 'range', r0: r, c0: c, r1: r, c1: c });
              openMenu(e, { kind: 'range', index: 0 });
            }}
            onDoubleClick={() => { const rect = { r0: r, c0: c, r1: r, c1: c }; if (fits(rect)) setEditing({ kind: 'new', rect, text: '' }); }} />
        )))}

        {rangeSel && !drag && <div className="xl-range" style={pos(rangeSel)} />}

        {rm.items.map(it => {
          const editingThis = editing?.kind === 'item' && editing.id === it.id;
          const hidden = drag?.id === it.id && drag.moved;
          return (
            <div key={it.id} className={`rm-cell xl-item${selItem === it.id ? ' picked' : ''}${hidden ? ' ghosted' : ''}`} style={pos(rectOf(it))}
              onPointerDown={e => startItem(e, it)}
              onPointerMove={e => { if (!drag) { const z = zone(e, e.currentTarget); e.currentTarget.style.cursor = z === 'right' ? 'ew-resize' : z === 'bottom' ? 'ns-resize' : z === 'corner' ? 'nwse-resize' : 'grab'; } }}
              onDoubleClick={() => setEditing({ kind: 'item', id: it.id })}
              onContextMenu={e => { setSel({ kind: 'item', id: it.id }); openMenu(e, { kind: 'item', index: 0, id: it.id }); }}>
              {editingThis
                ? <textarea className="xl-input" autoFocus defaultValue={it.label} onPointerDown={e => e.stopPropagation()}
                    onBlur={e => { save({ items: rm.items.map(i => (i.id === it.id ? { ...i, label: e.target.value.trim() || i.label } : i)) }); setEditing(null); wrap.current?.focus(); }}
                    onKeyDown={e => { if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Escape') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }} aria-label="항목 이름" />
                : it.label}
              {selItem === it.id && !editingThis && <button className="xl-x" aria-label="항목 지우기" onPointerDown={e => e.stopPropagation()} onClick={() => removeItem(it.id)}>×</button>}
            </div>
          );
        })}

        {editing?.kind === 'new' && (
          <div className="rm-cell xl-item picked" style={pos(editing.rect)}>
            <textarea className="xl-input" autoFocus defaultValue={editing.text} onBlur={e => commitNew(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setEditing(null); wrap.current?.focus(); } else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }} aria-label="새 항목 이름" />
          </div>
        )}
        {drag && preview && drag.moved && <div className={`xl-preview${drag.mode === 'select' || fits(preview, drag.id) ? '' : ' bad'}`} style={pos(preview)} />}
      </div>

      {menu && (
        <div className="xl-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={e => e.stopPropagation()}>
          {menu.kind === 'col' && <>
            <button onClick={() => { insertCol(menu.index); setMenu(null); }}>왼쪽에 열 삽입</button>
            <button onClick={() => { insertCol(menu.index + 1); setMenu(null); }}>오른쪽에 열 삽입</button>
            <button onClick={() => { setEditing({ kind: 'col', index: menu.index }); setMenu(null); }}>이름 바꾸기</button>
            <hr /><button className="danger" disabled={nCols <= 1} onClick={() => { if (confirm(`'${rm.cols[menu.index]}' 열을 지울까요? 이 열에만 있는 항목도 지워집니다.`)) deleteCol(menu.index); setMenu(null); }}>열 삭제</button>
          </>}
          {menu.kind === 'row' && <>
            <button onClick={() => { addGroup(menu.index, false); setMenu(null); }}>위에 영역 삽입</button>
            <button onClick={() => { addGroup(menu.index, true); setMenu(null); }}>아래에 영역 삽입</button>
            <button onClick={() => { addLine(menu.index); setMenu(null); }}>이 영역에 줄 추가</button>
            <button disabled={spans[menu.index] <= 1} onClick={() => { removeLine(menu.index); setMenu(null); }}>이 영역 줄 줄이기</button>
            <button onClick={() => { setEditing({ kind: 'row', index: menu.index }); setMenu(null); }}>이름 바꾸기</button>
            <hr /><button className="danger" disabled={rm.rowLabels.length <= 1} onClick={() => { if (confirm(`'${rm.rowLabels[menu.index].label}' 영역을 지울까요? 이 영역의 항목도 지워집니다.`)) deleteGroup(menu.index); setMenu(null); }}>영역 삭제</button>
          </>}
          {menu.kind === 'item' && menu.id && <>
            <button onClick={() => { setEditing({ kind: 'item', id: menu.id! }); setMenu(null); }}>이름 바꾸기</button>
            <button onClick={() => { clip.current = rm.items.find(i => i.id === menu.id)?.label || ''; setMenu(null); }}>복사 <span className="kbd">⌘C</span></button>
            <button onClick={() => { unmerge(); setMenu(null); }}>병합 해제</button>
            <hr /><button className="danger" onClick={() => { removeItem(menu.id!); setMenu(null); }}>항목 지우기 <span className="kbd">Delete</span></button>
          </>}
          {menu.kind === 'range' && <>
            <button onClick={() => { merge(); setMenu(null); }}>셀 병합</button>
            <button disabled={!clip.current} onClick={() => { const r = selRect(); if (r && fits(r)) { const it = { id: `${rm.id}-${newId()}`, label: clip.current, r: [r.r0, r.r1] as [number, number], c: [r.c0, r.c1] as [number, number] }; save({ items: [...rm.items, it] }); } setMenu(null); }}>붙여넣기 <span className="kbd">⌘V</span></button>
            <hr /><button className="danger" onClick={() => { const r = selRect(); if (r) clearRange(r); setMenu(null); }}>범위 지우기 <span className="kbd">Delete</span></button>
          </>}
        </div>
      )}
      <div className="xl-foot">
        <span className="xl-tools">
          <button onClick={undo} disabled={!past.length} title="되돌리기 (⌘/Ctrl+Z)">↶</button>
          <button onClick={redo} disabled={!future.length} title="다시 실행 (⌘/Ctrl+Shift+Z)">↷</button>
          <button onClick={merge} title="셀 병합">병합</button>
          <button onClick={unmerge} title="병합 해제">해제</button>
        </span>
        {flash ? <span className="xl-flash">{flash}</span> : <span>칸을 끌어 범위를 고르고 입력하면 항목 · 끌어서 옮기기, 가장자리로 늘리기 · Shift+클릭 범위 · 오른쪽 클릭 메뉴 · ⌘Z 되돌리기</span>}
      </div>
    </div>
  );
}
