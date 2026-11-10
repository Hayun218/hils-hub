'use client';
// 학생 한 명의 정보 수정 (학생 명단, 학생 상세에서 함께 쓴다). 권한은 나중에 정한다.
import { useState } from 'react';
import { useHub } from '@/lib/store';
import { DEMO_TODAY, gradeLabel } from '@/lib/rules';
import type { Gender, GedLevel, LeaveType, Student, StudentStatus } from '@/lib/types';
import { ArtLink } from './ui';
import { homeroomCandidates } from '@/lib/homeroom';

const STATUSES: StudentStatus[] = ['문의', '체험입학', '재학', '졸업', '퇴교'];
const LEAVE: { k: LeaveType; d: string }[] = [
  { k: '자퇴', d: '보호자 신청 (제34조 제1항 제1호)' },
  { k: '퇴학', d: '학교장 결정 (제34조 제1항 제2호)' },
  { k: '전학', d: '다른 학교로 옮김' },
];
const CLASSES = ['어니스트반', '드림반', '콜링반'];

export default function StudentEdit({ s, onClose }: { s: Student; onClose: () => void }) {
  const hub = useHub();
  const [v, setV] = useState<Student>(s);
  const set = (patch: Partial<Student>) => setV(x => ({ ...x, ...patch }));
  const changed = JSON.stringify(v) !== JSON.stringify(s);
  const needsReason = v.status === '퇴교' && !v.statusReason?.trim();
  const save = () => {
    const out = { ...v, name: v.name.trim() };
    if (out.status !== '퇴교') out.leaveType = undefined;
    if (out.status !== s.status && !out.statusDate) out.statusDate = DEMO_TODAY;
    hub.updateStudent(s.id, out);
    onClose();
  };
  const counts = (tid: string) => hub.students.filter(x => x.homeroom === tid && x.status === '재학' && x.id !== s.id).length;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal wide" onClick={e => e.stopPropagation()}>
        <div className="spread"><h2>{s.name} 정보 수정</h2><span className="tiny muted">{gradeLabel(v.birthYear)}</span></div>

        <h4 className="modal-sec">기본 정보</h4>
        <div className="grid g3">
          <label className="field">이름<input value={v.name} onChange={e => set({ name: e.target.value })} /></label>
          <label className="field">출생 연도
            <select value={v.birthYear} onChange={e => set({ birthYear: Number(e.target.value) })}>
              {Array.from({ length: 16 }, (_, i) => 2006 + i).map(y => <option key={y} value={y}>{y} ({gradeLabel(y)})</option>)}
            </select>
          </label>
          <label className="field">반
            <select value={v.classGroup || ''} onChange={e => set({ classGroup: e.target.value || undefined, schoolLevel: e.target.value === '어니스트반' ? '초등' : e.target.value ? '중고등' : v.schoolLevel })}>
              <option value="">없음</option>{CLASSES.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">성별
            <select value={v.gender || ''} onChange={e => set({ gender: (e.target.value || undefined) as Gender | undefined })}><option value="">-</option><option>남</option><option>여</option></select>
          </label>
          <label className="field">담임
            <select value={v.homeroom} onChange={e => set({ homeroom: e.target.value })}>
              <option value="">미지정</option>
              {homeroomCandidates(hub.teachers, s.homeroom).map(t => <option key={t.id} value={t.id}>{t.name} (현재 {counts(t.id)}명)</option>)}
            </select>
            <span className="tiny muted">1인 5명 이내 (제35조)</span>
          </label>
          <div className="field">생활
            <div className="row" style={{ paddingTop: 6 }}>
              <label className="check small"><input type="checkbox" checked={v.boarding} onChange={e => set({ boarding: e.target.checked })} /> 기숙</label>
              <label className="check small"><input type="checkbox" checked={!v.dutyExempt} onChange={e => set({ dutyExempt: !e.target.checked })} /> 당번 참여</label>
              <label className="check small" title="제24조 제3항: 시험이 있는 쿼터에는 개별 집중학습 시간표"><input type="checkbox" checked={!!v.gedThisQuarter} onChange={e => set({ gedThisQuarter: e.target.checked })} /> 이번 쿼터 개별 시간표</label>
            </div>
          </div>
        </div>

        <div className="grid g3" style={{ marginTop: 10 }}>
          <label className="field">영어 레벨 (별표 7)<select value={v.enLevel || ''} onChange={e => set({ enLevel: e.target.value || undefined })}><option value="">-</option>{['EN-E', 'EN-MH', 'EN-B', 'EN-A'].map(l => <option key={l}>{l}</option>)}</select></label>
          <label className="field">수학 레벨 (별표 7)<select value={v.mathLevel || ''} onChange={e => set({ mathLevel: e.target.value || undefined })}><option value="">-</option>{['초등', 'M-C', 'M-B', 'M-A'].map(l => <option key={l}>{l}</option>)}</select></label>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="small muted">검정고시 응시</span>
          {(['초졸', '중졸', '고졸'] as GedLevel[]).map(l => (
            <label key={l} className="check small"><input type="checkbox" checked={(v.gedLevels || []).includes(l)} onChange={e => set({ gedLevels: e.target.checked ? [...(v.gedLevels || []), l] : (v.gedLevels || []).filter(x => x !== l) })} /> {l}</label>
          ))}
        </div>

        <h4 className="modal-sec">보호자</h4>
        <div className="grid g3">
          <label className="field">보호자<input value={v.guardian} onChange={e => set({ guardian: e.target.value })} /></label>
          <label className="field">연락처<input value={v.guardianPhone} onChange={e => set({ guardianPhone: e.target.value })} placeholder="010-" /></label>
          <div className="field">동의·제출
            <div className="row" style={{ paddingTop: 6 }}>
              <label className="check small"><input type="checkbox" checked={v.consent} onChange={e => set({ consent: e.target.checked })} /> 기록 동의</label>
              <label className="check small"><input type="checkbox" checked={v.devicesSubmitted} onChange={e => set({ devicesSubmitted: e.target.checked })} /> 전자기기 제출</label>
            </div>
          </div>
        </div>

        <h4 className="modal-sec">학적 상태 <ArtLink no={34} /></h4>
        <div className="seg" style={{ marginBottom: 10 }}>
          {STATUSES.map(st => <button key={st} className={v.status === st ? 'on' : ''} onClick={() => set({ status: st, statusDate: st === s.status ? s.statusDate : DEMO_TODAY })}>{st}</button>)}
        </div>
        {v.status === '퇴교' && (
          <div className="row" style={{ marginBottom: 10 }}>
            {LEAVE.map(l => (
              <label key={l.k} className={`choice-card${v.leaveType === l.k ? ' on' : ''}`}>
                <input type="radio" name="leave" checked={v.leaveType === l.k} onChange={() => set({ leaveType: l.k })} />
                <b>{l.k}</b><span className="tiny muted">{l.d}</span>
              </label>
            ))}
          </div>
        )}
        <div className="grid" style={{ gridTemplateColumns: '180px minmax(0, 1fr)' }}>
          <label className="field">{v.status === '퇴교' ? '퇴교일' : v.status === '졸업' ? '졸업일' : '상태 변경일'}<input type="date" value={v.statusDate || ''} onChange={e => set({ statusDate: e.target.value || undefined })} /></label>
          <label className="field">{v.status === '퇴교' ? `${v.leaveType || '퇴교'} 사유` : '사유'}
            <input value={v.statusReason || ''} onChange={e => set({ statusReason: e.target.value })} placeholder={v.status === '퇴교' ? (v.leaveType === '전학' ? '예: 가정 이사로 ○○학교 전학' : '보호자 신청 내용 또는 학교장 결정 사유') : ''} />
          </label>
        </div>
        {v.status === '퇴교' && v.leaveType === '퇴학' && <p className="tiny muted" style={{ margin: '6px 0 0' }}>퇴학 결정 전에는 학생·보호자 면담과 교사회 의견 청취를 거치고, 결정은 사유와 함께 서면으로 알립니다 (제34조 제2항).</p>}
        <label className="field" style={{ marginTop: 10 }}>비고<textarea value={v.note || ''} onChange={e => set({ note: e.target.value })} /></label>
        {v.status !== '재학' && (
          <label className="field" style={{ marginTop: 10 }}>기록 보관 링크 (학생 상세에서 ZIP을 내려받아 드라이브에 올린 뒤)
            <input value={v.archiveUrl || ''} onChange={e => set({ archiveUrl: e.target.value || undefined, archivedAt: e.target.value ? (v.archivedAt || DEMO_TODAY) : undefined })} placeholder="https://drive.google.com/…" />
          </label>
        )}

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          {needsReason && <span className="tiny muted">퇴교는 사유를 남겨 주세요</span>}
          <button className="btn" onClick={onClose}>취소</button>
          <button className="btn primary" onClick={save} disabled={!changed || !v.name.trim()}>저장</button>
        </div>
      </div>
    </div>
  );
}
