'use client';
// 상점·벌점 빠른 입력 (별표 8). 일지가 아니라 한 줄로 기록한다.
import { useState } from 'react';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { DEMO_TODAY, DEMERIT_ITEMS, MERIT_ITEMS } from '@/lib/rules';

type Item = { area: string; label: string; points: number; q1: boolean; action?: string };

export default function QuickMerit({ onSaved }: { onSaved: (m: string) => void }) {
  const hub = useHub();
  const auth = useAuth();
  const [sid, setSid] = useState('');
  const [kind, setKind] = useState<'merit' | 'demerit'>('merit');
  const [q1Only, setQ1Only] = useState(true);
  const items: Item[] = (kind === 'merit' ? MERIT_ITEMS : DEMERIT_ITEMS).filter(i => !q1Only || i.q1);
  const [idx, setIdx] = useState(0);
  const item = items[Math.min(idx, items.length - 1)];
  const [pts, setPts] = useState<number | null>(null);
  const [date, setDate] = useState(DEMO_TODAY);
  const points = pts ?? item.points;
  const students = hub.students.filter(x => x.status === '재학').sort((a, b) => a.name.localeCompare(b.name));
  const author = auth.me?.teacherId || hub.students.find(x => x.id === sid)?.homeroom || hub.teachers.find(t => t.homeroomFor)?.id || '';

  const save = () => {
    const s = hub.students.find(x => x.id === sid);
    if (!s) return;
    const triggers = kind === 'demerit' ? (item.area === '공동체' ? '제32조 행동' : item.area === '전자기기' ? '전자기기' : '') : '';
    const created = hub.addRecord({
      studentId: s.id, type: kind, date, title: item.label, author, private: false,
      data: { points, area: item.area, ...(triggers ? { triggers } : {}), ...(item.action ? { action: item.action } : {}) },
    });
    const inc = created.filter(r => r.type === 'incident').length;
    onSaved(`${s.name} ${kind === 'merit' ? '상점' : '벌점'} ${points}점${item.action ? ` · 즉시 조치: ${item.action}` : ''}${inc ? ` · 지도 사유 ${inc}건 생김 → 생활·훈육 기록지와 면담 일지` : ''}. 학생에게 그 자리에서 이유를 말해 주세요.`);
    setPts(null);
  };

  return (
    <div className="quick-merit">
      <select className="input" value={sid} onChange={e => setSid(e.target.value)} aria-label="학생"><option value="">학생</option>{students.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <div className="seg">
        <button className={kind === 'merit' ? 'on' : ''} onClick={() => { setKind('merit'); setIdx(0); setPts(null); }}>상점</button>
        <button className={kind === 'demerit' ? 'on' : ''} onClick={() => { setKind('demerit'); setIdx(0); setPts(null); }}>벌점</button>
      </div>
      <select className="input grow" value={idx} onChange={e => { setIdx(Number(e.target.value)); setPts(null); }} aria-label="기준">
        {items.map((i, n) => <option key={i.label} value={n}>[{i.area}] {i.label} · {i.points}점{i.action ? ` · ${i.action}` : ''}</option>)}
      </select>
      <input className="input" style={{ width: 64 }} type="number" min={1} max={5} value={points} onChange={e => setPts(Number(e.target.value))} aria-label="점수" />
      <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="날짜" />
      <button className="btn primary" onClick={save} disabled={!sid}>기록</button>
      <label className="check tiny"><input type="checkbox" checked={q1Only} onChange={e => { setQ1Only(e.target.checked); setIdx(0); }} /> 1쿼터 적용 항목만</label>
    </div>
  );
}
