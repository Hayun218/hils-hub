// 학칙(HILS 교육 방향성)의 규칙을 코드로 옮긴 곳. 조문이 바뀌면 이 파일을 함께 고친다.
import type { StudentRecord, Student } from './types';

/** 시안의 기준일. 2027학년도 1쿼터 중간으로 고정해 시연한다. 운영 시에는 new Date()로 바꾼다. */
export const DEMO_TODAY = '2027-03-16';
export const SCHOOL_YEAR = 2027;

/** 별표 5 수업 시간. 별표 5를 개정하면 여기만 고친다 (시간표 학칙 검사가 이 값을 쓴다) */
export const CLASS_HOURS = {
  amStart: '09:00', amEnd: '12:00',
  pmStart: '13:30', pmEndSecondary: '18:00', pmEndElementary: '15:00', // 0.9.6: 중고등 17:00 → 18:00
};

/** 출생 연도로 국내 학년 표기 (학부모 안내용 참고, 제20조 제5항) */
export function gradeLabel(birthYear: number, year = SCHOOL_YEAR): string {
  const g = year - birthYear - 6;
  if (g < 1) return '취학 전';
  if (g <= 6) return `초${g}`;
  if (g <= 9) return `중${g - 6}`;
  if (g <= 12) return `고${g - 9}`;
  return `만 ${year - birthYear - 1}세`; // 고3을 지난 나이(고등 졸업 연령)는 만 나이 하나만 쓴다 (연 나이를 덧붙이지 않음)
}

export function age(birthYear: number, year = SCHOOL_YEAR): number {
  return year - birthYear; // 연 나이 기준
}

/** 쿼터 (제24조): 1~3월 1쿼터, 4~6월 2쿼터, 7~9월 3쿼터, 10~12월 4쿼터 */
export function quarterOf(date: string): number {
  const m = Number(date.slice(5, 7));
  return Math.ceil(m / 3);
}

export const QUARTER_LABEL: Record<number, string> = {
  1: '1쿼터 · 집중학습',
  2: '2쿼터 · 집중학습',
  3: '3쿼터 · 프로젝트',
  4: '4쿼터 · 프로젝트',
};

const inYear = (r: StudentRecord, year = SCHOOL_YEAR) => r.date.startsWith(String(year));

export function demeritsInQuarter(records: StudentRecord[], studentId: string, q: number, year = SCHOOL_YEAR) {
  return records
    .filter(r => r.studentId === studentId && r.type === 'demerit' && inYear(r, year) && quarterOf(r.date) === q)
    .reduce((s, r) => s + Number(r.data.points || 0), 0);
}

export function meritsInQuarter(records: StudentRecord[], studentId: string, q: number, year = SCHOOL_YEAR) {
  return records
    .filter(r => r.studentId === studentId && r.type === 'merit' && inYear(r, year) && quarterOf(r.date) === q)
    .reduce((s, r) => s + Number(r.data.points || 0), 0);
}

/** 제33조 제2항: 같은 학년도 안의 지도 사유 누적 건수 */
export function guidanceCount(records: StudentRecord[], studentId: string, year = SCHOOL_YEAR) {
  return records.filter(r => r.studentId === studentId && r.type === 'incident' && inYear(r, year)).length;
}

export interface Stage {
  step: number;
  label: string;
  who: string;
}

/** 제33조 제2항의 단계표 */
export function stageFor(count: number): Stage | null {
  if (count <= 0) return null;
  if (count === 1) return { step: 1, label: '1단계 · 담임 면담', who: '담임' };
  if (count === 2) return { step: 2, label: '2단계 · 목사 면담', who: '목사' };
  if (count === 3) return { step: 3, label: '3단계 · 학부모 면담', who: '담임, 생활교육 담당' };
  return { step: 4, label: '4단계 · 학교장 판단', who: '학교장' };
}

/** 별지 8 제목 규칙 */
export function interviewTitle(kind: '정기' | '학습' | '지도', name: string, date: string, opts: { subject?: string; step?: number; reason?: string } = {}) {
  if (kind === '정기') return `[정기] ${name} · ${date}`;
  if (kind === '학습') return `[학습] ${name} · ${opts.subject || '과목'} · ${date}`;
  return `[지도-${opts.step || 1}단계] ${name} · ${opts.reason || '사유'} · ${date}`;
}

/** 별표 8 상점·벌점 기준 */
export const MERIT_ITEMS = [
  { area: '생활', label: '3P 바인더를 한 주 동안 빠짐없이 작성', points: 1 },
  { area: '영성', label: '말씀 암송 단계 통과', points: 2 },
  { area: '사고력·독서', label: '독서 보고서 제출', points: 1 },
  { area: '사고력·독서', label: '하브루타·발표에서 뛰어난 참여', points: 2 },
  { area: '공동체·섬김', label: '맡지 않은 일을 자발적으로 섬김', points: 2 },
  { area: '공동체·섬김', label: '갈등 중재, 어린 학생 돌봄', points: 2 },
  { area: '학습', label: '쿼터 학습 목표 달성', points: 2 },
  { area: '학습', label: '레벨 상향', points: 3 },
  { area: '생활', label: '한 쿼터 동안 지각과 벌점 없음', points: 3 },
];

/** 별표 8 벌점 기준. action: 즉시 조치 (운영 원칙 ⑥) */
export const DEMERIT_ITEMS: { area: string; label: string; points: number; action?: string }[] = [
  { area: '생활', label: '지각', points: 1, action: '당일 저녁 설거지' },
  { area: '생활', label: '청소·당번 불이행', points: 1 },
  { area: '학습', label: '과제·준비물 미이행 (같은 주 2회 이상)', points: 1 },
  { area: '학습', label: '교사 지시 불응, 수업 방해', points: 2 },
  { area: '언어', label: '제31조 제1항 위반', points: 2 },
  { area: '전자기기', label: '제출하지 않은 기기 보유, 돌려받은 기기 미제출', points: 3, action: '기기 보관, 보호자 알림' },
  { area: '공동체', label: '제32조 제2항의 행동', points: 5, action: '제33조 지도 면담' },
];

/** 학생의 여정 단계 (제3장, 제6장) */
export const JOURNEY = ['문의', '체험입학', '재학', '졸업 심사', '졸업'] as const;
export function journeyIndex(s: Student) {
  if (s.status === '문의') return 0;
  if (s.status === '체험입학') return 1;
  if (s.status === '재학') return 2;
  if (s.status === '졸업') return 4;
  return 2;
}

export const won = (n: number) => n.toLocaleString('ko-KR') + '원';

/** 별표 8 제4호 누적 시 결과. 상점 칭찬 기준 점수는 교사회에서 정한다 (정하기 전에는 null) */
export const MERIT_PRAISE_POINTS: number | null = null;
export function accumulation(merit: number, demerit: number) {
  const nextGuidance = 5 - (demerit % 5);
  return {
    demerit: demerit ? `지도 사유 ${Math.floor(demerit / 5)}건 · 다음까지 ${nextGuidance}점` : '',
    merit: merit ? `메릿마켓 ${merit}점 사용 가능${MERIT_PRAISE_POINTS && merit >= MERIT_PRAISE_POINTS ? ' · 칭찬 기준 도달' : ''}` : '',
  };
}

/** 오늘 저녁 설거지: 지각 벌점의 즉시 조치 (별표 8) */
export const lateDishes = (records: StudentRecord[], date: string) =>
  records.filter(r => r.type === 'demerit' && r.date === date && r.title === '지각').map(r => r.studentId);
