'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useHub } from '@/lib/store';
import { gradeLabel } from '@/lib/rules';
import { filled, periodLabel, roadmapOn } from '@/lib/reports';
import type { ProgressReport, ReportStatus } from '@/lib/types';
import ReportSheet from '@/components/ReportSheet';
import { useOpenReport } from '@/components/useOpenReport';
import { Badge } from '@/components/ui';

const SECTIONS: [keyof ProgressReport['sections'], string][] = [['grades', '평가 결과'], ['life', '생활(상점·벌점)'], ['career', '진로·입시']];
const TONE = { 작성중: 'gold', 검토완료: 'green', 발송: 'deep' } as const;

export default function ReportEditor() {
  const { id } = useParams<{ id: string }>();
  const hub = useHub();
  const r = hub.reports.find(x => x.id === id);
  const open = useOpenReport(r?.period || '');
  if (!hub.loaded) return <div className="page muted">불러오는 중…</div>;
  if (!r) return <div className="page"><p>보고서를 찾을 수 없습니다. <Link href="/reports">목록으로</Link></p></div>;
  const s = hub.students.find(x => x.id === r.studentId)!;

  const active = hub.students.filter(x => x.status === '재학').sort((a, b) => b.birthYear - a.birthYear || a.name.localeCompare(b.name));
  const idx = active.findIndex(x => x.id === s.id);
  const reportOf = (sid: string) => hub.reports.find(x => x.studentId === sid && x.period === r.period);
  const save = (next: ProgressReport) => hub.saveReport(next);
  const setStatus = (status: ReportStatus) => {
    // 발송할 때 그때의 로드맵을 보관한다 (지난 보고서가 바뀌지 않게)
    save({ ...r, status, snapshot: status === '발송' ? { ...(hub.progress[s.id] || {}) } : undefined });
  };

  return (
    <div className="report-editor">
      <aside className="re-list no-print">
        <div className="re-list-head">
          <Link href="/reports" className="small">← 목록</Link>
          <b>{periodLabel(r.period)}</b>
        </div>
        {active.map(x => {
          const xr = reportOf(x.id);
          return (
            <button key={x.id} className={`re-item${x.id === s.id ? ' on' : ''}`} onClick={() => open(x)}>
              <span>{x.name} <span className="tiny muted">{gradeLabel(x.birthYear)}</span></span>
              <i className={`dot ${xr ? xr.status : '미작성'}`} title={xr?.status || '미작성'} />
            </button>
          );
        })}
      </aside>

      <div className="re-main">
        <div className="re-bar no-print">
          <div className="row">
            <button className="btn sm" disabled={idx <= 0} onClick={() => open(active[idx - 1])}>← 이전</button>
            <b style={{ fontSize: 17, color: 'var(--deep)' }}>{s.name}</b>
            <span className="small muted">{s.classGroup} · {gradeLabel(s.birthYear)} · 과목 평가 {filled(r)}/{r.comments.length}</span>
            <button className="btn sm" disabled={idx < 0 || idx >= active.length - 1} onClick={() => open(active[idx + 1])}>다음 →</button>
          </div>
          <div className="row">
            {hub.roadmaps.map(rm => (
              <label key={rm.id} className="check small"><input type="checkbox" checked={roadmapOn(r, rm.id)} disabled={r.status === '발송'}
                onChange={e => save({ ...r, sections: { grades: r.sections.grades, career: r.sections.career, life: r.sections.life }, roadmapsOff: e.target.checked ? (r.roadmapsOff || []).filter(x => x !== rm.id) : [...(r.roadmapsOff || []), rm.id] })} /> {rm.subject} 로드맵</label>
            ))}
            {SECTIONS.map(([k, label]) => (
              <label key={k} className="check small"><input type="checkbox" checked={r.sections[k] !== false} disabled={r.status === '발송'} onChange={e => save({ ...r, sections: { ...r.sections, [k]: e.target.checked } })} /> {label}</label>
            ))}
          </div>
          <div className="row">
            <div className="seg">
              {(['작성중', '검토완료', '발송'] as ReportStatus[]).map(st => <button key={st} className={r.status === st ? 'on' : ''} onClick={() => setStatus(st)}>{st}</button>)}
            </div>
            <button className="btn primary" onClick={() => window.print()}>인쇄 · PDF</button>
          </div>
        </div>
        {r.status === '발송' && <div className="callout small no-print" style={{ margin: '0 0 12px' }}>발송한 보고서는 고칠 수 없습니다. 고치려면 상태를 '검토완료'로 바꾸세요. <Badge tone={TONE[r.status]}>발송</Badge></div>}
        <div className="re-paper">
          <ReportSheet report={r} editable onChange={save} />
        </div>
      </div>
    </div>
  );
}
