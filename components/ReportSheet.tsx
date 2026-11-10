'use client';
// 학습 진도 보고서 한 장. 화면에서 바로 고치고(editable), 그대로 인쇄한다.
import Link from 'next/link';
import { useHub } from '@/lib/store';
import { DEMO_TODAY } from '@/lib/rules';
import { nextCell } from '@/lib/roadmaps';
import { GED_COLUMNS, gradesFor, inPeriod, periodLabel, roadmapOn } from '@/lib/reports';
import type { ProgressReport } from '@/lib/types';
import RoadmapView from './Roadmap';

interface Props { report: ProgressReport; editable?: boolean; onChange?: (r: ProgressReport) => void }

export default function ReportSheet({ report: r, editable, onChange }: Props) {
  const hub = useHub();
  const s = hub.students.find(x => x.id === r.studentId);
  if (!s) return null;
  // 발송한 보고서는 그때의 로드맵으로 보여 준다
  const progress = r.snapshot || hub.progress[s.id] || {};
  const canEdit = editable && r.status !== '발송';
  const onCell = canEdit ? (item: string) => hub.setProgress(s.id, item, nextCell(progress[item], DEMO_TODAY)) : undefined;
  const { ged, month } = gradesFor(s.id, r.period, hub.grades);
  const set = (patch: Partial<ProgressReport>) => onChange?.({ ...r, ...patch });
  const prayer = hub.prayers[r.period] || '';
  const auto = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } };

  return (
    <div className="rs">
      <div className="rs-title">
        <img src="/hils-logo.png" alt="" />
        <h1>{hub.reportTemplate.title}</h1>
      </div>
      <table className="rs-meta">
        <tbody><tr>
          <th>날짜</th>
          <td>{canEdit ? <input type="date" className="rs-input" value={r.date} onChange={e => set({ date: e.target.value })} aria-label="보고서 날짜" /> : r.date.replace(/-/g, '.')}</td>
          <th>이름</th><td>{s.name}</td>
          <th>기간</th><td>{periodLabel(r.period)}</td>
        </tr></tbody>
      </table>

      {hub.roadmaps.filter(rm => roadmapOn(r, rm.id)).map(rm => (
        <section key={rm.id}><h2>&lt;{rm.subject}&gt;</h2><RoadmapView rm={rm} progress={progress} onCell={onCell} /></section>
      ))}
      {onCell && <p className="rs-hint no-print">로드맵 칸을 누르면 현재 이수 중 → 이수 완료(오늘 날짜) → 면제 → 비움 순으로 바뀝니다. 학생 기록에 저장되어 다음 달 보고서로 이어집니다.</p>}

      {r.sections.grades && (ged.length > 0 || month.length > 0 || canEdit) && (
        <section>
          {ged.length > 0 && <>
            <h2>&lt;검정고시 진단평가&gt;</h2>
            <table className="rs-table">
              <thead><tr><th>문제</th><th>응시일</th>{GED_COLUMNS.map(c => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{ged.map(g => <tr key={g.id}><td>{g.title}</td><td>{g.date.slice(2).replace(/-/g, '.')}</td>{GED_COLUMNS.map(c => <td key={c}>{g.scores[s.id]?.[c] || ''}</td>)}</tr>)}</tbody>
            </table>
          </>}
          {month.length > 0 && <>
            <h2>&lt;평가 결과&gt;</h2>
            <table className="rs-table">
              <thead><tr><th>과목</th><th>평가</th><th>날짜</th><th>점수</th></tr></thead>
              <tbody>{month.map(g => (
                <tr key={g.id}>
                  <td>{g.subject}</td><td>{g.kind === '기타' ? g.title : `${g.kind} · ${g.title}`}</td><td>{g.date.slice(5).replace('-', '.')}</td>
                  <td>{g.columns.map(c => g.scores[s.id]?.[c]).filter(Boolean).join(' / ')}{g.max ? ` / ${g.max}` : ''}</td>
                </tr>
              ))}</tbody>
            </table>
          </>}
          {canEdit && ged.length === 0 && month.length === 0 && <p className="rs-hint no-print">이 기간 성적이 없습니다. <Link href="/records/grades">성적 입력</Link>에서 넣으면 여기에 자동으로 들어갑니다.</p>}
        </section>
      )}

      {r.sections.career && (canEdit || r.career) && (
        <section>
          <h2>&lt;진로 · 입시&gt;</h2>
          {canEdit
            ? <textarea ref={auto} className="rs-area" value={r.career} placeholder="목표 대학·전공, 준비 계획, 이번 쿼터 진행 상황" onChange={e => { auto(e.target); set({ career: e.target.value }); }} aria-label="진로·입시" />
            : <p className="rs-text">{r.career}</p>}
        </section>
      )}

      <section>
        <h2>과목 평가</h2>
        <table className="rs-table rs-comments">
          <tbody>
            {r.comments.map((c, i) => (
              <tr key={i}>
                <th>
                  {canEdit ? <input className="rs-input center" value={c.subject} aria-label="과목"
                    onChange={e => set({ comments: r.comments.map((x, j) => (j === i ? { ...x, subject: e.target.value } : x)) })} /> : c.subject}
                </th>
                <td>
                  {canEdit ? (
                    <div className="rs-comment">
                      <textarea ref={auto} className="rs-area" value={c.text} placeholder={`${c.subject} 수업에서의 모습, 진도, 칭찬할 점`} aria-label={`${c.subject} 평가`}
                        onChange={e => { auto(e.target); set({ comments: r.comments.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }); }} />
                      <button type="button" className="rs-x no-print" title="과목 빼기" onClick={() => set({ comments: r.comments.filter((_, j) => j !== i) })}>×</button>
                    </div>
                  ) : <p className="rs-text">{c.text}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {canEdit && <button type="button" className="btn sm no-print" style={{ marginTop: 6 }} onClick={() => set({ comments: [...r.comments, { subject: '과목', text: '' }] })}>+ 과목 추가</button>}
      </section>

      {r.sections.life !== false && (() => {
        // 제31조 제6항: 상점·벌점 쿼터 합계. 지도 사유·지도 면담(비공개)은 넣지 않는다
        const pub = hub.records.filter(x => x.studentId === s.id && !x.private && inPeriod(x.date, r.period));
        const sum = (t: 'merit' | 'demerit') => pub.filter(x => x.type === t).reduce((a, x) => a + Number(x.data.points || 0), 0);
        return (
          <section>
            <h2>&lt;생활&gt;</h2>
            <table className="rs-table"><tbody><tr><th>상점</th><td>{sum('merit')}점</td><th>벌점</th><td>{sum('demerit')}점</td></tr></tbody></table>
          </section>
        );
      })()}

      {(prayer || canEdit) && (
        <section className="rs-prayer">
          <b>기도제목</b>
          {canEdit
            ? <textarea ref={auto} className="rs-area" value={prayer} placeholder="이 쿼터 모든 보고서에 함께 들어갑니다" onChange={e => { auto(e.target); hub.setPrayer(r.period, e.target.value); }} aria-label="기도제목" />
            : <p className="rs-text">{prayer}</p>}
        </section>
      )}
    </div>
  );
}
