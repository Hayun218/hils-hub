// 학교생활기록부 Word 내보내기 (학교가 쓰던 학교생활세부사항기록부 구성). 모델·예시는 lib/schoolRecordModel.ts
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { SchoolRecordDoc, SrSubjectKind } from './types';
import type { Attendance } from './schoolRecordModel';

export { LIMITS, attendanceOf } from './schoolRecordModel';

export interface RecordHead { name: string; gender: string; grade: string; classGroup: string; admittedAt: string; homeroom: string }

const F = 'Malgun Gothic';
const b = { style: BorderStyle.SINGLE, size: 6, color: '333333' };
const borders = { top: b, bottom: b, left: b, right: b };
const p = (t: string, o: { bold?: boolean; size?: number; center?: boolean } = {}) =>
  new Paragraph({ alignment: o.center ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 30 }, children: [new TextRun({ text: t, font: F, bold: o.bold, size: o.size ?? 18 })] });
const cell = (t: string, head = false, span = 1, center = false) => new TableCell({
  borders, columnSpan: span,
  shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' } : undefined,
  children: (t || ' ').split('\n').map(x => p(x, { bold: head, center: head || center })),
});
/** rows[0]은 머리행. 칸 값이 [글, 합칠 칸 수]면 columnSpan */
type C = string | [string, number];
const table = (rows: C[][], headRows = 1) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: rows.map((r, i) => new TableRow({ children: r.map(c => (Array.isArray(c) ? cell(c[0], i < headRows, c[1]) : cell(c, i < headRows))) })),
});
const h = (t: string) => new Paragraph({ spacing: { before: 200, after: 70 }, children: [new TextRun({ text: t, font: F, bold: true, size: 21 })] });
const sub = (t: string) => p(t, { bold: true, size: 18 });
const none = (cols: number): C[][] => [[['해당 사항 없음', cols]]];

export async function schoolRecordDocx(d: SchoolRecordDoc, head: RecordHead, att: Attendance) {
  const g = att.grid;
  const a = d.activities;
  let acc = 0;
  const vol = d.volunteer.map(v => { acc += Number(v.hours) || 0; return [v.period, v.place, v.content, v.hours, String(acc)] as C[]; });
  const subjBlock = (kind: SrSubjectKind) => {
    const list = d.subjects.filter(x => x.kind === kind);
    if (!list.length) return [];
    const units = list.reduce((s, x) => s + (Number(x.units) || 0), 0);
    const rows: C[][] = kind === '체육·예술'
      ? [['학기', '교과', '과목', '단위수', '성취도', '비고'], ...list.map(x => [x.semester, x.area, x.subject, x.units, x.achievement, x.note || ''] as C[]), [['이수단위 합계', 3], [String(units), 3]]]
      : [['학기', '교과', '과목', '단위수', '원점수/과목평균\n(표준편차)', '성취도\n(수강자수)', kind === '진로 선택' ? '성취도별\n분포비율' : '석차등급', '비고'],
        ...list.map(x => [x.semester, x.area, x.subject, x.units, x.score, x.achievement, x.rank, x.note || ''] as C[]), [['이수단위 합계', 3], [String(units), 5]]];
    const details = list.filter(x => x.detail.trim()).map(x => `(${x.semester}학기) ${x.subject}: ${x.detail}`).join('\n');
    return [sub(kind === '일반' ? '<일반 과목>' : kind === '진로 선택' ? '<진로 선택 과목>' : '<체육·예술>'), table(rows),
      table([['세부능력 및 특기사항'], [details || ' ']])];
  };
  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 850, bottom: 850, left: 850, right: 850 } } },
      children: [
        p('학교생활세부사항기록부 (학교생활기록부 Ⅱ)', { bold: true, size: 30, center: true }),
        p(`${d.year}학년도 · HILS (Hyoja International Leaders' School)`, { center: true, size: 17 }),
        table([['학년도', '학년', '반', '담임성명'], [String(d.year), head.grade, head.classGroup, head.homeroom]]),
        h('1. 인적·학적사항'),
        table([['성명', head.name, '성별', head.gender], ['학적사항', [`${head.admittedAt} 입학`, 3]], ['특기사항', [d.special, 3]]], 0),
        h('2. 출결상황'),
        table([
          [['수업일수', 1], ['결석일수', 3], ['지각', 3], ['조퇴', 3], ['결과', 3], ['특기사항', 1]],
          ['', '질병', '미인정', '기타', '질병', '미인정', '기타', '질병', '미인정', '기타', '질병', '미인정', '기타', ''],
          [String(att.days), ...(['결석', '지각', '조퇴', '결과'] as const).flatMap(k => [g[k].질병, g[k].미인정, g[k].기타].map(n => (n ? String(n) : '.'))), d.attendanceNote || (att.perfect ? '개근' : '')],
        ], 2),
        h('3. 수상경력'),
        table([['학기', '수상명', '등급(위)', '수상연월일', '수여기관', '참가대상(참가인원)'], ...(d.awards.length ? d.awards.map(x => [x.semester, x.name, x.grade, x.date, x.org, x.target] as C[]) : none(6))]),
        h('4. 자격증 및 인증 취득상황'),
        table([['구분', '명칭 또는 종류', '번호 또는 내용', '취득연월일', '발급기관'], ...(d.certificates.length ? d.certificates.map(x => [x.kind, x.name, x.number, x.date, x.issuer] as C[]) : none(5))]),
        h('5. 창의적 체험활동상황'),
        table([
          ['영역', '시간', '특기사항'],
          ['자율활동', a.autonomy.hours, a.autonomy.text],
          ['동아리활동', a.club.hours, a.club.text],
          ['진로활동', a.career.hours, `희망분야: ${a.career.hope || ''}\n${a.career.text}`],
        ], 1),
        sub('<봉사활동 실적>'),
        table([['일자 또는 기간', '장소 또는 주관기관명', '활동내용', '시간', '누계시간'], ...(vol.length ? vol : none(5))]),
        h('6. 교과학습발달상태'),
        ...subjBlock('일반'), ...subjBlock('진로 선택'), ...subjBlock('체육·예술'),
        h('7. 독서활동상황'),
        table([['과목 또는 영역', '독서 활동 상황'], ...(d.reading.length ? d.reading.map(x => [x.area, `${x.semester ? `(${x.semester}학기) ` : ''}${x.books}`] as C[]) : none(2))], 1),
        h('8. 행동특성 및 종합의견'),
        table([['행동특성 및 종합의견'], [d.behavior || ' ']]),
      ],
    }],
  });
  return Packer.toBlob(doc);
}
