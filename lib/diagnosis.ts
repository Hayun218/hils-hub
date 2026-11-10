// 진단평가 (제20조, 제25조 제2항, 별표 7 제4호): 문해력·영어·수학. 단원평가와 달리 학년 범위 전체에서 출발선과 빈 곳을 찾는다.
// 시기: 체험 입학 1주차, 학기 첫 주(1쿼터·3쿼터 첫 주). 학기 중간(2·4쿼터 첫 주)은 학생 신청 + 담임 허락 시 추가 진단평가.
import type { DiagRound, DiagSubject, DiagnosticExam, HubState } from './types';

export const DIAG_SUBJECTS: DiagSubject[] = ['문해력', '영어', '수학'];
export const DIAG_ROUNDS: DiagRound[] = ['학기 첫 주', '추가 (학기 중간)', '체험 입학'];

/** 별표 7 제4호 (초안)와 같은 내용. 학칙을 고치면 여기도 고친다 */
export const DIAG_GUIDE: Record<DiagSubject, { method: string; time: string; place: string; teacher: string; result: string; sections: string[]; levels: string[] }> = {
  문해력: {
    method: '학년군에 맞는 글 2편(설명문, 문학)을 읽고 답하기, 읽은 글에 대한 생각을 한 문단으로 쓰기, 독서 이력 면담',
    time: '지필 40분 + 면담 10분', place: '러닝센터 (면담은 강의실)', teacher: '사고력·독서 교사',
    result: '기초·발달·학년 수준·심화 4단계와 독서 출발 목록',
    sections: ['읽기 (설명문)', '읽기 (문학)', '쓰기', '독서 이력 면담'],
    levels: ['기초', '발달', '학년 수준', '심화'],
  },
  영어: {
    method: '어휘·문법, 읽기, 짧은 글 쓰기(지필)와 1:1 말하기 인터뷰',
    time: '지필 50분 + 말하기 5분', place: '러닝센터 (말하기는 강의실)', teacher: '영어 교사',
    result: '레벨 판정 (EN-E·EN-MH·EN-B·EN-A)',
    sections: ['어휘·문법', '읽기', '쓰기', '말하기'],
    levels: ['EN-E', 'EN-MH', 'EN-B', 'EN-A'],
  },
  수학: {
    method: '계단식 3묶음(초등: 수와 연산·도형, 중학: 수·문자와 식·함수, 고1: 공통수학). 앞 묶음을 70% 이상 맞히면 다음 묶음',
    time: '60분', place: '러닝센터', teacher: '수학 교사',
    result: '레벨 판정 (초등·M-C·M-B·M-A)과 빈 단원 목록 (로드맵의 시작점)',
    sections: ['초등 묶음', '중학 묶음', '고1 묶음'],
    levels: ['초등', 'M-C', 'M-B', 'M-A'],
  },
};

export const semesterLabel = (date: string) => `${date.slice(0, 4)}학년도 ${Number(date.slice(5, 7)) <= 6 ? 1 : 2}학기`;

/** 학생의 현재 값 (영어·수학은 레벨, 문해력은 마지막 진단평가 판정) */
export function currentOf(hub: HubState, sid: string, subject: DiagSubject): string {
  const s = hub.students.find(x => x.id === sid);
  if (subject === '영어') return s?.enLevel || '';
  if (subject === '수학') return s?.mathLevel || '';
  return lastResult(hub, sid, '문해력')?.level || '';
}

export function lastResult(hub: HubState, sid: string, subject: DiagSubject, before?: string) {
  const list = hub.diagnostics.filter(d => d.subject === subject && d.results[sid]?.level && (!before || d.date < before)).sort((a, b) => b.date.localeCompare(a.date));
  return list[0] ? { exam: list[0], ...list[0].results[sid] } : null;
}

export const defaultTitle = (subject: DiagSubject, round: DiagRound, date: string) =>
  round === '체험 입학' ? `체험 입학 ${subject} 진단평가 (${date})` : `${semesterLabel(date)} ${subject} 진단평가${round === '학기 첫 주' ? '' : ' (추가)'}`;

export const newExam = (id: string, subject: DiagSubject, round: DiagRound, date: string, students: string[]): DiagnosticExam => ({
  id, subject, round, date, title: defaultTitle(subject, round, date), place: DIAG_GUIDE[subject].place, teacher: '', form: '가형',
  sections: [...DIAG_GUIDE[subject].sections], files: [], students, results: {},
});
