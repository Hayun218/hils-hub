// 학습 진도 보고서 기본값과 성적 모으기. 양식: reference/private/2025-1학기-3월-학습진도보고서-원본.docx
// 보고서에는 학생 기록 중 비공개 기록(지도 사유·지도 면담, 제38조)을 절대 넣지 않는다. 성적과 로드맵, 교사가 쓴 과목 평가만 넣는다.
import type { GradeSheet, ProgressReport, ReportTemplate, RoadmapDef, Student } from './types';
import { gradeLabel, quarterOf } from './rules';

export const DEFAULT_TEMPLATE: ReportTemplate = {
  title: 'HILS 학습 진도 보고서',
  elemSubjects: ['국어', '영어', '수학', '통합사회 / 통합과학', '한자', '미술'],
  secSubjects: ['국어', '영어', '수학', '통합사회 / 통합과학', '한자', '비교과'],
};
export const GED_COLUMNS = ['국어', '사회', '수학', '과학', '도덕', '영어'];

export const isHigh = (s: Student) => gradeLabel(s.birthYear).startsWith('고') || gradeLabel(s.birthYear).startsWith('만');

// 보고 기간: 쿼터 'YYYY-Qn' (제29조, 0.9.7). 예전에 만든 월 단위 'YYYY-MM'도 읽는다.
export const periodOf = (date: string) => `${date.slice(0, 4)}-Q${quarterOf(date)}`;
export const periodLabel = (p: string) => {
  const q = p.match(/^(\d{4})-Q(\d)$/);
  return q ? `${q[1]}학년도 ${q[2]}쿼터` : `${p.slice(0, 4)}년 ${Number(p.slice(5, 7))}월`;
};
export const inPeriod = (date: string, p: string) => (/-Q\d$/.test(p) ? periodOf(date) === p : date.startsWith(p));
export const lastDay = (p: string) => {
  const q = p.match(/^(\d{4})-Q(\d)$/);
  const [y, m] = q ? [Number(q[1]), Number(q[2]) * 3] : p.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
};
export const quarterPeriods = (year: number) => [1, 2, 3, 4].map(n => `${year}-Q${n}`);

export function newReport(s: Student, period: string, id: string, tpl: ReportTemplate, roadmaps: RoadmapDef[]): ProgressReport {
  return {
    id, studentId: s.id, period, date: lastDay(period),
    sections: { grades: true, career: isHigh(s), life: true },
    roadmapsOff: roadmaps.filter(rm => rm.level !== '전체' && rm.level !== s.schoolLevel).map(rm => rm.id),
    comments: (s.schoolLevel === '초등' ? tpl.elemSubjects : tpl.secSubjects).map(subject => ({ subject, text: '' })),
    career: '', status: '작성중', updatedAt: new Date().toISOString(),
  };
}

/** 보고서에 들어갈 성적: 검정고시 진단평가는 그 기간까지 누적, 나머지는 그 기간 것만 */
export function gradesFor(studentId: string, period: string, grades: GradeSheet[]) {
  const end = lastDay(period);
  const mine = grades.filter(g => g.students.includes(studentId) && g.scores[studentId] && Object.values(g.scores[studentId]).some(v => v !== ''));
  const ged = mine.filter(g => g.kind === '검정고시 진단평가' && g.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  const month = mine.filter(g => g.kind !== '검정고시 진단평가' && inPeriod(g.date, period)).sort((a, b) => a.subject.localeCompare(b.subject) || a.date.localeCompare(b.date));
  return { ged, month };
}

export const filled = (r: ProgressReport) => r.comments.filter(c => c.text.trim()).length;

/** 이 보고서에 이 로드맵을 넣는가 (예전 형식 sections.korean 등도 읽는다) */
export function roadmapOn(r: ProgressReport, id: string) {
  const legacy = r.sections as unknown as Record<string, boolean>;
  const key = { kor: 'korean', eng: 'english', math: 'math' }[id];
  if (key && legacy[key] === false) return false;
  return !(r.roadmapsOff || []).includes(id);
}
