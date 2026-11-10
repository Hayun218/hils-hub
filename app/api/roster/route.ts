// 실제 명단(reference/private/roster.csv, git 제외)을 읽어 학생 목록으로 돌려준다.
// 파일이 없으면 빈 목록 → 저장소는 가상 시연 명단(lib/seed.ts)을 쓴다.
import fs from 'node:fs/promises';
import path from 'node:path';
import type { StaffRole, Student, Teacher } from '@/lib/types';

export const dynamic = 'force-dynamic';

const FILE = path.join(process.cwd(), 'reference', 'private', 'roster.csv');
const STAFF = path.join(process.cwd(), 'reference', 'private', 'staff.csv');
const ROSTER_YEAR = 2026; // 명단의 학년 기준 연도 (26학년도 2학기)

/** 초N·중N·고N → 출생 연도 (연 나이 기준, lib/rules.ts gradeLabel의 역) */
function birthYearOf(grade: string): number | null {
  const m = grade.match(/^(초|중|고)(\d)$/);
  if (!m) return null;
  const g = Number(m[2]) + (m[1] === '중' ? 6 : m[1] === '고' ? 9 : 0);
  return ROSTER_YEAR - 6 - g;
}

function readCsv(text: string) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const [header, ...rows] = lines;
  const cols = header.split(',').map(c => c.trim());
  const col = (r: string[], k: string) => (r[cols.indexOf(k)] || '').trim();
  return { rows: rows.map(l => l.split(',')), col };
}

async function readTeachers(): Promise<Teacher[]> {
  let text: string;
  try { text = await fs.readFile(STAFF, 'utf8'); } catch { return []; }
  const { rows, col } = readCsv(text);
  return rows.filter(r => col(r, 'id') && col(r, '이름')).map(r => ({
    id: col(r, 'id'),
    name: col(r, '이름'),
    role: (col(r, '역할') || '교사') as StaffRole,
    homeroomFor: (['초등', '중고등'].includes(col(r, '담임')) ? col(r, '담임') : undefined) as Teacher['homeroomFor'],
    subjects: col(r, '과목') ? col(r, '과목').split('/').map(x => x.trim()) : [],
    areas: col(r, '운영영역') ? col(r, '운영영역').split('/').map(x => x.trim()) : [],
    leaving: col(r, '이직') === '예정' || undefined,
    strengths: col(r, '강점') ? col(r, '강점').split('/').map(x => x.trim()) : [],
    note: col(r, '비고') || undefined,
  }));
}

export async function GET() {
  const teachers = await readTeachers();
  let text: string;
  try {
    text = await fs.readFile(FILE, 'utf8');
  } catch {
    return Response.json({ students: [], teachers });
  }
  const { rows: raw, col } = readCsv(text);
  const rows = raw.map(r => r.join(','));

  const students: Student[] = [];
  rows.forEach((line, i) => {
    const r = line.split(',');
    const name = col(r, '이름');
    const birthYear = birthYearOf(col(r, '학년'));
    if (!name || !birthYear) return;
    const gender = col(r, '성별');
    students.push({
      id: col(r, 'id') || `r${String(i + 1).padStart(2, '0')}`, // id 열이 있으면 그 번호 (줄을 지워도 기록 연결 유지)
      name,
      birthYear,
      schoolLevel: col(r, '학년').startsWith('초') ? '초등' : '중고등',
      classGroup: col(r, '반') || undefined,
      gender: gender === '남' || gender === '여' ? gender : undefined,
      boarding: col(r, '기숙') !== '통학',
      dutyExempt: col(r, '당번') === '제외',
      status: '재학',
      homeroom: '',
      guardian: '',
      guardianPhone: '',
      consent: false,
      devicesSubmitted: false,
    });
  });
  return Response.json({ students, teachers });
}
