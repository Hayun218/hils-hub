'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useHub } from '@/lib/store';
import type { RecordType, Student } from '@/lib/types';
import {
  DEMO_TODAY, QUARTER_LABEL, age, demeritsInQuarter, gradeLabel,
  guidanceCount, meritsInQuarter, quarterOf, stageFor,
} from '@/lib/rules';
import { PageHead, Stat, Badge, StatusBadge, ArtLink } from '@/components/ui';
import StudentEdit from '@/components/StudentEdit';
import StudentTop from '@/components/StudentFlow';
import GedPanel from '@/components/GedPanel';
import { TYPE_LABEL, RecordItem } from '@/components/RecordForms';
import { useOpenReport } from '@/components/useOpenReport';
import { periodOf, gradesFor, periodLabel } from '@/lib/reports';
import { currentItems } from '@/lib/roadmaps';


export default function StudentPage() {
  const { id } = useParams<{ id: string }>();
  const hub = useHub();
  const s = hub.students.find(x => x.id === id);
  const [filter, setFilter] = useState<RecordType | '전체'>('전체');
  const [admitting, setAdmitting] = useState(false);
  const [editing, setEditing] = useState(false);

  const openReport = useOpenReport(periodOf(DEMO_TODAY));
  const records = useMemo(() => hub.records.filter(r => r.studentId === id).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), [hub.records, id]);
  if (!s) return <div className="page"><p>학생을 찾을 수 없습니다. <Link href="/students">명단으로</Link></p></div>;

  const q = quarterOf(DEMO_TODAY);
  const merits = meritsInQuarter(hub.records, s.id, q);
  const demerits = demeritsInQuarter(hub.records, s.id, q);
  const gCount = guidanceCount(hub.records, s.id);
  const stage = stageFor(gCount);
  const readings = records.filter(r => r.type === 'reading').length;
  const shown = filter === '전체' ? records : records.filter(r => r.type === filter);


  return (
    <div className="page">
      <PageHead
        title={s.name}
        desc={<>{gradeLabel(s.birthYear)}{gradeLabel(s.birthYear).startsWith('만') ? '' : ` · ${age(s.birthYear)}세`} · {s.schoolLevel} · {s.boarding ? '기숙' : '통학'} · 담임 {hub.teacherName(s.homeroom)}</>}
        right={<>
          <StatusBadge s={s.status} />
          {s.status === '문의' && <button className="btn" onClick={() => hub.updateStudent(s.id, { status: '체험입학' })}>체험 입학 시작</button>}
          {s.status === '체험입학' && <button className="btn primary" onClick={() => setAdmitting(true)}>입학 처리</button>}
          <button className="btn" onClick={() => setEditing(true)}>정보 수정</button>
          <Link className="btn" href="/students">명단</Link>
        </>}
      />

      <StudentTop s={s} />

      {s.status === '재학' && (
        <div className="grid g4" style={{ marginBottom: 16 }}>
          <Stat k={`${QUARTER_LABEL[q]} 상점`} v={merits} s="벌점과 상쇄하지 않음" />
          <Stat k={`${q}쿼터 벌점`} v={<span style={{ color: demerits >= 5 ? 'var(--red)' : undefined }}>{demerits}</span>} s={`다음 지도 사유까지 ${5 - (demerits % 5)}점`} />
          <Stat k="지도 사유 (학년도 누적)" v={gCount} s={stage ? stage.label : '없음'} />
          <Stat k="독서" v={`${readings}권`} s="졸업 기준은 별표 2" />
        </div>
      )}


      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)' }}>
        <div className="stack">
          <div className="card">
            <h3>바로가기 <span className="tiny muted">기록은 각 화면에서 씁니다</span></h3>
            <div className="quick-links">
              {s.status === '체험입학'
                ? <Link className="btn" href={`/forms/2?new=1&student=${s.id}`}>체험 입학 진단 (별지 2)</Link>
                : <>
                  <Link className="btn" href={`/records/interviews?new=1&student=${s.id}`}>면담 일지 쓰기</Link>
                  <Link className="btn" href="/records/life">상점·벌점</Link>
                  <Link className="btn" href={`/records/life?sheet=incident&student=${s.id}`}>생활·훈육 기록지</Link>
                  <Link className="btn" href="/records/grades">성적 입력</Link>
                  <Link className="btn" href="/records/attendance">출석</Link>
                  <button className="btn" onClick={() => openReport(s)}>{q}쿼터 진도 보고서</button>
                </>}
            </div>
          </div>

          <QuarterSummary s={s} />

          <GedPanel s={s} />

          <div className="card">
            <h3>학생 정보</h3>
            <table className="t"><tbody>
              <tr><td className="muted">보호자</td><td>{s.guardian} · {s.guardianPhone}</td></tr>
              <tr><td className="muted">레벨</td><td>영어 {s.enLevel || '-'} · 수학 {s.mathLevel || '-'}</td></tr>
              <tr><td className="muted">기록 동의</td><td>{s.consent ? <Badge tone="green">동의</Badge> : <Badge tone="red">미동의</Badge>} <ArtLink no={28} /></td></tr>
              <tr><td className="muted">전자기기 제출</td><td>{s.devicesSubmitted ? <Badge tone="green">제출</Badge> : <Badge tone="line">미제출</Badge>} <ArtLink no={31} /></td></tr>
              {s.admittedAt && <tr><td className="muted">입학일</td><td>{s.admittedAt}</td></tr>}
              {s.status === '퇴교' && <tr><td className="muted">퇴교</td><td>{s.leaveType || '-'} · {s.statusDate || ''} · {s.statusReason || ''}</td></tr>}
              {s.note && <tr><td className="muted">비고</td><td style={{ whiteSpace: 'pre-wrap' }}>{s.note}</td></tr>}
            </tbody></table>
          </div>
        </div>

        <div className="card">
          <div className="spread" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>학생 기록 <span className="tiny muted">{records.length}건</span></h3>
            <select className="input" value={filter} onChange={e => setFilter(e.target.value as RecordType | '전체')} aria-label="기록 종류">
              <option value="전체">전체</option>
              {(Object.keys(TYPE_LABEL) as RecordType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <ul className="timeline">
            {shown.map(r => <RecordItem key={r.id} r={r} />)}
            {shown.length === 0 && <li><span /><span className="muted small">기록이 없습니다</span></li>}
          </ul>
        </div>
      </div>

      {admitting && <AdmitModal s={s} onClose={() => setAdmitting(false)} />}
      {editing && <StudentEdit s={s} onClose={() => setEditing(false)} />}
    </div>
  );
}

