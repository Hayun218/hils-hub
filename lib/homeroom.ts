// 담임 배정 (제35조 제3항)
// 1. 초등은 별도 담임 (Teacher.homeroomFor = '초등')
// 2. 중고등은 혼합 연령 소그룹: 나이 많은 순으로 인원이 적은 담임에게, 같으면 성별·반이 덜 겹치는 담임에게
// 3. 교사 1인당 담당 학생 5명 이내 — 넘으면 막지 않고 경고
// 4. 이직 예정 교사(leaving)는 다음 학년도 배정에서 뺀다
// 5. 같은 교사가 같은 학생을 2년 연속 맡지 않는다 — 담임 이력이 쌓이면 검사 (supabase homeroom_assignments)
import type { Student, Teacher } from './types';

export const MAX_PER_HOMEROOM = 5;

export function assignHomerooms(students: Student[], teachers: Teacher[]) {
  const map: Record<string, string> = {};
  const warnings: string[] = [];
  const active = students.filter(s => s.status === '재학');
  const pools: [Student['schoolLevel'], Teacher[]][] = [
    ['초등', teachers.filter(t => t.homeroomFor === '초등' && !t.leaving)],
    ['중고등', teachers.filter(t => t.homeroomFor === '중고등' && !t.leaving)],
  ];
  for (const [level, ts] of pools) {
    const list = active.filter(s => s.schoolLevel === level).sort((a, b) => a.birthYear - b.birthYear || a.name.localeCompare(b.name));
    if (!list.length) continue;
    if (!ts.length) { warnings.push(`${level} 담임을 맡을 교사가 없습니다 (교직원 화면에서 '담임'을 정하세요)`); continue; }
    const groups = new Map<string, Student[]>(ts.map(t => [t.id, []]));
    for (const s of list) {
      let best = ts[0], score = Infinity;
      for (const t of ts) {
        const g = groups.get(t.id)!;
        const sc = g.length * 100 + (s.gender ? g.filter(x => x.gender === s.gender).length * 5 : 0) + g.filter(x => x.classGroup === s.classGroup).length;
        if (sc < score) { score = sc; best = t; }
      }
      groups.get(best.id)!.push(s);
      map[s.id] = best.id;
    }
    const over = [...groups.values()].some(g => g.length > MAX_PER_HOMEROOM);
    if (over) {
      const need = Math.ceil(list.length / MAX_PER_HOMEROOM);
      warnings.push(`${level} ${list.length}명을 담임 ${ts.length}명이 나눠 1인 ${Math.ceil(list.length / ts.length)}명까지 맡습니다. 제35조 제3항(1인 5명 이내)을 지키려면 ${level} 담임이 ${need}명 필요합니다.`);
    }
  }
  return { map, warnings };
}

export function homeroomWarnings(students: Student[], teachers: Teacher[]) {
  const w: string[] = [];
  for (const t of teachers) {
    const n = students.filter(s => s.status === '재학' && s.homeroom === t.id).length;
    if (n > MAX_PER_HOMEROOM) w.push(`${t.name} 담임 ${n}명 (1인 5명 이내, 제35조 제3항)`);
    if (n && t.leaving) w.push(`${t.name} 선생님은 이직 예정인데 담임 학생이 ${n}명 있습니다`);
    if (n && !t.homeroomFor) w.push(`${t.name} 선생님은 담임을 맡지 않는 교직원인데 담임 학생이 ${n}명 있습니다`);
  }
  return w;
}

/** 담임 선택 목록: 담임을 맡는 교사만 (학교장·목사님·행정은 뺀다). 지금 배정된 교사는 남겨 둔다 */
export const homeroomCandidates = (teachers: Teacher[], current?: string) =>
  teachers.filter(t => (t.homeroomFor && !t.leaving && t.role !== '학교장' && t.role !== '목사') || t.id === current || (!t.role && !t.homeroomFor && t.id.startsWith('t')));
