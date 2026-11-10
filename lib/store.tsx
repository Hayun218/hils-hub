'use client';
// 시안용 저장소: 브라우저 localStorage에 저장한다.
// 운영 단계에서는 같은 함수 이름을 유지한 채 Supabase 호출로 바꾼다 (supabase/schema.sql 참고).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  HubState, Student, StudentRecord, PurchaseRequest, Teacher, RoadmapCell, ProgressReport, TimetableBlock,
  AttendanceEntry, GradeSheet, FormRecord, RoadmapDef, ReportTemplate, GedExam, SyllabusPlan, ArchiveEntry, Submission, GradCheck, GradSettings, SchoolRecordDoc, DiagnosticExam,
} from './types';
import { normalizeRecord } from './schoolRecordModel';
import { seed } from './seed';
import { demeritsInQuarter, guidanceCount, quarterOf, stageFor } from './rules';
import { assignHomerooms } from './homeroom';

const KEY = 'hils-hub-demo-v2';

async function fetchRoster(): Promise<{ students: Student[]; teachers: Teacher[] }> {
  try {
    const res = await fetch('/api/roster', { cache: 'no-store' });
    return await res.json();
  } catch { return { students: [], teachers: [] }; }
}

/** 담임이 없는(또는 없는 교사를 가리키는) 재학생에게 제35조 규칙으로 담임을 정한다 */
function fillHomerooms(students: Student[], teachers: Teacher[]): Student[] {
  const ids = new Set(teachers.map(t => t.id));
  const missing = students.filter(s => s.status === '재학' && !ids.has(s.homeroom));
  if (!missing.length) return students;
  const { map } = assignHomerooms(missing, teachers);
  return students.map(s => (map[s.id] ? { ...s, homeroom: map[s.id] } : s));
}

/** 실제 명단(reference/private/roster.csv, staff.csv)이 있으면 그 명단으로, 없으면 가상 시연 데이터로 시작한다 */
async function initialState(): Promise<{ state: HubState; source: 'roster' | 'demo' }> {
  const { students, teachers } = await fetchRoster();
  if (students.length) {
    const ts = teachers.length ? teachers : seed.teachers;
    return { state: { ...seed, students: fillHomerooms(students, ts), teachers: ts, records: [], purchases: [], diagnostics: [] }, source: 'roster' };
  }
  return { state: seed, source: 'demo' };
}

/** 저장된 데이터에 명단 파일의 새 정보(성별, 교직원)를 채운다. 화면에서 고친 값은 그대로 둔다 */
async function mergeRoster(saved: HubState): Promise<HubState> {
  const { students, teachers } = await fetchRoster();
  if (!students.length) return saved;
  const byId = new Map(students.map(s => [s.id, s]));
  let ts = saved.teachers;
  const demoTeachers = ts.every(t => seed.teachers.some(x => x.id === t.id));
  if (teachers.length && demoTeachers) ts = teachers;
  else if (teachers.length) ts = ts.map(t => { const f = teachers.find(x => x.id === t.id); return f ? { ...f, ...t, strengths: t.strengths ?? f.strengths, homeroomFor: t.homeroomFor ?? f.homeroomFor, role: t.role ?? f.role } : t; });
  // 명단(roster.csv)에서 지운 학생(r번호)은 저장된 기록과 함께 뺀다 (예: 자퇴로 원본에서 삭제)
  const gone = new Set(saved.students.filter(s => /^r\d+$/.test(s.id) && !byId.has(s.id)).map(s => s.id));
  if (gone.size) {
    const keep = <T extends { studentId: string }>(xs: T[]) => xs.filter(x => !gone.has(x.studentId));
    saved = {
      ...saved, students: saved.students.filter(s => !gone.has(s.id)), records: keep(saved.records), reports: keep(saved.reports),
      forms: saved.forms.filter(f => !f.studentId || !gone.has(f.studentId)), gedExams: keep(saved.gedExams), diagnostics: saved.diagnostics.map(d => ({ ...d, students: d.students.filter(id => !gone.has(id)), results: Object.fromEntries(Object.entries(d.results).filter(([sid]) => !gone.has(sid))) })), submissions: keep(saved.submissions), schoolRecords: keep(saved.schoolRecords),
      attendance: Object.fromEntries(Object.entries(saved.attendance).map(([d, v]) => [d, Object.fromEntries(Object.entries(v).filter(([sid]) => !gone.has(sid)))])),
      progress: Object.fromEntries(Object.entries(saved.progress).filter(([sid]) => !gone.has(sid))),
      gradChecks: Object.fromEntries(Object.entries(saved.gradChecks).filter(([sid]) => !gone.has(sid))),
    };
  }
  const ss = saved.students.map(s => {
    const f = byId.get(s.id);
    return f ? { ...s, gender: s.gender ?? f.gender, classGroup: s.classGroup ?? f.classGroup } : s;
  });
  // 가상 시연 구입 신청(p1–p5, 없는 교사)은 실제 명단에서 뺀다
  const purchases = saved.purchases.filter(p => !(/^p\d$/.test(p.id) && !ts.some(t => t.id === p.requester)));
  return { ...saved, teachers: ts, students: fillHomerooms(ss, ts), purchases };
}

