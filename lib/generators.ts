// 시간표·당번표 자동 생성 (시안). 학칙의 조건을 코드로 옮겼다.
// 시간표: 제20조, 제24조 제3항, 제26조, 별표 3·5·7 / 당번표: 제31조 제10항
import type { Student, Teacher } from './types';
import { age, gradeLabel } from './rules';

export const DAYS = ['월', '화', '수', '목', '금'] as const;

export interface Block { no: number; time: string; elementary: boolean }
/** 별표 5: 75분 블록, 휴식 15분. 초등 오후는 13:30–15:00이므로 1블록만 */
export const BLOCKS: Block[] = [
  { no: 1, time: '09:00–10:15', elementary: true },
  { no: 2, time: '10:30–11:45', elementary: true },
  { no: 3, time: '13:30–14:45', elementary: true },
  { no: 4, time: '15:00–16:15', elementary: false },
];

export interface TimetableConditions {
  quarterType: '집중학습' | '프로젝트';
  english: number; // 레벨 그룹별 주당 블록
  math: number;
  reading: number; // 사고력·독서 (중고등 전체)
  basics: number; // 기초교과 (중고등 전체)
  elemEnglish: number;
  elemMath: number;
  elemReading: number;
  minGroup: number; // 별표 7 ③: 이보다 적은 레벨은 인접 레벨과 합반
}

export const DEFAULT_CONDITIONS: TimetableConditions = {
  quarterType: '집중학습', english: 4, math: 3, reading: 2, basics: 2, elemEnglish: 4, elemMath: 4, elemReading: 3, minGroup: 3,
};

export type Lane = '초등' | '중고등 공통' | '영어 레벨' | '수학 레벨';
export interface Lesson { day: number; block: number; lane: Lane; group: string; subject: string; teacher: string; students: string[] }
export interface TimetableResult { lessons: Lesson[]; warnings: string[]; groups: { name: string; lane: Lane; students: string[] }[]; individual: Student[] }

const EN_ORDER = ['EN-MH', 'EN-B', 'EN-A'];
const M_ORDER = ['M-C', 'M-B', 'M-A'];

/** 별표 7 ③: 인원이 적은 레벨은 인접 레벨과 합친다 */
function levelGroups(list: Student[], key: 'enLevel' | 'mathLevel', order: string[], min: number, warnings: string[]) {
  let groups = order.map(lv => ({ name: lv, students: list.filter(s => s[key] === lv) })).filter(g => g.students.length > 0);
  let changed = true;
  while (changed && groups.length > 1) {
    changed = false;
    const idx = groups.findIndex(g => g.students.length < min);
    if (idx >= 0) {
      const j = idx === 0 ? 1 : idx - 1;
      const [a, b] = [Math.min(idx, j), Math.max(idx, j)];
      warnings.push(`${groups[idx].name} 인원이 ${groups[idx].students.length}명이라 ${groups[j].name}와 합반 (별표 7 ③)`);
      groups.splice(a, 2, { name: `${groups[a].name}+${groups[b].name}`, students: [...groups[a].students, ...groups[b].students] });
      changed = true;
    }
  }
  return groups;
}

/** 같은 조건에서 '다시 생성'할 때 다른 배치를 고르기 위한 작은 난수 (seed가 같으면 결과도 같다) */
const jitter = (seed: number, ...xs: number[]) => {
  let h = seed * 2654435761;
  for (const x of xs) h = Math.imul(h ^ (x + 0x9e3779b9), 2246822507);
  return ((h >>> 0) % 1000) / 1000;
};

