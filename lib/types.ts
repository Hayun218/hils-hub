// HILS Hub 데이터 모델. Supabase 테이블(supabase/schema.sql)과 1:1로 맞춘다.

export type SchoolLevel = '초등' | '중고등';
export type StudentStatus = '문의' | '체험입학' | '재학' | '졸업' | '퇴교';

export interface Student {
  id: string;
  name: string;
  birthYear: number;
  schoolLevel: SchoolLevel;
  boarding: boolean; // 기숙 여부
  status: StudentStatus;
  homeroom: string; // 담임 교사 id (제35조)
  enLevel?: string; // EN-E · EN-MH · EN-B · EN-A
  mathLevel?: string; // M-A · M-B · M-C · 초등
  admittedAt?: string; // 정식 입학일
  guardian: string;
  guardianPhone: string;
  consent: boolean; // 학생 기록 수집·이용 동의 (제28조 제4항)
  devicesSubmitted: boolean; // 전자기기 제출 (제31조 제2항)
  gedThisQuarter?: boolean; // 이번 쿼터 검정고시 응시 (제24조 제3항: 개별 시간표)
  gender?: Gender; // 당번표 성비 맞추기
  classGroup?: string; // 반: 어니스트반(초등) · 드림반(중등) · 콜링반(고등)
  dutyExempt?: boolean; // 당번표에서 제외
  leaveType?: LeaveType; // 퇴교 구분 (제34조)
  statusDate?: string; // 상태가 바뀐 날 (퇴교일·졸업일 등)
  statusReason?: string; // 퇴교·졸업 등 상태 사유
  note?: string; // 비고
  gedLevels?: GedLevel[]; // 검정고시 응시 대상 (초졸·중졸·고졸)
  archiveUrl?: string; // 재학이 아닐 때 기록 묶음(ZIP)을 올린 드라이브 링크
  archivedAt?: string;
  personalTimetable?: '편집 중' | '고정'; // 개인 시간표 상태 (제24조 제3항 개별 시간표 등)
}

export type GedLevel = '초졸' | '중졸' | '고졸';
export type GedStatus = '응시 예정' | '합격' | '불합격' | '일부 과목 합격';
/** 검정고시 실제 응시 기록과 성적표 (모의 진단평가는 GradeSheet) */
export interface GedExam {
  id: string;
  studentId: string;
  level: GedLevel;
  round: string; // 예: 2027년 제1회
  date: string;
  status: GedStatus;
  scores: Record<string, string>; // 과목 → 점수
  electives?: string; // 선택 과목 이름
  reportUrl?: string; // 성적표 드라이브 링크
  reportFile?: { name: string; type: string; dataUrl: string }; // 작은 성적표 파일 (시안: 브라우저 저장)
  note?: string;
}

/** 제34조 제1항: 자퇴 = 보호자 신청(제1호), 퇴학 = 학교장 결정(제2호). 전학은 학칙에 없는 운영 구분 */
export type LeaveType = '자퇴' | '퇴학' | '전학';

export type Gender = '남' | '여';

export type StaffRole = '학교장' | '목사' | '교사' | '행정';
export interface Teacher {
  id: string;
  name: string;
  subjects: string[];
  areas: string[]; // 운영 영역 (제35조 제4항): 교육과정 · 생활교육 · 행정·대외협력, (정)/(부)
  role?: StaffRole;
  homeroomFor?: '초등' | '중고등'; // 맡는 담임. 없으면 담임 안 함 (제35조 제3항)
  leaving?: boolean; // 다음 학년도 이직 예정
  strengths?: string[]; // Gallup 강점 TOP 5 (역할 배치 참고)
  note?: string;
}

export type RecordType =
  | 'diagnosis' // 진단 (별지 2)
  | 'level' // 레벨 변경
  | 'reading' // 독서 기록
  | 'merit' // 상점 (별표 8)
  | 'demerit' // 벌점 (별표 8)
  | 'incident' // 지도 사유 (별지 4)
  | 'interview'; // 면담 일지 (별지 8)

export type InterviewKind = '정기' | '학습' | '지도';
export type IncidentReason = '제32조 행동' | '전자기기' | '벌점 누적' | '기타';

export interface StudentRecord {
  id: string;
  studentId: string;
  type: RecordType;
  date: string; // YYYY-MM-DD
  title: string;
  author: string; // 교사 id
  private: boolean; // 비공개 기록 (제38조 제2항): 학부모 일지에 넣지 않는다
  data: Record<string, string | number | boolean>;
}

