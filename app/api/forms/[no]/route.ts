// 별지 원문(content/forms/byeolji-N.md). 학생 기록 묶음(ZIP)에서 서식을 Word로 만들 때 쓴다.
import fs from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  if (!/^\d{1,2}$/.test(no)) return new Response('not found', { status: 404 });
  try {
    const md = await fs.readFile(path.join(process.cwd(), 'content', 'forms', `byeolji-${no}.md`), 'utf8');
    return new Response(md, { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
  } catch {
    return new Response('not found', { status: 404 });
  }
}
