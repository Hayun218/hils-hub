// 학교생활기록부 모델: 학교가 쓰던 학교생활세부사항기록부(학교생활기록부 Ⅱ) 구성을 따른다.
// 1 인적·학적 2 출결 3 수상 4 자격증 5 창의적 체험활동(+봉사) 6 교과학습발달상태(일반·진로 선택·체육·예술) 7 독서 8 행동특성
// Word 내보내기(docx)는 lib/schoolRecord.ts. 이 파일은 store에서도 쓰므로 무거운 패키지를 넣지 않는다.
import type { HubState, SchoolRecordDoc, SchoolRecordSubject, SrSubjectKind } from './types';

// 글자 수 한도 (공백 포함). 학년도 기재요령이 바뀌면 여기를 고친다
export const LIMITS = { autonomy: 500, club: 500, career: 700, detail: 500, behavior: 500 };
export const SUBJECT_KINDS: SrSubjectKind[] = ['일반', '진로 선택', '체육·예술'];

/** 출결: 수업일수와 결석·지각·조퇴·결과(외출)를 질병·미인정·기타로 나눈다.
 *  출석 메모에 '병·아파·병원·질병'이 있으면 질병, '인정·기타·가정·행사'가 있으면 기타, 없으면 미인정 */
export function attendanceOf(hub: HubState, sid: string, year: number) {
  const days = Object.entries(hub.attendance).filter(([d, v]) => d.startsWith(String(year)) && v[sid]);
  const cause = (note = '') => (/병|아파|질병/.test(note) ? '질병' : /인정|기타|가정|행사|경조/.test(note) ? '기타' : '미인정');
  const grid = { 결석: { 질병: 0, 미인정: 0, 기타: 0 }, 지각: { 질병: 0, 미인정: 0, 기타: 0 }, 조퇴: { 질병: 0, 미인정: 0, 기타: 0 }, 결과: { 질병: 0, 미인정: 0, 기타: 0 } };
  for (const [, v] of days) {
    const e = v[sid];
    const k = e.status === '외출' ? '결과' : e.status;
    if (k === '출석') continue;
    grid[k][cause(e.note)]++;
  }
  const none = Object.values(grid).every(g => !g.질병 && !g.미인정 && !g.기타);
  return { days: days.length, grid, perfect: days.length > 0 && none };
}
export type Attendance = ReturnType<typeof attendanceOf>;

export const emptyActivity = () => ({ hours: '', text: '' });
export const blankRecord = (studentId: string, year: number, id: string): SchoolRecordDoc => ({
  id, studentId, year, special: '', attendanceNote: '', awards: [], certificates: [],
  activities: { autonomy: emptyActivity(), club: { ...emptyActivity(), club: '' }, career: { ...emptyActivity(), hope: '' } },
  volunteer: [], subjects: [], reading: [], behavior: '', status: '작성중', updatedAt: new Date().toISOString(),
});
export const blankSubject = (kind: SrSubjectKind, semester = '1'): SchoolRecordSubject =>
  ({ kind, semester, area: '', subject: '', units: '', score: '', achievement: '', rank: '', detail: '' });

