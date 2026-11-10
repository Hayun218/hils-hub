-- HILS Hub · Supabase 스키마 (초안)
-- lib/types.ts와 1:1로 맞춘다. 운영 전환 시 Supabase SQL Editor에서 실행.
-- 근거: 학칙 제28조 제4항(기록 동의), 제35조(담임), 제38조(기록 관리·비공개)

create extension if not exists "pgcrypto";

-- 교직원 (auth.users와 연결)
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  subjects text[] not null default '{}',
  areas text[] not null default '{}',           -- 운영 영역: 교육과정 / 생활교육 / 행정·대외협력 (정·부)
  role text not null default '교사' check (role in ('교사', '학교장', '목사', '행정')),
  homeroom_for text check (homeroom_for in ('초등', '중고등')), -- 맡는 담임 (제35조 제3항)
  leaving boolean not null default false,       -- 다음 학년도 이직 예정
  strengths text[] not null default '{}',       -- Gallup 강점 TOP 5 (역할 배치 참고, 담당 교직원만)
  note text,
  active boolean not null default true,
  email text,
  status text not null default '대기' check (status in ('대기', '승인', '거절')), -- 가입 후 관리자 승인
  permissions text[] not null default '{}',     -- admin, hakchik, students, private, accounting, schedule (lib/permissions.ts)
  approved_by uuid references staff (id),
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_year int not null,
  school_level text not null check (school_level in ('초등', '중고등')),
  boarding boolean not null default true,
  status text not null default '문의' check (status in ('문의', '체험입학', '재학', '졸업', '퇴교')),
  homeroom uuid references staff (id),
  en_level text,
  math_level text,
  admitted_at date,
  guardian text,
  guardian_phone text,
  guardian_email text,
  consent boolean not null default false,       -- 제28조 제4항
  devices_submitted boolean not null default false, -- 제31조 제2항
  ged_this_quarter boolean not null default false,  -- 제24조 제3항
  gender text check (gender in ('남', '여')),        -- 당번표 성비
  class_group text,                                 -- 어니스트반 · 드림반 · 콜링반
  duty_exempt boolean not null default false,       -- 당번표 제외
  leave_type text check (leave_type in ('자퇴', '퇴학', '전학')), -- 퇴교 구분 (제34조)
  status_date date,                                 -- 퇴교일·졸업일 등
  status_reason text,                               -- 상태 사유
  note text,                                        -- 비고
  ged_levels text[] not null default '{}',          -- 검정고시 응시 대상: 초졸·중졸·고졸
  archive_url text,                                 -- 재학이 아닐 때 기록 묶음(ZIP) 드라이브 링크
  archived_at date,
  personal_timetable text check (personal_timetable in ('편집 중', '고정')),
  created_at timestamptz not null default now()
);

-- 담임 지정 이력 (제35조 제3항: 매년 새로 지정, 2년 연속 금지)
create table if not exists homeroom_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  staff_id uuid not null references staff (id),
  school_year int not null,
  unique (student_id, school_year)
);

-- 학생 기록: 진단·레벨·독서·메릿·디메릿·지도 사유·면담을 한 테이블에
create table if not exists student_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  type text not null check (type in ('diagnosis', 'level', 'reading', 'merit', 'demerit', 'incident', 'interview')),
  date date not null,
  title text not null,
  author uuid references staff (id),
  private boolean not null default false,       -- 제38조: 지도 사유·지도 면담은 비공개
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists student_records_student_date on student_records (student_id, date desc);

-- 지도 사유는 항상 비공개
create or replace function force_private() returns trigger language plpgsql as $$
begin
  if new.type = 'incident' or (new.type = 'interview' and new.data ->> 'kind' = '지도') then
    new.private := true;
  end if;
  return new;
end $$;
drop trigger if exists student_records_private on student_records;
create trigger student_records_private before insert or update on student_records
  for each row execute function force_private();

-- 회계: 구입 신청 → 승인 → 구매 → 전표
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  item text not null,
  amount int not null check (amount >= 0),
  category text not null,
  reason text,
  quantity text,
  amount_min int,
  vendor text,
  requester uuid references staff (id),
  status text not null default '신청' check (status in ('신청', '승인', '반려', '구매완료', '전표등록')),
  decided_by uuid references staff (id),
  decided_at date,
  reject_reason text,
  purchased_by uuid references staff (id),
  purchased_at date,
  actual_amount int,
  purchase_note text,
  voucher jsonb,                                -- {no, date, method, vendor, amount, file_path}
  created_at timestamptz not null default now()
);

