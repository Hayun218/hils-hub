'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FORMS } from '@/lib/forms';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { DEMO_TODAY } from '@/lib/rules';
import { completion, parseForm, type FormValues } from '@/lib/formTemplate';
import { downloadBlob, formToDocx } from '@/lib/formDocx';
import type { FormRecord, FormValue } from '@/lib/types';
import FormView from '@/components/FormView';
import { PageHead, ArtLink, Badge } from '@/components/ui';

type Mode = 'list' | 'edit' | 'source';

export default function FormWorkspace({ no, md }: { no: number; md: string }) {
  const f = FORMS.find(x => x.no === no)!;
  const hub = useHub();
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const tpl = useMemo(() => parseForm(md), [md]);
  const students = hub.students.filter(s => s.status !== '퇴교');
  const [mode, setMode] = useState<Mode>('list');
  const [cur, setCur] = useState<FormRecord | null>(null);
  const [saved, setSaved] = useState(true);

  const seeAll = can(auth.me, 'private');
  const list = hub.forms
    .filter(r => r.formNo === no)
    .filter(r => !r.private || seeAll || r.author === auth.me?.name)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));

  const studentKeys = useMemo(() => tpl.blocks.flatMap(b => (b.t === 'table' ? b.rows.flat().filter(c => c.kind === 'input' && c.student).map(c => (c as { key: string }).key) : [])), [tpl]);
  const nameOf = (id?: string) => hub.students.find(s => s.id === id)?.name || '';
  const titleFor = (r: FormRecord) => [f.title, nameOf(r.studentId), r.date].filter(Boolean).join(' · ');

  const start = (studentId?: string) => {
    const values: FormValues = {};
    if (studentId) studentKeys.forEach(k => { values[k] = studentId; });
    const r: FormRecord = {
      id: hub.newId('f'), formNo: no, title: '', date: DEMO_TODAY, author: auth.me?.name || '', values, studentId,
      status: '작성중', private: !!f.privateForm, updatedAt: new Date().toISOString(),
    };
    r.title = titleFor(r);
    setCur(r); setMode('edit'); setSaved(true); // 입력을 시작하면 저장한다
  };
  useEffect(() => {
    const openId = params.get('open');
    const found = openId && hub.forms.find(x => x.id === openId);
    if (found) { setCur(found); setSaved(true); setMode('edit'); router.replace(`/forms/${no}`); }
    else if (params.get('new') === '1') { start(params.get('student') || undefined); router.replace(`/forms/${no}`); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub.loaded]);

  // 작성 중인 기록은 바뀔 때마다 저장한다
  useEffect(() => {
    if (!cur || saved) return;
    const t = setTimeout(() => { hub.saveForm(cur); setSaved(true); }, 400);
    return () => clearTimeout(t);
  }, [cur, saved, hub]);

  const edit = (patch: Partial<FormRecord>) => { setCur(c => (c ? { ...c, ...patch } : c)); setSaved(false); };
  const setValue = (k: string, v: FormValue) => { setSaved(false); setCur(c => {
    if (!c) return c;
    const values: FormValues = { ...c.values, [k]: v };
    // 별지 8: 지도 면담이면 비공개 (제38조 제2항)
    const priv = f.privateForm || Object.entries(values).some(([key, x]) => key.includes('구분') && x === '지도 면담');
    return { ...c, values, private: !!priv };
  }); };
  const setStudent = (id: string) => {
    if (!cur) return;
    const values = { ...cur.values };
    studentKeys.forEach(k => { values[k] = id; });
    const next = { ...cur, studentId: id || undefined, values };
    edit({ studentId: next.studentId, values, title: cur.title === titleFor(cur) ? titleFor(next) : cur.title });
  };

  const word = async (r?: FormRecord) => {
    const blob = await formToDocx({ no, title: tpl.title, meta: tpl.meta, blocks: tpl.blocks, values: r?.values, studentName: nameOf });
    downloadBlob(blob, r ? `별지${no}_${r.title.replace(/[\\/:*?"<>|]/g, '')}.docx` : `HILS_별지${no}_${f.title.replace(/[ ·]/g, '')}.docx`);
  };


  return (
    <div className="page">
      <PageHead
        title={`별지 ${no} · ${f.title}`}
        desc={<>근거 {f.articles.map(a => <ArtLink key={a} no={a} />)} · {f.when} · 작성자 {f.writer}</>}
        right={<>
          {f.original
            ? f.original.map(o => <a key={o.href} className="btn" href={o.href} download={o.filename}>{o.label}</a>)
            : <button className="btn" onClick={() => word()}>빈 양식 Word</button>}
          {f.flow && <Link className="btn" href={f.flow.href}>{f.flow.label}</Link>}
          <button className="btn primary" onClick={() => start()}>새로 작성</button>
        </>}
      />

      <div className="tabs no-print">
        <button className={mode === 'list' ? 'on' : ''} onClick={() => setMode('list')}>기록 {list.length}</button>
        {cur && <button className={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')}>작성 중: {cur.title}</button>}
        <button className={mode === 'source' ? 'on' : ''} onClick={() => setMode('source')}>원본 미리보기</button>
      </div>

      {mode === 'list' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="t">
            <thead><tr><th>제목</th>{f.student && <th>학생</th>}<th>작성자</th><th>날짜</th><th>작성</th><th>상태</th><th /></tr></thead>
            <tbody>
              {list.map(r => {
                const c = completion(tpl.blocks, r.values);
                return (
                  <tr key={r.id}>
                    <td><button className="linklike" onClick={() => { setCur(r); setSaved(true); setMode('edit'); }}>{r.title}</button>{r.private && <> <Badge tone="line">비공개</Badge></>}</td>
                    {f.student && <td>{nameOf(r.studentId) || <span className="muted">-</span>}</td>}
                    <td className="small">{r.author}</td>
                    <td className="small">{r.date}</td>
                    <td className="small">{c.done}/{c.total}칸</td>
                    <td><Badge tone={r.status === '완료' ? 'green' : 'gold'}>{r.status}</Badge></td>
                    <td style={{ textAlign: 'right' }}>{!f.original && <button className="btn sm" onClick={() => word(r)}>Word</button>}</td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                  아직 기록이 없습니다. <button className="linklike" onClick={() => start()}>새로 작성</button>하거나 {f.original ? '원본 양식을' : '빈 양식을 Word로'} 내려받으세요.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {mode === 'edit' && cur && (
        <>
          <div className="card form-bar no-print">
            <label className="field" style={{ flex: 2, minWidth: 220 }}>제목<input value={cur.title} onChange={e => edit({ title: e.target.value })} /></label>
            {f.student && (
              <label className="field" style={{ minWidth: 140 }}>학생
                <select value={cur.studentId || ''} onChange={e => setStudent(e.target.value)}>
                  <option value="">선택</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
            <label className="field">날짜<input type="date" value={cur.date} onChange={e => edit({ date: e.target.value })} /></label>
            <label className="field">상태
              <select value={cur.status} onChange={e => edit({ status: e.target.value as FormRecord['status'] })}><option>작성중</option><option>완료</option></select>
            </label>
            <div className="row" style={{ alignSelf: 'flex-end' }}>
              <span className="tiny muted">{saved ? '저장됨' : '저장 중…'}</span>
              {!f.original && <button className="btn" onClick={() => word(cur)}>Word</button>}
              <button className="btn" onClick={() => window.print()}>인쇄</button>
              <button className="btn warn" onClick={() => { if (confirm('이 기록을 지울까요?')) { hub.removeForm(cur.id); setCur(null); setMode('list'); } }}>삭제</button>
            </div>
          </div>
          {tpl.guide && <div className="callout small no-print" style={{ marginBottom: 12 }}>{tpl.guide}</div>}
          {cur.private && <div className="callout small no-print" style={{ marginBottom: 12 }}>비공개 기록입니다. 작성자와 비공개 기록 열람 권한이 있는 교직원만 봅니다 <ArtLink no={38} /></div>}
          <article className="doc form-doc">
            <div className="form-no">별지 {no}</div>
            <h1 className="form-title">{tpl.title}</h1>
            <FormView blocks={tpl.blocks} values={cur.values} onChange={setValue} students={students} />
          </article>
        </>
      )}

      {mode === 'source' && (
        <>
          <div className="card form-info no-print">
            <table className="t small"><tbody>
              <tr><td className="muted" style={{ width: 90 }}>근거</td><td><div className="row" style={{ gap: 4 }}>{f.articles.map(a => <ArtLink key={a} no={a} />)}</div></td></tr>
              <tr><td className="muted">작성 시점</td><td>{f.when}</td></tr>
              <tr><td className="muted">작성자</td><td>{f.writer}</td></tr>
              {tpl.guide && <tr><td className="muted">안내</td><td>{tpl.guide}</td></tr>}
              {f.original && <tr><td className="muted">원본 파일</td><td className="row" style={{ gap: 6 }}>{f.original.map(o => <a key={o.href} className="btn sm" href={o.href} download={o.filename}>{o.label}</a>)}</td></tr>}
            </tbody></table>
          </div>
          <article className="doc form-doc preview">
            <div className="form-no">별지 {no}</div>
            <h1 className="form-title">{tpl.title}</h1>
            <FormView blocks={tpl.blocks} values={{}} students={students} />
          </article>
        </>
      )}
    </div>
  );
}
