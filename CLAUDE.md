# HILS Hub · 작업 규칙

대안교육기관 HILS(초1–고3, 학생 20명 내외, 교사 5명)의 학교 운영 시스템. 학칙("HILS 교육 방향성")이 기준이고, 시스템은 학칙을 그대로 실행하는 도구다.

## 기준 (SOT)

- 학칙 원문: `content/hakchik.md`. 학칙 내용을 코드 쪽에서 임의로 바꾸지 않는다. 규칙이 학칙과 다르면 코드를 학칙에 맞춘다.
- 학칙 규칙의 코드 구현: `lib/rules.ts` (지도 단계, 쿼터, 메릿·디메릿 항목, 면담 제목), `lib/store.tsx` (디메릿 → 지도 사유 자동 생성), `lib/generators.ts` (시간표·당번표).
- 조문 앵커 규칙: `제N조` → `#artN`, `별표 N` → `#bpN`, `별지 N` → `/forms/N` (`lib/markdown.tsx`의 `anchorFor`).
- 데이터 모델: `lib/types.ts` ↔ `supabase/schema.sql`은 1:1. 한쪽을 바꾸면 다른 쪽도 바꾼다.

## 꼭 지킬 것

- **개인정보**: 시연 데이터는 가상 이름만. 실제 학생 이름, 관찰 기록, 연락처를 코드·커밋·이슈에 넣지 않는다. 실제 명단·당번표·개인 일과표는 `reference/private/`(git 제외)에만 두고, `/api/roster`가 `roster.csv`를 읽어 쓴다.
- **비공개 기록** (제38조): 지도 사유(`incident`)와 지도 면담(`interview`, kind=지도)은 항상 `private: true`. 학부모 월간 일지(`/reports`)와 쿼터 보고서에 절대 들어가면 안 된다.
- **색**: `app/globals.css`의 BI 변수만 사용. deep green `#124046`이 기본, `#1E8D8B`는 큰 글자·아이콘에만, 노란색 `#FFC90F`은 배경·강조선에만 (글자색 금지).
- **문구**: 화면 문구는 한국어, 학칙 용어 그대로 (메릿·디메릿, 지도 사유, 담임, 쿼터, 별지, 별표).
- **고정 서식 (바꾸지 않는다)**: 학교가 쓰던 원본 양식을 따른 다음 화면·서식은 사용자가 요청하지 않는 한 모양과 문구를 바꾸지 않는다.
  - 학습 진도 보고서 (`components/ReportSheet.tsx`, `components/Roadmap.tsx`, 원본 `reference/private/2025-1학기-3월-학습진도보고서-원본.docx`). 로드맵 틀은 교과 로드맵 화면에서만 고친다.
  - 시간표 인쇄 양식 (`components/PosterHeader.tsx`, `.poster` 스타일, 원본 `reference/private/2026-2쿼터-개인일과표-*.webp`)
  - 입학원서·학부모 질문지(별지 9), 학부모 서약서 및 동의서(별지 11): 원본 `reference/admission/*.hwp` 문구 그대로. 내려받기는 원본 HWP(`public/forms/admission`)이고 Word를 만들지 않는다.
- **레퍼런스는 실제 자료다**: `reference/`(명단·교직원·학사일정·입학 서류·보고서 원본 등)와 화면에서 입력한 기록은 Supabase로 옮길 때 그대로 가져간다 (`reference/README.md`의 이관 목록).
- 한 번에 크게 바꾸지 않는다. 변경마다 무엇을 왜 바꿨는지 짧게 남긴다.

## 현재 상태 (2차 시안)

