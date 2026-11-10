'use client';
import { useMemo, useRef, useState } from 'react';
import { LandscapePage, usePrintFit } from '@/components/usePrintFit';
import { useHub } from '@/lib/store';
import {
  CLEAN_DAYS, DEFAULT_CLEAN_ZONES, DEFAULT_DUTY_OPTIONS, DISH_DAYS, dutyPool,
  generateCleaningDuty, generateDishDuty, type CleanZone, type DutyOptions, type DutyResult,
} from '@/lib/generators';
import { age, gradeLabel } from '@/lib/rules';
import type { Student } from '@/lib/types';
import { PageHead, Badge, ArtLink } from '@/components/ui';
import PosterHeader from '@/components/PosterHeader';
import CellInput from '@/components/CellInput';

type Kind = '설거지' | '청소';

export default function DutyPage() {
  const hub = useHub();
  const [kind, setKind] = useState<Kind>('설거지');
  const [o, setO] = useState<DutyOptions>(DEFAULT_DUTY_OPTIONS);
  const [zones, setZones] = useState<CleanZone[]>(DEFAULT_CLEAN_ZONES);
  const [detail, setDetail] = useState(true);
  const sheetRef = useRef<HTMLDivElement>(null);
  usePrintFit(sheetRef);

  const dish = useMemo(() => generateDishDuty(hub.students, DISH_DAYS, o), [hub.students, o]);
  const clean = useMemo(() => generateCleaningDuty(hub.students, zones, o), [hub.students, zones, o]);
  const res = kind === '설거지' ? dish : clean;
  const pool = dutyPool(hub.students);
  const exempt = hub.students.filter(s => s.status === '재학' && s.dutyExempt);
  const byId = (id: string) => hub.students.find(s => s.id === id)!;
  const setZone = (i: number, patch: Partial<CleanZone>) => setZones(zones.map((z, j) => (j === i ? { ...z, ...patch } : z)));

  return (
    <div className="page print-solo">
      <LandscapePage />
      <PageHead
        title="당번표 생성"
        desc="명단의 나이·성별로 섞어 설거지·청소 당번표를 만듭니다. 순번표는 쿼터 첫 주에 정하고 쿼터 동안 유지합니다."
        right={<>
          <ArtLink no={31} label="제31조 제10항" />
          <button className="btn" onClick={() => window.print()}>인쇄</button>
        </>}
      />

      <div className="grid duty-layout print-target">
        <div className="card stack no-print">
          <div className="seg">
            {(['설거지', '청소'] as Kind[]).map(k => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{k} 당번</button>)}
          </div>
          <div className="seg">
            <button className={o.mix === '혼합' ? 'on' : ''} onClick={() => setO({ ...o, mix: '혼합' })}>혼합 연령 · 선배 조장</button>
            <button className={o.mix === '학교급별' ? 'on' : ''} onClick={() => setO({ ...o, mix: '학교급별' })}>학교급별</button>
          </div>
          {o.mix === '혼합' && (
            <div className="callout gold small">
              실제 운영(혼합 연령 팀)대로 만듭니다. 학칙 제31조 제10항은 "학교급별 순번표"라고 되어 있어 학칙 개정이 필요합니다.
            </div>
          )}
          <label className="field">조장 최소 나이
            <input type="number" min={10} max={19} value={o.leaderAge} onChange={e => setO({ ...o, leaderAge: Number(e.target.value) })} />
          </label>

          {kind === '청소' && (
            <table className="t small">
              <thead><tr><th>구역</th><th className="num">정원 (0 = 고르게)</th><th /></tr></thead>
              <tbody>
                {zones.map((z, i) => (
                  <tr key={i}>
                    <td><CellInput className="input" style={{ width: 90, padding: '6px 8px' }} value={z.name} onChange={e => setZone(i, { name: e.target.value })} /></td>
                    <td className="num"><input className="input" style={{ width: 64, padding: '6px 8px' }} type="number" min={0} value={z.size} onChange={e => setZone(i, { size: Number(e.target.value) })} /></td>
                    <td><button className="btn sm" onClick={() => setZones(zones.filter((_, j) => j !== i))} disabled={zones.length <= 1}>삭제</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {kind === '청소' && <button className="btn sm" onClick={() => setZones([...zones, { name: `${zones.length + 2}층`, size: 0 }])}>+ 구역 추가</button>}
          {kind === '청소' && <p className="tiny muted" style={{ margin: 0 }}>학교 건물: 2층 러닝센터·강의실·초등부 교실, 3층 예배실, 4층 식당·발코니 (학교 리플렛)</p>}

          <div className="row">
            <button className="btn primary" onClick={() => setO({ ...o, seed: o.seed + 1 })}>다시 섞기</button>
            <label className="check"><input type="checkbox" checked={detail} onChange={e => setDetail(e.target.checked)} /> 학년·성별 표시</label>
          </div>

          <p className="tiny muted" style={{ margin: 0 }}>
            규칙: 나이 많은 학생을 팀마다 한 명씩 먼저 넣어 조장으로 삼고, 나머지는 인원이 적은 팀 → 같은 성별이 적은 팀 → 비슷한 나이가 적은 팀 순으로 넣습니다.
            당번 대상 {pool.length}명{exempt.length > 0 && <> · 제외 {exempt.map(s => s.name).join(', ')}</>} (학생 명단에서 바꿉니다)
          </p>
        </div>

        <div className="stack">
          {res.warnings.map(w => <div key={w} className="callout gold small no-print">{w}</div>)}
          <div ref={sheetRef} className="print-sheet"><DutySheet kind={kind} res={res} byId={byId} detail={detail} /></div>
          <TeamSummary res={res} byId={byId} />
        </div>
      </div>
    </div>
  );
}

function Name({ s, leader, detail }: { s: Student; leader: boolean; detail: boolean }) {
  return (
    <div className={`duty-name${leader ? ' leader' : ''}`}>
      {s.name}
      {leader && <Badge tone="deep">조장</Badge>}
      {detail && <span className="tiny muted"> {gradeLabel(s.birthYear)}{s.gender ? ` · ${s.gender}` : ''}</span>}
    </div>
  );
}

/** 인쇄용 표: 레퍼런스 당번표와 같은 모양 */
function DutySheet({ kind, res, byId, detail }: { kind: Kind; res: DutyResult; byId: (id: string) => Student; detail: boolean }) {
  return (
    <div className="card duty-sheet poster">
      <PosterHeader name={`${kind} 당번 일정표`} sub={kind === '설거지' ? '수·금 점심 당번은 주방 바닥 쓸기·닦기까지 마무리합니다' : '수·금 점심시간 12:40–13:20 청소'} />
      {kind === '설거지' ? (
        <>
          <table className="duty-table">
            <thead><tr>{res.teams.map(t => <th key={t.label} className={t.label === '수' || t.label === '금' ? 'accent' : ''}>{t.label}</th>)}</tr></thead>
            <tbody>
              <tr>
                {res.teams.map(t => (
                  <td key={t.label}>{t.members.map(id => <Name key={id} s={byId(id)} leader={id === t.leader} detail={detail} />)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </>
      ) : (
        <table className="duty-table">
          <thead><tr><th>구역</th>{CLEAN_DAYS.map(d => <th key={d}>{d}</th>)}</tr></thead>
          <tbody>
            {res.teams.map(t => (
              <tr key={t.label}>
                <th className="zone">{t.label}</th>
                {CLEAN_DAYS.map(d => (
                  <td key={d}>{t.members.map(id => <Name key={id} s={byId(id)} leader={id === t.leader} detail={detail} />)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ul className="duty-foot">
        <li>팀 안의 당번 일이 모두 끝날 때까지 서로 도와 마무리합니다.</li>
        <li>선생님께 미리 말하지 않고 당번을 하지 않거나 먼저 가면 벌점을 받습니다 (별표 8).</li>
      </ul>
    </div>
  );
}

/** 팀 구성 확인: 인원, 나이 폭, 성비, 학교급 */
function TeamSummary({ res, byId }: { res: DutyResult; byId: (id: string) => Student }) {
  return (
    <div className="card no-print" style={{ overflowX: 'auto' }}>
      <h3>팀 구성 확인</h3>
      <table className="t small">
        <thead><tr><th>팀</th><th className="num">인원</th><th>나이</th><th className="num">남</th><th className="num">여</th><th className="num">미입력</th><th className="num">초등</th><th className="num">중고등</th></tr></thead>
        <tbody>
          {res.teams.map(t => {
            const m = t.members.map(byId);
            const ages = m.map(s => age(s.birthYear));
            return (
              <tr key={t.label}>
                <td>{t.label}</td>
                <td className="num">{m.length}</td>
                <td>{ages.length ? `${Math.min(...ages)}–${Math.max(...ages)}세` : '-'}</td>
                <td className="num">{m.filter(s => s.gender === '남').length}</td>
                <td className="num">{m.filter(s => s.gender === '여').length}</td>
                <td className="num">{m.filter(s => !s.gender).length || ''}</td>
                <td className="num">{m.filter(s => s.schoolLevel === '초등').length}</td>
                <td className="num">{m.filter(s => s.schoolLevel !== '초등').length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
