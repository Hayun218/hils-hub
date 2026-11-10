// 학생 한 명의 기록 묶음(ZIP). 재학이 아닌 학생(졸업·퇴교)은 이 파일을 드라이브에 올리고 링크를 학생 정보에 남긴다.
// 들어가는 것: 학생 정보, 학생 기록(공개/비공개 폴더 분리, 제38조), 출결, 성적, 검정고시와 성적표, 별지 서식(Word), 학습 진도 보고서.
import JSZip from 'jszip';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FormView from '@/components/FormView';
import type { HubState, Student, StudentRecord } from './types';
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

export async function studentArchive(s: Student, hub: HubState) {
  const zip = new JSZip();
  const root = zip.folder(`${safe(s.name)}_학생기록_${new Date().toISOString().slice(0, 10)}`)!;
  const tname = (id: string) => hub.teachers.find(t => t.id === id)?.name || id;

  root.file('학생정보.txt', [
    `이름: ${s.name}`, `출생 연도: ${s.birthYear} (${gradeLabel(s.birthYear)})`, `반: ${s.classGroup || s.schoolLevel}`, `성별: ${s.gender || ''}`,
    `담임: ${tname(s.homeroom)}`, `상태: ${s.status}${s.leaveType ? ` · ${s.leaveType}` : ''}`, `상태 변경일: ${s.statusDate || ''}`, `사유: ${s.statusReason || ''}`,
    `입학일: ${s.admittedAt || ''}`, `보호자: ${s.guardian} ${s.guardianPhone}`, `기록 동의: ${s.consent ? '예' : '아니오'}`, `비고: ${s.note || ''}`,
  ].join('\n'));

  const recs = hub.records.filter(r => r.studentId === s.id).sort((a, b) => a.date.localeCompare(b.date));
  root.file('학생기록.csv', csv(recordRows(recs.filter(r => !r.private), tname)));
  const priv = recs.filter(r => r.private);
  if (priv.length) root.folder('비공개_제38조')!.file('지도사유_지도면담.csv', csv(recordRows(priv, tname)));

  const att = Object.entries(hub.attendance).filter(([, d]) => d[s.id]).sort(([a], [b]) => a.localeCompare(b));
  if (att.length) root.file('출결.csv', csv([['날짜', '출결', '사유'], ...att.map(([d, v]) => [d, v[s.id].status, v[s.id].note])]));

  const grades = hub.grades.filter(g => g.students.includes(s.id) && g.scores[s.id]);
  if (grades.length) root.file('성적.csv', csv([['날짜', '종류', '과목', '평가', '점수'], ...grades.map(g => [g.date, g.kind, g.subject, g.title, g.columns.map(c => `${c} ${g.scores[s.id][c] || ''}`).join(' / ')])]));

  const ged = hub.gedExams.filter(g => g.studentId === s.id);
  if (ged.length) {
    const gf = root.folder('검정고시')!;
    gf.file('응시기록.csv', csv([['구분', '회차', '시험일', '결과', '점수', '선택 과목', '성적표 링크'], ...ged.map(g => [g.level, g.round, g.date, g.status, Object.entries(g.scores).map(([k, v]) => `${k} ${v}`).join(' / '), g.electives, g.reportUrl])]));
    ged.forEach(g => { if (g.reportFile) gf.file(`${g.level}_${safe(g.round)}_${safe(g.reportFile.name)}`, g.reportFile.dataUrl.split(',')[1], { base64: true }); });
  }

  // 별지 서식: 웹에서 쓴 기록을 Word로
  const forms = hub.forms.filter(f => f.studentId === s.id);
  if (forms.length) {
    const ff = root.folder('서식')!;
    const mdCache: Record<number, string> = {};
    for (const f of forms) {
      mdCache[f.formNo] ??= await (await fetch(`/api/forms/${f.formNo}`)).text();
      const tpl = parseForm(mdCache[f.formNo]);
      const meta = FORMS.find(x => x.no === f.formNo);
      const dir = f.private ? root.folder('비공개_제38조')! : ff;
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

  // 학습 진도 보고서: 보고서마다 HTML 한 장
  const reports = hub.reports.filter(r => r.studentId === s.id);
  if (reports.length) {
    const rf = root.folder('학습진도보고서')!;
    for (const r of reports) {
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
      rf.file(`${safe(periodLabel(r.period))}.html`, html);
    }
  }

  return zip.generateAsync({ type: 'blob' });
}
