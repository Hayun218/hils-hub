'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { renderMarkdown } from '@/lib/markdown';
import { PageHead, ArtLink } from '@/components/ui';

const REV = /^\| (\d+\.\d+(?:\.\d+)?) \| \d{4}-\d{2}-\d{2} \|/gm;

/** 0.9.5 → 0.9.6, 1.0 → 1.0.1 */
function nextVersion(v?: string) {
  if (!v) return '0.1';
  const p = v.split('.').map(Number);
  if (p.length < 3) return `${v}.1`;
  p[p.length - 1] += 1;
  return p.join('.');
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function HakchikEditPage() {
  const auth = useAuth();
  const router = useRouter();
  const [orig, setOrig] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [editable, setEditable] = useState(false);
  const [logRev, setLogRev] = useState(false); // 완성본 전: 개정 이력을 남기지 않는다
  const [version, setVersion] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/hakchik', { cache: 'no-store' }).then(r => r.json()).then(({ content, editable }) => {
      setOrig(content); setText(content); setEditable(editable);
      setVersion(nextVersion([...content.matchAll(REV)].pop()?.[1]));
    });
  }, []);

  const dirty = orig !== null && text !== orig;
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const preview = useMemo(() => renderMarkdown(text, { skipTitle: true }).nodes, [text]);

  if (!can(auth.me, 'hakchik')) {
    return <div className="page"><PageHead title="학칙 편집" /><div className="callout red">학칙 편집 권한이 없습니다. 관리자에게 권한을 요청하세요.</div></div>;
  }

  const save = async () => {
    setErr('');
    if (logRev && !note.trim()) { setErr('개정 이력에 남길 내용을 적거나, "개정 이력에 남기기"를 끄세요'); return; }
    setSaving(true);
    const res = await fetch('/api/hakchik', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, revision: logRev ? { version, date: today(), note, author: auth.me!.name } : undefined }),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(j.error || '저장하지 못했습니다'); return; }
    setOrig(text);
    router.push('/hakchik');
    router.refresh();
  };

  return (
    <div className="page">
      <PageHead
        title="학칙 편집"
        desc={<>왼쪽에서 원문(마크다운)을 고치면 오른쪽에 바로 보입니다. 조문 제목은 <code>### 제N조(제목)</code> 형식을 지켜야 링크와 목차가 작동합니다. 개정 승인은 <ArtLink no={5} /> 절차를 따릅니다.</>}
        right={<>
          <Link className="btn" href="/hakchik" onClick={e => { if (dirty && !confirm('저장하지 않은 변경이 있습니다. 나갈까요?')) e.preventDefault(); }}>취소</Link>
          <button className="btn primary" onClick={save} disabled={!dirty || saving || !editable}>{saving ? '저장 중…' : '저장'}</button>
        </>}
      />
      {!editable && orig !== null && <div className="callout red" style={{ marginBottom: 12 }}>로컬 개발 서버(npm run dev)에서만 저장할 수 있습니다.</div>}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="check"><input type="checkbox" checked={logRev} onChange={e => setLogRev(e.target.checked)} /> 개정 이력에 남기기 (제5조 제4항)</label>
          {logRev && <>
            <label className="field" style={{ width: 110 }}>버전<input value={version} onChange={e => setVersion(e.target.value)} /></label>
            <label className="field" style={{ flex: 1, minWidth: 240 }}>내용<input value={note} onChange={e => setNote(e.target.value)} placeholder="예: 당번 편성을 혼합 연령 팀으로 변경(제31조 제10항)" /></label>
            <span className="tiny muted">작성 {auth.me?.name} · {today()}</span>
          </>}
        </div>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>
          저장하면 이전 원문을 <code>.hakchik-history/</code>에 백업합니다. {dirty ? '· 저장하지 않은 변경 있음' : ''}
        </p>
      </div>
      {err && <div className="callout red" style={{ marginBottom: 12 }}>{err}</div>}

      {orig === null ? <p className="muted">불러오는 중…</p> : (
        <div className="edit-layout">
          <textarea className="edit-area" value={text} onChange={e => setText(e.target.value)} spellCheck={false} aria-label="학칙 원문" />
          <article className="doc edit-preview">{preview}</article>
        </div>
      )}
    </div>
  );
}
