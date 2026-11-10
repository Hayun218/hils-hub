// 시연용 가상 데이터. 실제 학생·교직원 정보가 아니다.
import type { DiagnosticExam, HubState, Student, StudentRecord, Teacher, PurchaseRequest } from './types';
import { DEFAULT_ROADMAPS } from './roadmaps';
import { DEFAULT_TEMPLATE } from './reports';
import { DEFAULT_CALENDAR } from './calendar';

export const teachers: Teacher[] = [
  { id: 'principal', name: '학교장', role: '학교장', subjects: [], areas: ['학교장'] },
  { id: 'pastor', name: '목사님', role: '목사', subjects: ['예배자 학교'], areas: ['신앙교육 방향'] },
  { id: 't1', name: '이은혜', role: '교사', homeroomFor: '중고등', subjects: ['영어'], areas: ['교육과정'] },
  { id: 't2', name: '박지훈', role: '교사', homeroomFor: '중고등', subjects: ['수학'], areas: ['생활교육'] },
  { id: 't3', name: '최다솜', role: '교사', homeroomFor: '초등', subjects: ['국어', '독서'], areas: [] },
  { id: 't4', name: '정한결', role: '교사', homeroomFor: '중고등', subjects: ['과학', '사회'], areas: ['행정·대외협력'] },
  { id: 't5', name: '강민서', role: '교사', subjects: ['영어', '수학'], areas: ['생활교육(부)'] },
];

// 가상 학생 20명 (2027학년도 기준): 어니스트반 5 · 드림반 6 · 콜링반 9.
// 담임 (제35조 제3항): 초등은 별도 담임 1명, 중고등은 혼합 연령 소그룹 3명 — 나이순으로 돌아가며 1인 5명
type S = [string, string, number, '초등' | '중고등', boolean, string, string | undefined, string | undefined, Student['status'], '남' | '여', string];
const rows: S[] = [
  // id, 이름, 출생연도, 학교급, 기숙, 담임, 영어, 수학, 상태, 성별, 반
  ['s01', '김하늘', 2019, '초등', false, 't3', 'EN-E', '초등', '재학', '여', '어니스트반'],
  ['s02', '박서윤', 2018, '초등', false, 't3', 'EN-E', '초등', '재학', '여', '어니스트반'],
  ['s03', '이도윤', 2017, '초등', true, 't3', 'EN-E', '초등', '재학', '남', '어니스트반'],
  ['s04', '정우주', 2016, '초등', true, 't3', 'EN-E', '초등', '재학', '남', '어니스트반'],
  ['s05', '한예린', 2015, '초등', true, 't3', 'EN-MH', '초등', '재학', '여', '어니스트반'],
  ['s06', '오지안', 2014, '중고등', true, 't2', 'EN-MH', 'M-C', '재학', '여', '드림반'],
  ['s07', '서민준', 2014, '중고등', true, 't4', 'EN-MH', 'M-C', '재학', '남', '드림반'],
  ['s08', '윤채아', 2013, '중고등', true, 't4', 'EN-B', 'M-B', '재학', '여', '드림반'],
  ['s09', '장시우', 2013, '중고등', true, 't2', 'EN-MH', 'M-C', '재학', '남', '드림반'],
  ['s10', '임소율', 2013, '중고등', true, 't1', 'EN-B', 'M-B', '재학', '여', '드림반'],
  ['s20', '전지호', 2012, '중고등', true, 't1', 'EN-MH', 'M-C', '재학', '남', '드림반'],
  ['s11', '강태오', 2011, '중고등', true, 't1', 'EN-B', 'M-B', '재학', '남', '콜링반'],
  ['s12', '조은서', 2011, '중고등', true, 't2', 'EN-A', 'M-A', '재학', '여', '콜링반'],
  ['s13', '신재원', 2011, '중고등', true, 't4', 'EN-MH', 'M-C', '재학', '남', '콜링반'],
  ['s14', '홍다인', 2011, '중고등', true, 't1', 'EN-A', 'M-A', '재학', '여', '콜링반'],
  ['s15', '배준호', 2011, '중고등', true, 't2', 'EN-B', 'M-B', '재학', '남', '콜링반'],
  ['s16', '문가온', 2011, '중고등', true, 't4', 'EN-B', 'M-C', '재학', '남', '콜링반'],
  ['s17', '양서진', 2010, '중고등', true, 't4', 'EN-A', 'M-A', '재학', '여', '콜링반'],
  ['s18', '노건우', 2010, '중고등', true, 't2', 'EN-B', 'M-B', '재학', '남', '콜링반'],
  ['s19', '류하람', 2009, '중고등', true, 't1', 'EN-A', 'M-A', '재학', '여', '콜링반'],
];

