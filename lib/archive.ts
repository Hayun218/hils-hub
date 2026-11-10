// 학생 한 명의 기록 묶음(ZIP). 재학이 아닌 학생(졸업·퇴교)은 이 파일을 드라이브에 올리고 링크를 학생 정보에 남긴다.
// 구조 (학적 / 학년도마다 교과·생활 / 졸업과제). 문서는 서식을 갖춘 Word, 쿼터·날짜는 파일 이름에 넣는다:
//   00_안내.txt
//   학적/                학생정보 · 졸업수료지표 점검 · 입학서류/ · 검정고시/ (+성적표 원본) · 졸업 심사표
//   2027학년도/          학교생활기록부 (학년도 종합)
//     교과/              진단평가 · 성적표 · 학습진도보고서_N쿼터 · 별지 서식(교과)
//     생활/              출석부 · 생활기록(상점·벌점·레벨)
//   졸업과제/종류/       독서록(웹 작성은 Word, 올린 파일은 원본) · 포트폴리오 PDF 등
//   원자료/              CSV·JSON (데이터베이스로 옮길 때 쓰는 데이터)
//   면담·지도기록_비공개/ 면담 일지(정기·학습·지도), 지도 사유, 생활·훈육 기록지 — 학교 보관용에만 (제38조 제2항)
// mode '보관': 학교 보관용 전체 (교직원 전용 드라이브). mode '전달': 졸업생·학부모 전달용 (면담·지도 기록과 원자료를 뺀다)
import JSZip from 'jszip';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FormView from '@/components/FormView';
import type { HubState, Student, StudentRecord } from './types';
import { attendanceDocx, diagnosisDocx, gedDocx, gradDocx, gradesDocx, interviewDocx, lifeDocx, studentInfoDocx } from './archiveDocs';
import { readingLogDocx } from './readingLog';
import { attendanceOf } from './schoolRecordModel';
import { schoolRecordDocx } from './schoolRecord';
import { getFile } from './fileStore';
import { parseForm } from './formTemplate';
import { formToDocx } from './formDocx';
import { FORMS } from './forms';
import { periodLabel, gradesFor } from './reports';
import { gradeLabel } from './rules';

const csv = (rows: (string | number | undefined)[][]) =>
  '﻿' + rows.map(r => r.map(v => { const x = String(v ?? ''); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; }).join(',')).join('\n');
const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').trim();
const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

function recordRows(rs: StudentRecord[], name: (id: string) => string) {
  return [['날짜', '종류', '제목', '내용', '교사'], ...rs.map(r => [r.date, r.type, r.title, Object.entries(r.data).map(([k, v]) => `${k}: ${v}`).join(' / '), name(r.author)])];
}

export type ArchiveMode = '보관' | '전달';

