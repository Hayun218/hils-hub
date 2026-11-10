// 기록 묶음(ZIP)에 넣는 서식 문서(Word). 출석부·성적표·면담 일지·생활 기록·검정고시·졸업 지표·학생 정보.
// 학교 원본 양식이 정해진 것(학습 진도 보고서, 입학 서류)은 여기서 만들지 않는다.
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { DiagnosticExam, GedExam, GradeSheet, HubState, Student, StudentRecord } from './types';
import { GRAD_ITEMS, TRACK_LABEL, gradStatus, itemsOf, trackOf } from './graduation';
import { gradeLabel } from './rules';

const F = 'Malgun Gothic';
const line = { style: BorderStyle.SINGLE, size: 6, color: '333333' };
const borders = { top: line, bottom: line, left: line, right: line };
const p = (t: string, o: { bold?: boolean; size?: number; center?: boolean; color?: string } = {}) =>
  new Paragraph({ alignment: o.center ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 40 }, children: [new TextRun({ text: t, font: F, bold: o.bold, size: o.size ?? 19, color: o.color })] });
const cell = (t: string, head = false) => new TableCell({
  borders, shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' } : undefined,
  children: (t || ' ').split('\n').map(x => p(x, { bold: head })),
});
/** 첫 행이 머리행인 표. side=true면 첫 열이 머리칸 */
const table = (rows: string[][], side = false) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: rows.map((r, i) => new TableRow({ children: r.map((c, j) => cell(c, side ? j === 0 : i === 0)) })),
});
const h = (t: string) => new Paragraph({ spacing: { before: 220, after: 80 }, children: [new TextRun({ text: t, font: F, bold: true, size: 22 })] });
const title = (t: string, sub: string) => [p(t, { bold: true, size: 32, center: true }), p(sub, { center: true, size: 18, color: '555555' })];
const doc = (children: (Paragraph | Table)[]) => Packer.toBlob(new Document({ sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } }, children }] }));
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function studentInfoDocx(s: Student, tname: (id: string) => string) {
  return doc([
    ...title('학 생 정 보', `HILS · ${new Date().toISOString().slice(0, 10)} 기준`),
    table([
      ['이름', s.name], ['출생 연도', `${s.birthYear} (${gradeLabel(s.birthYear)})`], ['반', s.classGroup || s.schoolLevel], ['성별', s.gender || ''],
      ['담임', tname(s.homeroom)], ['입학일', s.admittedAt || ''], ['상태', `${s.status}${s.leaveType ? ` · ${s.leaveType}` : ''}`],
      ['상태 변경일', s.statusDate || ''], ['사유', s.statusReason || ''], ['영어·수학 레벨', `${s.enLevel || '-'} / ${s.mathLevel || '-'}`],
      ['보호자', `${s.guardian} ${s.guardianPhone}`], ['기록 동의', s.consent ? '예 (제28조 제4항)' : '아니오'], ['비고', s.note || ''],
    ], true),
  ]);
}

/** 출석부: 학년도 한 해, 달마다 표 + 합계 */
export function attendanceDocx(s: Student, year: string, days: [string, { status: string; note?: string }][]) {
  const count = (st: string) => days.filter(([, v]) => v.status === st).length;
  const months = [...new Set(days.map(([d]) => d.slice(5, 7)))];
  return doc([
    ...title('출 석 부', `${year}학년도 · ${s.name} (${s.classGroup || s.schoolLevel})`),
    table([['기록일수', '출석', '결석', '지각', '조퇴', '외출'], [String(days.length), String(count('출석')), String(count('결석')), String(count('지각')), String(count('조퇴')), String(count('외출'))]]),
    ...months.flatMap(m => [
      h(`${Number(m)}월`),
      table([['날짜', '요일', '출결', '사유'], ...days.filter(([d]) => d.slice(5, 7) === m).map(([d, v]) => [d, DOW[new Date(d).getDay()], v.status, v.note || ''])]),
    ]),
  ]);
}

/** 성적표: 학년도 한 해의 평가 */
export function gradesDocx(s: Student, year: string, sheets: GradeSheet[]) {
  const kinds = [...new Set(sheets.map(g => g.kind))];
  return doc([
    ...title('성 적 표', `${year}학년도 · ${s.name} (${s.classGroup || s.schoolLevel})`),
    ...kinds.flatMap(k => [
      h(k),
      table([['날짜', '과목', '평가', '점수', '만점'], ...sheets.filter(g => g.kind === k).sort((a, b) => a.date.localeCompare(b.date))
        .map(g => [g.date, g.subject, g.title, g.columns.map(c => `${g.columns.length > 1 ? `${c} ` : ''}${g.scores[s.id]?.[c] ?? ''}`).join(' / '), g.max ? String(g.max) : ''])]),
    ]),
  ]);
}

