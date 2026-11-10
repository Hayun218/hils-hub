// 시간표 블록 편집 도우미. 자동 생성(lib/generators.ts)은 출발점이고, 교사가 직접 옮기고 늘리고 만든다.
// 학칙과 다르게 편집해도 막지 않고 checkRules가 알려 준다 (제26조 제2항, 별표 5).
import type { Student, Teacher, TimetableBlock } from './types';
import { BLOCKS, type TimetableResult } from './generators';
import { CLASS_HOURS as H, gradeLabel } from './rules';

export const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];
export const BLOCK_MIN = 75;
export const BREAK_MIN = 15;
export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
export const fromMin = (n: number) => {
  const x = Math.max(0, Math.min(24 * 60 - 5, Math.round(n)));
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};
export const dur = (b: TimetableBlock) => toMin(b.end) - toMin(b.start);

let n = 0;
const bid = () => `b${Date.now().toString(36)}${(n++).toString(36)}`;

/** 대상 그룹: 전체, 학교급, 반, 레벨, 학생 개인 */
export function groupPresets(students: Student[]) {
  const act = students.filter(s => s.status === '재학');
  const ids = (xs: Student[]) => xs.map(s => s.id);
  const by = (k: 'enLevel' | 'mathLevel') => [...new Set(act.map(s => s[k]).filter(Boolean))].sort().map(lv => ({ name: `${k === 'enLevel' ? '영어' : '수학'} ${lv}`, students: ids(act.filter(s => s[k] === lv)) }));
  const classes = [...new Set(act.map(s => s.classGroup).filter(Boolean))] as string[];
  return [
    { name: '전체', students: ids(act) },
    ...classes.map(c => ({ name: c, students: ids(act.filter(s => s.classGroup === c)) })),
    ...by('enLevel'), ...by('mathLevel'),
    ...act.map(s => ({ name: `${s.name} (${gradeLabel(s.birthYear)})`, students: [s.id] })),
  ].filter(g => g.students.length);
}

/** 자동 생성 결과를 블록으로. 이어지는 같은 수업(프로젝트 2블록 묶음)은 한 블록으로 합친다. 고정 일과·점심도 넣는다 */
export function fromGenerated(res: TimetableResult, students: Student[]): TimetableBlock[] {
  const all = students.filter(s => s.status === '재학').map(s => s.id);
  const time = (no: number) => BLOCKS.find(b => b.no === no)!.time.split('–');
  const out: TimetableBlock[] = [];
  for (let d = 0; d < 5; d++) {
    out.push({ id: bid(), day: d, start: '08:30', end: '09:00', subject: '고정 일과', group: '전체', students: all, fixed: true, note: '아침 체조 · 임재적 묵상 · 성경 읽기 · 3P 바인더 (제26조 제1항)' });
    out.push({ id: bid(), day: d, start: '12:00', end: '13:30', subject: '점심', group: '전체', students: all, fixed: true });
  }
  const lessons = [...res.lessons].sort((a, b) => a.day - b.day || a.group.localeCompare(b.group) || a.subject.localeCompare(b.subject) || a.teacher.localeCompare(b.teacher) || a.block - b.block);
  for (const l of lessons) {
    const [s, e] = time(l.block);
    const prev = out[out.length - 1];
    if (prev && !prev.fixed && prev.day === l.day && prev.subject === l.subject && prev.group === l.group && prev.teacher === l.teacher && l.block - Number(prev.note?.split(':')[1]) === 1) {
      prev.end = e; prev.note = `블록:${l.block}`;
      continue;
    }
    out.push({ id: bid(), day: l.day, start: s, end: e, subject: l.subject, group: l.group, students: l.students, teacher: l.teacher, note: `블록:${l.block}` });
  }
  return out.map(b => (b.note?.startsWith('블록:') ? { ...b, note: undefined } : b));
}

export const newBlock = (day: number, start: string, group: { name: string; students: string[] }): TimetableBlock =>
  ({ id: bid(), day, start, end: fromMin(toMin(start) + BLOCK_MIN), subject: '새 수업', group: group.name, students: group.students });

export interface Issue { id: string; level: '겹침' | '학칙'; text: string }