const LEVELS: Record<string, string[]> = { 영어: ['EN-E', 'EN-MH', 'EN-B', 'EN-A'], 수학: ['초등', 'M-C', 'M-B', 'M-A'] };

function AdmitModal({ s, onClose }: { s: Student; onClose: () => void }) {
  const hub = useHub();
  const [consent, setConsent] = useState(false);
  const [devices, setDevices] = useState(false);
  const [en, setEn] = useState(s.schoolLevel === '초등' ? 'EN-E' : 'EN-MH');
  const [math, setMath] = useState(s.schoolLevel === '초등' ? '초등' : 'M-C');
  const ok = consent && devices;
  const admit = () => {
    hub.updateStudent(s.id, { status: '재학', consent, devicesSubmitted: devices, enLevel: en, mathLevel: math, admittedAt: DEMO_TODAY });
    hub.addRecord({ studentId: s.id, type: 'level', date: DEMO_TODAY, title: `입학 레벨 확정 영어 ${en} · 수학 ${math}`, author: s.homeroom, private: false, data: { subject: '영어·수학', from: '', to: `${en} / ${math}` } });
    onClose();
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{s.name} 입학 처리</h2>
        <p className="small muted" style={{ marginTop: 0 }}>교사회 심사(별지 2)를 마친 뒤 진행합니다. <ArtLink no={28} /></p>
        <div className="stack">
          <label className="check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> 학생 기록 수집·이용 동의서를 받았다 (제28조 제4항)</label>
          <label className="check"><input type="checkbox" checked={devices} onChange={e => setDevices(e.target.checked)} /> 전자기기를 제출받아 잠금 보관했다 (제31조 제2항)</label>
          <div className="grid g2">
            <label className="field">영어 레벨<select value={en} onChange={e => setEn(e.target.value)}>{LEVELS.영어.map(l => <option key={l}>{l}</option>)}</select></label>
            <label className="field">수학 레벨<select value={math} onChange={e => setMath(e.target.value)}>{LEVELS.수학.map(l => <option key={l}>{l}</option>)}</select></label>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn" onClick={onClose}>취소</button>
          <button className="btn primary" onClick={admit} disabled={!ok}>재학으로 전환</button>
        </div>
      </div>
    </div>
  );
}

/** 이번 쿼터 요약: 출결, 진도 보고서, 로드맵에서 지금 배우는 것, 성적 */
function QuarterSummary({ s }: { s: Student }) {
  const hub = useHub();
  const period = periodOf(DEMO_TODAY);
  const q = quarterOf(DEMO_TODAY);
  const days = Object.entries(hub.attendance).filter(([d, v]) => v[s.id] && quarterOf(d) === q && d.startsWith(DEMO_TODAY.slice(0, 4)));
  const cnt = (st: string) => days.filter(([, v]) => v[s.id].status === st).length;
  const rep = hub.reports.find(r => r.studentId === s.id && r.period === period);
  const now = hub.roadmaps.flatMap(rm => currentItems(rm, hub.progress[s.id]).map(x => `${rm.subject} · ${x}`));
  const { ged, month } = gradesFor(s.id, period, hub.grades);
  return (
    <div className="card">
      <h3>{periodLabel(period)} 요약</h3>
      <table className="t small"><tbody>
        <tr><td className="muted" style={{ width: 110 }}>출결</td><td>{days.length ? `기록 ${days.length}일 · 지각 ${cnt('지각')} · 결석 ${cnt('결석')} · 조퇴 ${cnt('조퇴')}` : '기록 없음'}</td></tr>
        <tr><td className="muted">진도 보고서</td><td>{rep ? `${rep.status} · 과목 평가 ${rep.comments.filter(c => c.text.trim()).length}/${rep.comments.length}` : '아직 없음'}</td></tr>
        <tr><td className="muted">지금 배우는 것</td><td>{now.length ? now.join(', ') : <span className="muted">로드맵 미입력</span>}</td></tr>
        <tr><td className="muted">평가</td><td>{month.length ? month.map(g => `${g.subject} ${g.title} ${g.columns.map(c => g.scores[s.id]?.[c]).filter(Boolean).join('/')}`).join(' · ') : '이번 쿼터 성적 없음'}{ged.length ? ` · 검정고시 진단 ${ged.length}회` : ''}</td></tr>
      </tbody></table>
    </div>
  );
}