export async function studentArchive(s: Student, hub: HubState, mode: ArchiveMode = '보관') {
  const zip = new JSZip();
  const root = zip.folder(`${safe(s.name)}_학생기록${mode === '전달' ? '_전달용' : ''}_${new Date().toISOString().slice(0, 10)}`)!;
  const keepAll = mode === '보관';
  const tname = (id: string) => hub.teachers.find(t => t.id === id)?.name || id;
  const yearOf = (d: string) => d.slice(0, 4);
  const hak = root.folder('학적')!;
  const yDir = (y: string) => root.folder(`${y}학년도`)!;
  const edu = (y: string) => yDir(y).folder('교과')!;
  const life = (y: string) => yDir(y).folder('생활')!;
  const raw = keepAll ? root.folder('원자료')! : new JSZip(); // 전달용에는 원자료를 넣지 않는다
  const talk = keepAll ? root.folder('면담·지도기록_비공개')! : null;

  hak.file('학생정보.docx', await studentInfoDocx(s, tname));
  hak.file('졸업수료지표_점검.docx', await gradDocx(hub, s));

  // 학생 기록: 비공개(지도 사유·지도 면담, 제38조)는 따로
  const recs = hub.records.filter(r => r.studentId === s.id).sort((a, b) => a.date.localeCompare(b.date));
  const open = recs.filter(r => !r.private);
  const privRecs = recs.filter(r => r.private);
  raw.file('학생기록.csv', csv(recordRows(open.filter(r => r.type !== 'interview'), tname)));
  if (talk && (privRecs.length || open.some(r => r.type === 'interview'))) talk.file('면담·지도기록.csv', csv(recordRows([...open.filter(r => r.type === 'interview'), ...privRecs].sort((a, b) => a.date.localeCompare(b.date)), tname)));

  const att = Object.entries(hub.attendance).filter(([, d]) => d[s.id]).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => [d, v[s.id]] as [string, { status: string; note?: string }]);
  if (att.length) raw.file('출결.csv', csv([['날짜', '출결', '사유'], ...att.map(([d, v]) => [d, v.status, v.note])]));
  const grades = hub.grades.filter(g => g.students.includes(s.id) && g.scores[s.id]);
  if (grades.length) raw.file('성적.csv', csv([['날짜', '종류', '과목', '평가', '점수'], ...grades.map(g => [g.date, g.kind, g.subject, g.title, g.columns.map(c => `${c} ${g.scores[s.id][c] || ''}`).join(' / ')])]));

  // 학년도 폴더: 교과(진단평가·성적표) · 생활(출석부·생활 기록) · 학교생활기록부
  const years = [...new Set([...att.map(([d]) => yearOf(d)), ...grades.map(g => yearOf(g.date)), ...recs.map(r => yearOf(r.date)), ...hub.schoolRecords.filter(d => d.studentId === s.id).map(d => String(d.year)), ...hub.reports.filter(r => r.studentId === s.id).map(r => r.period.slice(0, 4)), ...hub.diagnostics.filter(d => d.results[s.id]).map(d => d.date.slice(0, 4))])].sort();
  for (const y of years) {
    const ya = att.filter(([d]) => d.startsWith(y));
    if (ya.length) life(y).file(`출석부_${y}학년도.docx`, await attendanceDocx(s, y, ya));
    const yd2 = hub.diagnostics.filter(d => d.date.startsWith(y) && d.results[s.id]);
    if (yd2.length) edu(y).file(`진단평가_${y}학년도.docx`, await diagnosisDocx(s, y, yd2));
    const yg = grades.filter(g => g.date.startsWith(y));
    if (yg.length) edu(y).file(`성적표_${y}학년도.docx`, await gradesDocx(s, y, yg));
    const lifeRecs = open.filter(r => r.date.startsWith(y) && r.type !== 'interview');
    const pl = privRecs.filter(r => r.date.startsWith(y) && r.type !== 'interview');
    if (talk && pl.length) talk.file(`지도사유_${y}학년도.docx`, await lifeDocx(s, y, pl, tname, '지 도 사 유'));
    if (lifeRecs.length) life(y).file(`생활기록_${y}학년도.docx`, await lifeDocx(s, y, lifeRecs, tname));
    const sr = hub.schoolRecords.find(d => d.studentId === s.id && String(d.year) === y);
    if (sr) {
      const head = { name: s.name, gender: s.gender || '', grade: gradeLabel(s.birthYear, Number(y)), classGroup: s.classGroup || s.schoolLevel, admittedAt: s.admittedAt || '', homeroom: tname(s.homeroom) };
      yDir(y).file(`학교생활기록부_${y}학년도.docx`, await schoolRecordDocx(sr, head, attendanceOf(hub, s.id, Number(y))));
    }
  }

  // 면담 일지: 정기·학습·지도 모두 비공개 폴더에 한 건씩 (학교 보관용에만, 제38조 제2항)
  for (const r of talk ? recs.filter(x => x.type === 'interview') : []) {
    const name = `면담일지_${r.date}_${safe(String(r.data.kind || ''))}.docx`;
    talk!.file(name, await interviewDocx(s, r, tname));
  }

  // 검정고시: 응시 기록 Word + 성적표 원본
  const ged = hub.gedExams.filter(g => g.studentId === s.id);
  if (ged.length) {
    const gf = hak.folder('검정고시')!;
    gf.file('검정고시_응시기록.docx', await gedDocx(s, ged));
    for (const g of ged) {
      const base = `${g.level}_${safe(g.round || g.date)}`;
      if (g.reportFile) gf.file(`${base}_${safe(g.reportFile.name)}`, g.reportFile.dataUrl.split(',')[1], { base64: true });
      if (g.reportFileId) { const b = await getFile(g.reportFileId).catch(() => undefined); if (b) gf.file(`${base}_${safe(g.reportFileName || '성적표')}`, b); }
    }
  }

  // 졸업 과제: 종류별 폴더. 웹에서 쓴 독서록은 Word로, 올린 파일은 원본 그대로
  const subs = hub.submissions.filter(x => x.studentId === s.id);
  const missing: string[] = [];
  for (const x of subs) {
    const dir = root.folder('졸업과제')!.folder(safe(x.kind))!;
    const base = `${x.date}_${safe(x.title)}`;
    if (x.fileId) {
      const b = await getFile(x.fileId).catch(() => undefined);
      if (b) dir.file(`${base}_${safe(x.fileName || '')}`, b); else missing.push(`${x.kind} · ${x.title} (${x.fileName})`);
    } else if (x.content) dir.file(`${base}.docx`, await readingLogDocx(x.content, s.name));
    else if (x.url) dir.file(`${base}_링크.txt`, x.url);
  }

  // 별지 서식: 입학·체험 입학·졸업 심사는 학적, 생활·훈육 기록지와 면담 일지는 생활, 나머지는 교과 (모두 작성한 학년도)
  // 별지 4 생활·훈육 기록지, 별지 8 면담 일지, 비공개 서식은 면담·지도 기록 폴더 (학교 보관용에만)
  const isTalk = (f: { private?: boolean; formNo: number }) => f.private || f.formNo === 4 || f.formNo === 8;
  const forms = hub.forms.filter(f => f.studentId === s.id && (keepAll || !isTalk(f)));
  if (forms.length) {
    const mdCache: Record<number, string> = {};
    for (const f of forms) {
      mdCache[f.formNo] ??= await (await fetch(`/api/forms/${f.formNo}`)).text();
      const tpl = parseForm(mdCache[f.formNo]);
      const meta = FORMS.find(x => x.no === f.formNo);
      const dir = isTalk(f) ? talk! : meta?.stage === '입학' || meta?.stage === '체험입학' ? hak.folder('입학서류')! : f.formNo === 5 ? hak : edu(yearOf(f.date));
      const base = `별지${f.formNo}_${safe(meta?.title || '')}_${f.date}`;
      if (meta?.original) {
        // 입학 서류는 원본 양식(HWP)이 따로 있으므로 Word를 만들지 않고, 웹에서 쓴 내용을 한 장짜리 문서로 남긴다
        const body = renderToStaticMarkup(createElement(FormView, { blocks: tpl.blocks, values: f.values, students: hub.students }));
        dir.file(`${base}.html`, `<!doctype html><meta charset="utf-8"><title>${esc(tpl.title)}</title><style>body{font-family:sans-serif;max-width:760px;margin:24px auto;color:#111}h1{text-align:center;letter-spacing:.3em}table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:6px}th{background:#f2f2f2}.ff-choice.on{font-weight:700}.ff-choice.on::before{content:'■ '}.ff-choice:not(.on)::before{content:'□ '}.ff-ro{border-bottom:1px solid #999;min-height:20px;white-space:pre-wrap}</style><h1>${esc(tpl.title)}</h1><p>${esc(f.title)}</p>${body}`);
      } else {
        const blob = await formToDocx({ no: f.formNo, title: tpl.title, meta: tpl.meta, blocks: tpl.blocks, values: f.values, studentName: id => hub.students.find(x => x.id === id)?.name || '' });
        dir.file(`${base}.docx`, blob);
      }
    }
  }

  // 학습 진도 보고서: 교과 폴더에 쿼터마다 HTML 한 장 (학교 원본 양식은 화면 인쇄본이 기준)
  for (const r of hub.reports.filter(x => x.studentId === s.id)) {
    const p = r.snapshot || hub.progress[s.id] || {};
    const { ged: gg, month } = gradesFor(s.id, r.period, hub.grades);
    const rm = hub.roadmaps.map(m => {
      const items = m.items.filter(i => p[i.id]);
      return items.length ? `<h3>${esc(m.title)}</h3><ul>${items.map(i => `<li>${esc(i.label)} — ${p[i.id].state}${p[i.id].date ? ` (${p[i.id].date})` : ''}</li>`).join('')}</ul>` : '';
    }).join('');
    const html = `<!doctype html><meta charset="utf-8"><title>${esc(s.name)} ${esc(periodLabel(r.period))}</title>
<style>body{font-family:sans-serif;max-width:760px;margin:24px auto;line-height:1.6;color:#1b2b2d}h1,h2,h3{color:#124046}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:left}</style>
<h1>${esc(hub.reportTemplate.title)}</h1><p>${esc(s.name)} · ${esc(periodLabel(r.period))} · ${r.date} · ${r.status}</p>
<h2>로드맵</h2>${rm || '<p>표시한 진도 없음</p>'}
${gg.length || month.length ? `<h2>평가 결과</h2><table>${[...gg, ...month].map(g => `<tr><td>${g.date}</td><td>${esc(g.kind)} · ${esc(g.title)}</td><td>${esc(g.columns.map(c => `${c} ${g.scores[s.id]?.[c] || ''}`).join(' / '))}</td></tr>`).join('')}</table>` : ''}
${r.career ? `<h2>진로·입시</h2><p>${esc(r.career)}</p>` : ''}
<h2>과목 평가</h2><table>${r.comments.map(c => `<tr><th>${esc(c.subject)}</th><td>${esc(c.text)}</td></tr>`).join('')}</table>
${hub.prayers[r.period] ? `<h2>기도제목</h2><p>${esc(hub.prayers[r.period])}</p>` : ''}`;
    const m = r.period.match(/^(\d{4})-Q(\d)$/);
    edu(m ? m[1] : r.period.slice(0, 4)).file(`학습진도보고서_${m ? `${m[2]}쿼터` : safe(periodLabel(r.period))}.html`, html);
  }

  if (keepAll) raw.file('학생기록.json', JSON.stringify({
    student: s, records: open, grades: grades.map(g => ({ ...g, scores: { [s.id]: g.scores[s.id] }, students: [s.id] })),
    gedExams: ged, submissions: subs, schoolRecords: hub.schoolRecords.filter(d => d.studentId === s.id), forms: forms.filter(f => !isTalk(f)),
    reports: hub.reports.filter(r => r.studentId === s.id), diagnostics: hub.diagnostics.filter(d => d.results[s.id]).map(d => ({ ...d, students: [s.id], results: { [s.id]: d.results[s.id] } })), gradChecks: hub.gradChecks[s.id] || {},
  }, null, 2));

  root.file('00_안내.txt', [
    `${s.name} 학생 기록 묶음 · ${keepAll ? '학교 보관용' : '졸업생·학부모 전달용'} (${new Date().toISOString().slice(0, 10)} 만듦, HILS Hub)`,
    '',
    '폴더 구조',
    '- 학적/ : 학생정보, 졸업·수료 지표 점검, 입학서류, 검정고시(성적표 원본 포함), 졸업 심사표',
    '- NNNN학년도/ : 학교생활기록부',
    '  - 교과/ : 진단평가, 성적표, 학습 진도 보고서(쿼터별)',
    '  - 생활/ : 출석부, 생활기록(상점·벌점)',
    '- 졸업과제/ : 독서록·포트폴리오 등 제출물 (올린 원본 그대로)',
    ...(keepAll
      ? ['- 면담·지도기록_비공개/ : 면담 일지(정기·학습·지도), 지도 사유, 생활·훈육 기록지. 교직원 전용으로 보관하고 공유하지 않습니다 (제38조 제2항)', '- 원자료/ : CSV·JSON (데이터베이스로 옮길 때 사용)']
      : ['졸업생·학부모 전달용입니다. 면담·지도 기록과 원자료는 넣지 않았습니다 (제38조 제2항).']),
    '- 원자료/ : CSV·JSON (데이터베이스로 옮길 때 사용)',
    ...(missing.length ? ['', '이 브라우저에 없어 넣지 못한 파일 (다른 기기에서 올림):', ...missing.map(m => `- ${m}`)] : []),
  ].join('\n'));

  return zip.generateAsync({ type: 'blob' });
}

