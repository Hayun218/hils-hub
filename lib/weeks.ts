// 학사일정에서 쿼터 기간과 주차를 만든다 (과목 운영안 주차별 계획).
// 쿼터 시작: "n쿼터 개학", 끝: "n쿼터 방학"이 든 일정의 전날. 제25조: 첫 주 진단, 마지막 주 점검.
import type { CalendarEvent } from './types';

const d2s = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const s2d = (s: string) => new Date(`${s}T00:00:00`);
const addDays = (s: string, n: number) => { const d = s2d(s); d.setDate(d.getDate() + n); return d2s(d); };

export function quarterRange(cal: CalendarEvent[], q: number): { start: string; end: string } | null {
  const open = cal.find(e => new RegExp(`${q}쿼터 개학`).test(e.title));
  const brk = cal.filter(e => new RegExp(`${q}쿼터 방학`).test(e.title)).sort((a, b) => a.start.localeCompare(b.start))[0];
  if (!open || !brk) return null;
  return { start: open.start, end: addDays(brk.start, -1) };
}

export interface Week { no: number; mon: string; fri: string; classDays: number; events: CalendarEvent[]; off: boolean; role?: '진단' | '점검' }

const covers = (e: CalendarEvent, day: string) => e.start <= day && (e.end || e.start) >= day;
const noClass = (e: CalendarEvent) => e.kind === '휴일' || e.kind === '방학' || /전교생/.test(e.note || '') || /전교생/.test(e.title);

export function weeksOf(cal: CalendarEvent[], q: number): Week[] {
  const r = quarterRange(cal, q);
  if (!r) return [];
  const first = s2d(r.start);
  const mon = new Date(first); mon.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const weeks: Week[] = [];
  for (let m = d2s(mon); m <= r.end; m = addDays(m, 7)) {
    const days = [0, 1, 2, 3, 4].map(i => addDays(m, i)).filter(d => d >= r.start && d <= r.end);
    const classDays = days.filter(d => !cal.some(e => noClass(e) && covers(e, d))).length;
    const fri = addDays(m, 4);
    const events = cal.filter(e => e.start <= fri && (e.end || e.start) >= m && !/쿼터 (개학|방학)/.test(e.title)).sort((a, b) => a.start.localeCompare(b.start));
    weeks.push({ no: 0, mon: m, fri, classDays, events, off: classDays === 0 });
  }
  let n = 0;
  weeks.forEach(w => { if (!w.off) w.no = ++n; });
  const on = weeks.filter(w => !w.off);
  if (on.length) { on[0].role = '진단'; if (on.length > 1) on[on.length - 1].role = '점검'; }
  return weeks;
}

export const md = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