/** 예전 버전(글 칸 하나씩)에서 저장한 기록을 표 행 구조로 옮긴다 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeRecord(d: any): SchoolRecordDoc {
  const base = blankRecord(d.studentId, d.year, d.id);
  const str = (x: unknown) => (typeof x === 'string' ? x : '');
  const act = (x: unknown, extra: object = {}) => (typeof x === 'string' ? { hours: '', text: x, ...extra } : { ...emptyActivity(), ...extra, ...(x as object) });
  const a = d.activities || {};
  return {
    ...base, ...d,
    special: str(d.special),
    attendanceNote: str(d.attendanceNote),
    awards: Array.isArray(d.awards) ? d.awards : d.awards ? [{ semester: '', name: d.awards, grade: '', date: '', org: '', target: '' }] : [],
    certificates: Array.isArray(d.certificates) ? d.certificates : d.certificates ? [{ kind: '', name: d.certificates, number: '', date: '', issuer: '' }] : [],
    activities: { autonomy: act(a.autonomy), club: act(a.club, { club: '' }), career: act(a.career, { hope: '' }) },
    volunteer: Array.isArray(d.volunteer) ? d.volunteer : a.volunteer ? [{ period: '', place: '', content: a.volunteer, hours: '' }] : [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subjects: (d.subjects || []).map((x: any) => ({ ...blankSubject(x.kind || '일반'), ...x, score: x.score || '', achievement: x.achievement || '' })),
    reading: Array.isArray(d.reading) ? d.reading : d.reading ? [{ area: '공통', semester: '', books: d.reading }] : [],
  };
}

/** 항목별 작성 요령 (학교가 쓰던 기록부 문체 기준) */
export const GUIDE: Record<string, string> = {
  special: '검정고시 합격, 편입·전학 등 학적에 관한 사실만 날짜와 함께 씁니다. 예) 2027.05.15. 고등학교 졸업학력 검정고시 합격',
  attendance: '출석 현황에서 자동으로 셉니다. 출석 메모에 사유(병원, 가정 행사 등)를 적으면 질병·기타로 나뉩니다. 결석이 없으면 특기사항에 "개근".',
  awards: '교내 수상만 씁니다. 수상명, 등급(위), 수상연월일, 수여기관, 참가대상(참가인원)을 학기별로.',
  certificates: '국가자격·공인 민간자격만. 명칭, 번호, 취득일, 발급기관. 없으면 비워 두면 "해당 사항 없음"으로 출력됩니다.',
  activities: '활동명(날짜) → 맡은 역할과 한 일 → 그 과정에서 보인 태도나 변화 순서로 한 활동에 2–3문장. 문장은 "~함", "~임"으로 끝냅니다. 칭찬만 늘어놓지 말고 장면이 보이게 씁니다.',
  club: '동아리 이름과 시간을 앞에 쓰고, 주로 한 활동 → 학생이 맡은 일 → 결과물 순서로 씁니다.',
  career: '희망분야를 적고, 진로 검사·상담·탐색 활동(날짜)과 그 뒤에 학생이 한 일(보고서, 발표)을 이어서 씁니다.',
  volunteer: '일자 또는 기간, 장소(학교·개인·기관명), 활동 내용, 시간. 누계는 자동으로 계산합니다. 졸업 지표(봉사 시간)에 바로 반영됩니다.',
  subjects: '일반 과목은 원점수/과목평균(표준편차), 성취도(수강자수), 석차등급. 진로 선택 과목은 석차 대신 성취도별 분포비율, 체육·예술은 성취도만 씁니다.',
  detail: '"(학기) 과목:" 다음에 수업 중 구체적 장면 → 학생이 한 일 → 드러난 역량 순서로. 단원명이나 과제명을 넣으면 살아 있는 기록이 됩니다.',
  reading: '영역(공통, 문학, 신앙, 수학, 진로 등)별로 (학기) 책 제목(지은이). 독서록에서 가져오면 제출한 책이 들어갑니다.',
  behavior: '한 해 동안의 변화가 보이게, 강점과 성장 과정을 함께 씁니다. 처음 모습 → 계기 → 달라진 모습. 4–6문장.',
};

