'use client';
// 로드맵 표. onCell이 있으면 칸을 눌러 상태를 바꾼다 (없음 → 진행중 → 이수 완료 → 면제).
import type { Roadmap } from '@/lib/roadmaps';
import type { RoadmapProgress } from '@/lib/types';

const CLS = { 진행중: 'rm-doing', 이수완료: 'rm-done', 면제: 'rm-skip' } as const;
const dot = (d?: string) => (d ? d.replace(/-/g, '.') : '');

export default function RoadmapView({ rm, progress = {}, onCell, onEmpty, selected, bad = [] }: {
  rm: Roadmap; progress?: RoadmapProgress; onCell?: (itemId: string) => void;
  onEmpty?: (r: number, c: number) => void; selected?: string; bad?: string[]; // 양식 편집용
}) {
  const covered = new Set<string>();
  rm.items.forEach(i => { for (let r = i.r[0]; r <= i.r[1]; r++) for (let c = i.c[0]; c <= i.c[1]; c++) covered.add(`${r}-${c}`); });
  const empties: { r: number; c: number }[] = [];
  for (let r = 0; r < rm.rows; r++) for (let c = 0; c < rm.cols.length; c++) if (!covered.has(`${r}-${c}`)) empties.push({ r, c });
  const style = { gridTemplateColumns: `minmax(70px, 0.9fr) repeat(${rm.cols.length}, minmax(0, 1fr))` };
  // CSS grid 위치: 1행은 머리글, 1열은 행 이름
  const pos = (r: [number, number], c: [number, number]) => ({ gridRow: `${r[0] + 2} / ${r[1] + 3}`, gridColumn: `${c[0] + 2} / ${c[1] + 3}` });

  return (
    <div className="rm">
      <div className="rm-head">
        <b>{rm.title}</b>
        <span className="rm-legend"><i className="rm-doing" /> 현재 이수 중 <i className="rm-done" /> 이수 완료 <i className="rm-skip" /> 면제</span>
      </div>
      <div className="rm-grid" style={style}>
        <div className="rm-h" style={{ gridRow: 1, gridColumn: 1 }} />
        {rm.cols.map((c, i) => <div key={c} className="rm-h" style={{ gridRow: 1, gridColumn: i + 2 }}>{c}</div>)}
        {rm.rowLabels.map(l => <div key={l.label} className="rm-row" style={{ gridRow: `${l.r[0] + 2} / ${l.r[1] + 3}`, gridColumn: 1 }}>{l.label}</div>)}
        {empties.map(e => onEmpty
          ? <button type="button" key={`${e.r}-${e.c}`} className="rm-empty add" style={pos([e.r, e.r], [e.c, e.c])} onClick={() => onEmpty(e.r, e.c)} title="여기에 항목 추가">+</button>
          : <div key={`${e.r}-${e.c}`} className="rm-empty" style={pos([e.r, e.r], [e.c, e.c])} />)}
        {rm.items.map(i => {
          const p = progress[i.id];
          const cls = `rm-cell ${p ? CLS[p.state] : ''}${onCell ? ' editable' : ''}${selected === i.id ? ' picked' : ''}${bad.includes(i.id) ? ' bad' : ''}`;
          const body = <>{i.label}{p?.state === '이수완료' && p.date && <span className="rm-date">({dot(p.date)})</span>}</>;
          return onCell
            ? <button type="button" key={i.id} className={cls} style={pos(i.r, i.c)} onClick={() => onCell(i.id)} title="눌러서 상태 바꾸기">{body}</button>
            : <div key={i.id} className={cls} style={pos(i.r, i.c)}>{body}</div>;
        })}
      </div>
    </div>
  );
}