-- 학습 진도 보고서 (학부모 전달용). 로드맵 진도는 학생별로 이어지고, 보고서는 그달의 평가와 점수를 담는다
create table if not exists roadmap_progress (
  student_id uuid not null references students (id) on delete cascade,
  item_id text not null,                        -- lib/roadmaps.ts 항목 id
  state text not null check (state in ('진행중', '이수완료', '면제')),
  date date,                                    -- 이수 완료일
  primary key (student_id, item_id)
);

create table if not exists progress_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  period text not null,                         -- 'YYYY-Qn' 쿼터 (제29조)
  date date not null,
  sections jsonb not null default '{}',         -- {grades, career, life}
  roadmaps_off text[] not null default '{}',    -- 이 보고서에서 뺀 로드맵
  comments jsonb not null default '[]',         -- [{subject, text}] 과목 평가 (성적은 grade_sheets에서 자동)
  career text not null default '',
  status text not null default '작성중' check (status in ('작성중', '검토완료', '발송')),
  snapshot jsonb,                               -- 발송 시점 로드맵
  updated_at timestamptz not null default now(),
  unique (student_id, period)
);

-- 보고서 공통 양식: 교과별 로드맵 틀과 기본 과목. 고치면 모든 보고서에 적용
create table if not exists report_templates (
  id text primary key default 'default',
  title text not null,
  elem_subjects text[] not null default '{}',
  sec_subjects text[] not null default '{}',
  roadmaps jsonb not null default '[]'          -- [{id, subject, title, level, cols, rowLabels, rows, items}]
);

create table if not exists report_prayers (
  period text primary key,                      -- 그달 모든 보고서에 공통인 기도제목
  text text not null default ''
);

-- 출석 (제31조 제7항·제8항)
create table if not exists attendance (
  date date not null,
  student_id uuid not null references students (id) on delete cascade,
  status text not null check (status in ('출석', '지각', '결석', '조퇴', '외출')),
  note text,
  primary key (date, student_id)
);

-- 성적: 단원평가·영단어·검정고시 진단평가 등. 진도 보고서에 자동으로 들어간다
create table if not exists grade_sheets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('단원평가', '영단어', '검정고시 진단평가', '모의고사', '기타')),
  subject text not null,
  title text not null,
  date date not null,
  columns text[] not null default '{점수}',
  max int,
  students uuid[] not null default '{}',
  scores jsonb not null default '{}',           -- {student_id: {칸: 점수}}
  author uuid references staff (id)
);

-- 검정고시 실제 응시 기록과 성적표 (모의 진단평가는 grade_sheets)
-- 교재 소개: 교과 로드맵의 교과·학년과 연결. 매년 최신판·구매 링크 확인 (/api/books)
create table if not exists textbooks (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  target text,                                  -- 학년·레벨
  use text not null default '주교재' check (use in ('주교재', '부교재', '필독서', '검정고시', '참고')),
  title text not null,
  author text,
  publisher text,
  isbn text,
  date text,                                    -- 쓰는 판의 발행일
  link text,                                    -- 구매 링크
  price text,
  cover text,
  note text,
  checked_year int,
  checked_at timestamptz,
  newer jsonb                                   -- 더 새 판 후보 {title, author, publisher, date, isbn, link, price, cover, source}
);

