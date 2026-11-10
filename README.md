# HILS Hub

대안교육기관 HILS(Hyoja International Leaders' School, 초1–고3)의 학교 운영 시스템.
학칙 **「HILS 교육 방향성」**(`content/hakchik.md`)이 기준이고, 시스템은 학칙에 정한 절차와 서식(별지·별표)을 그대로 실행하고 기록을 남기는 도구다.

> **현재: 2차 시안.** 기획을 다듬는 단계라 데이터는 브라우저(localStorage)에만 저장한다. 운영 전환 때 Supabase로 한꺼번에 옮긴다 (`supabase/schema.sql`).

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
```

- Node 20 이상 권장
- 개발 서버에서는 로그인 없이 **관리자**로 바로 들어간다. 끄려면 `.env.local`에 `NEXT_PUBLIC_AUTO_ADMIN=off`
- 시연 기준일은 `2027-03-16` (2027학년도 1쿼터, `lib/rules.ts`의 `DEMO_TODAY`)
- 사이드바 아래 "데이터 초기화"로 입력한 기록을 지우고 명단을 처음 상태로 되돌린다 (계정은 그대로)

```bash
npm run typecheck  # 타입 검사
```

## 개인정보

- 코드와 git에는 **실제 학생·교직원 이름을 넣지 않는다.** 실제 명단·교직원 강점·당번표·개인 일과표·학교소개서는 `reference/private/`에 두며 git에서 제외한다.
- `reference/private/roster.csv`, `staff.csv`가 있으면 `/api/roster`가 읽어 명단으로 쓰고, 없으면 가상 시연 데이터(`lib/seed.ts`)로 동작한다.
- 지도 사유(별지 4)와 지도 면담(별지 8)은 항상 비공개이며 학습 진도 보고서에 들어가지 않는다 (학칙 제38조).

## 메뉴와 화면

| 메뉴 | 경로 | 내용 | 학칙 |
| --- | --- | --- | --- |
| 대시보드 | `/` | 내 담임 학생 할 일, 오늘 출석, 진도 보고서 진행, 저녁 설거지(지각), 다가오는 학사일정 | 제35조 |
| **학생관리** | `/students` | 명단, 편집(성별·담임·레벨·학적·검정고시·비고) | 제34조, 제35조 |
| | `/students/[id]` | 학생 대시보드: 입학원서·학부모 서약서, 전체 흐름(문의→졸업), 이번 쿼터 요약, 검정고시, 기록 ZIP 보관 | 제28조 |
| | `/records/attendance` | 일별 출결, 월별 현황, 지각 벌점·저녁 설거지 | 제31조 |
| | `/records/interviews` | 면담 일지 목록 → A4 기록지 (정기·학습·지도, 제목·단계 자동) | 제33조, 제35조, 별지 8 |
| | `/records/life` | 상점·벌점 빠른 입력, 누적 결과, 생활·훈육 기록지(A4) | 제31조–제33조, 별표 8, 별지 4 |
| **교과관리** | `/reports/template` | 커리큘럼 설계: 교과별 로드맵을 엑셀처럼 편집 (병합, ⌘Z) | 제29조 제4항 |
| | `/subjects/plans` | 과목 운영안(실라버스): 목표·교재·평가·학사일정 기반 주차별 계획 | 제21조, 별지 6 |
| | `/admin/timetable` | 학칙 기준 자동 생성 → 블록 편집, 반·개인 시간표, 학칙 검사, A4 가로 한 장 인쇄 | 제24조, 제26조, 별표 5 |
| | `/records/grades` | 단원평가·영단어·검정고시 진단평가 | 제29조 |
| | `/reports` | 학습 진도 보고서 (쿼터마다): 학생별·과목별 작성, 로드맵·평가·상점·벌점 자동 | 제29조, 별지 3 |
| **행정관리** | `/admin/calendar` | 학사일정 (2027 포스터 디자인, 목록 편집, 디자인 제안) | 제24조, 제27조 |
| | `/admin/duty` | 설거지·청소 당번표 (나이·성비 섞기), A4 가로 인쇄 | 제31조 제10항 |
| **회계** | `/admin/accounting` | 구입 신청 → 결재 → 전표 (목업) | |
| **학칙·서식** | `/hakchik`, `/hakchik/edit` | 학칙 전문, 편집 (개정 이력 자동, 백업) | 제5조 |
| | `/forms`, `/forms/[no]` | 별지 1–11: 웹 작성·기록, 원본 미리보기. 1–8은 Word, 9–11(입학 서류)은 원본 HWP | 별지 |
| **계정관리** | `/admin/staff` | 교직원 역할·담임·과목·운영 영역·강점, 담임 자동 배정 (제35조 5명 이내) | 제35조 |
| | `/admin/users` | 가입 승인, 권한 (시안: 목업) | |

## 고정 서식

학교가 쓰던 원본을 따른 다음 서식은 모양과 문구를 바꾸지 않는다.

- 학습 진도 보고서 (`components/ReportSheet.tsx`, 로드맵 틀만 커리큘럼 설계에서 편집)
- 시간표 인쇄 양식 (`components/PosterHeader.tsx`)
- 입학원서·학부모 질문지(별지 9), 학부모 서약서 및 동의서(별지 11) — 원본 `reference/admission/*.hwp`

## 학칙이 코드로 들어간 곳

| 규칙 | 코드 |
| --- | --- |
| 쿼터, 학년 표기, 별표 5 수업 시간, 상점·벌점 항목과 즉시 조치·누적 결과 (별표 8) | `lib/rules.ts` |
| 벌점 5점마다·제32조 행동 → 지도 사유, 면담 단계 (제33조) | `lib/store.tsx` |
| 담임 배정: 초등 별도, 중고등 혼합 연령, 1인 5명 이내 (제35조) | `lib/homeroom.ts` |
| 시간표 자동 생성, 당번표 | `lib/generators.ts`, `lib/timetable.ts` |
| 별지 원문 → 입력 템플릿·Word | `lib/formTemplate.ts`, `lib/formDocx.ts` |
| 학사일정, 쿼터 주차 | `lib/calendar.ts`, `lib/weeks.ts` |
| 조문 ↔ 화면 연결 | `lib/links.ts`, `lib/forms.ts` |

학칙과 실제 운영이 다른 곳은 `reference/README.md`에 정리한다.

## 구조

```
app/                  화면 (Next.js 15 App Router, React 19)
components/           공통 화면 요소 (Shell, 기록지, 로드맵 편집기 등)
content/hakchik.md    학칙 원문 (기준 문서)
content/forms/        별지 1–11 원문 (마크다운 → 입력 템플릿)
lib/                  데이터 모델, 학칙 규칙, 저장소, 생성기
public/               로고, 입학 서류 원본 HWP
reference/            레퍼런스 (private/은 git 제외)
supabase/schema.sql   운영용 테이블과 RLS 초안 (lib/types.ts와 1:1)
```

## 운영 전환 (다음 단계)

1. **Supabase**: `supabase/schema.sql` 실행 → `.env.local`에 키 → `lib/store.tsx`, `lib/auth.tsx` 내부를 Supabase 호출로 교체 (함수 이름 유지)
2. **로그인·권한**: 교직원 가입 → 관리자 승인, 권한별 RLS
3. **파일**: 검정고시 성적표·전표 사진은 Supabase Storage
4. **공휴일**: 공공데이터포털 특일 정보 API로 학사일정 공휴일 자동 반영
5. **배포**: Vercel
