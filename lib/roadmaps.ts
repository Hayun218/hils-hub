// 학습 진도 보고서의 국어·영어·수학 로드맵 (reference/private/2025-1학기-3월-학습진도보고서-원본.docx에서 옮김).
// 칸 배치는 원본 표와 같다. r: 행 범위, c: 열 범위 (0부터, 끝 포함).
// 이 파일은 처음 기본값이다. 실제로 쓰는 양식은 저장소(hub.roadmaps)에 있고 /reports/template에서 고친다.
import type { RoadmapCell, RoadmapDef, RoadmapItem, RoadmapProgress, RoadmapState } from './types';

export type Roadmap = RoadmapDef;

type Raw = [string, number | [number, number], number | [number, number]];
const span = (x: number | [number, number]): [number, number] => (Array.isArray(x) ? x : [x, x]);
const build = (id: string, raw: Raw[]): RoadmapItem[] =>
  raw.map(([label, r, c]) => { const rr = span(r), cc = span(c); return { id: `${id}-${rr[0]}-${cc[0]}`, label, r: rr, c: cc }; });

const SCHOOL = ['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
const steps = (prefix: string, row: number, from: number, n: number, suffix = ''): Raw[] =>
  Array.from({ length: n }, (_, i) => [`${prefix}${i + 1}${suffix}`, row, from + i] as Raw);

// 국어: 열 0 예비초, 1–12 초1–고3
export const KOREAN: Roadmap = {
  id: 'kor', subject: '국어', title: '국어 ROAD MAP', level: '전체',
  cols: ['예비초', ...SCHOOL],
  rowLabels: [
    { label: '문법', r: [0, 0] }, { label: '문학', r: [1, 1] }, { label: '독서 (비문학)', r: [2, 2] },
    { label: '어휘', r: [3, 3] }, { label: '언매/화작 (선택1)', r: [4, 4] },
  ],
  rows: 5,
  items: build('kor', [
    ['한글떼기 & 기탄국어 (A~D단계)', [0, 4], 0],
    ['문법기초', 0, 6], ['문법1', 0, 7], ['문법2', 0, 8],
    ...steps('빠작 ', 1, 1, 6, '단계'), ['문학1', 1, 7], ['문학2', 1, 8], ['문학3', 1, 9], ['고전', 1, 10],
    ...steps('빠작 ', 2, 1, 6, '단계'), ['독서1', 2, 7], ['독서2', 2, 8], ['독서3', 2, 9], ['독서4', 2, 10],
    ...steps('빠작 ', 3, 1, 6, '단계'), ['어휘1', 3, 7], ['어휘2', 3, 8],
    ['언매 / 화작', 4, 10],
  ]),
};

// 영어: 열 0–11 초1–고3
export const ENGLISH: Roadmap = {
  id: 'eng', subject: '영어', title: '영어 ROAD MAP', level: '전체',
  cols: SCHOOL,
  rowLabels: ['듣기', '말하기', '구문', '단어', '문법', '독해'].map((label, i) => ({ label, r: [i, i] as [number, number] })),
  rows: 6,
  items: build('eng', [
    ['Listening & Speaking', [0, 1], [0, 5]],
    ['영어듣기1', 0, 8], ['영어듣기2', 0, 10], ['영어듣기3', 0, 11],
    ['SOT (Word Building, English, Social Studies, Science)', 2, [0, 5]],
    ['영어구문1', 2, 7], ['영어구문2', 2, 8], ['영어구문3', 2, 9],
    ['미국교과서 읽는 리딩 Preschool Starter (1)–(6)', [3, 5], 0],
    ['미국교과서 읽는 리딩 Preschool (1)–(6)', [3, 5], 1],
    ['미국교과서 읽는 리딩 Preschool Plus (1)–(4)', [3, 5], 2],
    ['미국교과서 읽는 리딩 PreK (1)–(4)', [3, 5], 3],
    ['미국교과서 읽는 리딩 K (1)–(4)', [3, 5], 4],
    ['미국교과서 읽는 리딩 Easy (1)–(3)', [3, 5], 5],
    ...steps('영단어', 3, 6, 6),
    ...steps('영문법', 4, 6, 6),
    ...steps('영어독해', 5, 7, 5),
  ]),
};

// 수학: 열 0–5 초1–초6, 6 중1, 7 중2, 8 중3, 9 고1, 10 수1, 11 수2, 12 선택과목
export const MATH: Roadmap = {
  id: 'math', subject: '수학', title: '수학 개인별 로드맵', level: '전체',
  cols: ['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '수1', '수2', '선택과목'],
  rowLabels: [
    { label: '수와 연산', r: [0, 0] }, { label: '문자와 식', r: [1, 2] }, { label: '함수와 규칙성', r: [3, 3] },
    { label: '기하', r: [4, 5] }, { label: '확률과 통계', r: [6, 6] },
  ],
  rows: 7,
  items: build('math', [
    ...steps('수와 연산 ', 0, 0, 6), ['수와 연산 7', 0, [6, 7]], ['수와 연산 8', 0, [8, 9]],
    ['문자와 식 1', 1, [6, 7]], ['문자와 식 2', 1, [8, 9]],
    ['방정식과 부등식 1', 2, [6, 7]], ['방정식과 부등식 2', 2, [8, 9]],
    ['함수와 규칙성 1', 3, [0, 1]], ['함수와 규칙성 2', 3, [3, 5]], ['함수 3', 3, [6, 7]], ['함수 4', 3, [8, 9]],
    ['함수 5', 3, 10], ['미분과 적분 1', 3, 11], ['미분과 적분 2', 3, 12],
    ['도형 1', 4, [0, 2]], ['도형 2', 4, [3, 5]], ['측정 1', 5, [0, 2]], ['측정 2', 5, [3, 5]],
    ['도형의 방정식 3', [4, 5], 6], ['도형의 방정식 4', [4, 5], 7], ['도형의 방정식 5', [4, 5], 8], ['도형의 방정식 6', [4, 5], 9],
    ['기하와 벡터', [4, 5], [10, 12]],
    ['자료와 가능성 1', 6, [1, 2]], ['자료와 가능성 2', 6, [3, 5]], ['확률과 통계 3', 6, [6, 9]], ['확률과 통계 4', 6, 12],
  ]),
};

export const DEFAULT_ROADMAPS: RoadmapDef[] = [KOREAN, ENGLISH, MATH];

/** 칸을 누를 때마다: 없음 → 진행중 → 이수완료 → 면제 → 없음 */
export function nextCell(cur: RoadmapCell | undefined, today: string): RoadmapCell | null {
  const order: (RoadmapState | null)[] = [null, '진행중', '이수완료', '면제'];
  const i = order.indexOf(cur?.state ?? null);
  const next = order[(i + 1) % order.length];
  if (!next) return null;
  return { state: next, date: next === '이수완료' ? today : undefined };
}

/** 로드맵에서 지금 진행 중인 항목 이름 (목록 화면 요약용) */
export function currentItems(rm: Roadmap, p: RoadmapProgress = {}) {
  return rm.items.filter(i => p[i.id]?.state === '진행중').map(i => i.label);
}

/** 칸이 겹치는 항목 (양식 편집 검사) */
export function overlaps(rm: Roadmap): string[] {
  const seen = new Map<string, string>();
  const bad = new Set<string>();
  for (const i of rm.items) for (let r = i.r[0]; r <= i.r[1]; r++) for (let c = i.c[0]; c <= i.c[1]; c++) {
    const k = `${r}-${c}`;
    if (seen.has(k)) { bad.add(i.id); bad.add(seen.get(k)!); } else seen.set(k, i.id);
  }
  return [...bad];
}
