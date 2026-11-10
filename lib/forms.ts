// 별지 서식 목록. 원문은 content/forms/byeolji-N.md, Word 원본은 "2027 HILS 프로세스 설계/02_별지 서식 (Word)".
export interface FormMeta {
  no: number;
  title: string;
  articles: number[]; // 근거 조항
  when: string;
  writer: string;
  stage: string; // 학생 여정 중 쓰이는 단계
  web?: string; // 웹에서 바로 작성하는 위치 설명
  student?: boolean; // 학생 한 명에 대한 서식
  privateForm?: boolean; // 제38조 제2항: 담당 교직원만 열람
  flow?: { href: string; label: string }; // 학칙 절차가 자동으로 붙는 전용 작성 화면
  original?: { label: string; href: string; filename: string }[]; // 학교가 쓰던 원본 양식 (이 서식은 Word를 따로 만들지 않는다)
}

export const FORMS: FormMeta[] = [
  { no: 1, title: '도입 심사표', articles: [12], when: '새 과목·프로그램·행사 제안 시, 매년 12월', writer: '제안자', stage: '학교 운영', web: '서식 템플릿으로 작성' },
  { no: 2, title: '체험 입학 진단·심사표', articles: [15, 28], when: '체험 입학 3주 동안', writer: '담임', stage: '체험입학', web: '서식 템플릿으로 작성, 학생 상세에서 주차별 진단', student: true },
  { no: 3, title: '학습 진도 보고서', articles: [29], when: '매 쿼터 마지막 주', writer: '담임 (과목 평가는 교과 교사)', stage: '재학', web: '학습 진도 보고서 화면 (로드맵·성적 자동)', student: true, flow: { href: '/reports', label: '학습 진도 보고서에서 작성' } },
  { no: 4, title: '생활·훈육 기록지', articles: [31, 32, 33, 38], when: '지도 사유 발생 당일', writer: '발견한 교사', stage: '재학', web: '생활 기록 화면 (지도 단계 자동 계산) 또는 서식 템플릿', student: true, privateForm: true, flow: { href: '/records/life', label: '생활 기록에서 작성' } },
  { no: 5, title: '졸업 심사표', articles: [16, 30], when: '졸업 심사 시', writer: '담임, 전 교사', stage: '졸업 심사', web: '서식 템플릿으로 작성', student: true },
  { no: 6, title: '과목 운영안', articles: [21], when: '매년 12월', writer: '과목 담당 교사', stage: '학교 운영', web: '과목 운영안 화면 (학사일정 기반 주차별 계획)', flow: { href: '/subjects/plans', label: '과목 운영안에서 작성' } },
  { no: 7, title: '인수인계 확인서', articles: [37], when: '교사 퇴직·업무 변경·담임 교체 시', writer: '인계자, 인수자', stage: '학교 운영', web: '서식 템플릿으로 작성' },
  { no: 8, title: '면담 일지', articles: [33, 35], when: '모든 면담 (정기·학습·지도)', writer: '면담한 교직원', stage: '재학', web: '면담 일지 화면 (제목·단계 자동) 또는 서식 템플릿', student: true, flow: { href: '/records/interviews', label: '면담 일지에서 작성' } },
  { no: 9, title: '입학원서·학부모 질문지', articles: [28], when: '입학 원서 제출 시', writer: '지원자, 학부모', stage: '입학', web: '웹에서 작성 (학생 상세 맨 위에서 바로) 또는 원본 HWP', student: true, original: [{ label: '원본 HWP', href: '/forms/admission/application.hwp', filename: 'HILS 입학원서, 학부모 질문지.hwp' }, { label: 'HWPX', href: '/forms/admission/application.hwpx', filename: 'HILS 입학원서, 학부모 질문지.hwpx' }] },
  { no: 10, title: '자기소개서', articles: [28], when: '입학 원서 제출 시', writer: '지원자', stage: '입학', web: '웹에서 작성 또는 원본 HWP', student: true, original: [{ label: '원본 HWP', href: '/forms/admission/self-intro.hwp', filename: 'HILS 자기소개서.hwp' }, { label: 'HWPX', href: '/forms/admission/self-intro.hwpx', filename: 'HILS 자기소개서.hwpx' }] },
  { no: 11, title: '학부모 서약서 및 동의서', articles: [15, 28, 38], when: '정식 입학 전', writer: '학부모 (만 14세 미만은 법정대리인)', stage: '입학', web: '웹에서 작성 (학생 상세 맨 위에서 바로) 또는 원본 HWP', student: true, original: [{ label: '원본 HWP', href: '/forms/admission/pledge.hwp', filename: 'HILS 학부모 동의서 및 서약서.hwp' }, { label: 'HWPX', href: '/forms/admission/pledge.hwpx', filename: 'HILS 학부모 동의서 및 서약서.hwpx' }] },
];
