'use client';
// 로드맵 표. onCell이 있으면 칸을 눌러 상태를 바꾼다 (없음 → 진행중 → 이수 완료 → 면제).
// 이수 상태 범례는 학생 진도를 보여 줄 때(보고서)만 — 교과 로드맵(커리큘럼 설계)에서는 뺀다.
// 학교급 띠(초등·중등·고등)는 교과 로드맵 화면에서만. 학습 진도 보고서는 원본 서식대로 깔끔한 표 (bands={false}).
import { bandOf, bandSpans, type Band, type Roadmap } from '@/lib/roadmaps';
import type { RoadmapProgress } from '@/lib/types';

const CLS = { 진행중: 'rm-doing', 이수완료: 'rm-done', 면제: 'rm-skip' } as const;
const dot = (d?: string) => (d ? d.replace(/-/g, '.') : '');

export default function RoadmapView({ rm, progress, onCell, onEmpty, selected, bad = [], focus, bands = true }: {
  rm: Roadmap; progress?: RoadmapProgress; onCell?: (itemId: string) => void; focus?: Band; bands?: boolean; // bands: 학교급 띠와 색
  onEmpty?: (r: number, c: number) => void; selected?: string; bad?: string[]; // 양식 편집용
}) {
  const showProgress = !!progress || !!onCell;
  const prog = progress || {};
  const covered = new Set<string>();
  rm.items.forEach(i => { for (let r = i.r[0]; r <= i.r[1]; r++) for (let c = i.c[0]; c <= i.c[1]; c++) covered.add(`${r}-${c}`); });
  const empties: { r: number; c: number }[] = [];
  for (let r = 0; r < rm.rows; r++) for (let c = 0; c < rm.cols.length; c++) if (!covered.has(`${r}-${c}`)) empties.push({ r, c });
  const style = { gridTemplateColumns: `minmax(70px, 0.9fr) repeat(${rm.cols.length}, minmax(0, 1fr))` };
  // CSS grid 위치: (띠가 있으면) 1행은 학교급 띠, 그다음 열 머리글, 1열은 행 이름
  const top = bands ? 1 : 0;
  const pos = (r: [number, number], c: [number, number]) => ({ gridRow: `${r[0] + 2 + top} / ${r[1] + 3 + top}`, gridColumn: `${c[0] + 2} / ${c[1] + 3}` });
  const spans = bandSpans(rm.cols);
  const starts = new Set(spans.slice(1).map(b => b.c0)); // 학교급이 바뀌는 열 (왼쪽 굵은 선)
  const edge = (c: number) => (bands && starts.has(c) ? ' band-start' : '');
  const tint = (c: string) => (bands ? ` band-${bandOf(c)}` : '');

  return (
    <div className="rm">
      <div className="rm-head">
        <b>{rm.title}</b>
        {showProgress && <span className="rm-legend"><i className="rm-doing" /> 현재 이수 중 <i className="rm-done" /> 이수 완료 <i className="rm-skip" /> 면제</span>}
      </div>
      <div className="rm-grid" style={style}>
        <div className={`rm-h${bands ? ' rm-band-corner' : ''}`} style={{ gridRow: bands ? '1 / 3' : 1, gridColumn: 1 }} />
        {bands && spans.map(b => (
          <div key={b.c0} className={`rm-band band-${b.band}${edge(b.c0)}${focus === b.band ? ' focus' : ''}`} style={{ gridRow: 1, gridColumn: `${b.c0 + 2} / ${b.c1 + 3}` }}>
            {b.band}{focus === b.band && <span className="rm-band-now">지금 과정</span>}
          </div>
        ))}
        {rm.cols.map((c, i) => <div key={c} className={`rm-h${tint(c)}${edge(i)}`} style={{ gridRow: 1 + top, gridColumn: i + 2 }}>{c}</div>)}
        {rm.rowLabels.map(l => <div key={l.label} className="rm-row" style={{ gridRow: `${l.r[0] + 2 + top} / ${l.r[1] + 3 + top}`, gridColumn: 1 }}>{l.label}</div>)}
        {empties.map(e => onEmpty
          ? <button type="button" key={`${e.r}-${e.c}`} className={`rm-empty add${tint(rm.cols[e.c])}${edge(e.c)}`} style={pos([e.r, e.r], [e.c, e.c])} onClick={() => onEmpty(e.r, e.c)} title="여기에 항목 추가">+</button>
          : <div key={`${e.r}-${e.c}`} className={`rm-empty${tint(rm.cols[e.c])}${edge(e.c)}`} style={pos([e.r, e.r], [e.c, e.c])} />)}
        {rm.items.map(i => {
          const p = prog[i.id];
          const cls = `rm-cell ${p ? CLS[p.state] : ''}${edge(i.c[0])}${onCell ? ' editable' : ''}${selected === i.id ? ' picked' : ''}${bad.includes(i.id) ? ' bad' : ''}`;
          const body = <>{i.label}{p?.state === '이수완료' && p.date && <span className="rm-date">({dot(p.date)})</span>}</>;
          return onCell
            ? <button type="button" key={i.id} className={cls} style={pos(i.r, i.c)} onClick={() => onCell(i.id)} title="눌러서 상태 바꾸기">{body}</button>
            : <div key={i.id} className={cls} style={pos(i.r, i.c)}>{body}</div>;
        })}
      </div>
    </div>
  );
}
