// 독서록 양식 (별표 2 사고력·독서 졸업 기준의 근거 자료). 웹에서 쓰거나 Word로 내려받아 쓴다.
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, ShadingType } from 'docx';

export const READING_FIELDS: { key: string; label: string; long?: boolean; hint?: string }[] = [
  { key: 'title', label: '책 제목' },
  { key: 'author', label: '지은이' },
  { key: 'publisher', label: '출판사' },
  { key: 'period', label: '읽은 기간', hint: '예: 3/2–3/16' },
  { key: 'category', label: '분야', hint: '교과 · 영성 · 진로 · 자유' },
  { key: 'summary', label: '줄거리 · 내용 요약', long: true },
  { key: 'quote', label: '인상 깊은 구절', long: true, hint: '쪽수와 함께' },
  { key: 'thought', label: '생각과 느낀 점', long: true },
  { key: 'apply', label: '삶에 적용할 점', long: true },
  { key: 'question', label: '하브루타 질문', long: true, hint: '함께 나누고 싶은 질문 2개' },
];

const F = 'Malgun Gothic';
const border = { style: BorderStyle.SINGLE, size: 6, color: '333333' };
const borders = { top: border, bottom: border, left: border, right: border };
const p = (t: string, o: { bold?: boolean; size?: number; center?: boolean } = {}) =>
  new Paragraph({ alignment: o.center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: t, font: F, bold: o.bold, size: o.size ?? 20 })] });

export async function readingLogDocx(v: Record<string, string> = {}, student = '') {
  const rows = READING_FIELDS.map(f => new TableRow({
    children: [
      new TableCell({ borders, width: { size: 22, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' }, children: [p(f.label, { bold: true })] }),
      new TableCell({ borders, children: (v[f.key] || '').split('\n').map(t => p(t)).concat(f.long && !v[f.key] ? [p(''), p(''), p(''), p('')] : []) }),
    ],
  }));
  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
      children: [
        p('독 서 록', { bold: true, size: 36, center: true }),
        p(student ? `이름: ${student}` : '이름:                      작성일:', { size: 20 }),
        p(''),
        new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      ],
    }],
  });
  return Packer.toBlob(doc);
}