interface Hub extends HubState {
  source: 'roster' | 'demo';
  loaded: boolean;
  addStudent: (s: Omit<Student, 'id'>) => Student;
  updateStudent: (id: string, patch: Partial<Student>) => void;
  addRecord: (r: Omit<StudentRecord, 'id'>) => StudentRecord[];
  updateRecord: (id: string, patch: Partial<StudentRecord>) => void;
  addPurchase: (p: Omit<PurchaseRequest, 'id' | 'status'>) => void;
  updatePurchase: (id: string, patch: Partial<PurchaseRequest>) => void;
  teacherName: (id: string) => string;
  addTeacher: (t: Omit<Teacher, 'id'>) => Teacher;
  reset: () => Promise<void>;
  setProgress: (studentId: string, itemId: string, cell: RoadmapCell | null) => void;
  saveReport: (r: ProgressReport) => void;
  setPrayer: (period: string, text: string) => void;
  setTimetable: (blocks: TimetableBlock[]) => void;
  setAttendance: (date: string, studentId: string, entry: AttendanceEntry | null) => void;
  saveGrade: (g: GradeSheet) => void;
  removeGrade: (id: string) => void;
  saveForm: (f: FormRecord) => void;
  removeForm: (id: string) => void;
  newId: (prefix: string) => string;
  setRoadmaps: (r: RoadmapDef[]) => void;
  setReportTemplate: (t: ReportTemplate) => void;
  updateTeacher: (id: string, patch: Partial<Teacher>) => void;
  removeTeacher: (id: string) => void;
  setHomerooms: (map: Record<string, string>) => void;
  saveGed: (g: GedExam) => void;
  setCalendar: (c: HubState['calendar'], theme?: string) => void;
  saveSyllabus: (p: SyllabusPlan) => void;
  saveArchive: (a: Omit<ArchiveEntry, 'id' | 'savedAt'>) => void;
  saveSubmission: (x: Submission) => void;
  saveSchoolRecord: (r: SchoolRecordDoc) => void;
  saveDiagnostic: (d: DiagnosticExam) => void;
  removeDiagnostic: (id: string) => void;
  removeSubmission: (id: string) => void;
  setGradCheck: (sid: string, key: string, c: GradCheck | null) => void;
  setGradSettings: (g: GradSettings) => void;
  removeArchive: (id: string) => void;
  removeSyllabus: (id: string) => void;
  removeGed: (id: string) => void;
}

const Ctx = createContext<Hub | null>(null);
const uid = (p: string) => p + Math.random().toString(36).slice(2, 9);
const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some(x => x.id === item.id) ? list.map(x => (x.id === item.id ? item : x)) : [...list, item];

/** 예전 버전에서 저장한 데이터에 없는 칸을 채운다 */
const withDefaults = (s: Partial<HubState>): HubState => {
  const out = { ...seed, ...s } as HubState;
  if (!out.gradSettings || !('고등' in out.gradSettings)) out.gradSettings = seed.gradSettings; // 예전 한 가지 기준 → 학교급별
  else for (const t of ['초등', '중등', '고등'] as const) out.gradSettings[t] = { ...seed.gradSettings[t], ...out.gradSettings[t] };
  out.schoolRecords = (out.schoolRecords || []).map(normalizeRecord); // 예전 글 칸 → 표 행
  if (!s.diagnostics) out.diagnostics = out.students.some(x => seed.students.some(y => y.id === x.id)) ? seed.diagnostics : []; // 시연 진단평가는 가상 명단일 때만
  return out;
};

