'use client';
import { useState } from 'react';
import { useHub } from '@/lib/store';
import { assignHomerooms, homeroomWarnings, MAX_PER_HOMEROOM } from '@/lib/homeroom';
import { DOMAINS, DOMAIN_CLS, ROLE_HINTS, domainOf } from '@/lib/strengths';
import type { StaffRole, Teacher } from '@/lib/types';
import { PageHead, ArtLink, Badge } from '@/components/ui';

const ROLES: StaffRole[] = ['교사', '학교장', '목사', '행정'];
const AREAS = ['교육과정(정)', '교육과정(부)', '생활교육(정)', '생활교육(부)', '행정·대외협력(정)', '행정·대외협력(부)'];
const list = (s: string) => s.split(/[,/]/).map(x => x.trim()).filter(Boolean);

export default function StaffPage() {
  const hub = useHub();
  const [preview, setPreview] = useState<{ map: Record<string, string>; warnings: string[] } | null>(null);
  const count = (id: string) => hub.students.filter(s => s.status === '재학' && s.homeroom === id).length;
  const warnings = homeroomWarnings(hub.students, hub.teachers);
  const areaOwner = (a: string) => hub.teachers.filter(t => !t.leaving && t.areas.includes(a)).map(t => t.name);

  return (
    <div className="page wide">
      <PageHead
        title="교직원"
        desc={<>역할, 담임 여부, 과목, 운영 영역(정·부)을 정합니다. 강점(Gallup TOP 5)은 역할 배치 참고용입니다 <ArtLink no={35} /></>}
        right={<>
          <button className="btn" onClick={() => hub.addTeacher({ name: '새 교직원', subjects: [], areas: [], role: '교사' })}>+ 교직원 추가</button>
          <button className="btn primary" onClick={() => setPreview(assignHomerooms(hub.students, hub.teachers))}>담임 다시 배정 (제35조)</button>
        </>}
      />

      {warnings.map(w => <div key={w} className="callout gold small" style={{ marginBottom: 6 }}>{w}</div>)}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="t staff">
          <thead><tr><th>이름</th><th>역할</th><th>담임</th><th className="num">담임 학생</th><th>과목</th><th>운영 영역</th><th>강점 TOP 5</th><th>이직</th><th>비고</th><th /></tr></thead>
          <tbody>
            {hub.teachers.map(t => {
              const up = (p: Partial<Teacher>) => hub.updateTeacher(t.id, p);
              const n = count(t.id);
              return (
                <tr key={t.id} className={t.leaving ? 'leaving' : undefined}>
                  <td><input className="input compact" style={{ width: 90, fontWeight: 600 }} value={t.name} onChange={e => up({ name: e.target.value })} aria-label="이름" /></td>
                  <td><select className="input compact" value={t.role || '교사'} onChange={e => up({ role: e.target.value as StaffRole })} aria-label="역할">{ROLES.map(r => <option key={r}>{r}</option>)}</select></td>
                  <td><select className="input compact" value={t.homeroomFor || ''} onChange={e => up({ homeroomFor: (e.target.value || undefined) as Teacher['homeroomFor'] })} aria-label="담임"><option value="">안 함</option><option>초등</option><option>중고등</option></select></td>
                  <td className="num">{n ? <Badge tone={n > MAX_PER_HOMEROOM ? 'red' : 'line'}>{n}명</Badge> : ''}</td>
                  <td><input className="input compact" style={{ width: 110 }} defaultValue={t.subjects.join(', ')} onBlur={e => up({ subjects: list(e.target.value) })} placeholder="영어, 수학" aria-label="과목" /></td>
                  <td>
                    <select className="input compact" value="" onChange={e => e.target.value && up({ areas: t.areas.includes(e.target.value) ? t.areas : [...t.areas, e.target.value] })} aria-label="운영 영역 추가">
                      <option value="">+ 영역</option>{AREAS.map(a => <option key={a}>{a}</option>)}
                    </select>
                    <div className="chips-edit" style={{ marginTop: 4 }}>{t.areas.map(a => <span key={a} className="chip-x">{a}<button onClick={() => up({ areas: t.areas.filter(x => x !== a) })} aria-label={`${a} 빼기`}>×</button></span>)}</div>
                  </td>
                  <td>
                    <div className="strengths">{(t.strengths || []).map(x => <span key={x} className={`st ${domainOf(x) ? DOMAIN_CLS[domainOf(x)!] : ''}`}>{x}</span>)}</div>
                    <input className="input compact" style={{ width: 200, marginTop: 4 }} defaultValue={(t.strengths || []).join(', ')} onBlur={e => up({ strengths: list(e.target.value) })} placeholder="신념, 지휘, …" aria-label="강점" />
                  </td>
                  <td><label className="check small"><input type="checkbox" checked={!!t.leaving} onChange={e => up({ leaving: e.target.checked || undefined })} /> 예정</label></td>
                  <td><input className="input compact" style={{ width: 150 }} defaultValue={t.note || ''} onBlur={e => up({ note: e.target.value || undefined })} aria-label="비고" /></td>
                  <td><button className="btn sm warn" onClick={() => { if (confirm(`${t.name}을(를) 명단에서 뺄까요? 담임 학생은 미지정이 됩니다.`)) hub.removeTeacher(t.id); }}>삭제</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="row" style={{ padding: '8px 14px' }}>
          {DOMAINS.map(d => <span key={d} className={`st ${DOMAIN_CLS[d]}`}>{d}</span>)}
          <span className="tiny muted">강점 색은 Gallup 4개 영역</span>
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>운영 영역 지정 현황 <span className="tiny muted">(제35조 제4항: 학년도 시작 전 학교장이 지정)</span></h3>
          <table className="t small"><tbody>
            {['교육과정', '생활교육', '행정·대외협력'].map(a => (
              <tr key={a}><td style={{ width: 120 }}><b>{a}</b></td>
                <td>정: {areaOwner(`${a}(정)`).join(', ') || <span className="muted">미지정</span>}</td>
                <td>부: {areaOwner(`${a}(부)`).join(', ') || <span className="muted">미지정</span>}</td></tr>
            ))}
          </tbody></table>
        </div>
        <div className="card">
          <h3>강점으로 본 역할 후보 <span className="tiny muted">(이직 예정 제외)</span></h3>
          <table className="t small"><tbody>
            {ROLE_HINTS.map(h => {
              const fit = hub.teachers.filter(t => !t.leaving && t.role !== '학교장' && t.role !== '목사')
                .map(t => ({ t, n: (t.strengths || []).filter(x => h.themes.includes(x)).length })).filter(x => x.n).sort((a, b) => b.n - a.n);
              return <tr key={h.role}><td style={{ width: 170 }}><b>{h.role}</b><div className="tiny muted">{h.why}</div></td><td>{fit.map(x => `${x.t.name}(${x.n})`).join(', ') || <span className="muted">-</span>}</td></tr>;
            })}
          </tbody></table>
          <p className="tiny muted" style={{ margin: '6px 0 0' }}>괄호 안은 그 역할과 맞는 강점 수. 배치를 정할 때 참고만 하고, 결정은 학교장이 합니다.</p>
        </div>
      </div>

      {preview && (
        <div className="modal-bg" onClick={() => setPreview(null)}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <h2>담임 다시 배정</h2>
            <p className="small muted" style={{ marginTop: 0 }}>초등은 초등 담임에게, 중고등은 나이·성별·반을 섞어 중고등 담임에게 나눕니다. 이직 예정 교사는 뺍니다.</p>
            {preview.warnings.map(w => <div key={w} className="callout gold small" style={{ marginBottom: 6 }}>{w}</div>)}
            <div className="grid g3" style={{ marginTop: 10 }}>
              {hub.teachers.filter(t => Object.values(preview.map).includes(t.id)).map(t => {
                const ss = hub.students.filter(s => preview.map[s.id] === t.id).sort((a, b) => a.birthYear - b.birthYear);
                return (
                  <div key={t.id} className="card" style={{ padding: 12 }}>
                    <div className="spread"><b>{t.name}</b><Badge tone={ss.length > MAX_PER_HOMEROOM ? 'red' : 'line'}>{ss.length}명</Badge></div>
                    <div className="small" style={{ marginTop: 6 }}>{ss.map(s => `${s.name}(${s.classGroup?.replace('반', '') || ''}${s.gender ? '·' + s.gender : ''})`).join(', ')}</div>
                  </div>
                );
              })}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={() => setPreview(null)}>취소</button>
              <button className="btn primary" onClick={() => { hub.setHomerooms(preview.map); setPreview(null); }}>이대로 배정</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
