# HILS Hub · 작업 규칙

대안교육기관 HILS(초1–고3, 학생 20명 내외, 교사 5명)의 학교 운영 시스템. 학칙("HILS 교육 방향성")이 기준이고, 시스템은 학칙을 그대로 실행하는 도구다.

## 기준 (SOT)

- 학칙 원문: `content/hakchik.md`. 학칙 내용을 코드 쪽에서 임의로 바꾸지 않는다. 규칙이 학칙과 다르면 코드를 학칙에 맞춘다.
- 학칙 규칙의 코드 구현: `lib/rules.ts` (지도 단계, 쿼터, 메릿·디메릿 항목, 면담 제목), `lib/store.tsx` (디메릿 → 지도 사유 자동 생성), `lib/generators.ts` (시간표·당번표).
- 조문 앵커 규칙: `제N조` → `#artN`, 부칙 `#add-artN`, `별표 N` → `#bpN`, `별지 N` → `/forms/N` (`lib/markdown.tsx`의 `anchorFor`).
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
- 메뉴(`components/Shell.tsx`): 대시보드 / 학생관리(명단, 출석, 면담 일지, 생활 기록) / 교과관리(교과 로드맵, 과목 운영안, 시간표, 성적 입력, 학습 진도 보고서) / 행정관리(학사일정, 당번표) / 회계(구입 신청·결재·장부) / 학칙·서식 / 계정관리(교직원·담임, 계정 승인·권한).
- 로그인·가입 승인·권한은 목업 (`lib/auth.tsx`, `lib/permissions.ts`). 개발 서버에서는 "관리자"로 자동 진입 (`NEXT_PUBLIC_AUTO_ADMIN=off`로 끔). 권한은 관리자·학칙 편집만 화면에서 막고, 나머지는 Supabase RLS 때 적용.
- 실제 명단: `reference/private/roster.csv`, `staff.csv` (git 제외)를 `/api/roster`가 읽는다. 저장된 데이터가 있으면 비어 있는 칸(성별, 교직원)만 채운다.
- 학습 진도 보고서 (`/reports`, 별지 3, 쿼터마다 — 학칙 0.9.7): 로드맵 양식은 학교 공통(`hub.roadmaps`, `/reports/template` 교과 로드맵), 학생별 진도는 `hub.progress`, 성적은 `/records/grades`, 메릿·디메릿 합계는 학생 기록에서 자동. 비공개 기록(제38조)은 들어가지 않는다.
- 별지 서식 (`/forms/[no]`): `content/forms/byeolji-N.md`를 `lib/formTemplate.ts`가 입력 템플릿으로 바꾼다. 웹 작성 기록 + Word 내려받기(`lib/formDocx.ts`, docx 패키지).
- 시간표 (`/admin/timetable`): 학칙 기준 자동 생성 → 블록 끌기·늘리기·추가. 학칙과 다르면 `lib/timetable.ts` checkRules가 경고만 한다. 별표 5 시간은 `lib/rules.ts` CLASS_HOURS 한 곳.
- 담임 배정: `lib/homeroom.ts` (제35조 제3항). 학교장·목사님·행정은 담임 목록에서 뺀다.
- 학생 상세: 맨 위 입학원서(별지 9)·학부모 서약서(별지 11) 카드, 여정 막대를 누르면 전체 흐름, 검정고시(초졸·중졸·고졸, `components/GedPanel.tsx`), 재학이 아니면 기록 전체 ZIP(`lib/archive.ts`) + 드라이브 링크.
- 별지 원문 1–7은 읽기 전용 파일이었다. 별지 3은 0.9.7에서 쓰기 허용 후 교체.
- 연도별: 학사일정은 날짜로 학년도가 나뉘고(지난해 원본 이미지는 `public/calendar/연도.png`), 교과 로드맵·시간표는 보관함(`hub.archives`), 과목 운영안은 학년도 필드로 쌓인다.
- 회계(`/admin/accounting`): 신청(모두) → 확인 OK·반려 → 구입 완료 ✅ → 전표, 전체 장부·CSV는 회계 승인 권한. Slack #비품구입 신청 글 붙여넣기.
- 학칙 편집: `/hakchik/edit` → `content/hakchik.md`에 직접 쓴다 (개발 서버에서만, `.hakchik-history/`에 백업).
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
