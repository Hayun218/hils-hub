// 학칙 원문(content/hakchik.md) 읽기·저장.
// 시안: 로컬 개발 서버에서만 저장한다 (파일에 직접 씀, 저장 전 원문을 .hakchik-history/에 백업).
// 운영: Supabase로 옮길 때 개정본 테이블 + 권한 검사로 바꾼다. 지금 권한 검사는 화면에서만 한다.
import fs from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

const FILE = path.join(process.cwd(), 'content', 'hakchik.md');
const HISTORY = path.join(process.cwd(), '.hakchik-history');
const REV_ROW = /^\| (\d+\.\d+(?:\.\d+)?) \| \d{4}-\d{2}-\d{2} \|.*\|$/;

export async function GET() {
  const content = await fs.readFile(FILE, 'utf8');
  return Response.json({ content, editable: process.env.NODE_ENV === 'development' });
}

interface Body {
  content: string;
  revision?: { version: string; date: string; note: string; author: string };
}

/** 개정 이력 표의 마지막 행 뒤에 한 행을 넣는다 (제5조 제4항) */
function appendRevision(md: string, r: NonNullable<Body['revision']>): string {
  const lines = md.split('\n');
  let last = -1;
  lines.forEach((l, i) => { if (REV_ROW.test(l)) last = i; });
  if (last < 0) throw new Error('개정 이력 표를 찾지 못했습니다');
  const cell = (s: string) => s.replace(/\|/g, '/').replace(/\n/g, ' ').trim();
  lines.splice(last + 1, 0, `| ${cell(r.version)} | ${cell(r.date)} | ${cell(r.note)} | ${cell(r.author)} |`);
  return lines.join('\n');
}

export async function PUT(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return Response.json({ error: '시안 단계에서는 로컬 개발 서버에서만 저장할 수 있습니다' }, { status: 403 });
  }
  const body = (await req.json()) as Body;
  if (!body.content || !body.content.trim().startsWith('#')) {
    return Response.json({ error: '학칙 원문이 비어 있거나 제목(#)으로 시작하지 않습니다' }, { status: 400 });
  }
  let next = body.content.replace(/\r\n/g, '\n');
  try {
    if (body.revision?.note.trim()) next = appendRevision(next, body.revision);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  const prev = await fs.readFile(FILE, 'utf8');
  if (prev === next) return Response.json({ ok: true, changed: false });
  await fs.mkdir(HISTORY, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.writeFile(path.join(HISTORY, `hakchik-${stamp}.md`), prev, 'utf8');
  await fs.writeFile(FILE, next.endsWith('\n') ? next : next + '\n', 'utf8');
  return Response.json({ ok: true, changed: true, backup: `.hakchik-history/hakchik-${stamp}.md` });
}
