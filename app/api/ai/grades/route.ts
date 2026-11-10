// 성적표(사진·PDF)를 읽어 교과학습발달상태 행으로 (OpenAI). 파일은 저장하지 않고 이 요청에만 쓴다.
import { apiError, askJson, filePart, hasKey, noKey } from '@/lib/ai';

export const dynamic = 'force-dynamic';

const ROW = { type: 'object', properties: { subject: { type: 'string' }, score: { type: 'string' }, achievement: { type: 'string' }, note: { type: 'string' } }, required: ['subject', 'score', 'achievement', 'note'], additionalProperties: false };
const SCHEMA = { type: 'object', properties: { rows: { type: 'array', items: ROW } }, required: ['rows'], additionalProperties: false };

export async function POST(req: Request) {
  if (!hasKey()) return noKey();
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: '파일이 없습니다.' }, { status: 400 });
  try {
    const out = await askJson<{ rows: { subject: string; score: string; achievement: string; note: string }[] }>({
      name: 'grades',
      schema: SCHEMA,
      parts: [
        await filePart(file),
        { type: 'input_text', text: '이 성적표에서 과목별 점수와 성취도(또는 등급)를 읽어 행으로 정리해 줘. 없는 칸은 빈 문자열로, 학생 이름 등 개인정보는 note에 적지 마.' },
      ],
    });
    return Response.json(out);
  } catch (e) {
    return apiError(e);
  }
}
