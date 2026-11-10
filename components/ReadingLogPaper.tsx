'use client';
// 독서록 쓰기 (A4 기록지). 저장하면 졸업 과제 제출 목록의 독서록이 된다.
import { useState } from 'react';
import { useHub } from '@/lib/store';
import { DEMO_TODAY } from '@/lib/rules';
import { READING_FIELDS, readingLogDocx } from '@/lib/readingLog';
import { downloadBlob } from '@/lib/formDocx';
import type { Submission } from '@/lib/types';

export default function ReadingLogPaper({ initial, onDone }: { initial?: Submission; onDone: (msg: string) => void }) {
  const hub = useHub();
  const [sid, setSid] = useState(initial?.studentId || '');
  const [v, setV] = useState<Record<string, string>>(initial?.content || {});
  const students = hub.students.filter(s => s.status === '재학').sort((a, b) => a.name.localeCompare(b.name));
  const name = students.find(s => s.id === sid)?.name || '';
  const save = () => {
    if (!sid || !v.title?.trim()) return;
    hub.saveSubmission({ id: initial?.id || hub.newId('sub'), studentId: sid, kind: '독서록', title: v.title.trim(), author: v.author, date: initial?.date || DEMO_TODAY, content: v, fileId: initial?.fileId, fileName: initial?.fileName });
    onDone(`${name} 독서록 「${v.title}」을 저장했습니다`);
  };
  return (
    <div className="paper">
      <h1 className="paper-title">독 서 록</h1>
      <div className="paper-sub">사고력·독서 졸업 기준 (별표 2)</div>
      <table className="paper-table"><tbody>
        <tr><th>이름</th><td><select value={sid} onChange={e => setSid(e.target.value)} aria-label="학생"><option value="">선택</option>{students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td></tr>
        {READING_FIELDS.map(f => (
          <tr key={f.key}>
            <th>{f.label}</th>
            <td>{f.long
              ? <textarea className="paper-area" value={v[f.key] || ''} onChange={e => setV({ ...v, [f.key]: e.target.value })} placeholder={f.hint} aria-label={f.label} />
              : <input value={v[f.key] || ''} onChange={e => setV({ ...v, [f.key]: e.target.value })} placeholder={f.hint} aria-label={f.label} />}
            </td>
          </tr>
        ))}
      </tbody></table>
      <div className="paper-actions no-print">
        <button className="btn" onClick={async () => downloadBlob(await readingLogDocx(v, name), `독서록_${name || '이름'}_${v.title || '제목'}.docx`)}>Word</button>
        <button className="btn" onClick={() => window.print()}>인쇄</button>
        <button className="btn primary" onClick={save} disabled={!sid || !v.title?.trim()}>저장</button>
      </div>
    </div>
  );
}
