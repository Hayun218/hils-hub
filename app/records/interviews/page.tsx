'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { DEMO_TODAY, guidanceCount, quarterOf, stageFor } from '@/lib/rules';
import InterviewPaper from '@/components/InterviewPaper';
import { useSearchParams } from 'next/navigation';
import { PageHead, ArtLink, Badge, FormLink } from '@/components/ui';

type Kind = '전체' | '정기' | '학습' | '지도';

export default function InterviewsPage() {
  return <Suspense><Interviews /></Suspense>;
}

function Interviews() {
  const hub = useHub();
  const auth = useAuth();
  const [kind, setKind] = useState<Kind>('전체');
  const params = useSearchParams();
  const [sid, setSid] = useState(params.get('student') || '');
  const [flash, setFlash] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [writing, setWriting] = useState(params.get('new') === '1' || !!params.get('student'));
  const active = hub.students.filter(s => s.status === '재학' || s.status === '체험입학').sort((a, b) => a.name.localeCompare(b.name));
  const q = quarterOf(DEMO_TODAY);
  const seePrivate = can(auth.me, 'private');
  const mine = auth.me?.teacherId;

  const all = hub.records.filter(r => r.type === 'interview')
    .filter(r => !r.private || seePrivate || (mine && r.author === mine))
    .filter(r => kind === '전체' || r.data.kind === kind)
    .sort((a, b) => b.date.localeCompare(a.date));
  const openRec = openId ? hub.records.find(r => r.id === openId) : undefined;
  const hiddenCount = hub.records.filter(r => r.type === 'interview' && r.private).length - hub.records.filter(r => r.type === 'interview' && r.private && (seePrivate || (mine && r.author === mine))).length;

  const noRegular = hub.students.filter(s => s.status === '재학' && !hub.records.some(r => r.studentId === s.id && r.type === 'interview' && r.data.kind === '정기' && quarterOf(r.date) === q && r.date.startsWith(DEMO_TODAY.slice(0, 4))));
  const pendingGuidance = hub.students.filter(s => s.status === '재학').flatMap(s => {
    const n = guidanceCount(hub.records, s.id);
    if (!n) return [];
    const st = stageFor(n)!;
    const done = hub.records.some(r => r.studentId === s.id && r.type === 'interview' && r.data.kind === '지도' && Number(r.data.step) === st.step);
    return done ? [] : [{ s, st }];
  });

  return (
    <div className="page">
      <PageHead
        title="면담 일지"
        desc={<>정기·학습·지도 면담을 별지 8 형식으로 남깁니다. 제목은 자동으로 붙고, 지도 면담은 비공개입니다 <ArtLink no={33} /> <ArtLink no={35} /></>}
        right={<FormLink no={8} label="별지 8 양식 · Word" />}
      />

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="tiny muted">이번 쿼터 정기 면담 남은 학생 (제35조 제3항)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--deep)' }}>{noRegular.length}명</div>
          <div className="tiny muted" style={{ marginTop: 4 }}>{noRegular.slice(0, 8).map(s => s.name).join(', ')}{noRegular.length > 8 ? ' …' : ''}</div>
        </div>
        <div className="card">
          <div className="tiny muted">지도 면담 대기 (제33조)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: pendingGuidance.length ? 'var(--red)' : 'var(--deep)' }}>{pendingGuidance.length}명</div>
          <div className="row" style={{ marginTop: 4 }}>{pendingGuidance.map(({ s, st }) => <button key={s.id} className="chip" onClick={() => { setOpenId(null); setSid(s.id); setWriting(true); }}>{s.name} · {st.step}단계</button>)}</div>
        </div>
        <div className="card">
          <div className="tiny muted">기록된 면담</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--deep)' }}>{hub.records.filter(r => r.type === 'interview').length}건</div>
          {hiddenCount > 0 && <div className="tiny muted" style={{ marginTop: 4 }}>비공개 {hiddenCount}건은 권한이 있는 교직원만 봅니다</div>}
        </div>
      </div>

      {writing ? (
        <div className="paper-wrap">
          <div className="paper-top no-print">
            <button className="btn sm" onClick={() => { setWriting(false); setOpenId(null); }}>← 목록</button>
            {flash && <span className="callout gold small">{flash}</span>}
          </div>
          <InterviewPaper record={openRec} studentId={sid || undefined} initialKind={params.get('kind') === '지도' ? '지도' : undefined} onSaved={(m, id) => { setFlash(m); setOpenId(id); }} />
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="spread" style={{ padding: '12px 16px' }}>
            <div className="seg">{(['전체', '정기', '학습', '지도'] as Kind[]).map(k => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{k} 면담</button>)}</div>
            <button className="btn primary" onClick={() => { setOpenId(null); setFlash(''); setWriting(true); }}>+ 새 면담 일지</button>
          </div>
          <table className="t">
            <thead><tr><th>날짜</th><th>학생</th><th>구분</th><th>제목</th><th>면담자</th><th /></tr></thead>
            <tbody>
              {all.map(r => (
                <tr key={r.id} className="clickable" onClick={() => { setOpenId(r.id); setFlash(''); setWriting(true); }}>
                  <td className="small">{r.date}</td>
                  <td><b>{hub.students.find(x => x.id === r.studentId)?.name}</b></td>
                  <td><Badge tone={r.data.kind === '지도' ? 'red' : r.data.kind === '학습' ? 'gold' : 'line'}>{String(r.data.kind || '')}</Badge>{r.private && <> <Badge tone="line">비공개</Badge></>}</td>
                  <td className="small">{r.title}</td>
                  <td className="small">{hub.teacherName(r.author)}</td>
                  <td style={{ textAlign: 'right' }}><span className="small muted">열기 →</span></td>
                </tr>
              ))}
              {all.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 32 }}>기록이 없습니다. "새 면담 일지"로 시작하세요.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