export const students: Student[] = rows.map(([id, name, birthYear, schoolLevel, boarding, homeroom, enLevel, mathLevel, status, gender, classGroup]) => ({
  id, name, birthYear, schoolLevel, boarding, homeroom, enLevel, mathLevel, status, gender, classGroup,
  admittedAt: status === '재학' ? '2026-03-02' : undefined,
  guardian: name.slice(0, 1) + '보호자',
  guardianPhone: '010-0000-' + id.slice(1).padStart(4, '0'),
  consent: status === '재학',
  devicesSubmitted: status === '재학',
  gedThisQuarter: id === 's19',
}));

let n = 0;
const rec = (studentId: string, type: StudentRecord['type'], date: string, title: string, author: string, data: StudentRecord['data'] = {}, priv = false): StudentRecord =>
  ({ id: `r${++n}`, studentId, type, date, title, author, private: priv, data });

export const records: StudentRecord[] = [
  // 1쿼터 첫 주 진단과 레벨 (제25조)
  ...students.filter(s => s.status === '재학').flatMap(s => [
    rec(s.id, 'level', '2027-01-06', `영어 레벨 확정 ${s.enLevel}`, 't1', { subject: '영어', from: s.enLevel || '', to: s.enLevel || '' }),
    rec(s.id, 'level', '2027-01-06', `수학 레벨 확정 ${s.mathLevel}`, 't2', { subject: '수학', from: s.mathLevel || '', to: s.mathLevel || '' }),
  ]),
  rec('s08', 'level', '2027-03-08', '수학 레벨 상향 M-B → M-A', 't2', { subject: '수학', from: 'M-B', to: 'M-A' }),
  rec('s09', 'level', '2027-03-08', '영어 레벨 상향 EN-MH → EN-B', 't1', { subject: '영어', from: 'EN-MH', to: 'EN-B' }),
  // 독서 기록
  rec('s12', 'reading', '2027-01-20', '나니아 연대기 1', 't3', { book: '나니아 연대기 1', category: '교과' }),
  rec('s12', 'reading', '2027-02-14', '순전한 기독교', 't3', { book: '순전한 기독교', category: '영성' }),
  rec('s14', 'reading', '2027-02-02', '어린 왕자', 't3', { book: '어린 왕자', category: '교과' }),
  rec('s08', 'reading', '2027-02-25', '꿈꾸는 다락방', 't3', { book: '꿈꾸는 다락방', category: '진로' }),
  rec('s01', 'reading', '2027-03-03', '강아지똥', 't3', { book: '강아지똥', category: '교과' }),
  // 상점·벌점 (별표 8, 1쿼터 적용 항목)
  rec('s05', 'merit', '2027-02-10', '맡지 않은 일을 자발적으로 섬김', 't3', { points: 2, area: '공동체·섬김' }),
  rec('s12', 'merit', '2027-02-21', '독서 보고서 제출', 't3', { points: 1, area: '사고력·독서' }),
  rec('s17', 'merit', '2027-03-05', '3P 바인더를 한 주 동안 빠짐없이 작성', 't5', { points: 1, area: '생활' }),
  rec('s13', 'demerit', '2027-01-27', '지각', 't5', { points: 1, area: '생활' }),
  rec('s13', 'demerit', '2027-02-03', '제31조 제1항 위반', 't2', { points: 2, area: '언어' }),
  rec('s13', 'demerit', '2027-02-24', '지각', 't5', { points: 1, area: '생활' }),
  rec('s07', 'demerit', '2027-02-12', '제출하지 않은 기기 보유, 돌려받은 기기 미제출', 't2', { points: 3, area: '전자기기' }),
  rec('s07', 'demerit', '2027-03-10', '제31조 제1항 위반', 't1', { points: 2, area: '언어' }),
  // 지도 사유 (별지 4)와 지도 면담 (별지 8): s07은 2건 → 2단계
  rec('s07', 'incident', '2027-02-12', '전자기기 미제출 적발', 't2', { reason: '전자기기', fact: '기숙사 사물함에서 미제출 MP3(영상 재생 가능) 발견', step: 1 }, true),
  rec('s07', 'interview', '2027-02-15', '[지도-1단계] 서민준 · 전자기기 · 2027-02-15', 't2', { kind: '지도', step: 1, reason: '전자기기', summary: '기기 제출 약속, 보호자에게 귀가 시 반환 방식 안내', promise: '2주간 매일 저녁 담임 확인' }, true),
  rec('s07', 'incident', '2027-03-10', '벌점 5점 도달', 't1', { reason: '벌점 누적', fact: '1쿼터 벌점 누적 5점', step: 2 }, true),
  // 정기 면담 (제35조 제3항)
  rec('s12', 'interview', '2027-02-26', '[정기] 조은서 · 2027-02-26', 't4', { kind: '정기', summary: '독서 계획 점검, 리더 역할에 대한 부담 이야기 나눔', promise: '하브루타 조장 한 쿼터 맡기' }),
  rec('s01', 'interview', '2027-03-05', '[정기] 김하늘 · 2027-03-05', 't3', { kind: '정기', summary: '학교 적응 좋음, 아침 묵상 시간에 집중 어려움', promise: '묵상 노트 그림으로 시작' }),
  rec('s19', 'interview', '2027-03-11', '[학습] 류하람 · 수학 · 2027-03-11', 't2', { kind: '학습', subject: '수학', summary: '검정고시 4월 응시 준비, 개별 시간표 적용(제24조 제3항)', promise: '주 3회 모의고사' }),
  // 체험 입학 진단 (별지 2)
  rec('s20', 'diagnosis', '2026-03-09', '체험 입학 1주차 진단', 't1', { 영어: '듣기·쉐도잉 가능 (EN-MH 예상)', 수학: '연산 공백 있음 (M-C 예상)', 영성: '적응 면담 완료', 공동체: '관찰 중' }),
];

