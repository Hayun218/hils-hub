'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { DEFAULT_ROADMAPS, overlaps } from '@/lib/roadmaps';
import { DEFAULT_TEMPLATE } from '@/lib/reports';
import type { RoadmapDef, RoadmapItem } from '@/lib/types';
import RoadmapView from '@/components/Roadmap';
import RoadmapEditor from '@/components/RoadmapEditor';
import { PageHead } from '@/components/ui';

/** 행 이름별 줄 수로 행 범위를 다시 계산 */
const relabel = (spans: { label: string; n: number }[]) => {
  let r = 0;
  return spans.map(s => { const x = { label: s.label, r: [r, r + s.n - 1] as [number, number] }; r += s.n; return x; });
};

export default function TemplatePage() {
  const hub = useHub();
  const auth = useAuth();
  const editable = can(auth.me, 'admin');
  const [rid, setRid] = useState(hub.roadmaps[0]?.id || '');
  const [sel, setSel] = useState<string | null>(null);
  const rm = hub.roadmaps.find(x => x.id === rid) || hub.roadmaps[0];
  const tpl = hub.reportTemplate;

  const saveRm = (next: RoadmapDef) => hub.setRoadmaps(hub.roadmaps.map(x => (x.id === next.id ? next : x)));
  const item = rm?.items.find(i => i.id === sel);
  const setItem = (patch: Partial<RoadmapItem>) => rm && item && saveRm({ ...rm, items: rm.items.map(i => (i.id === item.id ? { ...i, ...patch } : i)) });
  const bad = rm ? overlaps(rm) : [];

  const addRoadmap = () => {
    const id = hub.newId('rm');
    const r: RoadmapDef = { id, subject: '새 교과', title: '새 교과 ROAD MAP', level: '전체', cols: ['초1', '초2', '초3', '초4', '초5', '초6'], rowLabels: [{ label: '영역', r: [0, 0] }], rows: 1, items: [] };
    hub.setRoadmaps([...hub.roadmaps, r]);
    setRid(id); setSel(null);
  };
  const removeCol = (ci: number) => {
    if (!rm) return;
    const items = rm.items.filter(i => !(i.c[0] === ci && i.c[1] === ci)).map(i => ({
      ...i, c: [i.c[0] > ci ? i.c[0] - 1 : i.c[0], i.c[1] >= ci ? i.c[1] - 1 : i.c[1]] as [number, number],
    }));
    saveRm({ ...rm, cols: rm.cols.filter((_, j) => j !== ci), items });
  };
  const spans = rm ? rm.rowLabels.map(l => ({ label: l.label, n: l.r[1] - l.r[0] + 1 })) : [];
  const setSpans = (next: { label: string; n: number }[], drop?: [number, number], add?: { at: number; n: number }) => {
    if (!rm) return;
    let items = rm.items;
    if (drop) { // 지운 행의 항목은 빼고 아래 항목은 위로
      const [a, b] = drop, k = b - a + 1;
      items = items.filter(i => i.r[1] < a || i.r[0] > b).map(i => (i.r[0] > b ? { ...i, r: [i.r[0] - k, i.r[1] - k] as [number, number] } : i));
    }
    if (add) items = items.map(i => (i.r[0] >= add.at ? { ...i, r: [i.r[0] + add.n, i.r[1] + add.n] as [number, number] } : i.r[1] >= add.at ? { ...i, r: [i.r[0], i.r[1] + add.n] as [number, number] } : i));
    const rowLabels = relabel(next);
    saveRm({ ...rm, rowLabels, rows: next.reduce((x, s) => x + s.n, 0), items });
  };
  const rowName = (r: number) => {
    const l = rm?.rowLabels.find(x => r >= x.r[0] && r <= x.r[1]);
    return l ? (l.r[1] > l.r[0] ? `${l.label} ${r - l.r[0] + 1}줄` : l.label) : `${r + 1}행`;
  };
  const listEdit = (key: 'elemSubjects' | 'secSubjects', label: string) => (
    <div className="field">{label}
      <div className="chips-edit">
        {tpl[key].map((x, i) => (
          <span key={i} className="chip-x">{x}{editable && <button aria-label={`${x} 빼기`} onClick={() => hub.setReportTemplate({ ...tpl, [key]: tpl[key].filter((_, j) => j !== i) })}>×</button>}</span>
        ))}
        {editable && <input className="input" style={{ width: 130, padding: '3px 8px' }} placeholder="+ 과목 (Enter)" onKeyDown={e => {
          const v = (e.target as HTMLInputElement).value.trim();
          if (e.key === 'Enter' && v) { hub.setReportTemplate({ ...tpl, [key]: [...tpl[key], v] }); (e.target as HTMLInputElement).value = ''; }
        }} />}
      </div>
    </div>
  );

  return (
    <div className="page wide">
      <PageHead
        title="커리큘럼 설계"
        desc="교과별 로드맵(커리큘럼)과 과목 평가의 기본 과목을 정합니다. 여기서 고치면 모든 학생의 학습 진도 보고서에 바로 적용되고, 학생별 진도 표시는 그대로 남습니다 (제29조 제4항)."
        right={<>
          {editable && <button className="btn" onClick={() => { if (confirm('로드맵과 기본 과목을 처음 양식(2025년 3월 보고서)으로 되돌릴까요?')) { hub.setRoadmaps(DEFAULT_ROADMAPS); hub.setReportTemplate(DEFAULT_TEMPLATE); setRid(DEFAULT_ROADMAPS[0].id); setSel(null); } }}>처음 양식으로</button>}
          <Link className="btn primary" href="/reports">보고서 목록</Link>
        </>}
      />
      {!editable && <div className="callout gold small" style={{ marginBottom: 12 }}>양식은 관리자만 고칠 수 있습니다.</div>}

      <div className="card grid g3" style={{ marginBottom: 14 }}>
        <label className="field">보고서 제목<input value={tpl.title} disabled={!editable} onChange={e => hub.setReportTemplate({ ...tpl, title: e.target.value })} /></label>
        {listEdit('elemSubjects', '과목 평가 · 초등 기본 과목')}
        {listEdit('secSubjects', '과목 평가 · 중고등 기본 과목')}
      </div>

      <div className="tabs">
        {hub.roadmaps.map(x => <button key={x.id} className={x.id === rm?.id ? 'on' : ''} onClick={() => { setRid(x.id); setSel(null); }}>{x.subject} 로드맵</button>)}
        {editable && <button onClick={addRoadmap}>+ 교과 로드맵 추가</button>}
      </div>

      {rm && (
        <div className="tpl-layout">
          <div className="card">
            <div className="grid g3" style={{ marginBottom: 12 }}>
              <label className="field">교과<input value={rm.subject} disabled={!editable} onChange={e => saveRm({ ...rm, subject: e.target.value })} /></label>
              <label className="field">표 제목<input value={rm.title} disabled={!editable} onChange={e => saveRm({ ...rm, title: e.target.value })} /></label>
              <label className="field">기본으로 넣는 대상
                <select value={rm.level} disabled={!editable} onChange={e => saveRm({ ...rm, level: e.target.value as RoadmapDef['level'] })}><option>전체</option><option>초등</option><option>중고등</option></select>
              </label>
            </div>
            {editable ? <RoadmapEditor rm={rm} onChange={saveRm} newId={() => hub.newId('')} /> : <RoadmapView rm={rm} />}
          </div>

          <aside className="card stack">
            <h3 style={{ margin: 0 }}>{rm.subject} 로드맵</h3>
            <p className="small muted" style={{ margin: 0 }}>항목 {rm.items.length}개 · 열 {rm.cols.length} · 행 {rm.rows}{bad.length ? ` · 겹침 ${bad.length}` : ''}</p>
            <ul className="tips">
              <li>빈 칸을 끌어 범위를 고르고 글자를 입력하면 항목(병합 셀)이 됩니다.</li>
              <li>항목을 끌면 옮겨지고, 오른쪽·아래 가장자리를 끌면 늘어나거나 줄어듭니다.</li>
              <li>더블클릭으로 이름을 바꾸고, 선택한 뒤 × 또는 Delete로 지웁니다.</li>
              <li>열·영역 머리글을 오른쪽 클릭하면 삽입·삭제·이름 바꾸기가 나옵니다.</li>
            </ul>
            <p className="small" style={{ margin: 0 }}>학생별 진도는 각 학생 보고서에서 칸을 눌러 표시합니다. 이 화면은 모든 학생이 함께 쓰는 틀입니다.</p>
            {editable && hub.roadmaps.length > 1 && (
              <button className="btn sm warn" style={{ alignSelf: 'flex-start' }} onClick={() => {
                if (confirm(`${rm.subject} 로드맵을 양식에서 뺄까요? 모든 보고서에서 사라집니다.`)) { hub.setRoadmaps(hub.roadmaps.filter(x => x.id !== rm.id)); setRid(hub.roadmaps[0].id); }
              }}>이 로드맵 빼기</button>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