export function checkRules(blocks: TimetableBlock[], students: Student[], teachers: Teacher[]): Issue[] {
  const issues: Issue[] = [];
  const elemIds = new Set(students.filter(s => s.schoolLevel === '초등').map(s => s.id));
  const lessons = blocks.filter(b => !b.fixed);
  for (const b of lessons) {
    const m = dur(b);
    if (m <= 0) { issues.push({ id: b.id, level: '학칙', text: `${b.subject}: 끝 시간이 시작보다 빠릅니다` }); continue; }
    if (m !== BLOCK_MIN && m !== BLOCK_MIN * 2 + BREAK_MIN) issues.push({ id: b.id, level: '학칙', text: `${DAY_NAMES[b.day]} ${b.start} ${b.subject} ${m}분 · 학칙은 75분 블록 (제26조 제2항)` });
    if (b.day >= 5) { issues.push({ id: b.id, level: '학칙', text: `${DAY_NAMES[b.day]} ${b.subject} · 주말 수업은 별표 5에 없습니다` }); continue; }
    const onlyElem = b.students.length > 0 && b.students.every(id => elemIds.has(id));
    const pmEnd = toMin(onlyElem ? H.pmEndElementary : H.pmEndSecondary);
    const s = toMin(b.start), e = toMin(b.end);
    const inAm = s >= toMin(H.amStart) && e <= toMin(H.amEnd);
    const inPm = s >= toMin(H.pmStart) && e <= pmEnd;
    if (!inAm && !inPm) issues.push({ id: b.id, level: '학칙', text: `${DAY_NAMES[b.day]} ${b.start}–${b.end} ${b.subject} · 수업 시간 밖 (별표 5: 오전 ${H.amStart}–${H.amEnd}, 오후 ${H.pmStart}–${onlyElem ? `${H.pmEndElementary} 초등` : H.pmEndSecondary})` });
  }
  // 같은 학생·교사의 겹침과 휴식
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const a = blocks[i], b = blocks[j];
    if (a.day !== b.day) continue;
    const [as, ae, bs, be] = [toMin(a.start), toMin(a.end), toMin(b.start), toMin(b.end)];
    const shared = a.students.filter(x => b.students.includes(x)).length;
    const overlap = as < be && bs < ae;
    if (overlap && a.teacher && a.teacher === b.teacher)
      issues.push({ id: b.id, level: '겹침', text: `${DAY_NAMES[a.day]} ${b.start} ${teachers.find(t => t.id === a.teacher)?.name || '교사'} 선생님 수업 겹침 (${a.subject} · ${b.subject})` });
    if (overlap && shared && !(a.fixed && b.fixed))
      issues.push({ id: b.id, level: '겹침', text: `${DAY_NAMES[a.day]} ${b.start} 학생 ${shared}명 시간 겹침 (${a.subject} · ${b.subject})` });
    if (!overlap && shared && !a.fixed && !b.fixed) {
      const gap = as < bs ? bs - ae : as - be;
      if (gap >= 0 && gap < BREAK_MIN) issues.push({ id: b.id, level: '학칙', text: `${DAY_NAMES[a.day]} ${a.subject}–${b.subject} 사이 휴식 ${gap}분 · 학칙은 15분 (제26조 제2항)` });
    }
  }
  return issues;
}

/** 하루 안에서 겹치는 블록을 나란히 놓을 칸 번호와 칸 수 */
export function layoutDay(blocks: TimetableBlock[]) {
  const sorted = [...blocks].sort((a, b) => toMin(a.start) - toMin(b.start) || dur(b) - dur(a));
  const pos = new Map<string, { lane: number; lanes: number }>();
  let cluster: TimetableBlock[] = [];
  let lanesEnd: number[] = [];
  let clusterEnd = -1;
  const flush = () => { cluster.forEach(b => { pos.get(b.id)!.lanes = lanesEnd.length; }); cluster = []; lanesEnd = []; };
  for (const b of sorted) {
    const s = toMin(b.start), e = toMin(b.end);
    if (s >= clusterEnd) { flush(); clusterEnd = -1; }
    let lane = lanesEnd.findIndex(x => x <= s);
    if (lane < 0) { lane = lanesEnd.length; lanesEnd.push(e); } else lanesEnd[lane] = e;
    pos.set(b.id, { lane, lanes: 1 });
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, e);
  }
  flush();
  return pos;
}