const LABEL: Record<string, string> = {
  kind: '면담 종류', step: '단계', subject: '과목', place: '장소', summary: '면담 내용', story: '학생의 이야기', guidance: '지도 내용',
  promise: '약속', follow: '후속 조치', reason: '사유', points: '점수', area: '영역', action: '조치', note: '비고', level: '레벨', from: '이전', to: '이후',
};
const fields = (r: StudentRecord) => Object.entries(r.data).filter(([, v]) => v !== '' && v !== undefined).map(([k, v]) => [LABEL[k] || k, String(v)]);

/** 면담 일지 한 건 (별지 8 항목) */
export function interviewDocx(s: Student, r: StudentRecord, tname: (id: string) => string) {
  return doc([
    ...title('면 담 일 지', `별지 8 · ${r.private ? '비공개 기록 (제38조)' : 'HILS'}`),
    table([['학생', `${s.name} (${s.classGroup || s.schoolLevel})`], ['날짜', r.date], ['면담 교사', tname(r.author)], ['제목', r.title], ...fields(r)], true),
  ]);
}

/** 생활 기록 (상점·벌점·레벨·진단·독서·지도 사유): 한 해를 표 하나로 */
export function lifeDocx(s: Student, year: string, recs: StudentRecord[], tname: (id: string) => string, label = '생 활 기 록') {
  const TYPE: Record<string, string> = { merit: '상점', demerit: '벌점', level: '레벨', diagnosis: '진단', reading: '독서', incident: '지도 사유', interview: '면담' };
  const merit = recs.filter(r => r.type === 'merit').reduce((a, r) => a + (Number(r.data.points) || 0), 0);
  const demerit = recs.filter(r => r.type === 'demerit').reduce((a, r) => a + (Number(r.data.points) || 0), 0);
  return doc([
    ...title(label, `${year}학년도 · ${s.name} (${s.classGroup || s.schoolLevel})`),
    table([['상점 합계', '벌점 합계', '기록 수'], [String(merit), String(demerit), String(recs.length)]]),
    h('기록'),
    table([['날짜', '종류', '내용', '세부', '교사'], ...recs.map(r => [r.date, TYPE[r.type] || r.type, r.title, fields(r).map(([k, v]) => `${k}: ${v}`).join('\n'), tname(r.author)])]),
  ]);
}

export function gedDocx(s: Student, exams: GedExam[]) {
  return doc([
    ...title('검정고시 응시 기록', s.name),
    ...(['초졸', '중졸', '고졸'] as const).filter(l => exams.some(e => e.level === l)).flatMap(l => {
      const list = exams.filter(e => e.level === l).sort((a, b) => a.date.localeCompare(b.date));
      const subs = [...new Set(list.flatMap(e => Object.keys(e.scores)))];
      return [h(`${l} 검정고시`), table([['회차', '시험일', ...subs, '결과', '선택 과목'], ...list.map(e => [e.round, e.date, ...subs.map(k => e.scores[k] || ''), e.status, e.electives || ''])])];
    }),
  ]);
}

export function gradDocx(hub: HubState, s: Student) {
  const t = trackOf(s);
  const st = gradStatus(hub, s);
  return doc([
    ...title(`${TRACK_LABEL[t]} 지표 점검`, `${s.name} · 별표 2 · ${new Date().toISOString().slice(0, 10)} 기준`),
    table([['영역', '지표', '기준', '상태', '근거'], ...itemsOf(t).map(i => [i.area, i.label, i.target[t] || '', st[i.key]?.status || '', st[i.key]?.detail || ''])]),
    p(`확인 자료: ${GRAD_ITEMS.map(i => `${i.label}(${i.source})`).join(', ')}`, { size: 16, color: '555555' }),
  ]);
}

/** 진단평가 기록: 학년도 한 해 (문해력·영어·수학, 제20조) */
export function diagnosisDocx(s: Student, year: string, exams: DiagnosticExam[]) {
  return doc([
    ...title('진단평가 기록', `${year}학년도 · ${s.name} (${s.classGroup || s.schoolLevel})`),
    table([['날짜', '과목', '회차', '영역별', '판정', '빈 단원·메모'], ...exams.sort((a, b) => a.date.localeCompare(b.date)).map(d => {
      const r = d.results[s.id];
      return [d.date, d.subject, d.round, d.sections.map(x => `${x} ${r?.scores[x] || '-'}`).join('\n'), r?.level || '', [r?.gaps, r?.note].filter(Boolean).join(' / ')];
    })]),
  ]);
}
