'use client';
// 과목 운영안 (별지 6, 제21조): 실라버스 형식. 주차별 계획은 학사일정에서 쿼터 주차를 만들어 채운다.
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { SCHOOL_YEAR, QUARTER_LABEL } from '@/lib/rules';
import { md, quarterRange, weeksOf } from '@/lib/weeks';
import type { SyllabusPlan } from '@/lib/types';
import { PageHead, ArtLink, Badge } from '@/components/ui';

const SUBJECTS = ['영어', '수학', '사고력·독서', '영성', '국어', '통합사회 / 통합과학', '한자', '기초교과'];
const TONE = { 작성중: 'gold', 검토: 'orange', 승인: 'green' } as const;

export default function PlansPage() {
  const hub = useHub();
  const auth = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);
  const plan = hub.syllabi.find(p => p.id === openId);
  const newPlan = () => {
    const p: SyllabusPlan = {
      id: hub.newId('sy'), subject: '영어', target: '', year: SCHOOL_YEAR, teacher: auth.me?.teacherId || '', status: '작성중',
      goal: '', profile: '', levels: '', method: '', textbooks: '', readings: '', evaluation: { diagnosis: '', formative: '', final: '' },
      blocks: {}, focus: {}, weekly: {}, notes: '', updatedAt: new Date().toISOString(),
    };
    hub.saveSyllabus(p); setOpenId(p.id);
  };
  const filled = (p: SyllabusPlan) => Object.values(p.weekly).filter(w => w.topic.trim()).length;

  if (plan) return <PlanSheet plan={plan} onBack={() => setOpenId(null)} />;

  return (
    <div className="page">
      <PageHead
        title="과목 운영안"
        desc={<>코어 과목마다 한 부: 목표, 레벨, 수업 방식·교재, 평가, 쿼터별 시간과 주차별 계획. 교육과정 담당 검토 → 학교장 승인, 매년 12월 다음 학년도 확정 <ArtLink no={21} /></>}
        right={<button className="btn primary" onClick={newPlan}>+ 새 과목 운영안</button>}
      />
      <div className="card" style={{ padding: 0 }}>
        <table className="t">
          <thead><tr><th>과목</th><th>대상</th><th>학년도</th><th>담당</th><th>주차 계획</th><th>상태</th><th /></tr></thead>
          <tbody>
            {hub.syllabi.map(p => (
              <tr key={p.id} className="clickable" onClick={() => setOpenId(p.id)}>
                <td><b>{p.subject}</b></td><td className="small">{p.target || '-'}</td><td className="small">{p.year}</td>
                <td className="small">{p.teacher ? hub.teacherName(p.teacher) : '-'}</td><td className="small">{filled(p)}주 작성</td>
                <td><Badge tone={TONE[p.status]}>{p.status}</Badge></td><td style={{ textAlign: 'right' }}><span className="small muted">열기 →</span></td>
              </tr>
            ))}
            {hub.syllabi.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 32 }}>아직 운영안이 없습니다. "새 과목 운영안"으로 시작하세요.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="tiny muted">주차는 <Link href="/admin/calendar">학사일정</Link>의 쿼터 개학·방학으로 자동 계산합니다. 학사일정을 고치면 주차도 바뀝니다.</p>
    </div>
  );
}

