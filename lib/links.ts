// 조문과 시스템 화면의 연결. 학칙 화면에서 조문 아래 칩으로 보인다 (서식 칩은 lib/forms.ts의 근거 조항으로 자동).
import { FORMS } from './forms';

export const SYSTEM_LINKS: Record<string, { href: string; label: string }[]> = {
  art20: [{ href: '/students', label: '레벨 현황' }, { href: '/records/grades', label: '성적 입력' }],
  art24: [{ href: '/admin/timetable', label: '시간표 (검정고시 개별)' }],
  art26: [{ href: '/admin/timetable', label: '시간표' }],
  art28: [{ href: '/students', label: '학생 등록' }],
  art29: [{ href: '/reports', label: '학습 진도 보고서' }, { href: '/records/grades', label: '성적 입력' }],
  art31: [{ href: '/records/attendance', label: '출석 현황' }, { href: '/records/life', label: '상점·벌점' }, { href: '/admin/duty', label: '당번표' }],
  art32: [{ href: '/records/life', label: '생활 기록' }],
  art33: [{ href: '/records/life', label: '지도 사유' }, { href: '/records/interviews', label: '지도 면담' }],
  art35: [{ href: '/records/interviews', label: '정기 면담' }, { href: '/students', label: '담임별 명단' }],
  art38: [{ href: '/records/interviews', label: '비공개 기록' }],
  bp5: [{ href: '/admin/timetable', label: '시간표' }],
  bp7: [{ href: '/admin/timetable', label: '레벨 그룹 편성' }],
  bp8: [{ href: '/records/life', label: '상점·벌점 입력' }],
};

export function formsForAnchor(id: string) {
  const m = id.match(/^art(\d+)$/);
  if (!m) return [];
  return FORMS.filter(f => f.articles.includes(Number(m[1])));
}
