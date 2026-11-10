'use client';
// 교재 소개: 교과 로드맵의 교과·학년(레벨)별로 쓰는 교재. 매년(학년도가 바뀌면) 한 번 최신판을 자동으로 확인하고
// 구매 링크를 잡는다 (/api/books: 알라딘·카카오 키가 있으면 그쪽, 없으면 서점 검색 링크).
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { SCHOOL_YEAR } from '@/lib/rules';
import { newerEdition, storeLinks } from '@/lib/books';
import type { BookEdition, Textbook, TextbookUse } from '@/lib/types';
import { Badge, PageHead } from '@/components/ui';
import CellInput from '@/components/CellInput';

const USES: TextbookUse[] = ['주교재', '부교재', '필독서', '검정고시', '참고'];
const TONE: Record<TextbookUse, 'green' | 'line' | 'gold' | 'deep' | 'orange'> = { 주교재: 'green', 부교재: 'line', 필독서: 'gold', 검정고시: 'deep', 참고: 'line' };

type Found = { editions: BookEdition[]; source: string; stores: Record<string, string>; errors: string[]; exact: boolean };
const lookup = async (t: { title: string; publisher?: string; isbn?: string }): Promise<Found> => {
  const u = new URLSearchParams({ q: t.title, publisher: t.publisher || '', isbn: t.isbn || '' });
  const r = await fetch(`/api/books?${u}`);
  return r.json();
};
const fromEdition = (e: BookEdition): Partial<Textbook> => ({ title: e.title, author: e.author, publisher: e.publisher, isbn: e.isbn, date: e.date, link: e.link, price: e.price, cover: e.cover });

