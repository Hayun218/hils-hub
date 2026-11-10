// 검정고시 성적증명서 PDF 글에서 학력·회차·시험일·과목별 점수를 찾는다 (AI 없이 규칙으로).
// 교육청 증명서 양식이 조금씩 달라 못 찾은 칸은 비워 두고 사람이 채운다.
import type { GedLevel, GedStatus } from './types';
import type { PdfItem } from './pdfText';

export interface GedParsed { level: GedLevel; round: string; date: string; status: GedStatus; scores: Record<string, string>; electives: string; found: number }

const CORE: Record<GedLevel, string[]> = {
  초졸: ['국어', '수학', '사회', '과학'],
  중졸: ['국어', '수학', '영어', '사회', '과학'],
  고졸: ['국어', '수학', '영어', '사회', '과학', '한국사'],
};
const ELECTIVES = ['도덕', '기술·가정', '체육', '음악', '미술', '정보', '실과', '영어']; // 이름 사이 ··공백은 정규식이 함께 받는다
const PASS = 60;

const SCORE = /^(100|\d{1,2}(?:\.\d)?|면제|기합격|과목합격)$/;
/** 표 모양(과목 줄 아래 점수 줄): 과목 이름이 있는 줄의 이웃 칸 사이 가운데를 칸 경계로 보고, 그 칸 안의 가장 가까운 아래 점수 */
function scoreBelow(items: PdfItem[], name: string) {
  const re = new RegExp(`^${name.replace(/[·\s]/g, '[·\\s]?')}$`);
  const label = items.find(i => re.test(i.s));
  if (!label) return undefined;
  const mid = (i: PdfItem) => i.x + i.w / 2;
  const row = items.filter(i => i.page === label.page && Math.abs(i.y - label.y) <= 2).sort((p, q) => p.x - q.x);
  const k = row.indexOf(label);
  const left = k > 0 ? (mid(row[k - 1]) + mid(label)) / 2 : -Infinity;
  const right = k < row.length - 1 ? (mid(label) + mid(row[k + 1])) / 2 : Infinity;
  return items.filter(i => i.page === label.page && SCORE.test(i.s) && i.y < label.y - 2 && label.y - i.y < 80 && mid(i) >= left && mid(i) < right)
    .sort((p, q) => q.y - p.y)[0]?.s;
}

export function parseGed(text: string, hint?: GedLevel, items: PdfItem[] = []): GedParsed | null {
  const t = text.replace(/ /g, ' ');
  const level: GedLevel | undefined =
    /고등학교\s*졸업\s*학력|고졸/.test(t) ? '고졸' : /중학교\s*졸업\s*학력|중졸/.test(t) ? '중졸' : /초등학교\s*졸업\s*학력|초졸/.test(t) ? '초졸' : hint;
  if (!level) return null;
  const r = t.match(/(\d{4})\s*년도?\s*제?\s*(\d)\s*회/);
  const round = r ? `${r[1]}년 제${r[2]}회` : '';
  const d = t.match(/시\s*험\s*일[^\d]{0,6}(\d{4})\s*[.\-년]\s*(\d{1,2})\s*[.\-월]\s*(\d{1,2})/) || t.match(/(\d{4})\s*[.\-]\s*(\d{1,2})\s*[.\-]\s*(\d{1,2})/);
  const date = d ? `${d[1]}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}` : '';
  // 과목 이름 뒤에 오는 점수(0–100) 또는 면제·기합격
  const scoreOf = (name: string) => {
    const re = new RegExp(`${name.replace(/[·\s]/g, '[·\\s]?')}[ \\t]*[:：]?[ \\t]*(100|\\d{1,2}(?:\\.\\d)?|면제|기합격|과목합격)(?!\\d)`);
    return t.match(re)?.[1] ?? scoreBelow(items, name);
  };
  const scores: Record<string, string> = {};
  for (const k of CORE[level]) { const v = scoreOf(k); if (v) scores[k] = v; }
  const coreSet = new Set(CORE[level]);
  const el = ELECTIVES.filter(n => !coreSet.has(n)).map(n => ({ n, v: scoreOf(n) })).filter(x => x.v);
  const slots = level === '초졸' ? ['선택1', '선택2'] : ['선택'];
  el.slice(0, slots.length).forEach((x, i) => { scores[slots[i]] = x.v!; });
  const found = Object.keys(scores).length;
  if (!found && !round) return null;
  // 합격: 전 과목 평균 60점 이상(면제·기합격 과목은 빼고 셈). 과목 합격: 60점 이상. 그해 공고로 다시 확인한다
  const nums = Object.values(scores).map(Number).filter(x => !Number.isNaN(x));
  const all = slots.length + CORE[level].length;
  const avg = nums.length ? nums.reduce((x, y) => x + y, 0) / nums.length : 0;
  const complete = found >= all;
  const status: GedStatus = /불\s*합\s*격/.test(t) ? (nums.some(x => x >= PASS) ? '일부 과목 합격' : '불합격')
    : complete && avg >= PASS ? '합격'
      : nums.some(x => x >= PASS) ? '일부 과목 합격' : '불합격';
  return { level, round, date, status, scores, electives: el.map(x => x.n).join(', '), found };
}
