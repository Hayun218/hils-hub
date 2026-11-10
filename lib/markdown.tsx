// 학칙·별지 마크다운을 화면으로 그리는 작은 렌더러.
// 조문 번호(제N조), 별표 N, 별지 N을 자동으로 링크로 바꿔 학칙과 서식이 서로 연결되게 한다.
import Link from 'next/link';
import type { ReactNode } from 'react';

export interface TocItem { id: string; label: string; level: 2 | 3 }

type Ctx = 'main' | 'add' | 'bp' | 'other';

/** 제목 문자열에 붙일 앵커 id. 학칙 화면 전체에서 같은 규칙을 쓴다. */
export function anchorFor(text: string, level: number, ctx: Ctx): { id: string; ctx: Ctx } {
  const t = text.trim();
  if (level === 2) {
    let m = t.match(/^제(\d+)장/);
    if (m) return { id: `ch${m[1]}`, ctx: 'main' };
    if (t.startsWith('부칙')) return { id: 'add', ctx: 'add' };
    if (t.startsWith('별표')) return { id: 'bp', ctx: 'bp' };
    if (t.startsWith('별지')) return { id: 'forms', ctx: 'other' };
    if (t.startsWith('[붙임]')) return { id: 'att', ctx: 'other' };
    if (t.startsWith('[참고]')) return { id: 'ref', ctx: 'other' };
    if (t.startsWith('문서 정보')) return { id: 'info', ctx: 'other' };
    return { id: slug(t), ctx: 'other' };
  }
  if (level === 3) {
    let m = t.match(/^제(\d+)조(?:의(\d+))?/);
    if (m) return { id: `${ctx === 'add' ? 'add-' : ''}art${m[1]}${m[2] ? '-' + m[2] : ''}`, ctx };
    m = t.match(/^\[별표 (\d+)\]/);
    if (m) return { id: `bp${m[1]}`, ctx };
    return { id: slug(t), ctx };
  }
  return { id: slug(t), ctx };
}

const slug = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();

const INLINE = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(부칙 제\d+조)|(제\d+조(?:의\d+)?)|(별표 \d+)|(별지 \d+)/g;

export function inline(text: string, opts: { autolink?: boolean } = {}): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    const [tok] = m;
    if (m[1]) out.push(<strong key={k++}>{inline(tok.slice(2, -2), opts)}</strong>);
    else if (m[2]) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      const href = /^https?:/.test(lm[2]) ? lm[2] : lm[2].endsWith('.md') ? '/hakchik' : lm[2];
      out.push(href.startsWith('http') ? <a key={k++} href={href} target="_blank" rel="noreferrer">{lm[1]}</a> : <Link key={k++} href={href}>{lm[1]}</Link>);
    } else if (opts.autolink === false) out.push(tok);
    else if (m[3]) out.push(<Link key={k++} className="ref" href={`/hakchik#add-art${tok.match(/\d+/)![0]}`}>{tok}</Link>);
    else if (m[4]) {
      const [, a, b] = tok.match(/제(\d+)조(?:의(\d+))?/)!;
      out.push(<Link key={k++} className="ref" href={`/hakchik#art${a}${b ? '-' + b : ''}`}>{tok}</Link>);
    } else if (m[5]) out.push(<Link key={k++} className="ref" href={`/hakchik#bp${tok.match(/\d+/)![0]}`}>{tok}</Link>);
    else if (m[6]) out.push(<Link key={k++} className="ref form" href={`/forms/${tok.match(/\d+/)![0]}`}>{tok}</Link>);
    last = i + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

interface Options {
  /** 각 h3 제목 바로 아래에 붙일 내용 (예: 조문에 연결된 서식 칩) */
  afterHeading?: (id: string) => ReactNode;
  /** 맨 위 h1을 생략 */
  skipTitle?: boolean;
  /** 문서 전체 제목 수준을 한 단계 내림 (서식 화면 등) */
  autolink?: boolean;
}