export default function BooksPage() {
  const hub = useHub();
  const auth = useAuth();
  const editable = !!auth.me; // 시안: 교사 모두 편집 (운영 때 권한)
  const subjects = useMemo(() => [...new Set([...hub.roadmaps.map(r => r.subject), ...hub.textbooks.map(t => t.subject)])], [hub.roadmaps, hub.textbooks]);
  const [subject, setSubject] = useState<string>('전체');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const list = hub.textbooks.filter(t => subject === '전체' || t.subject === subject);
  const groups = (subject === '전체' ? subjects : [subject]).filter(g => list.some(t => t.subject === g));

  // 매년 한 번 자동 확인: 이번 학년도에 아직 확인하지 않은 교재만 차례로
  const running = useRef(false);
  const [checking, setChecking] = useState('');
  useEffect(() => {
    if (running.current) return;
    const todo = hub.textbooks.filter(t => (t.checkedYear || 0) < SCHOOL_YEAR);
    if (!todo.length) return;
    running.current = true;
    (async () => {
      for (const t of todo) {
        setChecking(t.title);
        try {
          const f = await lookup(t);
          if (!f.editions.length && f.errors.length) { setMsg(f.errors[f.errors.length - 1]); break; } // 키가 없으면 멈춘다
          hub.saveTextbook({ ...t, checkedYear: SCHOOL_YEAR, checkedAt: new Date().toISOString(), newer: newerEdition(t, f.editions) });
        } catch { break; }
      }
      setChecking('');
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkOne = async (t: Textbook) => {
    setChecking(t.title); setMsg('');
    const f = await lookup(t).catch(() => null);
    setChecking('');
    if (!f) { setMsg('서버에 연결하지 못했습니다'); return; }
    if (!f.editions.length) { setMsg(f.errors.at(-1) || '찾은 판이 없습니다. 서점 검색 링크로 확인하세요.'); return; }
    const n = newerEdition(t, f.editions);
    hub.saveTextbook({ ...t, checkedYear: SCHOOL_YEAR, checkedAt: new Date().toISOString(), newer: n });
    setMsg(n ? `「${t.title}」 새 판이 있습니다 (${n.date})` : `「${t.title}」 지금 쓰는 판이 최신입니다`);
  };
  const checked = hub.textbooks.filter(t => t.checkedYear === SCHOOL_YEAR).length;

  return (
    <div className="page wide">
      <PageHead
        title="교재"
        desc={<>교과 로드맵의 교과·학년(레벨)별로 쓰는 교재를 소개합니다. 학년도가 바뀌면 한 번씩 최신판을 자동으로 확인하고 구매 링크를 잡습니다. 과목 운영안의 교재 칸과 함께 씁니다 (제21조).</>}
        right={<><Link className="btn" href="/subjects/roadmap">← 교과 로드맵</Link>{editable && <button className="btn primary" onClick={() => setAdding(true)}>+ 교재 추가</button>}</>}
      />
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="seg">{['전체', ...subjects].map(x => <button key={x} className={subject === x ? 'on' : ''} onClick={() => setSubject(x)}>{x}</button>)}</div>
        <span className="tiny muted">{SCHOOL_YEAR}학년도 최신판 확인 {checked}/{hub.textbooks.length}{checking ? ` · 「${checking}」 확인 중…` : ''}</span>
      </div>
      {msg && <div className="callout gold small" style={{ marginBottom: 12 }}>{msg}</div>}
      {adding && <BookForm subjects={subjects} initial={{ subject: subject === '전체' ? subjects[0] || '' : subject }} onClose={() => setAdding(false)} />}
      {list.length === 0 && !adding && <div className="card muted">아직 교재가 없습니다. &ldquo;+ 교재 추가&rdquo;에서 이름을 넣고 찾으면 출판사·판·구매 링크가 채워집니다.</div>}
      {groups.map(g => (
        <div key={g} className="stack" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '4px 0' }}>{g}</h3>
          <div className="book-grid">
            {list.filter(t => t.subject === g).sort((a, b) => USES.indexOf(a.use) - USES.indexOf(b.use) || a.target.localeCompare(b.target)).map(t => (
              <BookCard key={t.id} t={t} editable={editable} subjects={subjects} onCheck={() => checkOne(t)} busy={checking === t.title} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BookCard({ t, editable, subjects, onCheck, busy }: { t: Textbook; editable: boolean; subjects: string[]; onCheck: () => void; busy: boolean }) {
  const hub = useHub();
  const [edit, setEdit] = useState(false);
  if (edit) return <BookForm subjects={subjects} initial={t} onClose={() => setEdit(false)} />;
  const stores = storeLinks([t.title, t.publisher].filter(Boolean).join(' '));
  return (
    <div className="card book-card">
      <div className="book-cover">{t.cover ? <img src={t.cover} alt="" /> : <span>{t.title.slice(0, 2)}</span>}</div>
      <div className="book-body">
        <div className="row" style={{ gap: 6 }}><Badge tone={TONE[t.use]}>{t.use}</Badge>{t.target && <span className="tiny muted">{t.target}</span>}</div>
        <b className="book-title">{t.title}</b>
        <div className="tiny muted">{[t.author, t.publisher, t.date && `${t.date} 판`, t.price].filter(Boolean).join(' · ')}</div>
        {t.note && <p className="small" style={{ margin: '6px 0 0' }}>{t.note}</p>}
        {t.newer && (
          <div className="callout gold tiny" style={{ marginTop: 8 }}>
            새 판: {t.newer.title} ({t.newer.publisher}, {t.newer.date}){t.newer.price ? ` · ${t.newer.price}` : ''}
            {editable && <div className="row" style={{ gap: 6, marginTop: 4 }}>
              <button className="btn sm primary" onClick={() => hub.saveTextbook({ ...t, ...fromEdition(t.newer!), newer: undefined })}>이 판으로 바꾸기</button>
              <button className="btn sm" onClick={() => hub.saveTextbook({ ...t, newer: undefined })}>그대로 쓰기</button>
            </div>}
          </div>
        )}
        <div className="row book-links">
          {t.link ? <a className="btn sm primary" href={t.link} target="_blank" rel="noreferrer">구매 링크 ↗</a> : null}
          {Object.entries(stores).map(([k, u]) => <a key={k} className="tiny" href={u} target="_blank" rel="noreferrer">{k}</a>)}
        </div>
        <div className="row tiny muted" style={{ marginTop: 6 }}>
          {t.checkedYear ? `최신판 확인 ${t.checkedAt?.slice(0, 10)}` : '최신판 확인 전'}
          <button className="linklike tiny" onClick={onCheck} disabled={busy}>{busy ? '확인 중…' : '지금 확인'}</button>
          {editable && <><button className="linklike tiny" onClick={() => setEdit(true)}>고치기</button>
            <button className="linklike tiny" onClick={() => { if (confirm(`「${t.title}」을(를) 지울까요?`)) hub.removeTextbook(t.id); }}>지우기</button></>}
        </div>
      </div>
    </div>
  );
}

function BookForm({ subjects, initial, onClose }: { subjects: string[]; initial: Partial<Textbook>; onClose: () => void }) {
  const hub = useHub();
  const [f, setF] = useState<Partial<Textbook>>({ use: '주교재', target: '', title: '', ...initial });
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Textbook>) => setF(x => ({ ...x, ...p }));
  const cols = hub.roadmaps.find(r => r.subject === f.subject)?.cols || [];
  const search = async () => {
    if (!f.title?.trim()) return;
    setBusy(true);
    setFound(await lookup({ title: f.title, publisher: f.publisher, isbn: f.isbn }).catch(() => null));
    setBusy(false);
  };
  const save = () => {
    if (!f.title?.trim() || !f.subject) return;
    hub.saveTextbook({ id: f.id || hub.newId('bk'), subject: f.subject, target: f.target || '', use: (f.use || '주교재') as TextbookUse, title: f.title.trim(), author: f.author, publisher: f.publisher, isbn: f.isbn, date: f.date, link: f.link, price: f.price, cover: f.cover, note: f.note, checkedYear: f.checkedYear, checkedAt: f.checkedAt, newer: f.newer });
    onClose();
  };
  return (
    <div className="card stack" style={{ marginBottom: 12 }}>
      <div className="grid g3">
        <label className="field">교과
          <input list="book-subjects" value={f.subject || ''} onChange={e => set({ subject: e.target.value })} placeholder="교과 로드맵의 교과" />
          <datalist id="book-subjects">{subjects.map(x => <option key={x} value={x} />)}</datalist>
        </label>
        <label className="field">대상 (학년·레벨)
          <input list="book-targets" value={f.target || ''} onChange={e => set({ target: e.target.value })} placeholder="예: 중1–중2, EN-B" />
          <datalist id="book-targets">{cols.map(x => <option key={x} value={x} />)}</datalist>
        </label>
        <label className="field">쓰임<select value={f.use} onChange={e => set({ use: e.target.value as TextbookUse })}>{USES.map(u => <option key={u}>{u}</option>)}</select></label>
        <label className="field" style={{ gridColumn: 'span 2' }}>교재 이름<input value={f.title || ''} onChange={e => set({ title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') search(); }} placeholder="예: 개념원리 중학 수학 1-1" /></label>
        <label className="field">출판사<input value={f.publisher || ''} onChange={e => set({ publisher: e.target.value })} /></label>
      </div>
      <div className="row">
        <button className="btn" onClick={search} disabled={busy || !f.title?.trim()}>{busy ? '찾는 중…' : '최신판 찾기'}</button>
        {f.title && Object.entries(storeLinks([f.title, f.publisher].filter(Boolean).join(' '))).map(([k, u]) => <a key={k} className="tiny" href={u} target="_blank" rel="noreferrer">{k}에서 찾기</a>)}
      </div>
      {found && (
        found.editions.length ? (
          <table className="t small">
            <thead><tr><th>판</th><th>교재</th><th>출판사</th><th>가격</th><th /></tr></thead>
            <tbody>{found.editions.map((e, i) => (
              <tr key={i}><td>{e.date}</td><td>{e.title}<div className="tiny muted">{e.author}</div></td><td>{e.publisher}</td><td>{e.price || '-'}</td>
                <td><button className="btn sm" onClick={() => { set(fromEdition(e)); setFound(null); }}>이 판 쓰기</button></td></tr>
            ))}</tbody>
          </table>
        ) : <div className="callout gold small">{found.errors.at(-1) || '찾은 판이 없습니다.'} 서점 링크에서 찾은 뒤 아래 칸에 직접 적어도 됩니다.</div>
      )}
      <div className="grid g3">
        <label className="field">지은이<input value={f.author || ''} onChange={e => set({ author: e.target.value })} /></label>
        <label className="field">발행일 (판)<input value={f.date || ''} onChange={e => set({ date: e.target.value })} placeholder="2026-12-01" /></label>
        <label className="field">ISBN<input value={f.isbn || ''} onChange={e => set({ isbn: e.target.value })} /></label>
        <label className="field" style={{ gridColumn: 'span 2' }}>구매 링크<input value={f.link || ''} onChange={e => set({ link: e.target.value })} placeholder="https://…" /></label>
        <label className="field">가격<input value={f.price || ''} onChange={e => set({ price: e.target.value })} /></label>
      </div>
      <label className="field">활용 (순서·범위)<CellInput className="input" value={f.note || ''} onChange={e => set({ note: e.target.value })} placeholder="예: 1쿼터 1–4단원, 매주 2단원씩 + 단원평가" /></label>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>취소</button>
        <button className="btn primary" onClick={save} disabled={!f.title?.trim() || !f.subject}>저장</button>
      </div>
    </div>
  );
}
