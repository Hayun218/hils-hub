// 졸업·수료 지표 (제16조, 제30조, 별표 2). 학생의 반으로 과정을 정한다:
// 어니스트반 → 초등 수료, 드림반 → 중등 수료, 콜링반 → 고등 졸업.
// 3P 바인더 같은 매일의 고정 일과는 지표가 아니라 상시 기준이다 (제16조 제6항).
// 수량 기준은 제16조 제2항에 따라 매년 12월에 확정한다 (지금 값은 별표 2 초안).
import type { GedLevel, GradTrack, HubState, Student, SubmissionKind } from './types';

export type GradStatus = '충족' | '진행' | '미충족' | '해당 없음';
export type GradResult = { status: GradStatus; detail: string };
/** target: 학교급별 기준 (null이면 그 과정에는 없는 지표). confirm: 담임이 눌러서 확인하는 지표 */
export interface GradItem { key: string; area: string; label: string; target: Record<GradTrack, string | null>; source: string; confirm: boolean }

export const TRACKS: GradTrack[] = ['초등', '중등', '고등'];
export const TRACK_LABEL: Record<GradTrack, string> = { 초등: '초등 수료', 중등: '중등 수료', 고등: '고등 졸업' };
export const TRACK_CLASS: Record<GradTrack, string> = { 초등: '어니스트반', 중등: '드림반', 고등: '콜링반' };
export const trackOf = (s: Student): GradTrack =>
  s.classGroup === '어니스트반' || (!s.classGroup && s.schoolLevel === '초등') ? '초등' : s.classGroup === '드림반' ? '중등' : '고등';
export const GED_OF: Record<GradTrack, GedLevel> = { 초등: '초졸', 중등: '중졸', 고등: '고졸' };

export const GRAD_ITEMS: GradItem[] = [
  { key: 'bible', area: '기도와 예배', label: '성경 읽기', source: '담임 확인', confirm: true,
    target: { 초등: '성경 인물 이야기 10편 설명(안)', 중등: '신약 1독', 고등: '성경 1독 이상' } },
  { key: 'memorize', area: '기도와 예배', label: '암송', source: '암송 확인', confirm: true,
    target: { 초등: '주기도문·사도신경, 지정 구절 20개(안)', 중등: '중등 암송 40구절(안)', 고등: '고등 암송 60구절(안)' } },
  { key: 'word', area: '기도와 예배', label: '말씀 적용', source: '말씀·기도 노트, 포트폴리오', confirm: true,
    target: { 초등: null, 중등: '말씀·기도 노트 학기마다 1회', 고등: '말씀 적용 사례를 포트폴리오에' } },
  { key: 'reading', area: '지적 탐구', label: '독서', source: '독서록 제출 수 (자동)', confirm: false,
    target: { 초등: '독서록 30권(안)', 중등: '독서록 40권(안)', 고등: '독서록 50권(안)' } },
  { key: 'speech', area: '지적 탐구', label: '발표·보고서', source: '담임 확인, 제출 과제', confirm: true,
    target: { 초등: '책으로 3분 발표', 중등: '독서 보고서 학기마다 1편', 고등: '포트폴리오 발표 (PDF 제출)' } },
  { key: 'english', area: '지적 탐구', label: '영어', source: '학생 레벨 (자동)', confirm: false,
    target: { 초등: 'EN-MH 도달', 중등: 'EN-B 도달', 고등: 'EN-B 이상' } },
  { key: 'math', area: '지적 탐구', label: '수학', source: '학생 레벨 (자동)', confirm: false,
    target: { 초등: 'M-C 도달 (초등 범위)', 중등: 'M-B 도달 (중학교 범위)', 고등: 'M-B 이상 (고1 범위 이내)' } },
  { key: 'community', area: '이웃 사랑', label: '공동체 역할', source: '생활 기록, 당번표', confirm: true,
    target: { 초등: '당번을 스스로 함', 중등: '당번 조장 1쿼터 이상', 고등: '공동체 역할 1년 이상' } },
  { key: 'volunteer', area: '이웃 사랑', label: '봉사', source: '생기부 봉사활동 실적 (자동)', confirm: false,
    target: { 초등: null, 중등: '봉사 10시간(안)', 고등: '봉사 30시간(안)' } },
  { key: 'career', area: '비전과 진로', label: '진로', source: '담임 확인, 제출 과제', confirm: true,
    target: { 초등: '좋아하는 것·잘하는 것 발표', 중등: '진로 탐색 보고서 1편', 고등: '진로 포트폴리오, 진로 계획서' } },
  { key: 'ged', area: '학력', label: '검정고시', source: '검정고시 기록 (자동)', confirm: false,
    target: { 초등: '초졸 검정고시 합격', 중등: '중졸 검정고시 합격', 고등: '고졸 검정고시 합격' } },
  { key: 'final', area: '절차', label: '수료·졸업 확인', source: '담임 확인, 별지 5', confirm: true,
    target: { 초등: '담임 확인으로 수료', 중등: '담임 확인으로 수료', 고등: '졸업 심사 통과 (별지 5)' } },
];
export const itemsOf = (t: GradTrack) => GRAD_ITEMS.filter(i => i.target[t] !== null);

const EN = ['EN-E', 'EN-MH', 'EN-B', 'EN-A'];
const MA = ['초등', 'M-C', 'M-B', 'M-A'];