export function generateTimetable(students: Student[], teachers: Teacher[], c: TimetableConditions, seed = 0): TimetableResult {
  const warnings: string[] = [];
  const active = students.filter(s => s.status === '재학');
  const individual = active.filter(s => s.gedThisQuarter);
  const regular = active.filter(s => !s.gedThisQuarter);
  const elem = regular.filter(s => s.schoolLevel === '초등');
  const sec = regular.filter(s => s.schoolLevel === '중고등');
  if (individual.length) warnings.push(`검정고시 응시생 ${individual.length}명은 개별 집중학습 시간표로 운영 (제24조 제3항)`);

  const en = levelGroups(sec, 'enLevel', EN_ORDER, c.minGroup, warnings);
  const ma = levelGroups(sec, 'mathLevel', M_ORDER, c.minGroup, warnings);

  // 반(어니스트반·드림반·콜링반)별로 공통 수업을 배치하고, 레벨이 정해진 중고등 학생은 영어·수학을 레벨 그룹으로 듣는다
  const classOf = (s: Student) => s.classGroup || (s.schoolLevel === '초등' ? '어니스트반' : '콜링반');
  const classGroups = ['어니스트반', '드림반', '콜링반']
    .map(c => ({ name: c, lane: (c === '어니스트반' ? '초등' : '중고등 공통') as Lane, students: regular.filter(s => classOf(s) === c).map(s => s.id) }))
    .filter(g => g.students.length);
  const groups = [
    ...classGroups,
    ...en.map(g => ({ name: g.name, lane: '영어 레벨' as Lane, students: g.students.map(s => s.id) })),
    ...ma.map(g => ({ name: g.name, lane: '수학 레벨' as Lane, students: g.students.map(s => s.id) })),
  ];
  const leveled = (lv: 'enLevel' | 'mathLevel', id: string) => !!regular.find(s => s.id === id)?.[lv];

  const can = (t: Teacher, subject: string) =>
    t.leaving || t.role === '행정' || t.role === '학교장' ? false
      : subject === '예배자 학교' ? t.id === 'pastor' || t.role === '목사'
      : subject === '프로젝트' ? t.role !== '목사' && t.id !== 'pastor'
      : subject === '기초교과' ? t.subjects.some(x => ['국어', '과학', '사회'].includes(x))
      : subject === '사고력·독서' ? t.subjects.some(x => ['국어', '독서'].includes(x))
      : t.subjects.includes(subject);

  // 수업 요구량
  type Req = { group: (typeof groups)[number]; subject: string; count: number; span?: number };
  const reqs: Req[] = [];
  const scale = c.quarterType === '프로젝트' ? 0.5 : 1;
  const n = (x: number) => Math.max(1, Math.round(x * scale));
  for (const g of classGroups) {
    const elemClass = g.name === '어니스트반';
    if (c.quarterType === '프로젝트') reqs.push({ group: g, subject: '프로젝트', count: elemClass ? 3 : 4, span: 2 }); // 제26조 제2항: 2블록 묶음
    reqs.push({ group: g, subject: '예배자 학교', count: 1 });
    reqs.push({ group: g, subject: '사고력·독서', count: n(elemClass ? c.elemReading : c.reading) });
    if (!elemClass) reqs.push({ group: g, subject: '기초교과', count: n(c.basics) });
    // 레벨이 없는 반 학생은 반 단위로 영어·수학
    if (elemClass || !g.students.some(id => leveled('enLevel', id))) reqs.push({ group: g, subject: '영어', count: n(elemClass ? c.elemEnglish : c.english) });
    if (elemClass || !g.students.some(id => leveled('mathLevel', id))) reqs.push({ group: g, subject: '수학', count: n(elemClass ? c.elemMath : c.math) });
  }
  en.forEach(x => reqs.push({ group: groups.find(g => g.name === x.name)!, subject: '영어', count: n(c.english) }));
  ma.forEach(x => reqs.push({ group: groups.find(g => g.name === x.name)!, subject: '수학', count: n(c.math) }));
  // 가능한 교사가 적은 수업부터 배치
  reqs.sort((a, b) => (b.span || 1) - (a.span || 1) || teachers.filter(t => can(t, a.subject)).length - teachers.filter(t => can(t, b.subject)).length);

  const lessons: Lesson[] = [];
  const busyT = new Set<string>();
  const busyS = new Set<string>();
  const key = (d: number, b: number, x: string) => `${d}-${b}-${x}`;
  const load = new Map<string, number>(); // 교사 주당 블록 수 (고르게)

  for (const r of reqs) {
    const span = r.span || 1;
    for (let k = 0; k < r.count; k++) {
      let best: { d: number; b: number; t: Teacher; score: number } | null = null;
      for (let d = 0; d < 5; d++) {
        const sameDay = lessons.filter(l => l.day === d && l.group === r.group.name && l.subject === r.subject).length;
        for (const blk of BLOCKS) {
          const bs = Array.from({ length: span }, (_, i) => blk.no + i);
          if (bs.some(b => !BLOCKS.find(x => x.no === b) || (r.group.lane === '초등' && !BLOCKS.find(x => x.no === b)!.elementary))) continue;
          if (span === 2 && blk.no === 2) continue; // 점심을 넘기지 않음
          if (bs.some(b => r.group.students.some(s => busyS.has(key(d, b, s))))) continue;
          for (const t of teachers.filter(t => can(t, r.subject))) {
            if (bs.some(b => busyT.has(key(d, b, t.id)))) continue;
            const score = sameDay * 10 + (load.get(t.id) || 0) + (r.subject === '영어' || r.subject === '수학' ? (blk.no <= 2 ? 0 : 1) : 0) + (seed ? jitter(seed, d, blk.no, t.id.length, k) * 0.9 : d * 0.01);
            if (!best || score < best.score) best = { d, b: blk.no, t, score };
          }
        }
      }
      if (!best) { warnings.push(`${r.group.name} ${r.subject} ${k + 1}번째 블록을 배치할 교사·시간이 없습니다`); continue; }
      for (let i = 0; i < span; i++) {
        const b = best.b + i;
        lessons.push({ day: best.d, block: b, lane: r.group.lane, group: r.group.name, subject: r.subject, teacher: best.t.id, students: r.group.students });
        busyT.add(key(best.d, b, best.t.id));
        r.group.students.forEach(s => busyS.add(key(best!.d, b, s)));
      }
      load.set(best.t.id, (load.get(best.t.id) || 0) + span);
    }
  }
  // 별표 7 ②: 같은 시간 레벨 그룹 수 ≤ 수업 가능한 교사 수 (교사 중복 배치를 막았으므로 자동 충족)
  return { lessons, warnings, groups, individual };
}