- Next.js 15 App Router + React 19, 저장소는 localStorage (`hils-hub-demo-v2`). 기획을 다듬는 동안 데이터 연동은 미루고, 나중에 Supabase로 한꺼번에 옮긴다 (`supabase/schema.sql`는 `lib/types.ts`와 맞춰 둠).
- 메뉴(`components/Shell.tsx`): 대시보드 / 학생관리(명단, 출석, 면담 일지, 생활 기록, 학교생활기록부, 졸업 요건·과제) / 교과관리(교과 로드맵(+교재), 과목 운영안, 시간표, 진단평가, 성적 입력, 학습 진도 보고서) / 행정관리(학사일정, 당번표) / 회계(구입 신청 · 결재·구입 처리 · 회계 장부, 권한 없는 메뉴는 숨기고 하나만 남은 묶음은 바로 링크) / 학칙·서식 / 계정관리(교직원·담임, 계정 승인·권한).
- 로그인·가입 승인·권한은 목업 (`lib/auth.tsx`, `lib/permissions.ts`). 시안 단계라 개발 서버와 Vercel 배포 모두 "관리자"로 자동 진입하고 화면 위에 시안 안내 띠가 있다 (`NEXT_PUBLIC_AUTO_ADMIN=off`로 끔, Supabase Auth 때 없앤다). 초기 아이디·비밀번호는 없다. 권한은 관리자·학칙 편집만 화면에서 막고, 나머지는 Supabase RLS 때 적용.
- 실제 명단: `reference/private/roster.csv`, `staff.csv` (git 제외)를 `/api/roster`가 읽는다. 저장된 데이터가 있으면 비어 있는 칸(성별, 교직원)만 채운다. roster.csv의 `id` 열이 학생 기록과 연결되는 번호라 줄을 지워도 바뀌지 않는다. 명단에서 지운 학생(자퇴 등)은 저장된 기록과 함께 빠진다. 시연 데이터(`lib/seed.ts`)는 가상 학생 20명, 담임 4명(초등 1 · 중고등 3, 1인 5명).
- 학습 진도 보고서 (`/reports`, 별지 3, 쿼터마다 — 학칙 0.9.7): 로드맵 양식은 학교 공통(`hub.roadmaps`, `/subjects/roadmap` 교과 로드맵), 학생별 진도는 `hub.progress`, 성적은 `/records/grades`, 메릿·디메릿 합계는 학생 기록에서 자동. 비공개 기록(제38조)은 들어가지 않는다.
- 별지 서식 (`/forms/[no]`): `content/forms/byeolji-N.md`를 `lib/formTemplate.ts`가 입력 템플릿으로 바꾼다. 웹 작성 기록 + Word 내려받기(`lib/formDocx.ts`, docx 패키지).
- 시간표 (`/admin/timetable`): 학칙 기준 자동 생성 → 블록 끌기·늘리기·추가. 학칙과 다르면 `lib/timetable.ts` checkRules가 경고만 한다. 별표 5 시간은 `lib/rules.ts` CLASS_HOURS 한 곳.
- 담임 배정: `lib/homeroom.ts` (제35조 제3항). 학교장·목사님·행정은 담임 목록에서 뺀다.
- 학생 상세: 맨 위 입학원서(별지 9)·학부모 서약서(별지 11) 카드, 여정 막대를 누르면 전체 흐름, 검정고시(초졸·중졸·고졸, `components/GedPanel.tsx`: 성적표 PDF는 브라우저에서 pdf.js로 읽어 점수표를 채우고(`lib/pdfText.ts`, `lib/gedParse.ts`, AI 없음), 사진·스캔본만 AI), 재학이 아니면 기록 전체 ZIP + 드라이브 링크.
- 기록 ZIP (`lib/archive.ts`, 문서는 `lib/archiveDocs.ts`): `학적/`(학생정보·입학서류·검정고시·졸업 지표) · `NNNN학년도/`(생기부, `교과/` 진단평가·성적표·진도 보고서, `생활/` 출석부·생활기록·면담 일지) · `졸업과제/` · `비공개_제38조/` · `원자료/`. 쿼터·날짜는 파일 이름에. 문서는 Word.
- 학교생활기록부 (`/records/schoolrecord`): 학교가 쓰던 학교생활세부사항기록부(학교생활기록부 Ⅱ) 8개 항목 구성(`lib/schoolRecordModel.ts`), 항목별 작성 요령과 가상 학생 예시, Word(`lib/schoolRecord.ts`). 원본(블라인드)은 `reference/private/`에만.
- 졸업·수료 지표 (`/students/graduation`, `lib/graduation.ts`): 별표 2. 어니스트반=초등 수료, 드림반=중등 수료, 콜링반=고등 졸업. 학기 말(6·12월) 점검(제16조 제5항). 3P 바인더 등 매일 일과는 지표가 아니라 상시 기준(제16조 제6항). 독서록 양식(`components/ReadingLogPaper.tsx`), 포트폴리오는 PDF만.
- 교과 로드맵 (`/subjects/roadmap`, 예전 `/reports/template`은 이동): 커리큘럼 설계만. 표는 열 이름으로 학교급 띠(초등·중등·고등, `lib/roadmaps.ts` bandOf)를 얹어 보여 준다. 학습 진도 보고서는 원본 서식이라 띠·색 없이 예전 표 그대로 (`bands={false}`). 화면은 과목 탭 → 초등·중등·고등 탭(`components/RoadmapBand.tsx`: 과정 안내(목표·학습 방법·수업 운영·평가, `RoadmapDef.guides`) · 그 학교급 열만 뗀 표 · 그 과정 교재) + "전체 표 편집" 탭(엑셀식 편집). 보고서 제목·과목 평가 기본 과목은 학습 진도 보고서 화면의 "보고서 설정"(`components/ReportSettings.tsx`).
- 교재 (`/subjects/books`, 메뉴 없이 교과 로드맵·과목 운영안에서 들어감, `app/api/books`): 교과·학년(레벨)별 교재, 학년도가 바뀌면 한 번 최신판 자동 확인과 구매 링크. `ALADIN_TTB_KEY` 또는 `KAKAO_REST_API_KEY`가 있어야 자동 확인 (Google Books 키 없이는 한도 초과가 잦음), 없으면 서점 검색 링크.
- 진단평가 (`/records/diagnosis`, `lib/diagnosis.ts`): 문해력·영어·수학. 정기(매년 1쿼터 첫 주, 전원) · 입학(입학 첫 주) · 추가(학생이 쿼터별 담임 정기 면담에서 신청, 담임이 시행 결정, 학기마다 1회까지, 레벨 이동은 다음 쿼터 첫 주) (제20조, 별표 7 제4호 초안). 회차별 문항지·결과 보관, 판정 레벨을 학생 레벨에 반영. 단원평가는 성적 입력.
- 대시보드 주기별 할 일 (`components/CadenceTodos.tsx`): 매일 출석 · 쿼터 정기 면담·성적·진도 보고서 · 학기 생기부·졸업 지표 점검. 담임 계정이면 내 담임 학생만.
- AI (`lib/ai.ts`, `app/api/ai/*`): OpenAI Responses API를 fetch로 호출 (SDK 없음). 생기부 초안·성적표 읽기·검정고시 사진 읽기. `OPENAI_API_KEY` 필요, 모델은 `OPENAI_MODEL` (기본 gpt-5). 학생 이름은 '학생'으로 바꾸고 비공개 기록은 보내지 않는다.
- 별지 원문 1–7은 읽기 전용 파일이었다. 별지 3은 0.9.7에서 쓰기 허용 후 교체.
- 연도별: 학사일정은 날짜로 학년도가 나뉘고(지난해 원본 이미지는 `public/calendar/연도.png`), 교과 로드맵·시간표는 보관함(`hub.archives`), 과목 운영안은 학년도 필드로 쌓인다.
- 회계(`/admin/accounting`): 신청(모두) → 확인 OK·반려 → 구입 완료 ✅ → 전표, 전체 장부·CSV는 회계 승인 권한. Slack #비품구입 신청 글 붙여넣기.
- 학칙 편집: `/hakchik/edit` → `content/hakchik.md`에 직접 쓴다 (개발 서버에서만, `.hakchik-history/`에 백업). 완성본 전이라 개정 이력 표는 지웠고 남기지 않는다 (사용자 요청).
- 학칙과 실제 운영이 다른 곳: `reference/README.md` 표. 학칙 원문은 사용자가 정한 뒤 고친다.
- 시연 기준일 `DEMO_TODAY = 2027-03-16`. 명단은 26학년도 학년이라 2027학년도 기준으로 한 학년씩 올라가 보인다.
- `npm run typecheck` 통과. 빌드 시 타입 검사는 켰고 린트는 eslint 설정 전까지 끈 상태.

## 다음 작업 후보

1. 설치·빌드·타입 오류 정리, git 첫 커밋
2. Supabase 연결 (`lib/store.tsx` 내부 교체, 함수 이름 유지), 교직원 매직링크 로그인, RLS
3. 쿼터 성장 보고서(별지 3) 자동 생성, 졸업 심사(별지 5) 화면
4. 학생 상세에서 검정고시 응시 여부·담임 변경 (담임 2년 연속 금지 검사, 제35조)
5. 월간 일지 이메일 발송, 전표 사진 업로드
6. Vercel 배포
