'use client';
// 졸업 요건 (제16조·제30조, 별표 2): 학생별 충족 여부, 졸업 과제(독서록·포트폴리오 등) 제출, 기준 설정
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useHub } from '@/lib/store';
import { DEMO_TODAY, gradeLabel } from '@/lib/rules';
import { TRACK_CLASS, TRACK_LABEL, gradStatus, gradSummary, itemsOf, readingCount, reviewedThisSemester, semesterOf, trackOf, type GradStatus } from '@/lib/graduation';
import { deleteFile, openFile, putFile } from '@/lib/fileStore';
import type { GradTrack, Student, Submission, SubmissionKind } from '@/lib/types';
import { PageHead, ArtLink, Badge } from '@/components/ui';
import ReadingLogPaper from '@/components/ReadingLogPaper';
import { readingLogDocx } from '@/lib/readingLog';
import { downloadBlob } from '@/lib/formDocx';

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const KINDS: SubmissionKind[] = ['독서록', '독서 보고서', '포트폴리오', '진로 탐색 보고서', '진로 계획서', '말씀·기도 노트', '프로젝트 결과물', '기타'];
const TONE: Record<GradStatus, 'green' | 'gold' | 'red' | 'line'> = { 충족: 'green', 진행: 'gold', 미충족: 'red', '해당 없음': 'line' };
const MARK: Record<GradStatus, string> = { 충족: '●', 진행: '◐', 미충족: '○', '해당 없음': '–' };
type Tab = '졸업 요건 현황' | '과제 · 독서록 제출' | '기준 설정';

export default function GraduationPage() {
  const hub = useHub();
  const [tab, setTab] = useState<Tab>('졸업 요건 현황');
  const [cls, setCls] = useState('콜링반');
  const students = hub.students.filter(s => s.status === '재학' && (cls === '전체' || s.classGroup === cls)).sort((a, b) => a.birthYear - b.birthYear || a.name.localeCompare(b.name));
  return (
    <div className="page wide">
      <PageHead
        title="졸업 요건"
        desc={<>어니스트반은 초등 수료, 드림반은 중등 수료, 콜링반은 고등 졸업 목표(별표 2)로 봅니다. 담임은 학기 말(6월·12월)마다 점검합니다. 수량 기준은 매년 12월에 확정합니다 <ArtLink no={16} /> <ArtLink no={30} /> <Link className="ref" href="/hakchik#bp2">별표 2</Link></>}
      />
      <div className="tabs">{(['졸업 요건 현황', '과제 · 독서록 제출', '기준 설정'] as Tab[]).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab !== '기준 설정' && <div className="seg" style={{ marginBottom: 12 }}>{['전체', '어니스트반', '드림반', '콜링반'].map(c => <button key={c} className={cls === c ? 'on' : ''} onClick={() => setCls(c)}>{c}</button>)}</div>}
      {tab === '졸업 요건 현황' && <StatusTab students={students} />}
      {tab === '과제 · 독서록 제출' && <SubmitTab students={students} />}
      {tab === '기준 설정' && <SettingsTab />}
    </div>
  );
}

function StatusTab({ students }: { students: Student[] }) {
  const tracks = (['초등', '중등', '고등'] as GradTrack[]).map(t => ({ t, list: students.filter(s => trackOf(s) === t) })).filter(x => x.list.length);
  if (!tracks.length) return <div className="card muted">학생이 없습니다</div>;
  return <div className="stack">{tracks.map(x => <TrackTable key={x.t} track={x.t} students={x.list} />)}</div>;
}