export const readingCount = (hub: HubState, sid: string) =>
  hub.submissions.filter(x => x.studentId === sid && x.kind === '독서록').length + hub.records.filter(r => r.studentId === sid && r.type === 'reading').length;
export const volunteerHours = (hub: HubState, sid: string) =>
  hub.schoolRecords.filter(d => d.studentId === sid).flatMap(d => d.volunteer || []).reduce((a, v) => a + (Number(v.hours) || 0), 0);

export function gradStatus(hub: HubState, s: Student): Record<string, GradResult> {
  const t = trackOf(s);
  const checks = hub.gradChecks[s.id] || {};
  const st = hub.gradSettings[t];
  const count = (k: SubmissionKind) => hub.submissions.filter(x => x.studentId === s.id && x.kind === k).length;
  const ok = (k: string) => checks[k]?.done;
  // 담임 확인 + 제출 증빙: 확인하면 충족, 증빙만 있으면 진행
  const confirmed = (k: string, evidence = 0, label = '') =>
    ok(k) ? { status: '충족' as const, detail: `확인 ${checks[k].date || ''}`.trim() }
      : evidence ? { status: '진행' as const, detail: `${label} ${evidence}건, 확인 전` } : { status: '미충족' as const, detail: '확인 전' };
  const lv = (list: string[], cur: string | undefined, min: string): GradResult => {
    const i = list.indexOf(cur || ''), m = list.indexOf(min);
    if (i < 0) return { status: '미충족', detail: '레벨 없음' };
    return { status: i >= m ? '충족' : '진행', detail: `${cur} / ${min}` };
  };
  const out: Record<string, GradResult> = {};
  out.bible = confirmed('bible');
  out.memorize = confirmed('memorize', hub.records.filter(r => r.studentId === s.id && r.type === 'merit' && r.title.includes('암송')).length, '암송 상점');
  if (t !== '초등') out.word = confirmed('word', t === '중등' ? count('말씀·기도 노트') : count('포트폴리오'), t === '중등' ? '노트' : '포트폴리오');
  const n = readingCount(hub, s.id);
  out.reading = st.readingCount == null ? { status: '진행', detail: `${n}권 (기준 미정)` } : { status: n >= st.readingCount ? '충족' : n ? '진행' : '미충족', detail: `${n} / ${st.readingCount}권` };
  out.speech = confirmed('speech', t === '초등' ? 0 : t === '중등' ? count('독서 보고서') : count('포트폴리오'), t === '중등' ? '보고서' : '포트폴리오');
  out.english = lv(EN, s.enLevel, st.enMin);
  out.math = lv(MA, s.mathLevel, st.mathMin);
  out.community = confirmed('community');
  if (t !== '초등') {
    const h = volunteerHours(hub, s.id);
    out.volunteer = st.volunteerHours == null ? { status: '진행', detail: `${h}시간 (기준 미정)` } : { status: h >= st.volunteerHours ? '충족' : h ? '진행' : '미충족', detail: `${h} / ${st.volunteerHours}시간` };
  }
  if (t === '초등') out.career = confirmed('career');
  else if (t === '중등') out.career = count('진로 탐색 보고서') ? { status: '충족', detail: '보고서 제출' } : confirmed('career');
  else {
    const plan = count('진로 계획서'), port = count('포트폴리오');
    out.career = plan && port ? { status: '충족', detail: '계획서·포트폴리오' } : plan || port ? { status: '진행', detail: plan ? '포트폴리오 전' : '진로 계획서 전' } : confirmed('career');
  }
  const level = GED_OF[t];
  const ged = hub.gedExams.filter(g => g.studentId === s.id && g.level === level);
  const passed = ged.find(g => g.status === '합격');
  out.ged = passed ? { status: '충족', detail: `${passed.round} 합격` }
    : ok('ged_exempt') ? { status: '해당 없음', detail: '이전 학력 있음' }
      : ged.length ? { status: '진행', detail: ged.some(g => g.status === '일부 과목 합격') ? '일부 과목 합격' : '응시 중' } : { status: '미충족', detail: '응시 기록 없음' };
  if (t === '고등') {
    const review = hub.forms.find(f => f.formNo === 5 && f.studentId === s.id);
    out.final = review?.status === '완료' ? { status: '충족', detail: `심사 ${review.date}` } : review ? { status: '진행', detail: '심사표 작성 중' } : { status: '미충족', detail: '심사 전' };
  } else out.final = confirmed('final');
  return out;
}

export function gradSummary(hub: HubState, s: Student) {
  const r = gradStatus(hub, s);
  const vals = Object.values(r).filter(v => v.status !== '해당 없음');
  const met = vals.filter(v => v.status === '충족').length;
  return { met, total: vals.length, ready: met === vals.length, detail: r, track: trackOf(s) };
}

/** 학기: 1–6월 1학기, 7–12월 2학기. 제16조 제5항 학기 말 점검 */
export const semesterOf = (date: string) => `${date.slice(0, 4)}-${Number(date.slice(5, 7)) <= 6 ? 1 : 2}`;
export const semesterEnd = (date: string) => (Number(date.slice(5, 7)) <= 6 ? `${date.slice(0, 4)}-06-30` : `${date.slice(0, 4)}-12-31`);
export const reviewedThisSemester = (hub: HubState, sid: string, today: string) => {
  const r = hub.gradChecks[sid]?._review;
  return !!r?.date && semesterOf(r.date) === semesterOf(today);
};
