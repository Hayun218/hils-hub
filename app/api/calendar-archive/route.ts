// 지난 학년도 학사일정 원본 이미지 (public/calendar/연도.png|jpg|webp, 원본 pdf가 있으면 함께)
import fs from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const dir = path.join(process.cwd(), 'public', 'calendar');
  let files: string[] = [];
  try { files = await fs.readdir(dir); } catch { return Response.json({ years: [] }); }
  const years = new Map<number, { year: number; image?: string; pdf?: string }>();
  for (const f of files) {
    const m = f.match(/^(\d{4})\.(png|jpe?g|webp|pdf)$/i);
    if (!m) continue;
    const y = Number(m[1]);
    const e = years.get(y) || { year: y };
    if (m[2].toLowerCase() === 'pdf') e.pdf = `/calendar/${f}`; else e.image = `/calendar/${f}`;
    years.set(y, e);
  }
  return Response.json({ years: [...years.values()].filter(e => e.image).sort((a, b) => b.year - a.year) });
}
