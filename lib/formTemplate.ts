// 별지 서식 원문(content/forms/byeolji-N.md)을 입력 템플릿으로 바꾼다.
// 원문 규칙만 지키면 서식을 고쳐도 웹 입력 화면과 Word 파일이 함께 바뀐다.
//   표의 빈 칸            → 입력 칸 (열 이름이나 행 이름이 '일'로 끝나면 날짜)
//   "가 / 나 / 다" 칸      → 선택 (참석자처럼 여러 개 고르는 칸은 복수 선택)
//   "…:" 또는 "__" 칸     → 앞뒤 글자를 남긴 입력 칸
//   모든 칸이 빈 마지막 행  → 행을 늘릴 수 있는 표
//   - [ ] 문장            → 체크 (문장이 ':'로 끝나면 체크 + 입력)
//   - 항목:  /  문장:      → 입력 칸
//   (안내 문장)           → 여러 줄 입력 (안내는 입력 칸의 예시 글로)
import type { FormValue } from './types';

export type Cell =
  | { kind: 'static'; text: string }
  | { kind: 'input'; key: string; prefix?: string; suffix?: string; placeholder?: string; date?: boolean; student?: boolean }
  | { kind: 'choice'; key: string; options: string[]; multi: boolean };

export type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'quote'; text: string }
  | { t: 'li'; text: string }
  | { t: 'table'; key: string; header: string[]; rows: Cell[][]; repeat: boolean }
  | { t: 'check'; key: string; text: string; input: boolean }
  | { t: 'field'; key: string; label: string; multiline: boolean }
  | { t: 'area'; key: string; placeholder: string };

const DATE_HINT = /(일|일자|일시)$/;
const MULTI_HINT = /(참석|대상)/;

/** meta: 근거·작성자 줄, guide: 본문 앞 작성 안내. 둘 다 문서 본문이 아니라 화면 위쪽 설명으로 보여 준다 */
export function parseForm(md: string): { title: string; meta: string; guide: string; blocks: Block[] } {
  const lines = md.split('\n');
  const blocks: Block[] = [];
  const used = new Map<string, number>();
  let title = '';
  let meta = '';
  let guide = '';
  let section = '';
  const key = (k: string) => {
    const base = `${section}|${k}`;
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    return n > 1 ? `${base}#${n}` : base;
  };
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const t = l.trim();
    if (!t) continue;
    if (t.startsWith('# ')) { title = t.slice(2).replace(/^\[별지 \d+\]\s*/, ''); continue; }
    if (!meta && t.startsWith('근거:')) { meta = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); continue; }
    const h = t.match(/^(#{2,4})\s+(.*)$/);
    if (h) { section = h[2]; blocks.push({ t: 'h', level: h[1].length, text: h[2] }); continue; }
    if (t.startsWith('>')) {
      const q = t.replace(/^>\s?/, '');
      if (!blocks.length && !guide) { guide = q; continue; } // 첫 안내 문단
      blocks.push({ t: 'quote', text: q });
      continue;
    }
    if (t.startsWith('|')) {
      const rowsRaw: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const r = cells(lines[i]);
        if (!r.every(c => /^:?-{3,}:?$/.test(c))) rowsRaw.push(r);
        i++;
      }
      i--;
      const [header, ...body] = rowsRaw;
      const tkey = key(`표:${header.join('/')}`);
      const twoCol = header.length === 2 && header[0] === '항목';
      const rows: Cell[][] = body.map((r, ri) => r.map((c, ci): Cell => {
        if (ci === 0 && c) return { kind: 'static', text: c };
        const rowLabel = r[0] || `${ri + 1}행`;
        const colLabel = twoCol ? '' : header[ci] || '';
        const k = `${tkey}|${rowLabel}|${colLabel || ci}`;
        if (!c) {
          const label = twoCol ? rowLabel : colLabel;
          return { kind: 'input', key: k, date: DATE_HINT.test(label) && !/일시/.test(label) ? true : undefined, student: label === '학생' || undefined };
        }
        const opts = c.split(' / ').map(x => x.trim()).filter(Boolean);
        if (opts.length >= 2 && opts.every(o => o.length <= 24)) return { kind: 'choice', key: k, options: opts, multi: MULTI_HINT.test(rowLabel) };
        if (c.endsWith(':')) return { kind: 'input', key: k, prefix: c };
        if (c.includes('_')) return { kind: 'input', key: k, placeholder: c }; // 예: 20__년 _쿼터, __건
        const pm = c.match(/^(.*:\s*)(\S+-)$/); // "최종 레벨: EN-"
        if (pm) return { kind: 'input', key: k, prefix: c };
        return { kind: 'static', text: c };
      }));
      const last = body[body.length - 1];
      const repeat = !!last && last.every(c => !c);
      blocks.push({ t: 'table', key: tkey, header, rows, repeat });
      continue;
    }
    const ck = t.match(/^- \[[ x]\]\s*(.*)$/);
    if (ck) {
      const text = ck[1];
      blocks.push({ t: 'check', key: key(`체크:${text}`), text, input: text.endsWith(':') });
      continue;
    }
    const li = t.match(/^[-*]\s+(.*)$/);
    if (li) {
      if (li[1].endsWith(':')) blocks.push({ t: 'field', key: key(`항목:${li[1]}`), label: li[1].slice(0, -1), multiline: false });
      else blocks.push({ t: 'li', text: li[1] });
      continue;
    }
    if (/^\(.*\)$/.test(t)) { blocks.push({ t: 'area', key: key(`글:${t}`), placeholder: t.slice(1, -1) }); continue; }
    if (t.endsWith(':') && !t.startsWith('**')) { blocks.push({ t: 'field', key: key(`항목:${t}`), label: t.slice(0, -1), multiline: true }); continue; }
    blocks.push({ t: 'p', text: t });
  }
  return { title, meta: meta.replace(/^근거:\s*/, ''), guide, blocks };
}

export type FormValues = Record<string, FormValue>;

/** 행을 늘릴 수 있는 표의 행 값 */
export function repeatRows(b: Extract<Block, { t: 'table' }>, v: FormValues): string[][] {
  const saved = v[`${b.key}#rows`];
  if (Array.isArray(saved) && Array.isArray(saved[0])) return saved as string[][];
  return [b.header.map(() => '')];
}

export const cellText = (v: FormValue | undefined): string =>
  v === undefined ? '' : typeof v === 'boolean' ? (v ? '✓' : '') : Array.isArray(v) ? (v as string[]).join(', ') : String(v);

/** 작성 정도: 채운 칸 / 전체 칸 */
export function completion(blocks: Block[], v: FormValues) {
  let total = 0, done = 0;
  const count = (k: string) => { total++; const x = v[k]; if (x !== undefined && x !== '' && x !== false && !(Array.isArray(x) && !x.length)) done++; };
  for (const b of blocks) {
    if (b.t === 'table' && !b.repeat) b.rows.forEach(r => r.forEach(c => { if (c.kind !== 'static') count(c.key); }));
    if (b.t === 'check') count(b.key);
    if (b.t === 'field' || b.t === 'area') count(b.key);
  }
  return { total, done };
}