// ───────────────────────── 당번표 ─────────────────────────
// 레퍼런스: reference/private/2026-2쿼터-설거지당번표, 청소당번표
// 설거지: 요일(월–금)마다 한 팀. 수·금 점심 당번은 주방 바닥 쓸기·닦기까지.
// 청소: 구역(층)마다 한 팀, 수·금 점심시간 청소.
// 순번표는 쿼터 첫 주에 정하고 쿼터 동안 유지한다 (제31조 제10항).

export type DutyMix = '혼합' | '학교급별';

export interface DutyOptions {
  mix: DutyMix; // 혼합: 초·중·고를 섞고 선배 조장 (실제 운영) / 학교급별: 제31조 제10항 문언
  leaderAge: number; // 조장 최소 나이 (못 채우면 경고)
  seed: number; // '다시 섞기'
}
export const DEFAULT_DUTY_OPTIONS: DutyOptions = { mix: '혼합', leaderAge: 15, seed: 1 };

export interface DutyTeam { label: string; members: string[]; leader?: string }
export interface DutyResult { teams: DutyTeam[]; warnings: string[]; unassigned: string[] }

export const DISH_DAYS = ['월', '화', '수', '목', '금'];
export const CLEAN_DAYS = ['수', '금'];
export interface CleanZone { name: string; size: number } // size 0 = 고르게 나눔
export const DEFAULT_CLEAN_ZONES: CleanZone[] = [
  { name: '2층', size: 0 },
  { name: '3층', size: 0 },
  { name: '4층', size: 0 },
];

/** 당번 대상: 재학 중이고 당번 제외가 아닌 학생 */
export const dutyPool = (students: Student[]) => students.filter(s => s.status === '재학' && !s.dutyExempt);

/**
 * 나이와 성비를 섞어 팀을 만든다.
 * 1. 나이 많은 학생부터 팀마다 한 명씩 먼저 넣어 조장으로 삼는다.
 * 2. 나머지는 나이 많은 순으로, (인원이 적은 팀) → (같은 성별이 적은 팀) → (비슷한 나이가 적은 팀) 순으로 고른다.
 * 3. 같은 조건이면 seed로 정해지는 난수로 고른다 ('다시 섞기'마다 다른 배치).
 */