export function HubProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HubState>(seed);
  const [loaded, setLoaded] = useState(false);
  const [source, setSource] = useState<'roster' | 'demo'>('demo');

  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const saved = JSON.parse(raw) as HubState & { source?: 'roster' | 'demo' };
          setState(saved.source === 'roster' ? await mergeRoster(withDefaults(saved)) : withDefaults(saved));
          setSource(saved.source || 'demo');
          setLoaded(true);
          return;
        }
      } catch {}
      const init = await initialState();
      setState(init.state);
      setSource(init.source);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(KEY, JSON.stringify({ ...state, source })); } catch {}
  }, [state, loaded, source]);

  const hub = useMemo<Hub>(() => ({
    ...state,
    source,
    loaded,
    addStudent: (s) => {
      const st = { ...s, id: uid('s') };
      setState(x => ({ ...x, students: [...x.students, st] }));
      return st;
    },
    updateStudent: (id, patch) => setState(x => ({ ...x, students: x.students.map(s => (s.id === id ? { ...s, ...patch } : s)) })),
    addRecord: (r) => {
      // 벌점이 쿼터 안에서 5점 단위를 넘으면 지도 사유를 자동 생성한다 (제33조 제1항 제3호)
      const created: StudentRecord[] = [{ ...r, id: uid('r') }];
      if (r.type === 'demerit' && r.data.triggers) {
        // 제32조 제2항 행동·전자기기 적발은 그 자체로 지도 사유 1건 (제31조 제5항, 제33조 제1항)
        const count = guidanceCount(state.records, r.studentId) + 1;
        created.push({
          id: uid('r'), studentId: r.studentId, type: 'incident', date: r.date, author: r.author, private: true,
          title: String(r.title), data: { reason: String(r.data.triggers), fact: String(r.data.note || r.title), step: stageFor(count)?.step || 1 },
        });
      } else if (r.type === 'demerit') {
        const q = quarterOf(r.date);
        const before = demeritsInQuarter(state.records, r.studentId, q);
        const after = before + Number(r.data.points || 0);
        const crossings = Math.floor(after / 5) - Math.floor(before / 5);
        let count = guidanceCount(state.records, r.studentId);
        for (let i = 0; i < crossings; i++) {
          count += 1;
          created.push({
            id: uid('r'), studentId: r.studentId, type: 'incident', date: r.date, author: r.author, private: true,
            title: `벌점 ${Math.floor(after / 5) * 5}점 도달`,
            data: { reason: '벌점 누적', fact: `${q}쿼터 벌점 누적 ${after}점`, step: stageFor(count)?.step || 1 },
          });
        }
      }
      setState(x => ({ ...x, records: [...x.records, ...created] }));
      return created;
    },
    updateRecord: (id, patch) => setState(x => ({ ...x, records: x.records.map(r => (r.id === id ? { ...r, ...patch, data: { ...r.data, ...(patch.data || {}) } } : r)) })),
    addPurchase: (p) => setState(x => ({ ...x, purchases: [{ ...p, id: uid('p'), status: '신청' }, ...x.purchases] })),
    updatePurchase: (id, patch) => setState(x => ({ ...x, purchases: x.purchases.map(p => (p.id === id ? { ...p, ...patch } : p)) })),
    teacherName: (id) => (id ? state.teachers.find(t => t.id === id)?.name || id : '미지정'),
    addTeacher: (t) => {
      const teacher = { ...t, id: uid('t') };
      setState(x => ({ ...x, teachers: [...x.teachers, teacher] }));
      return teacher;
    },
    setProgress: (sid, item, cell) => setState(x => {
      const cur = { ...(x.progress[sid] || {}) };
      if (cell) cur[item] = cell; else delete cur[item];
      return { ...x, progress: { ...x.progress, [sid]: cur } };
    }),
    saveReport: (r) => setState(x => ({ ...x, reports: upsert(x.reports, { ...r, updatedAt: new Date().toISOString() }) })),
    setPrayer: (period, text) => setState(x => ({ ...x, prayers: { ...x.prayers, [period]: text } })),
    setTimetable: (blocks) => setState(x => ({ ...x, timetable: blocks })),
    setAttendance: (date, sid, entry) => setState(x => {
      const day = { ...(x.attendance[date] || {}) };
      if (entry) day[sid] = entry; else delete day[sid];
      return { ...x, attendance: { ...x.attendance, [date]: day } };
    }),
    saveGrade: (g) => setState(x => ({ ...x, grades: upsert(x.grades, g) })),
    removeGrade: (id) => setState(x => ({ ...x, grades: x.grades.filter(g => g.id !== id) })),
    saveForm: (f) => setState(x => ({ ...x, forms: upsert(x.forms, { ...f, updatedAt: new Date().toISOString() }) })),
    removeForm: (id) => setState(x => ({ ...x, forms: x.forms.filter(f => f.id !== id) })),
    newId: uid,
    setRoadmaps: (roadmaps) => setState(x => ({ ...x, roadmaps })),
    setReportTemplate: (reportTemplate) => setState(x => ({ ...x, reportTemplate })),
    updateTeacher: (id, patch) => setState(x => ({ ...x, teachers: x.teachers.map(t => (t.id === id ? { ...t, ...patch } : t)) })),
    removeTeacher: (id) => setState(x => ({ ...x, teachers: x.teachers.filter(t => t.id !== id), students: x.students.map(s => (s.homeroom === id ? { ...s, homeroom: '' } : s)) })),
    saveDiagnostic: (d) => setState(x => ({ ...x, diagnostics: upsert(x.diagnostics, d) })),
    removeDiagnostic: (id) => setState(x => ({ ...x, diagnostics: x.diagnostics.filter(v => v.id !== id) })),
    saveSchoolRecord: (r) => setState(x => ({ ...x, schoolRecords: upsert(x.schoolRecords, { ...r, updatedAt: new Date().toISOString() }) })),
    saveSubmission: (sub) => setState(x => ({ ...x, submissions: upsert(x.submissions, sub) })),
    removeSubmission: (id) => setState(x => ({ ...x, submissions: x.submissions.filter(v => v.id !== id) })),
    setGradCheck: (sid, key, c) => setState(x => {
      const cur = { ...(x.gradChecks[sid] || {}) };
      if (c) cur[key] = c; else delete cur[key];
      return { ...x, gradChecks: { ...x.gradChecks, [sid]: cur } };
    }),
    setGradSettings: (gradSettings) => setState(x => ({ ...x, gradSettings })),
    saveArchive: (a) => setState(x => ({ ...x, archives: [...x.archives, { ...a, id: uid('ar'), savedAt: new Date().toISOString() }] })),
    removeArchive: (id) => setState(x => ({ ...x, archives: x.archives.filter(a => a.id !== id) })),
    saveSyllabus: (p) => setState(x => ({ ...x, syllabi: upsert(x.syllabi, { ...p, updatedAt: new Date().toISOString() }) })),
    removeSyllabus: (id) => setState(x => ({ ...x, syllabi: x.syllabi.filter(p => p.id !== id) })),
    setCalendar: (calendar, theme) => setState(x => ({ ...x, calendar, ...(theme !== undefined ? { calendarTheme: theme } : {}) })),
    saveGed: (g) => setState(x => ({ ...x, gedExams: upsert(x.gedExams, g) })),
    removeGed: (id) => setState(x => ({ ...x, gedExams: x.gedExams.filter(g => g.id !== id) })),
    setHomerooms: (map) => setState(x => ({ ...x, students: x.students.map(s => (map[s.id] !== undefined ? { ...s, homeroom: map[s.id] } : s)) })),
    reset: async () => {
      try { localStorage.removeItem(KEY); } catch {}
      const init = await initialState();
      setState(init.state);
      setSource(init.source);
    },
  }), [state, source, loaded]);

  return <Ctx.Provider value={hub}>{children}</Ctx.Provider>;
}

export function useHub(): Hub {
  const v = useContext(Ctx);
  if (!v) throw new Error('HubProvider가 필요합니다');
  return v;
}