-- 진단평가 (제20조, 별표 7 제4호): 문해력·영어·수학. 정기(매년 1쿼터 첫 주), 입학(입학 첫 주), 추가(학생 신청 + 담임 결정, 학기마다 1회까지)
create table if not exists diagnostic_exams (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject in ('문해력', '영어', '수학')),
  round text not null check (round in ('정기', '추가', '입학')),
  date date not null,
  title text not null,
  place text,
  teacher_id uuid references staff (id),
  form text check (form in ('가형', '나형')),
  sections jsonb not null default '[]',         -- 평가 영역
  files jsonb not null default '[]',            -- 문항지·정답: [{path, name}] (Supabase Storage)
  note text
);
create table if not exists diagnostic_results (
  exam_id uuid not null references diagnostic_exams (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  scores jsonb not null default '{}',           -- {영역: 점수}
  level text,                                   -- 판정
  gaps text,                                    -- 빈 단원
  note text,
  applied boolean not null default false,       -- 학생 레벨에 반영
  primary key (exam_id, student_id)
);

create table if not exists ged_exams (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  level text not null check (level in ('초졸', '중졸', '고졸')),
  round text not null,                          -- 예: 2027년 제1회
  date date not null,
  status text not null default '응시 예정' check (status in ('응시 예정', '합격', '불합격', '일부 과목 합격')),
  scores jsonb not null default '{}',           -- {과목: 점수}
  electives text,
  report_url text,                              -- 성적표 드라이브 링크
  report_file text,                             -- 성적표 파일: Supabase Storage 경로 (시안: reportFileId·reportFileName)
  note text
);

-- 별지 서식 기록 (content/forms/byeolji-N.md 템플릿으로 작성)
create table if not exists form_records (
  id uuid primary key default gen_random_uuid(),
  form_no int not null check (form_no between 1 and 11),
  title text not null,
  student_id uuid references students (id) on delete set null,
  date date not null,
  author text not null,
  values jsonb not null default '{}',
  status text not null default '작성중' check (status in ('작성중', '완료')),
  private boolean not null default false,       -- 제38조 제2항: 별지 4, 별지 8 지도 면담
  updated_at timestamptz not null default now()
);

-- 과목 운영안 (별지 6, 제21조): 실라버스와 주차별 계획
create table if not exists syllabus_plans (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  target text not null default '',
  year int not null,
  teacher uuid references staff (id),
  status text not null default '작성중' check (status in ('작성중', '검토', '승인')),
  content jsonb not null default '{}',          -- goal, profile, levels, method, textbooks, readings, evaluation, blocks, focus, notes
  weekly jsonb not null default '{}',           -- {"쿼터-주차": {topic, task}}
  updated_at timestamptz not null default now()
);

-- 학교생활기록부 (학년도별, 모든 학교급). 항목은 교육부 기재요령
create table if not exists school_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  year int not null,
  content jsonb not null default '{}',          -- special, attendanceNote, awards[], certificates[], activities{autonomy,club,career}, volunteer[], subjects[{kind, semester, area, subject, units, score, achievement, rank, detail}], reading[], behavior
  status text not null default '작성중' check (status in ('작성중', '검토', '확정')),
  updated_at timestamptz not null default now(),
  unique (student_id, year)
);

-- 졸업 과제 제출 (독서록·포트폴리오 등)과 졸업 요건 확인 (제16조, 별표 2)
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  kind text not null check (kind in ('독서록', '독서 보고서', '포트폴리오', '진로 탐색 보고서', '진로 계획서', '말씀·기도 노트', '프로젝트 결과물', '기타')),
  title text not null,
  author text,
  date date not null,
  file_path text,                               -- Supabase Storage
  url text,
  note text
);
create table if not exists grad_checks (
  student_id uuid not null references students (id) on delete cascade,
  item text not null,                           -- lib/graduation.ts 항목 키
  done boolean not null default false,
  date date,
  note text,
  primary key (student_id, item)
);
create table if not exists grad_settings (     -- 학교급별 기준 (별표 2의2, 제16조 제2항: 매년 12월 확정)
  track text primary key check (track in ('초등', '중등', '고등')),
  reading_count int,
  en_min text,
  math_min text,
  volunteer_hours int
);

-- 연도별 보관: 지난 학년도의 교과 로드맵·시간표
create table if not exists archives (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('roadmaps', 'timetable')),
  year int not null,
  label text not null,
  data jsonb not null,
  saved_at timestamptz not null default now()
);

-- 학사일정 (날짜에 연도가 있어 학년도별로 쌓인다)
create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date,
  title text not null,
  kind text not null check (kind in ('학사', '방학', '휴일', '행사', '검정고시', '상담')),
  note text
);

-- 시간표 블록 (자동 생성 후 직접 편집)
create table if not exists timetable_blocks (
  id uuid primary key default gen_random_uuid(),
  day int not null check (day between 0 and 6), -- 0 월 … 6 일
  start_time time not null,
  end_time time not null,
  subject text not null,
  group_name text not null,
  students uuid[] not null default '{}',
  teacher uuid references staff (id),
  room text,
  note text,
  fixed boolean not null default false,
  owner uuid references students (id) on delete cascade -- 학생 개인 시간표 블록
);

-- 월간 일지 발송 기록
create table if not exists monthly_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  month text not null,                          -- 'YYYY-MM'
  note text,
  status text not null default '작성' check (status in ('작성', '발송준비', '발송')),
  sent_at timestamptz,
  unique (student_id, month)
);

