'use client';
import { useState } from 'react';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { DEMO_TODAY, gradeLabel } from '@/lib/rules';
import type { AttendanceStatus, Student } from '@/lib/types';
import { PageHead, ArtLink, Badge } from '@/components/ui';

const STATUSES: AttendanceStatus[] = ['출석', '지각', '결석', '조퇴', '외출'];
const MARK: Record<AttendanceStatus, string> = { 출석: '○', 지각: '지', 결석: '결', 조퇴: '조', 외출: '외' };
const CLASSES = ['전체', '어니스트반', '드림반', '콜링반'];
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

const shift = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00`);
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export default function AttendancePage() {
  const hub = useHub();
  const [date, setDate] = useState(DEMO_TODAY);
  const [tab, setTab] = useState<'일별' | '월별'>('일별');
  const [cls, setCls] = useState('전체');
  const students = hub.students.filter(s => s.status === '재학' && (cls === '전체' || s.classGroup === cls))
    .sort((a, b) => b.birthYear - a.birthYear || a.name.localeCompare(b.name));
  const day = hub.attendance[date] || {};
  const count = (st: AttendanceStatus) => students.filter(s => day[s.id]?.status === st).length;
  const dow = new Date(`${date}T00:00:00`).getDay();

  return (
    <div className="page">
      <PageHead
        title="출석 현황"
        desc={<>등교 시간 이후 도착은 지각, 결석·조퇴는 보호자가 담임에게 미리 알립니다 <ArtLink no={31} label="제31조 제7항·제8항" /></>}
      />
      <div className="tabs">
        <button className={tab === '일별' ? 'on' : ''} onClick={() => setTab('일별')}>일별 체크</button>
        <button className={tab === '월별' ? 'on' : ''} onClick={() => setTab('월별')}>월별 현황</button>
      </div>

      <div className="card spread" style={{ marginBottom: 12 }}>
        <div className="row">
          <button className="btn sm" onClick={() => setDate(shift(date, -1))} aria-label="전날">←</button>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} aria-label="날짜" />
          <button className="btn sm" onClick={() => setDate(shift(date, 1))} aria-label="다음날">→</button>
          <span className="small muted">{DOW[dow]}요일{date === DEMO_TODAY ? ' · 오늘' : ''}</span>
        </div>
        <div className="seg">{CLASSES.map(c => <button key={c} className={cls === c ? 'on' : ''} onClick={() => setCls(c)}>{c}</button>)}</div>
      </div>

      {tab === '일별' ? (
        <>
          <div className="row" style={{ marginBottom: 10 }}>
            {STATUSES.map(st => <Badge key={st} tone={st === '출석' ? 'green' : st === '결석' ? 'red' : 'gold'}>{st} {count(st)}</Badge>)}
            <Badge tone="line">미기록 {students.filter(s => !day[s.id]).length}</Badge>
            <button className="btn sm primary" style={{ marginLeft: 'auto' }} onClick={() => students.forEach(s => { if (!day[s.id]) hub.setAttendance(date, s.id, { status: '출석' }); })}>미기록 모두 출석</button>
          </div>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="t">
              <thead><tr><th>이름</th><th>반</th><th>출결</th><th>사유 · 메모</th></tr></thead>
              <tbody>{students.map(s => <AttRow key={s.id} s={s} date={date} />)}</tbody>
            </table>
          </div>
        </>
      ) : <Monthly month={date.slice(0, 7)} students={students} />}
    </div>
  );
}

function AttRow({ s, date }: { s: Student; date: string }) {
  const hub = useHub();
  const auth = useAuth();
  const e = hub.attendance[date]?.[s.id];
  const demerit = hub.records.some(r => r.studentId === s.id && r.type === 'demerit' && r.date === date && r.title === '지각');
  return (
    <tr>
      <td><b>{s.name}</b> <span className="tiny muted">{gradeLabel(s.birthYear)}</span></td>
      <td className="small">{s.classGroup || s.schoolLevel}</td>
      <td>
        <div className="seg att">
          {STATUSES.map(st => (
            <button key={st} className={e?.status === st ? `on s-${st}` : ''} onClick={() => hub.setAttendance(date, s.id, e?.status === st ? null : { status: st, note: e?.note })}>{st}</button>
          ))}
        </div>
      </td>
      <td>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input className="input" style={{ flex: 1, minWidth: 140 }} value={e?.note || ''} placeholder={e && e.status !== '출석' ? '사유 (보호자 연락 여부 등)' : ''} disabled={!e}
            onChange={ev => hub.setAttendance(date, s.id, { status: e!.status, note: ev.target.value })} aria-label={`${s.name} 사유`} />
          {e?.status === '지각' && (demerit
            ? <Badge tone="orange">벌점 1 · 저녁 설거지</Badge>
            : <button className="btn sm" title="별표 8: 지각 벌점 1점, 즉시 조치 당일 저녁 설거지" onClick={() => hub.addRecord({ studentId: s.id, type: 'demerit', date, title: '지각', author: auth.me?.teacherId || s.homeroom, private: false, data: { points: 1, area: '생활', action: '당일 저녁 설거지' } })}>벌점 1 + 저녁 설거지</button>)}
        </div>
      </td>
    </tr>
  );
}

function Monthly({ month, students }: { month: string; students: Student[] }) {
  const hub = useHub();
  const [y, m] = month.split('-').map(Number);
  const days = Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
    .filter(d => { const w = new Date(`${d}T00:00:00`).getDay(); return w !== 0 && w !== 6; });
  return (
    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
      <table className="t att-month">
        <thead>
          <tr><th>이름</th>{days.map(d => <th key={d} className="num">{Number(d.slice(8))}</th>)}<th className="num">지각</th><th className="num">결석</th><th className="num">조퇴</th></tr>
        </thead>
        <tbody>
          {students.map(s => {
            const sts = days.map(d => hub.attendance[d]?.[s.id]?.status);
            const n = (x: AttendanceStatus) => sts.filter(v => v === x).length;
            return (
              <tr key={s.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{s.name}</td>
                {sts.map((v, i) => <td key={i} className={`num m-${v || 'none'}`}>{v ? MARK[v] : ''}</td>)}
                <td className="num">{n('지각') || ''}</td><td className="num">{n('결석') || ''}</td><td className="num">{n('조퇴') || ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="tiny muted" style={{ padding: '8px 14px', margin: 0 }}>○ 출석 · 지 지각 · 결 결석 · 조 조퇴 · 외 외출 (주말 제외)</p>
    </div>
  );
}
