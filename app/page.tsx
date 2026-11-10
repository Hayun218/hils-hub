'use client';
import Link from 'next/link';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { DEMO_TODAY, QUARTER_LABEL, guidanceCount, lateDishes, quarterOf, stageFor, won } from '@/lib/rules';
import { fmtRange, upcoming } from '@/lib/calendar';
import { periodLabel, periodOf } from '@/lib/reports';
import { Badge } from '@/components/ui';
import CadenceTodos from '@/components/CadenceTodos';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export default function Dashboard() {
  const hub = useHub();
  const auth = useAuth();
  const today = DEMO_TODAY;
  const period = periodOf(today);
  const active = hub.students.filter(s => s.status === '재학');

  // 학습 진도 보고서
  const reports = hub.reports.filter(r => r.period === period);
  const reportDone = reports.filter(r => r.status !== '작성중').length;
  const noReport = active.filter(s => !reports.some(r => r.studentId === s.id));

  // 출석
  const day = hub.attendance[today] || {};
  const checked = active.filter(s => day[s.id]).length;
  const absent = active.filter(s => day[s.id]?.status === '결석').length;
  const late = active.filter(s => day[s.id]?.status === '지각').length;

  // 지도 면담 대기 (제33조)
  const pendingGuidance = active.flatMap(s => {
    const n = guidanceCount(hub.records, s.id);
    if (!n) return [];
    const st = stageFor(n)!;
    const done = hub.records.some(r => r.studentId === s.id && r.type === 'interview' && r.data.kind === '지도' && Number(r.data.step) === st.step);
    return done ? [] : [{ s, st }];
  });
  const waitingPurchase = hub.purchases.filter(p => p.status === '신청');
  const pendingAccounts = can(auth.me, 'admin') ? auth.accounts.filter(a => a.status === '대기').length : 0;

  const todos: { label: string; href: string; n: number; tone?: 'red' | 'gold' }[] = [
    { label: `${periodLabel(period)} 학습 진도 보고서 작성 전`, href: '/reports', n: noReport.length + (reports.length - reportDone), tone: 'gold' },
    { label: '오늘 출석 미기록', href: '/records/attendance', n: active.length - checked, tone: 'gold' },
    { label: '지도 면담 대기 (제33조)', href: '/records/interviews', n: pendingGuidance.length, tone: 'red' },
    { label: '구입 신청 결재 대기', href: '/admin/accounting', n: waitingPurchase.length },
    ...(pendingAccounts ? [{ label: '가입 승인 대기', href: '/admin/users', n: pendingAccounts, tone: 'red' as const }] : []),
  ];
  const d = new Date(today);

  // 담임 계정: 내 담임 학생의 할 일 (제35조 제3항: 월 1회 모임, 쿼터마다 개별 면담)
  const me = auth.me?.teacherId;
  const q = quarterOf(today);
  const mine = me ? active.filter(s => s.homeroom === me) : [];
  const myTodos = mine.map(s => {
    const r = reports.find(x => x.studentId === s.id);
    const items: { label: string; href: string; tone: 'gold' | 'red' }[] = [];
    if (!r || r.status === '작성중') items.push({ label: r ? '진도 보고서 작성 중' : '진도 보고서 미작성', href: '/reports', tone: 'gold' });
    if (!day[s.id]) items.push({ label: '오늘 출석', href: '/records/attendance', tone: 'gold' });
    if (!hub.records.some(x => x.studentId === s.id && x.type === 'interview' && x.data.kind === '정기' && quarterOf(x.date) === q && x.date.startsWith(today.slice(0, 4))))
      items.push({ label: `${q}쿼터 정기 면담`, href: '/records/interviews', tone: 'gold' });
    const g = pendingGuidance.find(x => x.s.id === s.id);
    if (g) items.push({ label: `지도 면담 ${g.st.step}단계`, href: '/records/interviews', tone: 'red' });
    return { s, items };
  }).sort((a, b) => b.items.length - a.items.length);

  return (
    <div className="page">
      <div className="dash-head">
        <div>
          <h1>안녕하세요, {auth.me?.name}님</h1>
          <p>{today} ({DOW[d.getDay()]}) · {QUARTER_LABEL[quarterOf(today)]}</p>
        </div>
        <div className="row">
          <Link className="btn" href="/records/attendance">출석 체크</Link>
          <Link className="btn" href="/records/grades">성적 입력</Link>
          <Link className="btn primary" href="/reports">진도 보고서 쓰기</Link>
        </div>
      </div>

      {me ? (
        <div className="card my-students">
          <div className="spread"><h2 style={{ margin: 0 }}>내 담임 학생 {mine.length}명</h2><Link className="small" href="/students">학생 명단 →</Link></div>
          {mine.length === 0 ? <p className="small muted">담임 학생이 없습니다. 학생 명단이나 교직원 화면에서 담임을 배정하세요.</p> : (
            <ul className="todo">
              {myTodos.map(({ s, items }) => (
                <li key={s.id}>
                  <Link href={`/students/${s.id}`}><b>{s.name}</b> <span className="tiny muted">{s.classGroup}</span></Link>
                  <span className="row" style={{ gap: 4 }}>
                    {items.length ? items.map(i => <Link key={i.label} href={i.href} className={`chip todo-chip ${i.tone}`}>{i.label}</Link>) : <span className="tiny muted">할 일 없음</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="callout small" style={{ marginBottom: 16 }}>
          이 계정은 교사와 연결되어 있지 않습니다. {can(auth.me, 'admin') ? <><Link href="/admin/users">계정 승인 · 권한</Link>에서 교사와 연결하면 </> : '관리자가 교사와 연결하면 '}내 담임 학생의 할 일이 여기에 먼저 나옵니다.
        </div>
      )}

      <CadenceTodos students={mine.length ? mine : active} today={today} scope={mine.length ? '내 담임 학생' : '전체 재학생'} />

      <div className="grid g4">
        <Tile k="재학생" v={`${active.length}명`} s={`초등 ${active.filter(s => s.schoolLevel === '초등').length} · 중고등 ${active.filter(s => s.schoolLevel === '중고등').length}`} href="/students" />
        <Tile k="오늘 출석" v={`${checked}/${active.length}`} s={checked ? `결석 ${absent} · 지각 ${late}` : '아직 기록 전'} href="/records/attendance" />
        <Tile k={`${quarterOf(today)}쿼터 진도 보고서`} v={`${reportDone}/${active.length}`} s="검토 완료 · 발송" href="/reports" bar={active.length ? reportDone / active.length : 0} />
        <Tile k="결재 대기" v={`${waitingPurchase.length}건`} s={won(waitingPurchase.reduce((a, p) => a + p.amount, 0))} href="/admin/accounting" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', marginTop: 16 }}>
        <div className="card">
          <h2>할 일</h2>
          <ul className="todo">
            {todos.map(t => (
              <li key={t.label}>
                <Link href={t.href}>{t.label}</Link>
                {t.n > 0 ? <Badge tone={t.tone || 'line'}>{t.n}</Badge> : <span className="tiny muted">완료</span>}
              </li>
            ))}
          </ul>
          {lateDishes(hub.records, today).length > 0 && (
            <div className="callout gold small" style={{ marginTop: 10 }}>
              오늘 저녁 설거지 (지각, 별표 8 즉시 조치): {lateDishes(hub.records, today).map(id => hub.students.find(s => s.id === id)?.name).join(', ')}
            </div>
          )}
          {pendingGuidance.length > 0 && (
            <div className="tiny muted" style={{ marginTop: 10 }}>
              지도 면담: {pendingGuidance.map(({ s, st }) => `${s.name}(${st.step}단계)`).join(', ')}
            </div>
          )}
        </div>

        <div className="card">
          <div className="spread"><h2>다가오는 학사일정</h2><span className="tiny muted">2027학년도</span></div>
          <ul className="events">
            {upcoming(today, 7, hub.calendar).map(e => (
              <li key={e.start + e.title}>
                <span className="when">{fmtRange(e)}</span>
                <span className={`kind k-${e.kind}`}>{e.kind}</span>
                <span>{e.title}{e.note && <span className="tiny muted"> · {e.note}</span>}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Tile({ k, v, s, href, bar }: { k: string; v: string; s: string; href: string; bar?: number }) {
  return (
    <Link href={href} className="card stat tile">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {bar !== undefined && <div className="bar"><span style={{ width: `${Math.round(bar * 100)}%` }} /></div>}
      <div className="s">{s}</div>
    </Link>
  );
}