export function renderMarkdown(md: string, opts: Options = {}): { nodes: ReactNode[]; toc: TocItem[] } {
  const lines = md.replace(/\r/g, '').split('\n');
  const nodes: ReactNode[] = [];
  const toc: TocItem[] = [];
  let ctx: Ctx = 'main';
  let i = 0;
  let k = 0;
  const il = (t: string) => inline(t, { autolink: opts.autolink });

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { i++; continue; }

    // 제목
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      if (level === 1) {
        if (!opts.skipTitle) nodes.push(<h1 key={k++}>{text}</h1>);
      } else {
        const a = anchorFor(text, level, ctx);
        ctx = a.ctx;
        if (level <= 3) toc.push({ id: a.id, label: text, level: level as 2 | 3 });
        const H = (`h${level}`) as 'h2' | 'h3' | 'h4';
        nodes.push(
          <H key={k++} id={a.id} className="anchor">
            {inline(text, { autolink: false })}
            <a className="hash" href={`#${a.id}`} aria-label="이 위치 링크">#</a>
          </H>,
        );
        if (level === 3 && opts.afterHeading) {
          const extra = opts.afterHeading(a.id);
          if (extra) nodes.push(<div key={k++}>{extra}</div>);
        }
      }
      i++;
      continue;
    }

    if (/^-{3,}$/.test(t)) { nodes.push(<hr key={k++} />); i++; continue; }

    // 표
    if (t.startsWith('|') && i + 1 < lines.length && /^\|?\s*:?-{3}/.test(lines[i + 1].trim())) {
      const head = cells(t);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { body.push(cells(lines[i])); i++; }
      nodes.push(
        <div className="table-wrap" key={k++}>
          <table>
            <thead><tr>{head.map((c, j) => <th key={j}>{il(c)}</th>)}</tr></thead>
            <tbody>{body.map((r, ri) => <tr key={ri}>{head.map((_, j) => <td key={j}>{il(r[j] ?? '')}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    // 인용
    if (t.startsWith('>')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) { buf.push(lines[i].trim().replace(/^>\s?/, '')); i++; }
      nodes.push(<blockquote key={k++}>{buf.map((b, j) => <p key={j}>{il(b)}</p>)}</blockquote>);
      continue;
    }

    // 목록 (중첩 "   - " 포함)
    if (/^(\s*)([-*]|\d+\.)\s+/.test(line)) {
      const items: { depth: number; ordered: boolean; num?: string; text: string; check?: boolean }[] = [];
      while (i < lines.length && /^(\s*)([-*]|\d+\.)\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/)!;
        let text = m[3];
        let check: boolean | undefined;
        const c = text.match(/^\[( |x)\]\s+(.*)$/);
        if (c) { check = c[1] === 'x'; text = c[2]; }
        items.push({ depth: m[1].length >= 2 ? 1 : 0, ordered: /\d/.test(m[2]), num: m[2], text, check });
        i++;
      }
      const ordered = items[0].ordered;
      const top: ReactNode[] = [];
      let j = 0;
      while (j < items.length) {
        const it = items[j];
        const subs: typeof items = [];
        j++;
        while (j < items.length && items[j].depth > it.depth) { subs.push(items[j]); j++; }
        top.push(
          <li key={j} className={it.check !== undefined ? 'check' : undefined}>
            {it.check !== undefined && <span className="box" aria-hidden>{it.check ? '☑' : '☐'}</span>}
            {ordered ? <><span className="num">{it.num}</span> {il(it.text)}</> : il(it.text)}
            {subs.length > 0 && <ul className="sub">{subs.map((s, si) => <li key={si}>{il(s.text)}</li>)}</ul>}
          </li>,
        );
      }
      nodes.push(ordered ? <ol key={k++} className="plain">{top}</ol> : <ul key={k++}>{top}</ul>);
      continue;
    }

    // 문단 (연속 줄은 하나로)
    const buf: string[] = [t];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#|\||>|-{3,}|\s*([-*]|\d+\.)\s)/.test(lines[i])) { buf.push(lines[i].trim()); i++; }
    const p = buf.join(' ');
    nodes.push(<p key={k++} className={/^[①-⑳]/.test(p) ? 'clause' : undefined}>{il(p)}</p>);
  }
  return { nodes, toc };
}
