'use client';
// 생활 기록을 A4 기록지로 쓴다: 상점·벌점 기록(별표 8), 생활·훈육 기록지(별지 4)
import { useState } from 'react';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { DEMO_TODAY, DEMERIT_ITEMS, MERIT_ITEMS, accumulation, demeritsInQuarter, guidanceCount, meritsInQuarter, quarterOf, stageFor } from '@/lib/rules';
import { ArtLink } from './ui';
import CellInput from './CellInput';

export type Sheet = '상점·벌점' | '생활·훈육 기록지';

export default function LifePaper({ sheet, onSheet, studentId, onSaved }: { sheet: Sheet; onSheet: (s: Sheet) => void; studentId?: string; onSaved: (m: string) => void }) {
  const hub = useHub();
  const auth = useAuth();
  const [sid, setSid] = useState(studentId || '');
  const [date, setDate] = useState(DEMO_TODAY);
  const [author, setAuthor] = useState(auth.me?.teacherId || hub.teachers.find(t => t.homeroomFor)?.id || '');
  const students = hub.students.filter(x => x.status === '재학').sort((a, b) => a.name.localeCompare(b.name));
  const s = hub.students.find(x => x.id === sid);
  const q = quarterOf(date);

  // 상점·벌점
  const [kind, setKind] = useState<'merit' | 'demerit'>('merit');
  const items = (kind === 'merit' ? MERIT_ITEMS : DEMERIT_ITEMS);
  const [idx, setIdx] = useState(0);
  const item = items[Math.min(idx, items.length - 1)] as { area: string; label: string; points: number; action?: string };
  const [pts, setPts] = useState<number | null>(null);
  const points = pts ?? item.points;
  const [memo, setMemo] = useState('');

  // 생활·훈육 기록지
  const [reason, setReason] = useState<'제32조 행동' | '전자기기' | '기타'>('제32조 행동');
  const [place, setPlace] = useState('');
  const [others, setOthers] = useState('');
  const [what, setWhat] = useState('');
  const [who, setWho] = useState('');
  const [said, setSaid] = useState('');
  const [safety, setSafety] = useState(false);

  const merits = s ? meritsInQuarter(hub.records, s.id, q) : 0;
  const demerits = s ? demeritsInQuarter(hub.records, s.id, q) : 0;
  const acc = accumulation(merits, demerits);
  const count = s ? guidanceCount(hub.records, s.id) : 0;
  const next = stageFor(count + 1)!;

  const saveMerit = () => {
    if (!s) return;
    const triggers = kind === 'demerit' ? (item.area === '공동체' ? '제32조 행동' : item.area === '전자기기' ? '전자기기' : '') : '';
    const created = hub.addRecord({
      studentId: s.id, type: kind, date, title: item.label, author, private: false,
      data: { points, area: item.area, ...(triggers ? { triggers } : {}), ...(item.action ? { action: item.action } : {}), ...(memo ? { note: memo } : {}) },
    });
    const inc = created.filter(r => r.type === 'incident').length;
    onSaved(`${s.name} ${kind === 'merit' ? '상점' : '벌점'} ${points}점${item.action ? ` · 즉시 조치: ${item.action}` : ''}${inc ? ` · 지도 사유 ${inc}건 생김 → 면담 일지` : ''}`);
    setPts(null); setMemo('');
  };
  const saveIncident = () => {
    if (!s || !what.trim()) return;
    const fact = [what && `무엇이: ${what}`, who && `목격: ${who}`, said && `학생의 말: ${said}`].filter(Boolean).join(' / ');
    hub.addRecord({ studentId: s.id, type: 'incident', date, title: `${reason} 지도 사유`, author, private: true, data: { reason, fact, step: next.step, safety, place, others } });
    onSaved(`${s.name} 지도 사유를 기록했습니다 → ${next.label} (${next.who})${safety ? ' · 오늘 보호자에게 알리세요' : ''}`);
    setWhat(''); setWho(''); setSaid(''); setSafety(false); setPlace(''); setOthers('');
  };

  const common = (
    <tr>
      <th>학생</th>
      <td><select value={sid} onChange={e => setSid(e.target.value)} aria-label="학생"><option value="">선택</option>{students.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></td>
      <th>날짜</th>
      <td><input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="날짜" /></td>
    </tr>
  );
  const teacherRow = (
    <tr>
      <th>{sheet === '상점·벌점' ? '기록 교사' : '발견·기록 교사'}</th>
      <td colSpan={3}><select value={author} onChange={e => setAuthor(e.target.value)} aria-label="교사"><option value="">선택</option>{hub.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></td>
    </tr>
  );

  return (
    <div className="paper">
      <div className="paper-no">{sheet === '상점·벌점' ? '별표 8' : '별지 4'}</div>

      {sheet === '상점·벌점' ? (
        <>
          <h1 className="paper-title">상 점 · 벌 점 기 록</h1>
          <div className="paper-sub">{s ? `${s.name} · ${q}쿼터 상점 ${merits}점 · 벌점 ${demerits}점` : '학생을 고르세요'}</div>
          <table className="paper-table"><tbody>
            {common}
            <tr>
              <th>구분</th>
              <td colSpan={3}>
                <div className="paper-choices">
                  <button type="button" className={kind === 'merit' ? 'on' : ''} onClick={() => { setKind('merit'); setIdx(0); setPts(null); }}>상점</button>
                  <button type="button" className={kind === 'demerit' ? 'on' : ''} onClick={() => { setKind('demerit'); setIdx(0); setPts(null); }}>벌점</button>
                </div>
              </td>
            </tr>
            <tr>
              <th>기준</th>
              <td colSpan={3}><select value={idx} onChange={e => { setIdx(Number(e.target.value)); setPts(null); }} aria-label="기준">{items.map((i, n) => <option key={i.label} value={n}>[{i.area}] {i.label} · {i.points}점</option>)}</select></td>
            </tr>
            <tr>
              <th>점수</th>
              <td><input type="number" min={1} max={5} value={points} onChange={e => setPts(Number(e.target.value))} aria-label="점수" /></td>
              <th>즉시 조치</th>
              <td>{item.action || <span className="muted">-</span>}</td>
            </tr>
            {teacherRow}
            <tr><th>메모</th><td colSpan={3}><CellInput value={memo} onChange={e => setMemo(e.target.value)} placeholder="상황을 짧게" aria-label="메모" /></td></tr>
          </tbody></table>
          <table className="paper-table"><tbody>
            <tr><th>누적 결과</th><td>{s ? <>{acc.merit || '상점 없음'}{' · '}{acc.demerit || '벌점 없음'}</> : '-'} <ArtLink no={31} label="별표 8 제4호" /></td></tr>
          </tbody></table>
          <div className="paper-actions no-print">
            <span className="tiny muted">점수를 줄 때는 그 자리에서 학생에게 이유를 말해 줍니다 (별표 8 ②)</span>
            <button className="btn primary" onClick={saveMerit} disabled={!s}>기록</button>
          </div>
        </>
      ) : (
        <>
          <h1 className="paper-title">생 활 · 훈 육 기 록 지</h1>
          <div className="paper-sub">{s ? `${s.name} · 학년도 누적 지도 ${count}건 → 이번은 ${next.label}` : '학생을 고르세요'}</div>
          <table className="paper-table"><tbody>
            {common}
            <tr><th>장소</th><td><CellInput value={place} onChange={e => setPlace(e.target.value)} aria-label="장소" /></td><th>관련 학생</th><td><CellInput value={others} onChange={e => setOthers(e.target.value)} aria-label="관련 학생" /></td></tr>
            {teacherRow}
            <tr>
              <th>지도 사유</th>
              <td colSpan={3}>
                <div className="paper-choices">
                  {(['제32조 행동', '전자기기', '기타'] as const).map(x => <button key={x} type="button" className={reason === x ? 'on' : ''} onClick={() => setReason(x)}>{x === '제32조 행동' ? '제32조 제2항의 행동' : x === '전자기기' ? '전자기기 위반' : '기타'}</button>)}
                </div>
              </td>
            </tr>
          </tbody></table>
          <section className="paper-sec">
            <h2>사실 기록 <span className="tiny muted" style={{ fontWeight: 400 }}>판단이나 해석 없이, 보고 들은 것만</span></h2>
            <table className="paper-table"><tbody>
              <tr><th>무엇이 일어났는가</th><td><textarea className="paper-area" value={what} onChange={e => setWhat(e.target.value)} aria-label="무엇이 일어났는가" /></td></tr>
              <tr><th>누가 보았는가</th><td><CellInput value={who} onChange={e => setWho(e.target.value)} aria-label="누가 보았는가" /></td></tr>
              <tr><th>학생의 말</th><td><textarea className="paper-area" value={said} onChange={e => setSaid(e.target.value)} placeholder="가능하면 그대로" aria-label="학생의 말" /></td></tr>
            </tbody></table>
          </section>
          <table className="paper-table"><tbody>
            <tr><th>단계 확인</th><td>누적 {count + 1}건 · {next.label} · 면담 담당 {next.who} <ArtLink no={33} /></td></tr>
            <tr><th>안전 사안</th><td><label className="check small"><input type="checkbox" checked={safety} onChange={e => setSafety(e.target.checked)} /> 학생의 안전과 관련된 사안이라 당일 보호자에게 알림 (제33조 제4항)</label></td></tr>
          </tbody></table>
          <div className="paper-actions no-print">
            <span className="tiny muted">비공개 기록입니다 (제38조 제2항). 면담 내용은 면담 일지에 씁니다.</span>
            <button className="btn" onClick={() => window.print()}>인쇄</button>
            <button className="btn primary" onClick={saveIncident} disabled={!s || !what.trim()}>지도 사유 기록</button>
          </div>
        </>
      )}
    </div>
  );
}