function PlanSheet({ plan: p, onBack }: { plan: SyllabusPlan; onBack: () => void }) {
  const hub = useHub();
  const [q, setQ] = useState(1);
  const up = (patch: Partial<SyllabusPlan>) => hub.saveSyllabus({ ...p, ...patch });
  const weeks = useMemo(() => weeksOf(hub.calendar, q), [hub.calendar, q]);
  const range = quarterRange(hub.calendar, q);
  const onWeeks = weeks.filter(w => !w.off);
  const wk = (n: number) => p.weekly[`${q}-${n}`] || { topic: '', task: '' };
  const setWk = (n: number, patch: Partial<{ topic: string; task: string }>) => up({ weekly: { ...p.weekly, [`${q}-${n}`]: { ...wk(n), ...patch } } });
  const area = (v: string, on: (x: string) => void, ph: string, label: string) => <textarea className="paper-area" value={v} onChange={e => on(e.target.value)} placeholder={ph} aria-label={label} />;

  return (
    <div className="page">
      <div className="paper-wrap">
        <div className="paper-top no-print">
          <button className="btn sm" onClick={onBack}>← 목록</button>
          <div className="seg">{(['작성중', '검토', '승인'] as const).map(s => <button key={s} className={p.status === s ? 'on' : ''} onClick={() => up({ status: s })}>{s}</button>)}</div>
          <span style={{ flex: 1 }} />
          <button className="btn sm warn" onClick={() => { if (confirm('이 운영안을 지울까요?')) { hub.removeSyllabus(p.id); onBack(); } }}>삭제</button>
          <button className="btn sm" onClick={() => window.print()}>인쇄</button>
        </div>
        <div className="paper">
          <div className="paper-no">별지 6</div>
          <h1 className="paper-title">과 목 운 영 안</h1>
          <div className="paper-sub">{p.year}학년도 {p.subject}{p.target ? ` · ${p.target}` : ''}</div>

          <table className="paper-table"><tbody>
            <tr>
              <th>과목</th>
              <td><select value={SUBJECTS.includes(p.subject) ? p.subject : ''} onChange={e => up({ subject: e.target.value })} aria-label="과목">{!SUBJECTS.includes(p.subject) && <option value="">{p.subject}</option>}{SUBJECTS.map(x => <option key={x}>{x}</option>)}</select></td>
              <th>대상</th>
              <td><input value={p.target} onChange={e => up({ target: e.target.value })} placeholder="반·레벨 (예: 콜링반, EN-B)" aria-label="대상" /></td>
            </tr>
            <tr>
              <th>학년도</th>
              <td><input type="number" value={p.year} onChange={e => up({ year: Number(e.target.value) })} aria-label="학년도" /></td>
              <th>담당 교사</th>
              <td><select value={p.teacher} onChange={e => up({ teacher: e.target.value })} aria-label="담당 교사"><option value="">선택</option>{hub.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></td>
            </tr>
          </tbody></table>

          <section className="paper-sec">
            <h2>1. 과목 목표</h2>
            <table className="paper-table"><tbody>
              <tr><th>졸업 시점 목표</th><td>{area(p.goal, v => up({ goal: v }), '이 과목을 마친 학생은 무엇을 할 수 있는가 (별표 2 졸업 기준)', '졸업 시점 목표')}</td></tr>
              <tr><th>졸업생 상</th><td><input value={p.profile} onChange={e => up({ profile: e.target.value })} placeholder="연결되는 졸업생 상 (별표 1)" aria-label="졸업생 상" /></td></tr>
              <tr><th>레벨 정의</th><td>{area(p.levels, v => up({ levels: v }), '레벨별로 할 수 있는 것, 진단 도구 (별표 7)', '레벨 정의')}</td></tr>
            </tbody></table>
          </section>

          <section className="paper-sec">
            <h2>2. 수업 방식과 교재</h2>
            <table className="paper-table"><tbody>
              <tr><th>수업 방식</th><td>{area(p.method, v => up({ method: v }), '자기주도·코칭·하브루타·강의 등', '수업 방식')}</td></tr>
              <tr><th>교재</th><td><input value={p.textbooks} onChange={e => up({ textbooks: e.target.value })} aria-label="교재" /></td></tr>
              <tr><th>필독서·독서</th><td><input value={p.readings} onChange={e => up({ readings: e.target.value })} placeholder="필독서와 활용 시점, 하브루타·발표 주제" aria-label="필독서" /></td></tr>
            </tbody></table>
          </section>

          <section className="paper-sec">
            <h2>3. 평가 방법</h2>
            <table className="paper-table"><tbody>
              <tr><th>쿼터 첫 주 진단</th><td><input value={p.evaluation.diagnosis} onChange={e => up({ evaluation: { ...p.evaluation, diagnosis: e.target.value } })} aria-label="진단" /></td></tr>
              <tr><th>본 기간 형성 평가</th><td><input value={p.evaluation.formative} onChange={e => up({ evaluation: { ...p.evaluation, formative: e.target.value } })} placeholder="단원평가, 영단어 시험 등 → 성적 입력" aria-label="형성 평가" /></td></tr>
              <tr><th>마지막 주 점검</th><td><input value={p.evaluation.final} onChange={e => up({ evaluation: { ...p.evaluation, final: e.target.value } })} placeholder="집중학습: 단원평가 / 프로젝트: 결과물 평가" aria-label="점검" /></td></tr>
            </tbody></table>
          </section>

          <section className="paper-sec">
            <h2>4. 주차별 계획</h2>
            <div className="row no-print" style={{ marginBottom: 6 }}>
              <div className="seg">{[1, 2, 3, 4].map(n => <button key={n} className={q === n ? 'on' : ''} onClick={() => setQ(n)}>{n}쿼터</button>)}</div>
              <span className="tiny muted">{range ? `${md(range.start)}–${md(range.end)} · 수업 ${onWeeks.length}주` : '학사일정에 이 쿼터 개학·방학이 없습니다'}</span>
            </div>
            <table className="paper-table"><tbody>
              <tr><th>{QUARTER_LABEL[q]}</th><td>주당 <input style={{ width: 50, display: 'inline-block' }} type="number" min={0} value={p.blocks[q] ?? ''} onChange={e => up({ blocks: { ...p.blocks, [q]: Number(e.target.value) } })} aria-label="주당 블록" /> 블록 · 중점 <input style={{ width: 'calc(100% - 170px)', display: 'inline-block' }} value={p.focus[q] || ''} onChange={e => up({ focus: { ...p.focus, [q]: e.target.value } })} aria-label="중점 내용" /></td></tr>
            </tbody></table>
            <table className="paper-table weekly">
              <thead><tr><th style={{ width: 54 }}>주차</th><th style={{ width: 84 }}>기간</th><th style={{ width: 170 }}>학사일정</th><th>단원·주제</th><th>활동·과제·평가</th></tr></thead>
              <tbody>
                {weeks.map(w => (
                  <tr key={w.mon} className={w.off ? 'off' : w.role ? 'role' : undefined}>
                    <td>{w.off ? '-' : `${w.no}주`}</td>
                    <td className="small">{md(w.mon)}–{md(w.fri)}{!w.off && w.classDays < 5 && <div className="tiny muted">수업 {w.classDays}일</div>}</td>
                    <td className="tiny">{w.events.map(e => e.title).join(', ')}</td>
                    {w.off ? <td colSpan={2} className="small muted">수업 없음</td> : <>
                      <td><input value={wk(w.no).topic} onChange={e => setWk(w.no, { topic: e.target.value })} placeholder={w.role === '진단' ? '진단·레벨 확정 (제25조)' : w.role === '점검' ? '점검·학습 진도 보고서 (제25조)' : ''} aria-label={`${w.no}주 주제`} /></td>
                      <td><input value={wk(w.no).task} onChange={e => setWk(w.no, { task: e.target.value })} aria-label={`${w.no}주 과제`} /></td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="paper-sec">
            <h2>5. 운영상 필요 사항</h2>
            {area(p.notes, v => up({ notes: v }), '교사 협력(로테이션·보조교사), 필요한 자원과 예산, 지난 학년도 대비 바뀐 점', '운영상 필요 사항')}
          </section>
        </div>
      </div>
    </div>
  );
}