export const purchases: PurchaseRequest[] = [
  { id: 'p1', date: '2027-02-03', item: '수학 교재 『체크 체크』 8권', amount: 136000, category: '교재비', reason: 'M-B 레벨 학생용', requester: 't2', status: '전표등록', decidedBy: 'principal', decidedAt: '2027-02-04', voucher: { no: 'C-2027-0012', date: '2027-02-06', method: '법인카드', vendor: '○○서점', amount: 136000 } },
  { id: 'p2', date: '2027-02-20', item: '3P 바인더 리필 20세트', amount: 180000, category: '학습 소모품', reason: '2쿼터 사용분', requester: 't3', status: '구매완료', decidedBy: 'principal', decidedAt: '2027-02-21' },
  { id: 'p3', date: '2027-03-02', item: '전자기기 잠금 보관함', amount: 420000, category: '시설·비품', reason: '제31조 제2항 보관 기준', requester: 't2', status: '승인', decidedBy: 'principal', decidedAt: '2027-03-03' },
  { id: 'p4', date: '2027-03-12', item: '메릿마켓 물품', amount: 95000, category: '행사비', reason: '3월 메릿마켓', requester: 't4', status: '신청' },
  { id: 'p5', date: '2027-03-14', item: '영어 원서 세트', amount: 310000, category: '교재비', reason: 'EN-A 필독서', requester: 't1', status: '신청' },
];

