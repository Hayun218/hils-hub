// 2027학년도 학사일정 (reference/calendar/2027-학사일정-*.jpg에서 옮김). '예상'은 확정 전 일정.
export type EventKind = '학사' | '방학' | '휴일' | '행사' | '검정고시' | '상담';
export interface SchoolEvent { id?: string; start: string; end?: string; title: string; kind: EventKind; note?: string }

export const CALENDAR_2027: SchoolEvent[] = [
  { start: '2027-01-01', title: '신정', kind: '휴일' },
  { start: '2027-01-07', title: '1쿼터 개학', kind: '학사', note: '1/8 학생 귀가 없음' },
  { start: '2027-01-11', end: '2027-01-14', title: '예배자 영성캠프', kind: '행사', note: '해당 학생' },
  { start: '2027-02-01', end: '2027-02-04', title: '라스트러너 캠프', kind: '행사', note: '전교생 영성캠프' },
  { start: '2027-02-05', title: 'Family Day', kind: '휴일', note: '설 연휴 연장' },
  { start: '2027-02-06', end: '2027-02-09', title: '설 연휴', kind: '휴일' },
  { start: '2027-02-15', end: '2027-02-19', title: '검정고시 1회 접수', kind: '검정고시', note: '해당 학생' },
  { start: '2027-03-01', title: '삼일절', kind: '휴일' },
  { start: '2027-03-02', end: '2027-04-09', title: '검정고시 집중 준비 기간', kind: '검정고시', note: '해당 학생' },
  { start: '2027-04-10', title: '검정고시 1회 시험', kind: '검정고시', note: '예상 · 4/11–12 학생 귀가 없음' },
  { start: '2027-04-13', title: '현장 체험 학습', kind: '행사' },
  { start: '2027-04-14', end: '2027-04-16', title: '1쿼터 방학', kind: '방학', note: '4/14 오전 학생 귀가' },
  { start: '2027-04-19', title: '2쿼터 개학', kind: '학사' },
  { start: '2027-04-21', title: '유월절', kind: '행사' },
  { start: '2027-04-23', end: '2027-06-11', title: '초실절: 오멜카운트', kind: '행사' },
  { start: '2027-05-02', end: '2027-05-08', title: '말라카 오크리치 국제학교 한국 방문', kind: '행사', note: '해당 학생' },
  { start: '2027-05-03', end: '2027-05-05', title: 'Family Day', kind: '휴일', note: '5/5 20:00 학생 복귀' },
  { start: '2027-05-17', end: '2027-05-21', title: '생활 집중 상담 주간', kind: '상담' },
  { start: '2027-06-07', end: '2027-06-11', title: '입시·학업 집중 상담 주간', kind: '상담', note: '진로 탐색' },
  { start: '2027-06-10', title: '오순절 전야', kind: '행사' },
  { start: '2027-06-11', title: '오순절', kind: '행사' },
  { start: '2027-06-18', title: '성경 암송 콘테스트', kind: '행사' },
  { start: '2027-06-21', end: '2027-06-25', title: '검정고시 2회 접수', kind: '검정고시', note: '해당 학생' },
  { start: '2027-07-19', title: '제헌절 대체 공휴일', kind: '휴일', note: '7/19 20:00 학생 복귀' },
  { start: '2027-07-26', end: '2027-07-29', title: '라스트러너 캠프', kind: '행사', note: '전교생 영성캠프' },
  { start: '2027-08-10', title: '검정고시 2회 시험', kind: '검정고시', note: '예상' },
  { start: '2027-08-11', end: '2027-08-31', title: '여름방학 (2쿼터 방학)', kind: '방학' },
  { start: '2027-09-01', title: '3쿼터 개학', kind: '학사' },
  { start: '2027-09-03', end: '2027-10-11', title: '테슈바', kind: '행사' },
  { start: '2027-09-06', end: '2027-09-10', title: '대학 수시 원서 접수', kind: '상담', note: '예상' },
  { start: '2027-09-13', end: '2027-09-17', title: '추석 연휴 (3쿼터 방학)', kind: '방학' },
  { start: '2027-09-20', title: '4쿼터 개학', kind: '학사' },
  { start: '2027-10-01', title: '나팔절 전야', kind: '행사' },
  { start: '2027-10-02', title: '나팔절', kind: '행사' },
  { start: '2027-10-04', title: '대테슈바 · 개천절 대체 공휴일', kind: '휴일' },
  { start: '2027-10-07', title: '현장 체험 학습', kind: '행사' },
  { start: '2027-10-11', title: '대속죄일 · 한글날 대체 공휴일', kind: '휴일' },
  { start: '2027-10-16', end: '2027-10-23', title: '장막절', kind: '행사' },
  { start: '2027-10-30', title: '학부모 세미나', kind: '행사' },
  { start: '2027-11-18', title: '대학수학능력시험', kind: '검정고시' },
  { start: '2027-11-22', end: '2027-11-24', title: '영성 훈련 집중 주간', kind: '행사', note: '핵심 교과 수업만 진행' },
  { start: '2027-11-29', end: '2027-12-15', title: '빛의 축제 집중 준비 기간', kind: '행사', note: '핵심 교과 수업만 진행' },
  { start: '2027-12-16', title: '빛의 축제', kind: '행사' },
  { start: '2027-12-17', end: '2028-01-06', title: '겨울방학 (4쿼터 방학)', kind: '방학' },
  { start: '2027-12-24', end: '2028-01-01', title: '하누카', kind: '행사' },
];

/** 저장소 기본값 (id 붙임) */
export const DEFAULT_CALENDAR = CALENDAR_2027.map((e, i) => ({ ...e, id: `ev${i}` }));

/** 오늘 이후(진행 중 포함) 일정 n개 */
export function upcoming(today: string, n = 6, list: SchoolEvent[] = CALENDAR_2027) {
  return list.filter(e => (e.end || e.start) >= today).sort((a, b) => a.start.localeCompare(b.start)).slice(0, n);
}

export const fmtRange = (e: SchoolEvent) => {
  const f = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  return e.end ? `${f(e.start)}–${f(e.end)}` : f(e.start);
};
