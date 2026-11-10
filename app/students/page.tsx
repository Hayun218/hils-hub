'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHub } from '@/lib/store';
import type { SchoolLevel, Student, StudentStatus } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import StudentEdit from '@/components/StudentEdit';
import { homeroomCandidates } from '@/lib/homeroom';
import { SCHOOL_YEAR, age, gradeLabel } from '@/lib/rules';
import { PageHead, Badge, StatusBadge, ArtLink } from '@/components/ui';

const STATUSES: (StudentStatus | '전체')[] = ['전체', '재학', '체험입학', '문의', '졸업', '퇴교'];

export default function StudentsPage() {
  const hub = useHub();
  const auth = useAuth();
  const mine = auth.me?.teacherId;
  const [status, setStatus] = useState<StudentStatus | '전체'>('재학');
  const [cls, setCls] = useState('전체');
  const [onlyMine, setOnlyMine] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);

  const list = useMemo(() => hub.students
    .filter(s => status === '전체' || s.status === status)
    .filter(s => cls === '전체' || s.classGroup === cls || (!s.classGroup && cls === s.schoolLevel))
    .filter(s => !onlyMine || (mine && s.homeroom === mine))
    .filter(s => !search || s.name.includes(search))
    .sort((a, b) => Number(b.homeroom === mine) - Number(a.homeroom === mine) || b.birthYear - a.birthYear || a.name.localeCompare(b.name)),
  [hub.students, status, cls, onlyMine, mine, search]);

  const activeCount = (tid: string) => hub.students.filter(s => s.homeroom === tid && s.status === '재학').length;
  const homerooms = hub.teachers.filter(t => activeCount(t.id) > 0);
  const noHomeroom = hub.students.filter(s => s.status === '재학' && !s.homeroom).length;

  return (
    <div className="page">
      <PageHead
        title="학생 명단"
        desc={<>{SCHOOL_YEAR}학년도 · 학년은 출생 연도 기준 참고 표기 (제20조 제5항). 이름을 누르면 학생 상세, 편집을 누르면 성별·담임·학적·비고를 고칩니다.</>}
        right={<button className="btn primary" onClick={() => setAdding(true)}>+ 학생 추가</button>}
      />

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="spread">
          <div className="row">
            <div className="seg">{STATUSES.map(s => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s} {s !== '전체' && <span className="tiny">{hub.students.filter(x => x.status === s).length}</span>}</button>)}</div>
            <div className="seg">{['전체', '어니스트반', '드림반', '콜링반'].map(c => <button key={c} className={cls === c ? 'on' : ''} onClick={() => setCls(c)}>{c}</button>)}</div>
            {mine && <label className="check small"><input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} /> 내 담임 학생만</label>}
          </div>
          <input className="input" placeholder="이름 검색" value={search} onChange={e => setSearch(e.target.value)} aria-label="이름 검색" />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="tiny muted">담임별 재학생 (1인 5명 이내, <Link href="/hakchik#art35">제35조</Link>)</span>
          {homerooms.map(t => <Badge key={t.id} tone={activeCount(t.id) > 5 ? 'red' : 'line'}>{t.name} {activeCount(t.id)}</Badge>)}
          {noHomeroom > 0 && <Badge tone="gold">담임 미지정 {noHomeroom}</Badge>}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="t">
          <thead>
            <tr><th>이름</th><th>반</th><th>학년</th><th>성별</th><th>담임</th><th>상태</th><th>비고</th><th /></tr>
          </thead>
          <tbody>
            {list.map(s => (
              <tr key={s.id} className={mine && s.homeroom === mine ? 'mine' : undefined}>
                <td>
                  <Link href={`/students/${s.id}`} style={{ fontWeight: 600 }}>{s.name}</Link>
                  {!s.boarding && <span className="tiny muted"> · 통학</span>}
                  {s.gedThisQuarter && <> <Badge tone="gold">검정고시</Badge></>}
                </td>
                <td className="small">{s.classGroup || s.schoolLevel}</td>
                <td className="small">{gradeLabel(s.birthYear)}{!gradeLabel(s.birthYear).startsWith('만') && <span className="muted"> {age(s.birthYear)}세</span>}</td>
                <td className="small">{s.gender || <span className="muted">-</span>}</td>
                <td className="small">{s.homeroom ? hub.teacherName(s.homeroom) : s.status === '재학' ? <Badge tone="gold">미지정</Badge> : <span className="muted">-</span>}</td>
                <td>
                  <StatusBadge s={s.status} />
                  {s.status === '퇴교' && s.leaveType && <span className="tiny muted"> {s.leaveType}</span>}
                  {s.statusDate && s.status !== '재학' && <div className="tiny muted">{s.statusDate}</div>}
                </td>
                <td className="small note-cell" title={[s.statusReason, s.note].filter(Boolean).join(' / ')}>
                  {s.statusReason && <span>{s.statusReason}</span>}
                  {s.statusReason && s.note && <span className="muted"> · </span>}
                  {s.note && <span className="muted">{s.note}</span>}
                </td>
                <td style={{ textAlign: 'right' }}><button className="btn sm" onClick={() => setEditing(s)}>편집</button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 28 }}>조건에 맞는 학생이 없습니다</td></tr>}
          </tbody>
        </table>
      </div>

      {adding && <AddStudent onClose={() => setAdding(false)} />}
      {editing && <StudentEdit s={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AddStudent({ onClose }: { onClose: () => void }) {
  const hub = useHub();
  const router = useRouter();
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState(2013);
  const [boarding, setBoarding] = useState(true);
  const [homeroom, setHomeroom] = useState('');
  const [guardian, setGuardian] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<StudentStatus>('체험입학');
  const schoolLevel: SchoolLevel = SCHOOL_YEAR - birthYear - 6 <= 6 ? '초등' : '중고등';
  const teachers = homeroomCandidates(hub.teachers);

  const save = () => {
    if (!name.trim()) return;
    const s = hub.addStudent({ name: name.trim(), birthYear, schoolLevel, boarding, status, homeroom, guardian, guardianPhone: phone, consent: false, devicesSubmitted: false });
    onClose();
    router.push(`/students/${s.id}`);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>학생 추가</h2>
        <p className="small muted" style={{ marginTop: 0 }}>체험 입학으로 등록하면 3주 동안 별지 2 진단을 기록하고, 교사회 심사 후 재학으로 바꿉니다. <ArtLink no={28} /></p>
        <div className="grid g2">
          <label className="field">이름<input value={name} onChange={e => setName(e.target.value)}  autoFocus /></label>
          <label className="field">출생 연도
            <select value={birthYear} onChange={e => setBirthYear(Number(e.target.value))}>
              {Array.from({ length: 13 }, (_, i) => 2008 + i).map(y => <option key={y} value={y}>{y} ({gradeLabel(y)})</option>)}
            </select>
          </label>
          <label className="field">상태
            <select value={status} onChange={e => setStatus(e.target.value as StudentStatus)}><option>문의</option><option>체험입학</option></select>
          </label>
          <label className="field">담임 (제35조)
            <select value={homeroom} onChange={e => setHomeroom(e.target.value)}>
              <option value="">미지정</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name} (현재 {hub.students.filter(s => s.homeroom === t.id && s.status === '재학').length}명)</option>)}
            </select>
          </label>
          <label className="field">보호자<input value={guardian} onChange={e => setGuardian(e.target.value)} /></label>
          <label className="field">보호자 연락처<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-" /></label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <label className="check"><input type="checkbox" checked={boarding} onChange={e => setBoarding(e.target.checked)} /> 기숙</label>
          <Badge tone="line">학교급 자동: {schoolLevel}</Badge>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn" onClick={onClose}>취소</button>
          <button className="btn primary" onClick={save} disabled={!name.trim()}>등록하고 학생 기록 열기</button>
        </div>
      </div>
    </div>
  );
}