// 시연용 진단평가: 2027학년도 1학기 첫 주 (1쿼터 첫 주). 가상 점수
const diagStudents = students.filter(s => s.status === '재학');
const pick = (s: Student, i: number) => (s.id.charCodeAt(2) + i * 7) % 20;
const diagnostics: DiagnosticExam[] = [
  {
    id: 'dg1', subject: '영어', round: '학기 첫 주', date: '2027-01-11', title: '2027학년도 1학기 영어 진단평가', place: '러닝센터 (말하기는 강의실)', teacher: 't1', form: '가형',
    sections: ['어휘·문법', '읽기', '쓰기', '말하기'], files: [], students: diagStudents.map(s => s.id),
    results: Object.fromEntries(diagStudents.map(s => [s.id, { scores: { '어휘·문법': String(60 + pick(s, 1)), 읽기: String(55 + pick(s, 2)), 쓰기: String(50 + pick(s, 3)), 말하기: String(55 + pick(s, 4)) }, level: s.enLevel || 'EN-E', applied: true }])),
  },
  {
    id: 'dg2', subject: '수학', round: '학기 첫 주', date: '2027-01-12', title: '2027학년도 1학기 수학 진단평가', place: '러닝센터', teacher: 't2', form: '가형',
    sections: ['초등 묶음', '중학 묶음', '고1 묶음'], files: [], students: diagStudents.map(s => s.id),
    results: Object.fromEntries(diagStudents.map(s => {
      const lv = s.mathLevel || '초등';
      const sc = lv === '초등' ? ['14/20', '', ''] : lv === 'M-C' ? ['17/20', '9/20', ''] : lv === 'M-B' ? ['19/20', '15/20', '6/20'] : ['20/20', '18/20', '14/20'];
      return [s.id, { scores: { '초등 묶음': sc[0], '중학 묶음': sc[1], '고1 묶음': sc[2] }, level: lv, gaps: lv === 'M-C' ? '분수의 나눗셈, 일차방정식' : lv === 'M-B' ? '이차함수 그래프' : '', applied: true }];
    })),
  },
  {
    id: 'dg3', subject: '문해력', round: '학기 첫 주', date: '2027-01-13', title: '2027학년도 1학기 문해력 진단평가', place: '러닝센터 (면담은 강의실)', teacher: 't3', form: '가형',
    sections: ['읽기 (설명문)', '읽기 (문학)', '쓰기', '독서 이력 면담'], files: [], students: diagStudents.map(s => s.id),
    results: Object.fromEntries(diagStudents.map(s => [s.id, { scores: { '읽기 (설명문)': String(5 + (pick(s, 1) % 6)) + '/10', '읽기 (문학)': String(4 + (pick(s, 2) % 7)) + '/10', 쓰기: ['상', '중', '하'][pick(s, 3) % 3], '독서 이력 면담': '완료' }, level: ['발달', '학년 수준', '학년 수준', '심화', '기초'][pick(s, 5) % 5] }])),
  },
];

export const seed: HubState = { students, teachers, records, purchases, progress: {}, reports: [], prayers: {}, timetable: [], attendance: {}, grades: [], forms: [], gedExams: [], diagnostics, syllabi: [], archives: [], submissions: [], schoolRecords: [], gradChecks: {}, gradSettings: { 초등: { readingCount: 30, enMin: 'EN-MH', mathMin: 'M-C', volunteerHours: null }, 중등: { readingCount: 40, enMin: 'EN-B', mathMin: 'M-B', volunteerHours: 10 }, 고등: { readingCount: 50, enMin: 'EN-B', mathMin: 'M-B', volunteerHours: 30 } }, calendar: DEFAULT_CALENDAR, roadmaps: DEFAULT_ROADMAPS, reportTemplate: DEFAULT_TEMPLATE };
