'use client';
// 학교생활기록부: 학교가 쓰던 학교생활세부사항기록부(학교생활기록부 Ⅱ)의 구성과 문체를 따른다. 모든 학교급에서 쓴다.
// 항목마다 작성 요령과 가상 학생 예시를 함께 보여 준다. 출결·독서·교과 성적·검정고시는 학생 기록에서 가져오고,
// 서술 항목은 AI 초안(OpenAI GPT)으로 시작할 수 있다.
import { useMemo, useState, type ReactNode } from 'react';
import { useHub } from '@/lib/store';
import { SCHOOL_YEAR, gradeLabel } from '@/lib/rules';
import { downloadBlob } from '@/lib/formDocx';
import { EXAMPLE, EXAMPLE_STUDENT, GUIDE, LIMITS, SUBJECT_KINDS, attendanceOf, blankRecord, blankSubject, type Attendance } from '@/lib/schoolRecordModel';
import type { HubState, SchoolRecordDoc, SchoolRecordSubject, SrActivity, SrSubjectKind, Student } from '@/lib/types';
import { PageHead, Badge } from '@/components/ui';

const TONE = { 작성중: 'gold', 검토: 'orange', 확정: 'green' } as const;

export default function SchoolRecordPage() {
  const hub = useHub();
  const [year, setYear] = useState(SCHOOL_YEAR);
  const [openId, setOpenId] = useState<string | null>(null);
  const [example, setExample] = useState(false);
  const [cls, setCls] = useState('전체');
  const students = hub.students.filter(s => s.status === '재학' && (cls === '전체' || s.classGroup === cls)).sort((a, b) => a.birthYear - b.birthYear || a.name.localeCompare(b.name));
  const docOf = (sid: string) => hub.schoolRecords.find(r => r.studentId === sid && r.year === year);
  const open = (s: Student) => {
    const d = docOf(s.id) || blankRecord(s.id, year, hub.newId('sr'));
    if (!docOf(s.id)) hub.saveSchoolRecord(d);
    setOpenId(d.id);
  };
  if (example) return <ExampleSheet onBack={() => setExample(false)} />;
  const doc = hub.schoolRecords.find(r => r.id === openId);
  if (doc) return <RecordSheet doc={doc} onBack={() => setOpenId(null)} />;

  const filledOf = (d: SchoolRecordDoc) =>
    [d.activities.autonomy.text, d.activities.club.text, d.activities.career.text, d.behavior].filter(x => x.trim()).length
    + d.subjects.filter(x => x.detail.trim()).length + (d.reading.length ? 1 : 0) + (d.volunteer.length ? 1 : 0);

  return (
    <div className="page">
      <PageHead title="학교생활기록부" desc="학년도마다 학생별로 한 부. 학교가 쓰던 학교생활세부사항기록부(학교생활기록부 Ⅱ)의 8개 항목을 그대로 따르고, 항목마다 작성 요령과 예시를 함께 봅니다." />
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="seg">{[SCHOOL_YEAR + 1, SCHOOL_YEAR, SCHOOL_YEAR - 1].map(y => <button key={y} className={year === y ? 'on' : ''} onClick={() => setYear(y)}>{y}학년도</button>)}</div>
        <div className="seg">{['전체', '어니스트반', '드림반', '콜링반'].map(c => <button key={c} className={cls === c ? 'on' : ''} onClick={() => setCls(c)}>{c}</button>)}</div>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => setExample(true)}>작성 예시 보기 (가상 학생)</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="t">
          <thead><tr><th>이름</th><th>반</th><th>학년</th><th>작성</th><th>상태</th><th /></tr></thead>
          <tbody>
            {students.map(s => {
              const d = docOf(s.id);
              return (
                <tr key={s.id} className="clickable" onClick={() => open(s)}>
                  <td><b>{s.name}</b></td><td className="small">{s.classGroup}</td><td className="small">{gradeLabel(s.birthYear, year)}</td>
                  <td className="small">{d ? `${filledOf(d)}개 항목` : '-'}</td>
                  <td>{d ? <Badge tone={TONE[d.status]}>{d.status}</Badge> : <Badge tone="line">미작성</Badge>}</td>
                  <td style={{ textAlign: 'right' }}><span className="small muted">{d ? '열기 →' : '작성 →'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** AI에 보낼 자료: 실명은 '학생'으로, 비공개 기록(지도 사유·지도 면담, 제38조)은 넣지 않는다 */
function contextOf(hub: HubState, s: Student, year: number) {
  const y = String(year);
  const anon = (t: string) => t.split(s.name).join('학생');
  const grades = hub.grades.filter(g => g.date.startsWith(y) && g.scores[s.id]).map(g => `- ${g.subject} ${g.kind} ${g.title}: ${g.columns.map(c => `${c} ${g.scores[s.id][c] || ''}`).join(' / ')}`);
  const comments = hub.reports.filter(r => r.studentId === s.id && r.period.startsWith(y)).flatMap(r => r.comments.filter(c => c.text.trim()).map(c => `- [${r.period}] ${c.subject}: ${anon(c.text)}`));
  const talks = hub.records.filter(r => r.studentId === s.id && r.date.startsWith(y) && !r.private && r.type === 'interview').map(r => `- 면담: ${anon(String(r.data.promise || r.data.guidance || ''))}`);
  const merits = hub.records.filter(r => r.studentId === s.id && r.date.startsWith(y) && r.type === 'merit').map(r => `- 상점: ${r.title}`);
  const books = hub.submissions.filter(x => x.studentId === s.id && x.kind === '독서록').map(x => `- 독서: 「${x.title}」${x.author ? `(${x.author})` : ''}${x.content?.thought ? ` — ${anon(x.content.thought).slice(0, 160)}` : ''}`);
  const works = hub.submissions.filter(x => x.studentId === s.id && x.kind !== '독서록').map(x => `- ${x.kind}: ${x.title}`);
  return [`학년: ${gradeLabel(s.birthYear, year)} (${s.classGroup || s.schoolLevel})`, ...grades, ...comments, ...talks, ...merits, ...books, ...works].join('\n') || '기록 없음';
}

type Draft = (section: string, limit: number, existing: string, apply: (t: string) => void) => void;
interface Head { name: string; gender: string; grade: string; classGroup: string; admittedAt: string; homeroom: string }

function RecordSheet({ doc: d, onBack }: { doc: SchoolRecordDoc; onBack: () => void }) {
  const hub = useHub();
  const s = hub.students.find(x => x.id === d.studentId)!;
  const up = (p: Partial<SchoolRecordDoc>) => hub.saveSchoolRecord({ ...d, ...p, updatedAt: new Date().toISOString() });
  const att = attendanceOf(hub, s.id, d.year);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const ctx = useMemo(() => contextOf(hub, s, d.year), [hub, s, d.year]);
  const head: Head = {
    name: s.name, gender: s.gender || '', grade: gradeLabel(s.birthYear, d.year), classGroup: s.classGroup || s.schoolLevel,
    admittedAt: s.admittedAt || '', homeroom: hub.teachers.find(t => t.id === s.homeroom)?.name || '',
  };

  const draft: Draft = async (section, limit, existing, apply) => {
    setBusy(section); setErr('');
    try {
      const r = await fetch('/api/ai/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ section, limit, context: ctx, existing }) });
      const j = await r.json();
      if (!r.ok) setErr(j.error || '초안을 만들지 못했습니다'); else apply(j.text);
    } catch { setErr('AI 서버에 연결하지 못했습니다'); }
    setBusy(null);
  };
  const importGrades = async (file?: File) => {
    if (!file) return;
    setBusy('성적표'); setErr('');
    const fd = new FormData(); fd.append('file', file);
    try {
      const r = await fetch('/api/ai/grades', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) setErr(j.error);
      else up({ subjects: [...d.subjects, ...(j.rows as { subject: string; score: string; achievement: string; note: string }[]).map(x => ({ ...blankSubject('일반'), subject: x.subject, score: x.score, achievement: x.achievement, note: x.note }))] });
    } catch { setErr('AI 서버에 연결하지 못했습니다'); }
    setBusy(null);
  };
  const fromGrades = () => {
    const y = String(d.year);
    const bySub = new Map<string, { sem: string; xs: number[] }>();
    hub.grades.filter(g => g.date.startsWith(y) && g.scores[s.id] && g.kind !== '검정고시 진단평가').forEach(g => {
      const v = Number(g.scores[s.id][g.columns[0]]);
      if (Number.isNaN(v)) return;
      const sem = Number(g.date.slice(5, 7)) <= 6 ? '1' : '2';
      const k = `${sem}|${g.subject}`;
      const cur = bySub.get(k) || { sem, xs: [] };
      cur.xs.push(g.max ? (v / g.max) * 100 : v);
      bySub.set(k, cur);
    });
    const rows = [...bySub.entries()].filter(([k]) => !d.subjects.some(x => `${x.semester}|${x.subject}` === k))
      .map(([k, v]) => ({ ...blankSubject('일반', v.sem), area: k.split('|')[1], subject: k.split('|')[1], score: (v.xs.reduce((a, b) => a + b, 0) / v.xs.length).toFixed(0) }));
    if (!rows.length) { setErr('이 학년도 성적 입력에 가져올 과목이 없습니다'); return; }
    up({ subjects: [...d.subjects, ...rows] });
  };
  const fromReading = () => {
    const list = hub.submissions.filter(x => x.studentId === s.id && x.kind === '독서록' && x.date.startsWith(String(d.year)));
    if (!list.length) { setErr(`${d.year}년에 제출한 독서록이 없습니다 (졸업 요건 · 과제)`); return; }
    const groups = new Map<string, string[]>();
    list.forEach(x => {
      const k = `${x.content?.category || '공통'}|${Number(x.date.slice(5, 7)) <= 6 ? '1' : '2'}`;
      groups.set(k, [...(groups.get(k) || []), `${x.title}${x.author ? `(${x.author})` : ''}`]);
    });
    up({ reading: [...groups.entries()].map(([k, books]) => ({ area: k.split('|')[0], semester: k.split('|')[1], books: books.join(', ') })) });
  };
  const gedText = hub.gedExams.filter(g => g.studentId === s.id && g.status === '합격' && g.date.startsWith(String(d.year)))
    .map(g => `${g.date.replace(/-/g, '.')}. ${g.level === '초졸' ? '초등학교' : g.level === '중졸' ? '중학교' : '고등학교'} 졸업학력 검정고시 합격`).join('\n');

  const download = async () => {
    const { schoolRecordDocx } = await import('@/lib/schoolRecord');
    downloadBlob(await schoolRecordDocx(d, head, att), `학교생활기록부_${s.name}_${d.year}.docx`);
  };

  return (
    <div className="page">
      <div className="paper-wrap">
        <div className="paper-top no-print">
          <button className="btn sm" onClick={onBack}>← 목록</button>
          <div className="seg">{(['작성중', '검토', '확정'] as const).map(x => <button key={x} className={d.status === x ? 'on' : ''} onClick={() => up({ status: x })}>{x}</button>)}</div>
          <span style={{ flex: 1 }} />
          <button className="btn sm" onClick={download}>Word</button>
          <button className="btn sm" onClick={() => window.print()}>인쇄</button>
        </div>
        {err && <div className="callout red small no-print" style={{ width: '100%', maxWidth: 900, marginBottom: 8 }}>{err}</div>}
        <Sheet d={d} head={head} att={att} up={up} ro={d.status === '확정'} busy={busy} draft={draft}
          tools={{
            special: gedText ? <button className="btn sm" onClick={() => up({ special: [d.special, gedText].filter(Boolean).join('\n') })}>검정고시 합격 가져오기</button> : null,
            subjects: <>
              <button className="btn sm" onClick={fromGrades}>성적 입력에서 가져오기</button>
              <label className="btn sm" style={{ cursor: 'pointer' }}>{busy === '성적표' ? '읽는 중…' : '성적표 불러오기 (AI)'}<input type="file" accept="image/*,application/pdf" hidden onChange={e => { importGrades(e.target.files?.[0]); e.target.value = ''; }} /></label>
            </>,
            reading: <button className="btn sm" onClick={fromReading}>독서록에서 가져오기</button>,
          }} />
      </div>
    </div>
  );
}

function ExampleSheet({ onBack }: { onBack: () => void }) {
  const zero = { 질병: 0, 미인정: 0, 기타: 0 };
  const att: Attendance = { days: 190, perfect: true, grid: { 결석: zero, 지각: zero, 조퇴: zero, 결과: zero } };
  return (
    <div className="page">
      <div className="paper-wrap">
        <div className="paper-top no-print">
          <button className="btn sm" onClick={onBack}>← 목록</button>
          <div className="callout gold small">가상 학생으로 쓴 작성 예시입니다. 실제 학생 기록이 아닙니다.</div>
        </div>
        <Sheet d={EXAMPLE} head={EXAMPLE_STUDENT} att={att} up={() => {}} ro busy={null} draft={() => {}} example />
      </div>
    </div>
  );
}

/** 기록부 본문. 편집과 예시(읽기 전용)를 같이 그린다 */
function Sheet({ d, head, att, up, ro, busy, draft, tools = {}, example = false }: {
  d: SchoolRecordDoc; head: Head; att: Attendance; up: (p: Partial<SchoolRecordDoc>) => void; ro: boolean;
  busy: string | null; draft: Draft; tools?: Partial<Record<'special' | 'subjects' | 'reading', ReactNode>>; example?: boolean;
}) {
  const [guide, setGuide] = useState(!example);
  const a = d.activities;
  const setAct = (k: keyof typeof a, p: Partial<SrActivity>) => up({ activities: { ...a, [k]: { ...a[k], ...p } } });
  const show = guide && !example;
  const hint = (k: keyof typeof GUIDE, ex?: ReactNode) => (show ? <Hint text={GUIDE[k]} ex={ex} /> : null);
  let acc = 0;
  return (
    <div className="paper sr-paper">
      <div className="spread no-print" style={{ marginBottom: 6 }}>
        <span className="tiny muted">{example ? '' : '칸을 눌러 바로 씁니다. 확정하면 잠깁니다.'}</span>
        {!example && <label className="check tiny"><input type="checkbox" checked={guide} onChange={e => setGuide(e.target.checked)} /> 작성 요령·예시 보기</label>}
      </div>
      <h1 className="paper-title sr-title">학교생활세부사항기록부</h1>
      <div className="paper-sub">(학교생활기록부 Ⅱ) · {d.year}학년도 · HILS</div>
      <table className="paper-table center sr-head"><thead><tr><th>학년도</th><th>학년</th><th>반</th><th>담임성명</th></tr></thead>
        <tbody><tr><td>{d.year}</td><td>{head.grade}</td><td>{head.classGroup}</td><td>{head.homeroom}</td></tr></tbody></table>

      <Sec n={1} title="인적·학적사항">
        <table className="paper-table"><tbody>
          <tr><th>성명</th><td>{head.name}</td><th>성별</th><td>{head.gender}</td></tr>
          <tr><th>학적사항</th><td colSpan={3}>{head.admittedAt ? `${head.admittedAt.replace(/-/g, '.')}. 입학` : '입학일 없음 (학생 명단에서 입력)'}</td></tr>
          <tr><th>특기사항</th><td colSpan={3}><AutoText value={d.special} onChange={v => up({ special: v })} ro={ro} ph="예) 2027.05.15. 고등학교 졸업학력 검정고시 합격" /></td></tr>
        </tbody></table>
        {!ro && tools.special && <div className="row no-print">{tools.special}</div>}
        {hint('special')}
      </Sec>

      <Sec n={2} title="출결상황" note="출석 현황에서 자동">
        <table className="paper-table center sr-att">
          <thead>
            <tr><th rowSpan={2}>수업일수</th><th colSpan={3}>결석일수</th><th colSpan={3}>지각</th><th colSpan={3}>조퇴</th><th colSpan={3}>결과</th><th rowSpan={2}>특기사항</th></tr>
            <tr>{['결석', '지각', '조퇴', '결과'].flatMap(k => ['질병', '미인정', '기타'].map(c => <th key={k + c}>{c}</th>))}</tr>
          </thead>
          <tbody><tr>
            <td>{att.days}</td>
            {(['결석', '지각', '조퇴', '결과'] as const).flatMap(k => (['질병', '미인정', '기타'] as const).map(c => <td key={k + c}>{att.grid[k][c] || '.'}</td>))}
            <td><input value={d.attendanceNote} onChange={e => up({ attendanceNote: e.target.value })} disabled={ro} placeholder={att.perfect ? '개근' : ''} aria-label="출결 특기사항" /></td>
          </tr></tbody>
        </table>
        {hint('attendance')}
      </Sec>

      <Sec n={3} title="수상경력">
        <Rows ro={ro} rows={d.awards} onChange={awards => up({ awards })} blank={() => ({ semester: '1', name: '', grade: '', date: '', org: 'HILS', target: '' })}
          cols={[{ k: 'semester', label: '학기', w: 48 }, { k: 'name', label: '수상명' }, { k: 'grade', label: '등급(위)', w: 90 }, { k: 'date', label: '수상연월일', w: 100, ph: '2027.06.18.' }, { k: 'org', label: '수여기관', w: 80 }, { k: 'target', label: '참가대상(참가인원)', w: 130, ph: '중고등학생 (14)' }]} />
        {hint('awards', <Mini rows={EXAMPLE.awards.map(x => `${x.semester}학기 · ${x.name} · ${x.grade} · ${x.date} · ${x.target}`)} />)}
      </Sec>

      <Sec n={4} title="자격증 및 인증 취득상황">
        <Rows ro={ro} rows={d.certificates} onChange={certificates => up({ certificates })} blank={() => ({ kind: '', name: '', number: '', date: '', issuer: '' })}
          cols={[{ k: 'kind', label: '구분', w: 110 }, { k: 'name', label: '명칭 또는 종류' }, { k: 'number', label: '번호 또는 내용', w: 120 }, { k: 'date', label: '취득연월일', w: 100 }, { k: 'issuer', label: '발급기관', w: 110 }]} />
        {hint('certificates')}
      </Sec>

      <Sec n={5} title="창의적 체험활동상황">
        <table className="paper-table sr-act">
          <thead><tr><th style={{ width: 92 }}>영역</th><th style={{ width: 56 }}>시간</th><th>특기사항</th></tr></thead>
          <tbody>
            <ActRow label="자율활동" act={a.autonomy} onChange={p => setAct('autonomy', p)} limit={LIMITS.autonomy} ro={ro} busy={busy} draft={draft} section="창의적 체험활동 - 자율활동" />
            <ActRow label="동아리활동" act={a.club} onChange={p => setAct('club', p)} limit={LIMITS.club} ro={ro} busy={busy} draft={draft} section="창의적 체험활동 - 동아리활동"
              top={<label className="sr-inline">동아리 <input value={a.club.club || ''} onChange={e => setAct('club', { club: e.target.value })} disabled={ro} placeholder="예) 독서토론반" /></label>} />
            <ActRow label="진로활동" act={a.career} onChange={p => setAct('career', p)} limit={LIMITS.career} ro={ro} busy={busy} draft={draft} section="창의적 체험활동 - 진로활동"
              top={<label className="sr-inline">희망분야 <input value={a.career.hope || ''} onChange={e => setAct('career', { hope: e.target.value })} disabled={ro} placeholder="예) 교육학" /></label>} />
          </tbody>
        </table>
        {hint('activities', <><b>자율활동</b><p>{EXAMPLE.activities.autonomy.text}</p><b>동아리활동</b><p>{EXAMPLE.activities.club.text}</p><b>진로활동</b> (희망분야: {EXAMPLE.activities.career.hope})<p>{EXAMPLE.activities.career.text}</p></>)}
        <h3 className="sr-sub">&lt;봉사활동 실적&gt;</h3>
        <Rows ro={ro} rows={d.volunteer} onChange={volunteer => up({ volunteer })} blank={() => ({ period: '', place: '(학교)', content: '', hours: '' })}
          cols={[{ k: 'period', label: '일자 또는 기간', w: 190, ph: '2027.03.06. – 2027.06.26.' }, { k: 'place', label: '장소 또는 주관기관명', w: 150, ph: '(학교) / (개인) 기관명' }, { k: 'content', label: '활동내용' }, { k: 'hours', label: '시간', w: 50 }]}
          extra={{ label: '누계시간', w: 60, value: r => { acc += Number(r.hours) || 0; return String(acc); } }} />
        {hint('volunteer', <Mini rows={EXAMPLE.volunteer.map(v => `${v.period} · ${v.place} · ${v.content} · ${v.hours}시간`)} />)}
      </Sec>

      <Sec n={6} title="교과학습발달상태">
        {!ro && tools.subjects && <div className="row no-print" style={{ marginBottom: 6 }}>{tools.subjects}</div>}
        {hint('subjects')}
        {SUBJECT_KINDS.map(kind => <SubjectBlock key={kind} kind={kind} d={d} up={up} ro={ro} busy={busy} draft={draft} guide={show} />)}
      </Sec>

      <Sec n={7} title="독서활동상황">
        {!ro && tools.reading && <div className="row no-print" style={{ marginBottom: 6 }}>{tools.reading}</div>}
        <Rows ro={ro} rows={d.reading} onChange={reading => up({ reading })} blank={() => ({ area: '공통', semester: '1', books: '' })}
          cols={[{ k: 'area', label: '과목 또는 영역', w: 110, ph: '공통·문학·신앙' }, { k: 'semester', label: '학기', w: 48 }, { k: 'books', label: '독서 활동 상황 (책 제목(지은이), …)', area: true }]} />
        {hint('reading', <Mini rows={EXAMPLE.reading.map(r => `${r.area} (${r.semester}학기) ${r.books}`)} />)}
      </Sec>

      <Sec n={8} title="행동특성 및 종합의견">
        <TextBox value={d.behavior} onChange={v => up({ behavior: v })} limit={LIMITS.behavior} ro={ro} busy={busy} draft={draft} section="행동특성 및 종합의견" />
        {hint('behavior', <p>{EXAMPLE.behavior}</p>)}
      </Sec>
      {!example && <p className="tiny muted no-print">AI 초안은 학생 이름을 &apos;학생&apos;으로 바꾸고 비공개 기록(지도 사유·지도 면담)은 빼고 보냅니다. 초안은 반드시 교사가 사실과 맞는지 확인하고 고칩니다. 글자 수 한도는 해당 학년도 기재요령으로 확인하세요.</p>}
    </div>
  );
}

function Sec({ n, title, note, children }: { n: number; title: string; note?: string; children: ReactNode }) {
  return <section className="paper-sec sr-sec"><h2>{n}. {title}{note && <span className="tiny muted" style={{ fontWeight: 400, marginLeft: 8 }}>{note}</span>}</h2>{children}</section>;
}

/** 작성 요령 + 예시 펼치기 */
function Hint({ text, ex }: { text: string; ex?: ReactNode }) {
  return (
    <div className="sr-hint no-print">
      <span className="sr-hint-tag">작성 요령</span> {text}
      {ex && <details><summary>예시 보기</summary><div className="sr-ex">{ex}</div></details>}
    </div>
  );
}
const Mini = ({ rows }: { rows: string[] }) => <ul>{rows.map((r, i) => <li key={i}>{r}</li>)}</ul>;

/** 줄이 늘면 칸이 따라 커지는 글 칸 */
function AutoText({ value, onChange, ro, ph }: { value: string; onChange: (v: string) => void; ro: boolean; ph?: string }) {
  return <textarea className="sr-auto" rows={Math.max(1, value.split('\n').length)} value={value} onChange={e => onChange(e.target.value)} disabled={ro} placeholder={ph} />;
}

/** 서술 칸: 글자 수, AI 초안 */
function TextBox({ value, onChange, limit, ro, busy, draft, section }: { value: string; onChange: (v: string) => void; limit: number; ro: boolean; busy: string | null; draft: Draft; section: string }) {
  if (ro) return <div className="sr-text">{value || ' '}</div>;
  // 글 길이에 맞춰 칸 높이를 늘린다 (한 줄 약 48자)
  const rows = Math.max(4, value.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 48)), 0) + 1);
  return (
    <>
      <textarea className="paper-area sr" rows={rows} value={value} onChange={e => onChange(e.target.value)} aria-label={section} />
      <div className="sr-foot no-print">
        <span className={value.length > limit ? 'over' : ''}>{value.length} / {limit}자</span>
        {!ro && <button className="btn sm" disabled={!!busy} onClick={() => draft(section, limit, value, onChange)}>{busy === section ? '쓰는 중…' : 'AI 초안'}</button>}
      </div>
    </>
  );
}

function ActRow({ label, act, onChange, limit, ro, busy, draft, section, top }: {
  label: string; act: SrActivity; onChange: (p: Partial<SrActivity>) => void; limit: number; ro: boolean; busy: string | null; draft: Draft; section: string; top?: ReactNode;
}) {
  return (
    <tr>
      <th>{label}</th>
      <td><input className="center" value={act.hours} onChange={e => onChange({ hours: e.target.value })} disabled={ro} inputMode="numeric" aria-label={`${label} 시간`} /></td>
      <td>
        {top}
        <TextBox value={act.text} onChange={v => onChange({ text: v })} limit={limit} ro={ro} busy={busy} draft={draft} section={section} />
      </td>
    </tr>
  );
}

interface Col<T> { k: keyof T & string; label: string; w?: number; ph?: string; area?: boolean }
/** 행을 더하고 빼는 표 (수상·자격증·봉사·독서) */
function Rows<T extends object>({ cols, rows, onChange, ro, blank, extra }: {
  cols: Col<T>[]; rows: T[]; onChange: (rows: T[]) => void; ro: boolean; blank: () => T;
  extra?: { label: string; w?: number; value: (r: T, i: number) => string };
}) {
  const set = (i: number, k: keyof T, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const span = cols.length + (extra ? 1 : 0) + (ro ? 0 : 1);
  return (
    <table className="paper-table sr-rows">
      <thead><tr>{cols.map(c => <th key={c.k} style={c.w ? { width: c.w } : undefined}>{c.label}</th>)}{extra && <th style={{ width: extra.w }}>{extra.label}</th>}{!ro && <th className="no-print" style={{ width: 28 }} />}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {cols.map(c => (
              <td key={c.k}>{c.area
                ? <AutoText value={String(r[c.k] ?? '')} onChange={v => set(i, c.k, v)} ro={ro} ph={c.ph} />
                : <input value={String(r[c.k] ?? '')} onChange={e => set(i, c.k, e.target.value)} disabled={ro} placeholder={c.ph} aria-label={c.label} />}</td>
            ))}
            {extra && <td className="center">{extra.value(r, i)}</td>}
            {!ro && <td className="no-print center"><button className="sr-del" title="행 지우기" onClick={() => onChange(rows.filter((_, j) => j !== i))}>×</button></td>}
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={span} className="center muted small">해당 사항 없음</td></tr>}
        {!ro && <tr className="no-print"><td colSpan={span}><button className="linklike small" onClick={() => onChange([...rows, blank()])}>+ 행 추가</button></td></tr>}
      </tbody>
    </table>
  );
}

function SubjectBlock({ kind, d, up, ro, busy, draft, guide }: { kind: SrSubjectKind; d: SchoolRecordDoc; up: (p: Partial<SchoolRecordDoc>) => void; ro: boolean; busy: string | null; draft: Draft; guide: boolean }) {
  const idx = d.subjects.map((x, i) => [x, i] as const).filter(([x]) => x.kind === kind);
  if (ro && !idx.length) return null;
  const set = (i: number, p: Partial<SchoolRecordSubject>) => up({ subjects: d.subjects.map((y, j) => (j === i ? { ...y, ...p } : y)) });
  const art = kind === '체육·예술';
  const units = idx.reduce((s, [x]) => s + (Number(x.units) || 0), 0);
  const cols: [keyof SchoolRecordSubject, string, number?][] = art
    ? [['semester', '학기', 44], ['area', '교과', 70], ['subject', '과목'], ['units', '단위수', 54], ['achievement', '성취도', 70], ['note', '비고', 80]]
    : [['semester', '학기', 44], ['area', '교과', 64], ['subject', '과목'], ['units', '단위수', 50], ['score', '원점수/과목평균 (표준편차)', 130], ['achievement', '성취도 (수강자수)', 80], ['rank', kind === '진로 선택' ? '성취도별 분포비율' : '석차등급', kind === '진로 선택' ? 150 : 64], ['note', '비고', 56]];
  const exList = EXAMPLE.subjects.filter(x => x.kind === kind && x.detail);
  const editCol = ro ? 0 : 1;
  return (
    <div className="sr-block">
      <h3 className="sr-sub">&lt;{kind === '일반' ? '일반 과목' : kind === '진로 선택' ? '진로 선택 과목' : '체육·예술'}&gt;</h3>
      <table className="paper-table center sr-rows sr-subj">
        <thead><tr>{cols.map(([k, l, w]) => <th key={k} style={w ? { width: w } : undefined}>{l}</th>)}{!ro && <th className="no-print" style={{ width: 28 }} />}</tr></thead>
        <tbody>
          {idx.map(([x, i]) => (
            <tr key={i}>
              {cols.map(([k]) => <td key={k}><input value={String(x[k] ?? '')} onChange={e => set(i, { [k]: e.target.value })} disabled={ro} aria-label={String(k)} /></td>)}
              {!ro && <td className="no-print"><button className="sr-del" title="과목 지우기" onClick={() => up({ subjects: d.subjects.filter((_, j) => j !== i) })}>×</button></td>}
            </tr>
          ))}
          {!ro && <tr className="no-print"><td colSpan={cols.length + 1} style={{ textAlign: 'left' }}><button className="linklike small" onClick={() => up({ subjects: [...d.subjects, blankSubject(kind)] })}>+ 과목 추가</button></td></tr>}
          {idx.length > 0 && <tr><th colSpan={3}>이수단위 합계</th><td colSpan={cols.length - 3 + editCol}>{units}</td></tr>}
        </tbody>
      </table>
      {idx.length > 0 && (!ro || idx.some(([x]) => x.detail.trim())) && (
        <table className="paper-table sr-detail"><thead><tr><th>세부능력 및 특기사항</th></tr></thead>
          <tbody><tr><td>
            {idx.filter(([x]) => !ro || x.detail.trim()).map(([x, i]) => (
              <div key={i} className="sr-det">
                <div className="sr-det-head">({x.semester || '?'}학기) {x.subject || '과목 이름'}:</div>
                <TextBox value={x.detail} onChange={v => set(i, { detail: v })} limit={LIMITS.detail} ro={ro} busy={busy} draft={draft} section={`교과 세부능력 및 특기사항 - ${x.subject}`} />
              </div>
            ))}
          </td></tr></tbody>
        </table>
      )}
      {guide && kind === '일반' && <Hint text={GUIDE.detail} ex={<>{exList.map((x, i) => <p key={i}>({x.semester}학기) {x.subject}: {x.detail}</p>)}</>} />}
    </div>
  );
}
