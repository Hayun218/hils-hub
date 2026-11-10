'use client';
// 연도별 보관: 지금 판을 학년도(·쿼터)로 보관하고, 지난 판을 보거나 불러온다.
import { useState } from 'react';
import { useHub } from '@/lib/store';
import type { ArchiveEntry } from '@/lib/types';

export default function ArchiveBar({ kind, label, year, current, onRestore, renderView }: {
  kind: ArchiveEntry['kind']; label: string; year: number; current: unknown;
  onRestore: (data: unknown) => void; renderView?: (data: unknown) => React.ReactNode;
}) {
  const hub = useHub();
  const list = hub.archives.filter(a => a.kind === kind).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  const [open, setOpen] = useState<ArchiveEntry | null>(null);
  const [show, setShow] = useState(false);
  return (
    <>
      <span className="archive-bar">
        <button className="btn sm" onClick={() => { hub.saveArchive({ kind, year, label, data: JSON.parse(JSON.stringify(current)) }); setShow(true); }} title="지금 판을 보관함에 남깁니다">보관</button>
        <button className="btn sm" onClick={() => setShow(true)}>보관함 {list.length || ''}</button>
      </span>
      {show && (
        <div className="modal-bg" onClick={() => { setShow(false); setOpen(null); }}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <h2>보관함</h2>
            <p className="small muted" style={{ marginTop: 0 }}>학년도마다 보관해 두면 지난해 것을 보고 불러올 수 있습니다.</p>
            {list.length === 0 && <p className="small muted">보관한 판이 없습니다.</p>}
            <ul className="rec-list">
              {list.map(a => (
                <li key={a.id}><div className="rec-row" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><b>{a.label}</b> <span className="tiny muted">{a.savedAt.slice(0, 16).replace('T', ' ')} 보관</span></span>
                  <span className="row" style={{ gap: 4 }}>
                    {renderView && <button className="btn sm" onClick={() => setOpen(open?.id === a.id ? null : a)}>{open?.id === a.id ? '닫기' : '보기'}</button>}
                    <button className="btn sm primary" onClick={() => { if (confirm(`${a.label} 판을 지금 판으로 불러올까요? (⌘Z로 되돌릴 수 있습니다)`)) { onRestore(JSON.parse(JSON.stringify(a.data))); setShow(false); } }}>불러오기</button>
                    <button className="btn sm warn" onClick={() => { if (confirm('보관한 판을 지울까요?')) hub.removeArchive(a.id); }}>삭제</button>
                  </span>
                </div></li>
              ))}
            </ul>
            {open && renderView && <div style={{ marginTop: 12, maxHeight: '50vh', overflow: 'auto' }}>{renderView(open.data)}</div>}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn" onClick={() => { setShow(false); setOpen(null); }}>닫기</button></div>
          </div>
        </div>
      )}
    </>
  );
}
