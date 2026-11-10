// 별지 서식을 Word(.docx)로 만든다. 빈 양식(values 없음)과 작성한 기록 모두 같은 함수로 만든다.
import {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import { repeatRows, type Block, type FormValues } from './formTemplate';

const INK = '111111';
const FONT = 'Malgun Gothic';
const plain = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const run = (text: string, o: { bold?: boolean; color?: string; size?: number } = {}) => new TextRun({ text, font: FONT, size: o.size ?? 20, bold: o.bold, color: o.color });
const para = (text: string, o: { bold?: boolean; color?: string; size?: number; after?: number } = {}) =>
  new Paragraph({ children: [run(plain(text), o)], spacing: { after: o.after ?? 80 } });
const border = { style: BorderStyle.SINGLE, size: 6, color: '333333' };
const borders = { top: border, bottom: border, left: border, right: border };

function tcell(text: string, head = false) {
  return new TableCell({
    borders,
    shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: text.split('\n').map(t => para(t, { bold: head, after: 0 })),
  });
}

export async function formToDocx(opts: { no: number; title: string; meta: string; blocks: Block[]; values?: FormValues; studentName?: (id: string) => string }) {
  const v = opts.values || {};
  const str = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : '');
  const blank = !opts.values;
  const children: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 120 }, children: [run(`별지 ${opts.no}`, { size: 18, color: '555555' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run(opts.title.split('').join(' ').replace(/ {3}/g, '  '), { bold: true, size: 36, color: INK })] }),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
  ];
  for (const b of opts.blocks) {
    if (b.t === 'h') children.push(new Paragraph({ heading: b.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, spacing: { before: 240, after: 100 }, children: [run(plain(b.text), { bold: true, color: INK, size: b.level === 2 ? 24 : 21 })] }));
    else if (b.t === 'p') children.push(para(b.text));
    else if (b.t === 'quote') children.push(para(b.text, { color: '555555', size: 18 }));
    else if (b.t === 'li') children.push(para(`• ${b.text}`));
    else if (b.t === 'check') {
      const text = b.input ? b.text.slice(0, -1) : b.text;
      const extra = b.input ? `: ${str(`${b.key}:text`) || (blank ? '                    ' : '')}` : '';
      children.push(para(`${v[b.key] === true ? '☑' : '☐'} ${text}${extra}`));
    } else if (b.t === 'field') {
      children.push(para(`${b.label}:`, { bold: true, after: 40 }));
      children.push(para(str(b.key) || (blank ? ' ' : ''), { after: blank ? 360 : 120 }));
    } else if (b.t === 'area') {
      children.push(para(str(b.key) || (blank ? `(${b.placeholder})` : ''), { color: str(b.key) ? undefined : '8A9396', after: blank ? 600 : 160 }));
    } else if (b.t === 'table') {
      const fixed = b.repeat ? b.rows.filter(r => r.some(c => c.kind === 'static' && c.text)) : b.rows;
      const rows: TableRow[] = [new TableRow({ tableHeader: true, children: b.header.map(h => tcell(plain(h), true)) })];
      for (const r of fixed) {
        rows.push(new TableRow({
          children: r.map(c => {
            if (c.kind === 'static') return tcell(plain(c.text));
            if (c.kind === 'choice') {
              const cur = v[c.key];
              const list = Array.isArray(cur) ? (cur as string[]) : typeof cur === 'string' && cur ? [cur] : [];
              return tcell(c.options.map(o => `${list.includes(o) ? '■' : '□'} ${o}`).join('  '));
            }
            const val = c.student && opts.studentName ? opts.studentName(str(c.key)) : str(c.key);
            return tcell(`${c.prefix ? c.prefix + ' ' : ''}${val || (blank && c.placeholder) || ''}${c.suffix || ''}`);
          }),
        }));
      }
      if (b.repeat) for (const r of (blank ? [b.header.map(() => ''), b.header.map(() => ''), b.header.map(() => '')] : repeatRows(b, v))) rows.push(new TableRow({ children: r.map(x => tcell(x)) }));
      children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      children.push(para('', { after: 80 }));
    }
  }
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children }],
  });
  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
