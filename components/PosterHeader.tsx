'use client';
// 기존 HILS 게시물(2쿼터 개인 일과표, 당번표)의 머리글 모양: 큰 제목 + 표 이름 + 로고·표어 상자.
// 표어와 말씀 구절은 화면에서 고치며 이 브라우저에 기억한다.
import { useEffect, useState } from 'react';
import { DEMO_TODAY, SCHOOL_YEAR, quarterOf } from '@/lib/rules';

const KEY = 'hils-hub-poster-v1';
interface Motto { motto: string; verse: string }
const DEFAULT: Motto = { motto: '하나님의 친밀함과 비밀을 누리는 자', verse: '시 25:14' };

export default function PosterHeader({ name, sub }: { name: string; sub?: string }) {
  const [m, setM] = useState<Motto>(DEFAULT);
  const [editing, setEditing] = useState(false);
  useEffect(() => { try { const raw = localStorage.getItem(KEY); if (raw) setM(JSON.parse(raw)); } catch {} }, []);
  const save = (x: Motto) => { setM(x); try { localStorage.setItem(KEY, JSON.stringify(x)); } catch {} };

  return (
    <div className="poster-head">
      <div className="poster-left">
        <div className="poster-year">HILS {SCHOOL_YEAR}학년도 {quarterOf(DEMO_TODAY)}쿼터</div>
        <div className="poster-name">{name}</div>
        {sub && <div className="poster-sub">{sub}</div>}
      </div>
      <div className="poster-motto" onDoubleClick={() => setEditing(true)} title="더블클릭해서 표어 고치기">
        <img src="/hils-logo.png" alt="" />
        {editing ? (
          <div className="stack no-print" style={{ flex: 1 }}>
            <input className="input" value={m.motto} onChange={e => save({ ...m, motto: e.target.value })} aria-label="표어" />
            <input className="input" value={m.verse} onChange={e => save({ ...m, verse: e.target.value })} aria-label="말씀" placeholder="[시 25:14] 말씀 구절" />
            <button className="btn sm" onClick={() => setEditing(false)}>완료</button>
          </div>
        ) : (
          <div>
            <div className="motto">{m.motto}</div>
            {m.verse && <div className="verse">{m.verse}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