/** 비품 구입: 신청 → 확인(OK, 회계 관리자) → 구입 완료(✅) → 전표 등록. 반려 가능 (Slack #비품구입 절차를 옮김) */
export type PurchaseStatus = '신청' | '승인' | '반려' | '구매완료' | '전표등록';

export interface PurchaseRequest {
  id: string;
  date: string; // 신청일
  item: string; // 신청 물품
  quantity?: string; // 수량 (예: 3set, 1 set = 4개)
  amount: number; // 예상 금액 (범위면 큰 값)
  amountMin?: number; // 예상 금액 범위의 작은 값
  vendor?: string; // 구입처
  category: string; // 예산 항목
  reason: string; // 구입 목적
  requester: string; // Teacher.id
  status: PurchaseStatus;
  decidedBy?: string;
  decidedAt?: string;
  rejectReason?: string;
  purchasedBy?: string; // 구입한 교직원
  purchasedAt?: string;
  actualAmount?: number; // 실제 금액
  purchaseNote?: string; // 대체 구입 등 (예: 1.0이 없어서 다른 제품)
  voucher?: {
    no: string;
    date: string;
    method: '법인카드' | '계좌이체' | '현금';
    vendor: string;
    amount: number;
  };
}

// ───────── 교직원 계정 (시안: localStorage, 운영: Supabase auth.users + staff) ─────────

export type AccountStatus = '대기' | '승인' | '거절';
export type Permission = 'admin' | 'hakchik' | 'students' | 'private' | 'accounting' | 'schedule';

export interface Account {
  id: string;
  email: string;
  name: string;
  status: AccountStatus; // 가입 → 관리자 승인 후 사용
  permissions: Permission[];
  teacherId?: string; // 연결된 교사 (Teacher.id)
  createdAt: string;
  approvedBy?: string; // Account.id
  salt: string; // 시안 전용: 비밀번호 해시. 운영에서는 Supabase Auth가 맡는다
  hash: string;
}

// ───────── 학습 진도 보고서 (학부모 전달용, reference/private/2025-1학기-3월-학습진도보고서-원본.docx) ─────────

export type RoadmapState = '진행중' | '이수완료' | '면제';

/** 로드맵 양식 (학교 공통). 고치면 모든 학생 보고서에 함께 적용된다. r: 행 범위, c: 열 범위 (0부터, 끝 포함) */
export interface RoadmapItem { id: string; label: string; r: [number, number]; c: [number, number] }
export interface RoadmapDef {
  id: string;
  subject: string;
  title: string;
  level: '전체' | '초등' | '중고등'; // 새 보고서에 기본으로 넣는 대상
  cols: string[];
  rowLabels: { label: string; r: [number, number] }[];
  rows: number;
  items: RoadmapItem[];
}
export interface ReportTemplate {
  title: string; // 보고서 제목
  elemSubjects: string[]; // 초등 과목 평가 기본 과목
  secSubjects: string[]; // 중고등 과목 평가 기본 과목
}
export interface RoadmapCell { state: RoadmapState; date?: string } // date: 이수 완료일
/** 학생별 로드맵 진도: itemId → 상태 (lib/roadmaps.ts). 달이 바뀌어도 이어진다 */
export type RoadmapProgress = Record<string, RoadmapCell>;

export type ReportStatus = '작성중' | '검토완료' | '발송';
export interface ProgressReport {
  id: string;
  studentId: string;
  period: string; // 'YYYY-Qn' 쿼터 (제29조). 예전 기록은 'YYYY-MM'
  date: string; // 보고서 날짜
  sections: { grades: boolean; career: boolean; life?: boolean }; // life: 상점·벌점 합계 (제31조 제6항)
  roadmapsOff: string[]; // 이 보고서에서 뺀 로드맵 id
  comments: { subject: string; text: string }[]; // 과목 평가
  career: string; // 진로·입시 (고등)
  status: ReportStatus;
  snapshot?: RoadmapProgress; // 발송 시점의 로드맵 (지난 보고서가 바뀌지 않게)
  updatedAt: string;
}

// ───────── 과목 운영안 (별지 6, 제21조): 실라버스 + 주차별 계획 ─────────