function TrackTable({ track, students }: { track: GradTrack; students: Student[] }) {
  const hub = useHub();
  const items = itemsOf(track);
  const toggle = (sid: string, key: string) => {
    const cur = hub.gradChecks[sid]?.[key];
    hub.setGradCheck(sid, key, cur?.done ? null : { done: true, date: DEMO_TODAY });
  };
  const review = (sid: string) => hub.setGradCheck(sid, '_review', reviewedThisSemester(hub, sid, DEMO_TODAY) ? null : { done: true, date: DEMO_TODAY });
  const sem = semesterOf(DEMO_TODAY).replace('-', '년 ') + '학기';
  return (
    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
      <div className="spread" style={{ padding: '12px 16px' }}>
        <h3 style={{ margin: 0 }}>{TRACK_LABEL[track]} <span className="tiny muted">{TRACK_CLASS[track]} · 별표 2</span></h3>
        <span className="tiny muted">{sem} 점검 {students.filter(s => reviewedThisSemester(hub, s.id, DEMO_TODAY)).length}/{students.length}명</span>
      </div>
      <table className="t grad">
        <thead>
          <tr><th>학생</th>{items.map(i => <th key={i.key} title={`${i.target[track]} · 확인: ${i.source}`}><span className="tiny muted">{i.area}</span><br />{i.label}<div className="grad-target">{i.target[track]}</div></th>)}<th>충족</th><th>학기 점검</th></tr>
        </thead>
        <tbody>
          {students.map(s => {
            const st = gradStatus(hub, s);
            const sum = gradSummary(hub, s);
            return (
              <tr key={s.id}>
                <td><Link href={`/students/${s.id}`}><b>{s.name}</b></Link><div className="tiny muted">{gradeLabel(s.birthYear)}</div></td>
                {items.map(i => (
                  <td key={i.key} className={`g-${st[i.key].status}`} title={st[i.key].detail}>
                    {i.confirm
                      ? <button className="grad-cell" onClick={() => toggle(s.id, i.key)} title={`${st[i.key].detail} · 눌러서 확인/취소`}>{MARK[st[i.key].status]}</button>
                      : i.key === 'ged' && st.ged.status !== '충족'
                        ? <button className="grad-cell" onClick={() => toggle(s.id, 'ged_exempt')} title="입학 전에 이 학력이 있으면 눌러서 '이전 학력 있음'으로 표시">{MARK[st[i.key].status]}</button>
                        : <span className="grad-cell">{MARK[st[i.key].status]}</span>}
                    <div className="tiny muted">{st[i.key].detail}</div>
                  </td>
                ))}
                <td><Badge tone={sum.ready ? 'green' : 'gold'}>{sum.met}/{sum.total}</Badge></td>
                <td>{reviewedThisSemester(hub, s.id, DEMO_TODAY)
                  ? <button className="btn sm" onClick={() => review(s.id)} title="눌러서 취소">✓ {hub.gradChecks[s.id]?._review?.date}</button>
                  : <button className="btn sm primary" onClick={() => review(s.id)}>점검 완료</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="tiny muted" style={{ padding: '8px 14px', margin: 0 }}>● 충족 · ◐ 진행(증빙은 있고 확인 전) · ○ 미충족 · – 해당 없음. 성경·암송·공동체·발표 등은 칸을 눌러 담임이 확인하고, 독서·영어·수학·봉사·검정고시·졸업 심사는 기록에서 자동으로 봅니다. 검정고시 칸은 입학 전 학력이 있으면 눌러서 제외합니다. 3P 바인더 같은 매일의 일과는 지표가 아니라 상시 기준입니다(제16조 제6항).</p>
    </div>
  );
}

interface Pending { file: File; studentId: string; kind: SubmissionKind; title: string }

function SubmitTab({ students }: { students: Student[] }) {
  const hub = useHub();
  const [kind, setKind] = useState<SubmissionKind>('독서록');
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<SubmissionKind | '전체'>('전체');
  const [writing, setWriting] = useState<Submission | 'new' | null>(null);
  const [msg, setMsg] = useState('');
  const all = hub.students.filter(s => s.status === '재학');
  const ids = new Set(students.map(s => s.id));
  const list = hub.submissions.filter(x => ids.has(x.studentId) && (filter === '전체' || x.kind === filter)).sort((a, b) => b.date.localeCompare(a.date));

  // 파일 이름에 학생 이름이 있으면 그 학생으로 맞춘다 (예: 홍길동_어린왕자.pdf)
  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Pending[] = [...files].map(file => {
      const base = file.name.replace(/\.[^.]+$/, '');
      const s = [...all].sort((a, b) => b.name.length - a.name.length).find(x => base.includes(x.name));
      const title = (s ? base.replace(s.name, '') : base).replace(/^[\s_\-·.]+|[\s_\-·.]+$/g, '').replace(/[_]+/g, ' ') || base;
      return { file, studentId: s?.id || '', kind, title };
    });
    setPending(p => [...p, ...next]);
  };
  const save = async () => {
    setBusy(true);
    const bad = pending.filter(x => x.studentId && x.kind === '포트폴리오' && !isPdf(x.file));
    if (bad.length) { alert(`졸업 포트폴리오는 PDF로 올립니다: ${bad.map(b => b.file.name).join(', ')}`); setBusy(false); return; }
    for (const p of pending.filter(x => x.studentId)) {
      const fileId = await putFile(p.file);
      hub.saveSubmission({ id: hub.newId('sub'), studentId: p.studentId, kind: p.kind, title: p.title, date: DEMO_TODAY, fileId, fileName: p.file.name });
    }
    setPending(p => p.filter(x => !x.studentId));
    setBusy(false);
  };
  const remove = async (x: Submission) => { if (!confirm(`'${x.title}'을(를) 지울까요?`)) return; if (x.fileId) await deleteFile(x.fileId); hub.removeSubmission(x.id); };
  const byStudent = useMemo(() => students.map(s => ({ s, n: readingCount(hub, s.id) })), [students, hub]);

  if (writing) return (
    <div className="paper-wrap">
      <div className="paper-top no-print"><button className="btn sm" onClick={() => setWriting(null)}>← 목록</button></div>
      <ReadingLogPaper initial={writing === 'new' ? undefined : writing} onDone={m => { setMsg(m); setWriting(null); }} />
    </div>
  );
  return (
    <div className="stack">
      {msg && <div className="callout gold small">{msg}</div>}
      <div className="card row">
        <b style={{ color: 'var(--deep)' }}>독서록</b>
        <button className="btn primary" onClick={() => setWriting('new')}>웹에서 독서록 쓰기</button>
        <button className="btn" onClick={async () => downloadBlob(await readingLogDocx(), 'HILS_독서록_양식.docx')}>빈 독서록 양식 Word</button>
        <span className="tiny muted">손으로 쓴 독서록은 사진·PDF로 아래에서 일괄 올립니다. 졸업 포트폴리오는 PDF로 올립니다.</span>
      </div>
      <div className="card">
        <h3>일괄 올리기</h3>
        <div className="row">
          <select className="input" value={kind} onChange={e => setKind(e.target.value as SubmissionKind)} aria-label="과제 종류">{KINDS.map(k => <option key={k}>{k}</option>)}</select>
          <label className="btn primary" style={{ cursor: 'pointer' }}>파일 고르기 (여러 개)<input type="file" multiple hidden onChange={e => { onFiles(e.target.files); e.target.value = ''; }} /></label>
          <span className="tiny muted">파일 이름에 학생 이름을 넣으면 자동으로 맞춥니다 (예: 홍길동_어린왕자.pdf → 홍길동, 「어린왕자」)</span>
        </div>
        {pending.length > 0 && (
          <>
            <table className="t small" style={{ marginTop: 10 }}>
              <thead><tr><th>파일</th><th>학생</th><th>종류</th><th>제목 (독서록은 책 제목)</th><th /></tr></thead>
              <tbody>
                {pending.map((p, i) => (
                  <tr key={i}>
                    <td className="tiny">{p.file.name}{p.kind === '포트폴리오' && !isPdf(p.file) && <div style={{ color: 'var(--red)' }}>PDF만 올릴 수 있습니다</div>}</td>
                    <td><select className={`input compact${p.studentId ? '' : ' empty'}`} value={p.studentId} onChange={e => setPending(pending.map((x, j) => (j === i ? { ...x, studentId: e.target.value } : x)))} aria-label="학생"><option value="">학생 선택</option>{all.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
                    <td><select className="input compact" value={p.kind} onChange={e => setPending(pending.map((x, j) => (j === i ? { ...x, kind: e.target.value as SubmissionKind } : x)))} aria-label="종류">{KINDS.map(k => <option key={k}>{k}</option>)}</select></td>
                    <td><input className="input compact" style={{ width: '100%' }} value={p.title} onChange={e => setPending(pending.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} aria-label="제목" /></td>
                    <td><button className="btn sm" onClick={() => setPending(pending.filter((_, j) => j !== i))}>빼기</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              {pending.some(p => !p.studentId) && <span className="tiny muted">학생을 고르지 않은 파일은 남겨 둡니다</span>}
              <button className="btn primary" onClick={save} disabled={busy || !pending.some(p => p.studentId)}>{busy ? '올리는 중…' : `${pending.filter(p => p.studentId).length}개 저장`}</button>
            </div>
          </>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 240px', alignItems: 'start' }}>
        <div className="card" style={{ padding: 0 }}>
          <div className="spread" style={{ padding: '12px 16px' }}>
            <h3 style={{ margin: 0 }}>제출 목록</h3>
            <select className="input" value={filter} onChange={e => setFilter(e.target.value as SubmissionKind | '전체')} aria-label="종류"><option value="전체">전체</option>{KINDS.map(k => <option key={k}>{k}</option>)}</select>
          </div>
          <table className="t small">
            <thead><tr><th>날짜</th><th>학생</th><th>종류</th><th>제목</th><th>파일</th><th /></tr></thead>
            <tbody>
              {list.map(x => (
                <tr key={x.id}>
                  <td>{x.date}</td>
                  <td>{hub.students.find(s => s.id === x.studentId)?.name}</td>
                  <td><Badge tone={x.kind === '독서록' ? 'green' : 'line'}>{x.kind}</Badge></td>
                  <td>{x.kind === '독서록' ? `「${x.title}」` : x.title}</td>
                  <td>{x.fileId ? <button className="linklike small" onClick={() => openFile(x.fileId!, x.fileName || x.title)}>{x.fileName}</button> : x.content ? <button className="linklike small" onClick={() => setWriting(x)}>웹 독서록 열기</button> : x.url ? <a href={x.url} target="_blank" rel="noreferrer">링크</a> : '-'}</td>
                  <td><button className="btn sm warn" onClick={() => remove(x)}>삭제</button></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>제출한 과제가 없습니다</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>독서 권수</h3>
          {byStudent.map(({ s, n }) => (
            <div key={s.id} className="spread small" style={{ padding: '3px 0' }}><span>{s.name}</span><b>{n}권</b></div>
          ))}
          <p className="tiny muted" style={{ marginBottom: 0 }}>독서록 제출과 학생 기록의 독서를 합한 수</p>
        </div>
      </div>
    </div>
  );
}

function SettingsTab() {
  const hub = useHub();
  const g = hub.gradSettings;
  const set = (t: GradTrack, patch: Partial<typeof g[GradTrack]>) => hub.setGradSettings({ ...g, [t]: { ...g[t], ...patch } });
  return (
    <div className="card" style={{ maxWidth: 1080 }}>
      <h3>학교급별 기준 (수량·레벨)</h3>
      <table className="t small">
        <thead><tr><th>과정</th><th>독서 권수</th><th>영어 최소 레벨</th><th>수학 최소 수준</th><th>봉사 시간</th></tr></thead>
        <tbody>
          {(['초등', '중등', '고등'] as GradTrack[]).map(t => (
            <tr key={t}>
              <td><b>{TRACK_LABEL[t]}</b></td>
              <td><input className="input compact" type="number" min={0} style={{ width: 80 }} value={g[t].readingCount ?? ''} placeholder="미정" onChange={e => set(t, { readingCount: e.target.value === '' ? null : Number(e.target.value) })} aria-label="독서 권수" /> 권</td>
              <td><select className="input compact" value={g[t].enMin} onChange={e => set(t, { enMin: e.target.value })} aria-label="영어">{['EN-E', 'EN-MH', 'EN-B', 'EN-A'].map(l => <option key={l}>{l}</option>)}</select></td>
              <td><select className="input compact" value={g[t].mathMin} onChange={e => set(t, { mathMin: e.target.value })} aria-label="수학">{['초등', 'M-C', 'M-B', 'M-A'].map(l => <option key={l}>{l}</option>)}</select></td>
              <td>{t === '초등' ? <span className="tiny muted">해당 없음</span> : <><input className="input compact" type="number" min={0} style={{ width: 70 }} value={g[t].volunteerHours ?? ''} placeholder="미정" onChange={e => set(t, { volunteerHours: e.target.value === '' ? null : Number(e.target.value) })} aria-label="봉사 시간" /> 시간</>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 style={{ marginTop: 18 }}>지표 전체 (별표 2)</h3>
      <table className="t small">
        <thead><tr><th>영역</th><th>지표</th>{(['초등', '중등', '고등'] as GradTrack[]).map(t => <th key={t}>{TRACK_LABEL[t]}</th>)}<th>확인</th></tr></thead>
        <tbody>{itemsOf('고등').concat(itemsOf('중등').filter(i => !itemsOf('고등').includes(i))).map(i => (
          <tr key={i.key}><td className="muted">{i.area}</td><td><b>{i.label}</b></td>{(['초등', '중등', '고등'] as GradTrack[]).map(t => <td key={t}>{i.target[t] ?? <span className="muted">-</span>}</td>)}<td className="tiny muted">{i.source}</td></tr>
        ))}</tbody>
      </table>
      <p className="small muted">지금 값은 별표 2 초안입니다. 제16조 제2항에 따라 1년 이상 쌓인 기록을 바탕으로 매년 12월 정기 검토에서 확정하고 다음 입학생부터 적용합니다.</p>
    </div>
  );
}
