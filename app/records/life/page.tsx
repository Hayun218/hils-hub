'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { DEMO_TODAY, QUARTER_LABEL, accumulation, demeritsInQuarter, guidanceCount, lateDishes, meritsInQuarter, quarterOf, stageFor } from '@/lib/rules';
import LifePaper, { type Sheet } from '@/components/LifePaper';
import QuickMerit from '@/components/QuickMerit';
import { PageHead, ArtLink, Badge, FormLink } from '@/components/ui';

export default function LifePage() {
  return <Suspense><Life /></Suspense>;
}

function Life() {
  const hub = useHub();
  const auth = useAuth();
  const params = useSearchParams();
  const [sheet, setSheet] = useState<Sheet>(params.get('sheet') === 'incident' ? '생활·훈육 기록지' : '상점·벌점');
  const [flash, setFlash] = useState('');
  const [writing, setWriting] = useState(params.get('sheet') === 'incident' && !!params.get('student'));
  const q = quarterOf(DEMO_TODAY);
  const active = hub.students.filter(s => s.status === '재학');
  const seePrivate = can(auth.me, 'private');
  const mine = auth.me?.teacherId;
  const types = sheet === '상점·벌점' ? ['merit', 'demerit'] : ['incident'];
  const recent = hub.records.filter(r => types.includes(r.type))
    .filter(r => !r.private || seePrivate || (mine && r.author === mine))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  const summary = active.map(s => ({ s, m: meritsInQuarter(hub.records, s.id, q), d: demeritsInQuarter(hub.records, s.id, q), g: guidanceCount(hub.records, s.id) }))
    .filter(x => x.m || x.d || x.g).sort((a, b) => b.g - a.g || b.d - a.d);
  const dishes = lateDishes(hub.records, DEMO_TODAY);
  const name = (id: string) => hub.students.find(x => x.id === id)?.name;

  return (
    <div className="page wide">
      <PageHead
        title="생활 기록"
        desc={<>상점·벌점(별표 8)과 생활·훈육 기록지(별지 4). 벌점이 한 쿼터 5점마다, 또는 제32조 행동이면 지도 사유와 면담 단계가 자동으로 생깁니다 <ArtLink no={31} /> <ArtLink no={33} /></>}
        right={<FormLink no={4} label="별지 4 양식" />}
      />

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="tiny muted">오늘 저녁 설거지 (지각 즉시 조치)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--deep)' }}>{dishes.length}명</div>
          <div className="tiny muted" style={{ marginTop: 4 }}>{dishes.map(name).join(', ') || '없음'}</div>
        </div>
        <div className="card">
          <div className="tiny muted">{QUARTER_LABEL[q]} 지도 사유 대상</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: summary.some(x => x.g) ? 'var(--red)' : 'var(--deep)' }}>{summary.filter(x => x.g).length}명</div>
          <div className="tiny muted" style={{ marginTop: 4 }}>벌점 5점마다 1건 · <Link href="/records/interviews">면담 일지</Link></div>
        </div>
        <div className="card">
          <div className="tiny muted">{q}쿼터 상점 합계</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--deep)' }}>{summary.reduce((a, x) => a + x.m, 0)}점</div>
          <div className="tiny muted" style={{ marginTop: 4 }}>메릿마켓에서 사용</div>
        </div>
      </div>

      {writing ? (
        <div className="paper-wrap">
          <div className="paper-top no-print">
            <button className="btn sm" onClick={() => setWriting(false)}>← 목록</button>
            {flash && <span className="callout gold small">{flash}</span>}
          </div>
          <LifePaper sheet="생활·훈육 기록지" onSheet={() => {}} studentId={params.get('student') || undefined} onSaved={setFlash} />
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', alignItems: 'start' }}>
          <div className="card" style={{ padding: 0 }}>
            <div className="spread" style={{ padding: '12px 16px' }}>
              <div className="seg">{(['상점·벌점', '생활·훈육 기록지'] as Sheet[]).map(x => <button key={x} className={sheet === x ? 'on' : ''} onClick={() => setSheet(x)}>{x === '생활·훈육 기록지' ? '지도 사유 (별지 4)' : x}</button>)}</div>
              {sheet !== '상점·벌점' && <button className="btn primary" onClick={() => { setFlash(''); setWriting(true); }}>+ 생활·훈육 기록지</button>}
            </div>
            {sheet === '상점·벌점' && <div style={{ padding: '0 16px 12px' }}><QuickMerit onSaved={setFlash} />{flash && <div className="callout gold small" style={{ marginTop: 8 }}>{flash}</div>}</div>}
            <table className="t">
              <thead><tr><th>날짜</th><th>학생</th><th>구분</th><th>내용</th><th>교사</th></tr></thead>
              <tbody>
                {recent.map(r => (
                  <tr key={r.id}>
                    <td className="small">{r.date}</td>
                    <td><Link href={`/students/${r.studentId}`}><b>{name(r.studentId)}</b></Link></td>
                    <td><Badge tone={r.type === 'merit' ? 'green' : r.type === 'demerit' ? 'orange' : 'red'}>{r.type === 'merit' ? `상점 +${r.data.points}` : r.type === 'demerit' ? `벌점 ${r.data.points}` : '지도 사유'}</Badge>{r.private && <> <Badge tone="line">비공개</Badge></>}</td>
                    <td className="small">{r.title}{r.data.action ? ` · ${r.data.action}` : ''}</td>
                    <td className="small">{hub.teacherName(r.author)}</td>
                  </tr>
                ))}
                {recent.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 32 }}>기록이 없습니다</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '14px 16px 4px' }}><h3 style={{ margin: 0 }}>{q}쿼터 누적과 결과 <span className="tiny muted">별표 8 제4호</span></h3></div>
            <table className="t small">
              <thead><tr><th>이름</th><th className="num">상점</th><th className="num">벌점</th><th>결과</th></tr></thead>
              <tbody>
                {summary.map(({ s, m, d, g }) => {
                  const st = stageFor(g);
                  return (
                    <tr key={s.id}>
                      <td><Link href={`/students/${s.id}`}>{s.name}</Link></td>
                      <td className="num">{m || ''}</td>
                      <td className="num" style={{ color: d % 5 >= 3 ? 'var(--red)' : undefined }}>{d || ''}</td>
                      <td className="tiny">{st ? <Badge tone={st.step >= 3 ? 'red' : 'orange'}>{st.label}</Badge> : accumulation(m, d).demerit || (m ? '메릿마켓' : '')}</td>
                    </tr>
                  );
                })}
                {summary.length === 0 && <tr><td colSpan={4} className="muted small" style={{ textAlign: 'center', padding: 20 }}>이번 쿼터 기록이 없습니다</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