export interface SyllabusWeek { topic: string; task: string; note?: string } // note: 학사일정 칸에 직접 적은 내용
export interface SyllabusPlan {
  id: string;
  subject: string;
  target: string; // 대상: 반·레벨 (예: 콜링반, EN-B)
  year: number;
  teacher: string; // Teacher.id
  status: '작성중' | '검토' | '승인'; // 제21조 제2항: 교육과정 담당 검토 → 학교장 승인
  goal: string; // 졸업 시점의 목표 (별표 2)
  profile: string; // 연결되는 졸업생 상 (별표 1)
  levels: string; // 레벨 정의 (별표 7)
  method: string; // 수업 방식
  textbooks: string;
  readings: string; // 필독서·독서와의 연결
  evaluation: { diagnosis: string; formative: string; final: string };
  blocks: Record<number, number>; // 쿼터 → 주당 블록 (별표 4)
  focus: Record<number, string>; // 쿼터 → 중점 내용
  weekly: Record<string, SyllabusWeek>; // 'q-주차' → 계획
  notes: string; // 운영상 필요 사항
  updatedAt: string;
}

// ───────── 연도별 보관 (지난 학년도 교과 로드맵·시간표 보기) ─────────

export interface ArchiveEntry {
  id: string;
  kind: 'roadmaps' | 'timetable';
  year: number;
  label: string; // 예: 2027학년도, 2027학년도 1쿼터
  data: unknown; // roadmaps: RoadmapDef[] / timetable: TimetableBlock[]
  savedAt: string;
}

// ───────── 학사일정 ─────────

export interface CalendarEvent { id: string; start: string; end?: string; title: string; kind: '학사' | '방학' | '휴일' | '행사' | '검정고시' | '상담'; note?: string }

// ───────── 시간표 블록 (자동 생성 후 직접 편집) ─────────

export interface TimetableBlock {
  id: string;
  day: number; // 0 월 … 6 일
  start: string; // 'HH:MM'
  end: string;
  subject: string;
  group: string; // 대상 이름 (전체, 초등, 중고등, 레벨 그룹, 학생 이름)
  students: string[]; // 대상 학생 id
  teacher?: string; // Teacher.id
  room?: string;
  note?: string;
  fixed?: boolean; // 고정 일과 (제26조 제1항)
  owner?: string; // 학생 개인 시간표 블록이면 그 학생 id (공통 시간표는 없음)
}

// ───────── 출석 (제31조 제7항·제8항) ─────────

export type AttendanceStatus = '출석' | '지각' | '결석' | '조퇴' | '외출';
export interface AttendanceEntry { status: AttendanceStatus; note?: string }

// ───────── 성적 (단원평가, 영단어, 검정고시 진단평가 등). 진도 보고서에 자동으로 들어간다 ─────────

export type GradeKind = '단원평가' | '영단어' | '검정고시 진단평가' | '모의고사' | '기타';
export interface GradeSheet {
  id: string;
  kind: GradeKind;
  subject: string;
  title: string; // 예: 수와 연산 3-2 4단원 분수 1회, Word Building 1015, 24-1회차
  date: string;
  columns: string[]; // 점수 칸. 단원평가 ['점수'], 검정고시 ['국어','사회','수학','과학','도덕','영어']
  max?: number; // 만점
  students: string[];
  scores: Record<string, Record<string, string>>; // studentId → 칸 → 점수
  author?: string;
}

// ───────── 별지 서식 기록 (content/forms/byeolji-N.md 템플릿으로 작성) ─────────

export type FormValue = string | boolean | string[] | string[][];
export interface FormRecord {
  id: string;
  formNo: number;
  title: string;
  studentId?: string;
  date: string;
  author: string; // 작성한 교직원 이름
  values: Record<string, FormValue>;
  status: '작성중' | '완료';
  private: boolean; // 제38조 제2항
  updatedAt: string;
}

export interface HubState {
  students: Student[];
  teachers: Teacher[];
  records: StudentRecord[];
  purchases: PurchaseRequest[];
  progress: Record<string, RoadmapProgress>; // studentId → 로드맵 진도
  reports: ProgressReport[];
  prayers: Record<string, string>; // period → 기도제목 (그 쿼터 모든 보고서에 공통)
  timetable: TimetableBlock[];
  attendance: Record<string, Record<string, AttendanceEntry>>; // date → studentId → 출결
  grades: GradeSheet[];
  forms: FormRecord[];
  gedExams: GedExam[];
  syllabi: SyllabusPlan[];
  archives: ArchiveEntry[];
  calendar: CalendarEvent[]; // 학사일정 (기본: 2027학년도, lib/calendar.ts)
  calendarTheme?: string;
  roadmaps: RoadmapDef[]; // 보고서 공통 양식
  reportTemplate: ReportTemplate;
}