function balancedTeams(list: Student[], caps: number[], seed: number): { teams: Student[][]; rest: Student[] } {
  const r = (s: Student, k = 0) => jitter(seed, s.id.length, ...[...s.id].map(c => c.charCodeAt(0)), k);
  const order = [...list].sort((a, b) => a.birthYear - b.birthYear || r(a) - r(b));
  const teams: Student[][] = caps.map(() => []);
  const rest: Student[] = [];
  // 조장 후보를 팀 순서와 무관하게 흩어 놓는다
  const teamOrder = caps.map((_, i) => i).sort((a, b) => jitter(seed, a, 7) - jitter(seed, b, 7));
  order.forEach((s, idx) => {
    if (idx < caps.length && caps[teamOrder[idx]] > 0) { teams[teamOrder[idx]].push(s); return; }
    const a = age(s.birthYear);
    let best = -1, bestScore = Infinity;
    teams.forEach((t, i) => {
      if (t.length >= caps[i]) return;
      const fill = t.length / caps[i];
      const sameGender = s.gender ? t.filter(x => x.gender === s.gender).length : 0;
      const sameAge = t.filter(x => Math.abs(age(x.birthYear) - a) <= 1).length;
      const score = fill * 100 + sameGender * 6 + sameAge * 3 + r(s, i);
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best < 0) rest.push(s); else teams[best].push(s);
  });
  return { teams, rest };
}

/** 인원을 n칸에 고르게 나눈 정원 */
const evenCaps = (total: number, n: number) => Array.from({ length: n }, (_, i) => Math.floor(total / n) + (i < total % n ? 1 : 0));

function build(students: Student[], labels: string[], sizes: number[], o: DutyOptions): DutyResult {
  const warnings: string[] = [];
  const pool = dutyPool(students);
  const fixed = sizes.reduce((a, b) => a + b, 0);
  const autoN = sizes.filter(x => !x).length;
  const autoCaps = evenCaps(Math.max(0, pool.length - fixed), autoN);
  let k = 0;
  const caps = sizes.map(x => (x ? x : autoCaps[k++]));
  if (caps.reduce((a, b) => a + b, 0) < pool.length) warnings.push(`정원 합계가 당번 대상 ${pool.length}명보다 적습니다`);

  let teams: Student[][] = [];
  const rest: Student[] = [];
  if (o.mix === '혼합') {
    const b = balancedTeams(pool, caps, o.seed);
    teams = b.teams; rest.push(...b.rest);
  } else {
    // 학교급별: 팀을 학교급 인원 비율대로 나눠 같은 학교급끼리 묶는다
    teams = caps.map(() => []);
    const elem = pool.filter(s => s.schoolLevel === '초등');
    const sec = pool.filter(s => s.schoolLevel !== '초등');
    const nElem = elem.length ? Math.max(1, Math.round((elem.length / pool.length) * caps.length)) : 0;
    const groups: [Student[], number[]][] = [[elem, caps.map((_, i) => i).slice(0, nElem)], [sec, caps.map((_, i) => i).slice(nElem)]];
    for (const [list, idxs] of groups) {
      if (!list.length) continue;
      if (!idxs.length) { rest.push(...list); continue; }
      const sub = balancedTeams(list, evenCaps(list.length, idxs.length), o.seed);
      sub.teams.forEach((t, j) => teams[idxs[j]].push(...t));
      rest.push(...sub.rest);
    }
  }

  const result = teams.map((t, i) => {
    const sorted = [...t].sort((a, b) => a.birthYear - b.birthYear);
    const leader = sorted[0];
    if (leader && age(leader.birthYear) < o.leaderAge)
      warnings.push(`${labels[i]}: 조장 나이 기준(${o.leaderAge}세) 이상 학생이 없어 ${gradeLabel(leader.birthYear)} ${leader.name}이(가) 조장`);
    return { label: labels[i], members: sorted.map(s => s.id), leader: leader?.id };
  });
  const noGender = pool.filter(s => !s.gender).length;
  if (noGender) warnings.push(`성별 미입력 ${noGender}명: 성비는 입력된 학생만 맞춥니다 (학생 명단에서 입력)`);
  if (rest.length) warnings.push(`정원이 모자라 ${rest.length}명이 배정되지 않았습니다`);
  return { teams: result, warnings, unassigned: rest.map(s => s.id) };
}

/** 설거지 당번: 요일마다 한 팀 */
export function generateDishDuty(students: Student[], days: string[], o: DutyOptions): DutyResult {
  return build(students, days, days.map(() => 0), o);
}

/** 청소 당번: 구역마다 한 팀 (팀 전체가 청소 요일마다 함께 맡는다) */
export function generateCleaningDuty(students: Student[], zones: CleanZone[], o: DutyOptions): DutyResult {
  return build(students, zones.map(z => z.name), zones.map(z => z.size), { ...o, seed: o.seed * 31 + 5 });
}