/** 작성 예시: 가상의 학생 (실제 학생 기록이 아님) */
export const EXAMPLE: SchoolRecordDoc = {
  id: 'example', studentId: 'example', year: 2027, status: '확정', updatedAt: '2027-12-20',
  special: '2027.05.15. 고등학교 졸업학력 검정고시 일부 과목 합격 (국어, 영어, 한국사)',
  attendanceNote: '개근',
  awards: [
    { semester: '1', name: '독서 발표 대회', grade: '최우수(1위)', date: '2027.06.18.', org: 'HILS', target: '중고등학생 (14)' },
    { semester: '2', name: '프로젝트 쿼터 결과 발표', grade: '우수(2위)', date: '2027.12.10.', org: 'HILS', target: '콜링반 (6)' },
  ],
  certificates: [{ kind: '국가공인 민간자격', name: '한자능력검정 4급', number: '(예시 번호)', date: '2027.08.24.', issuer: '한국어문회' }],
  activities: {
    autonomy: { hours: '64', text: '학기 초 학급 자치회의(2027.03.08.)에서 생활 약속을 정하는 토의를 이끌며, 지각을 줄이는 방법으로 "아침 5분 먼저 오기"를 제안해 학급의 동의를 얻음. 경주 필드트립(2027.04.22.–2027.04.23.)에서 조장을 맡아 동선과 역할을 미리 나누고, 일정이 늦어지자 조원들과 상의해 관람 순서를 바꾸는 판단력을 보임.\n여름 캠프(2027.07.12.–2027.07.16.) 예배팀에서 건반을 맡아 매일 저녁 예배를 준비하며 후배 2명에게 반주 코드를 가르침. 크리스마스 행사(2027.12.18.)에서 무대 진행을 맡아 리허설 시간표를 직접 만들어 공유하는 등 맡은 일을 끝까지 책임지는 태도가 돋보임.' },
    club: { hours: '34', club: '독서토론반', text: '(독서토론반)(34시간) 격주로 한 권을 정해 읽고 하브루타 방식으로 질문을 만들어 토론함. 「데미안」을 읽고 "내 안의 목소리를 따르는 것과 공동체의 약속은 부딪힐 수 있는가"라는 질문을 내어 토론을 이끌었으며, 다른 의견을 끝까지 듣고 자신의 주장을 근거와 함께 고쳐 가는 모습을 보임. 학기 말 토론 글을 묶은 소책자 제작에서 편집을 맡아 12편의 글을 주제별로 정리함.' },
    career: { hours: '40', hope: '교육학', text: '강점 진단(2027.03.15.) 결과 "배움"과 "공감" 테마가 높게 나와 가르치는 일로 관심을 넓힘. 담임과의 진로 상담(2027.04.10.)에서 "배우기 어려운 아이를 돕는 교사"라는 목표를 세움.\n어니스트반 수학 시간 보조 교사(2027.05.–2027.06., 주 1회)로 참여하며 학생 눈높이에 맞춘 설명 방법을 고민하고, 같은 문제를 그림·구체물·말로 각각 설명해 보며 기록함. 전공 탐색 보고서에서 교육학과 특수교육학의 교육과정을 비교하고 필요한 준비를 단계별로 정리해 발표함.' },
  },
  volunteer: [
    { period: '2027.03.06. – 2027.06.26.', place: '(학교)', content: '교내 환경 정화 활동', hours: '12' },
    { period: '2027.05.20.', place: '(개인) 지역아동센터', content: '초등학생 학습 돕기', hours: '4' },
    { period: '2027.11.13.', place: '(학교)', content: '연탄 나눔 봉사', hours: '5' },
  ],
  subjects: [
    { kind: '일반', semester: '1', area: '수학', subject: '수학', units: '5', score: '92/78.4 (12.1)', achievement: 'A (8)', rank: '2/8', detail: '이차함수 단원에서 최댓값·최솟값을 구하는 문제를 그래프로 먼저 그려 보고 식으로 확인하는 자기만의 풀이 순서를 만들어 친구들에게 설명함. 틀린 문제를 오답 노트에 "왜 틀렸는지"까지 적어 같은 실수를 줄여 감.' },
    { kind: '일반', semester: '1', area: '영어', subject: '영어 I', units: '4', score: '88/81.0 (9.4)', achievement: 'B (8)', rank: '3/8', detail: '"My Small Habit"을 주제로 200단어 에세이를 쓰고 발표함. 발음 실수를 두려워하지 않고 질문에 영어로 답하려 애쓰는 모습이 인상적임. 피드백을 받아 문단 연결어를 고쳐 다시 제출함.' },
    { kind: '일반', semester: '1', area: '국어', subject: '문학', units: '4', score: '95/84.2 (8.7)', achievement: 'A (8)', rank: '1/8', detail: '윤동주의 시를 시대 배경과 함께 읽고 "부끄러움"이라는 낱말이 시마다 어떻게 다르게 쓰였는지 표로 정리해 발표함. 작품을 자기 삶과 연결해 감상문을 쓰는 힘이 뛰어남.' },
    { kind: '일반', semester: '1', area: '사회', subject: '한국사', units: '2', score: '90/86.5 (5.2)', achievement: 'A (8)', rank: '3/8', detail: '' },
    { kind: '일반', semester: '1', area: '신앙', subject: '기도와 예배', units: '2', score: '', achievement: 'P', rank: '', detail: '' },
    { kind: '일반', semester: '2', area: '수학', subject: '수학', units: '5', score: '89/76.0 (13.5)', achievement: 'A (8)', rank: '2/8', detail: '경우의 수 단원에서 문제를 직접 만들어 친구와 바꿔 풀고, 풀이가 다를 때 어느 쪽이 맞는지 끝까지 따져 보는 끈기를 보임.' },
    { kind: '진로 선택', semester: '2', area: '탐구', subject: '개별 연구', units: '3', score: '', achievement: 'A (6)', rank: 'A(50.0) B(33.3) C(16.7)', detail: '"초등학생은 왜 분수를 어려워할까"를 주제로 어니스트반 학생 5명과 면담하고, 그림으로 설명했을 때 이해가 빨라지는 과정을 관찰해 보고서로 정리함.' },
    { kind: '체육·예술', semester: '1', area: '체육', subject: '운동과 건강', units: '2', score: '', achievement: 'A', rank: '', detail: '' },
    { kind: '체육·예술', semester: '2', area: '예술', subject: '음악 (합주)', units: '2', score: '', achievement: 'A', rank: '', detail: '합주에서 건반을 맡아 박자가 흔들리는 친구 옆에서 함께 세어 주며 전체 소리를 맞춤.' },
  ],
  reading: [
    { area: '공통', semester: '1', books: '사피엔스(유발 하라리), 생각의 탄생(로버트 루트번스타인)' },
    { area: '문학', semester: '1', books: '데미안(헤르만 헤세)' },
    { area: '문학', semester: '2', books: '동물농장(조지 오웰)' },
    { area: '신앙', semester: '2', books: '순전한 기독교(C.S. 루이스), 천로역정(존 번연)' },
    { area: '진로', semester: '2', books: '수학이 필요한 순간(김민형)' },
  ],
  behavior: '자기 생각을 분명하게 말하면서도 다른 사람의 의견을 끝까지 듣는 태도가 몸에 밴 학생임. 1학기에는 과제를 미루는 습관이 있었으나 3P 바인더로 하루 계획을 점검하면서 2학기에는 제출 기한을 모두 지킴. 어니스트반 수학 보조 교사로 참여하며 어린 학생이 이해할 때까지 다른 방법으로 다시 설명하는 인내심을 보였고, 이 경험이 교사라는 진로를 구체화하는 계기가 됨. 예배팀과 행사 준비에서 눈에 띄지 않는 일을 먼저 맡아 공동체의 신뢰를 얻고 있음.',
};
export const EXAMPLE_STUDENT = { name: '예시 학생', gender: '여', grade: '고1', classGroup: '콜링반', admittedAt: '2026-03-02', homeroom: '담임 교사' };
