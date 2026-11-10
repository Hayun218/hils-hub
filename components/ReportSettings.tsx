'use client';
// 학습 진도 보고서 설정: 보고서 제목, 과목 평가의 기본 과목 (초등·중고등). 교과 로드맵(커리큘럼)과 분리한다.
// 보고서 모양 자체는 고정 서식 (components/ReportSheet.tsx)이라 여기서 바꾸지 않는다.
import { useState } from 'react';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { DEFAULT_TEMPLATE } from '@/lib/reports';

export default function ReportSettings() {
  const hub = useHub();
  const auth = useAuth();
  const editable = can(auth.me, 'admin');
  const [open, setOpen] = useState(false);
  const tpl = hub.reportTemplate;
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
    <div className="card" style={{ marginBottom: 12 }}>
      <button type="button" className="linklike small" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? '▾' : '▸'} 보고서 설정 <span className="muted">· 제목 「{tpl.title}」 · 과목 평가 기본 과목</span>
      </button>
      {open && (
        <div className="grid g3" style={{ marginTop: 10 }}>
          <label className="field">보고서 제목<input value={tpl.title} disabled={!editable} onChange={e => hub.setReportTemplate({ ...tpl, title: e.target.value })} /></label>
          {listEdit('elemSubjects', '과목 평가 · 초등 기본 과목')}
          {listEdit('secSubjects', '과목 평가 · 중고등 기본 과목')}
          <div className="tiny muted" style={{ gridColumn: '1 / -1' }}>
            {editable ? <>새로 만드는 보고서부터 적용됩니다. <button className="linklike tiny" onClick={() => { if (confirm('보고서 제목과 기본 과목을 처음 값으로 되돌릴까요?')) hub.setReportTemplate(DEFAULT_TEMPLATE); }}>처음 값으로</button></> : '관리자만 고칠 수 있습니다.'}
          </div>
        </div>
      )}
    </div>
  );
}