-- ───────── RLS ─────────
alter table staff enable row level security;
alter table students enable row level security;
alter table homeroom_assignments enable row level security;
alter table student_records enable row level security;
alter table purchases enable row level security;
alter table monthly_reports enable row level security;
alter table roadmap_progress enable row level security;
alter table progress_reports enable row level security;
alter table report_prayers enable row level security;
alter table report_templates enable row level security;
alter table timetable_blocks enable row level security;
alter table attendance enable row level security;
alter table grade_sheets enable row level security;
alter table form_records enable row level security;
alter table ged_exams enable row level security;
alter table diagnostic_exams enable row level security;
alter table textbooks enable row level security;
alter table diagnostic_results enable row level security;
alter table calendar_events enable row level security;
alter table syllabus_plans enable row level security;
alter table archives enable row level security;
alter table submissions enable row level security;
alter table school_records enable row level security;
alter table grad_checks enable row level security;
alter table grad_settings enable row level security;

create or replace function me() returns staff language sql stable security definer as $$
  select * from staff where user_id = auth.uid() and active and status = '승인'
$$;

-- 교직원은 모두 학생 명단과 공개 기록을 본다
create policy staff_read_staff on staff for select using ((select me()) is not null);
create policy staff_read_students on students for select using ((select me()) is not null);
create policy staff_write_students on students for all using ((select me()) is not null) with check ((select me()) is not null);
create policy staff_read_homeroom on homeroom_assignments for select using ((select me()) is not null);

-- 비공개 기록: 작성자, 해당 학생 담임, 생활교육 담당, 목사, 학교장만
create policy records_read on student_records for select using (
  (select me()) is not null and (
    not private
    or author = (select (me()).id)
    or (select (me()).role) in ('학교장', '목사')
    or exists (select 1 from staff s where s.id = (select (me()).id) and '생활교육' = any (s.areas))
    or exists (select 1 from students st where st.id = student_id and st.homeroom = (select (me()).id))
  )
);
create policy records_insert on student_records for insert with check ((select me()) is not null and author = (select (me()).id));

-- 회계: 신청은 누구나, 승인·반려는 학교장만 (앱에서도 확인)
create policy purchases_read on purchases for select using ((select me()) is not null);
create policy purchases_insert on purchases for insert with check ((select me()) is not null);
create policy purchases_update on purchases for update using ((select me()) is not null);

create policy reports_all on monthly_reports for all using ((select me()) is not null) with check ((select me()) is not null);

create policy progress_all on roadmap_progress for all using ((select me()) is not null) with check ((select me()) is not null);
create policy preports_all on progress_reports for all using ((select me()) is not null) with check ((select me()) is not null);
create policy prayers_all on report_prayers for all using ((select me()) is not null) with check ((select me()) is not null);
create policy timetable_read on timetable_blocks for select using ((select me()) is not null);
create policy timetable_write on timetable_blocks for all
  using ('schedule' = any ((select me()).permissions) or 'admin' = any ((select me()).permissions))
  with check ('schedule' = any ((select me()).permissions) or 'admin' = any ((select me()).permissions));
create policy attendance_all on attendance for all using ((select me()) is not null) with check ((select me()) is not null);
create policy grades_all on grade_sheets for all using ((select me()) is not null) with check ((select me()) is not null);
create policy forms_read on form_records for select using (
  (select me()) is not null and (not private or 'private' = any ((select me()).permissions) or 'admin' = any ((select me()).permissions))
);
create policy forms_write on form_records for all using ((select me()) is not null) with check ((select me()) is not null);
create policy templates_read on report_templates for select using ((select me()) is not null);
create policy templates_write on report_templates for all
  using ('admin' = any ((select me()).permissions)) with check ('admin' = any ((select me()).permissions));
create policy ged_all on ged_exams for all using ((select me()) is not null) with check ((select me()) is not null);
create policy textbooks_all on textbooks for all using ((select me()) is not null) with check ((select me()) is not null);
create policy diag_exams_all on diagnostic_exams for all using ((select me()) is not null) with check ((select me()) is not null);
create policy diag_results_all on diagnostic_results for all using ((select me()) is not null) with check ((select me()) is not null);
create policy calendar_read on calendar_events for select using ((select me()) is not null);
create policy calendar_write on calendar_events for all using ('admin' = any ((select me()).permissions) or 'schedule' = any ((select me()).permissions)) with check ('admin' = any ((select me()).permissions) or 'schedule' = any ((select me()).permissions));
create policy syllabus_all on syllabus_plans for all using ((select me()) is not null) with check ((select me()) is not null);
create policy archives_all on archives for all using ((select me()) is not null) with check ((select me()) is not null);
create policy submissions_all on submissions for all using ((select me()) is not null) with check ((select me()) is not null);
create policy grad_checks_all on grad_checks for all using ((select me()) is not null) with check ((select me()) is not null);
create policy grad_settings_all on grad_settings for all using ((select me()) is not null) with check ((select me()) is not null);
create policy school_records_all on school_records for all using ((select me()) is not null) with check ((select me()) is not null);
