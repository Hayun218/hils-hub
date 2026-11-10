// 학교생활기록부 항목 초안 (OpenAI). 학생 이름은 클라이언트에서 '학생'으로 바꿔 보낸다 (실명·비공개 기록은 보내지 않는다).
import { apiError, askJson, hasKey, noKey } from '@/lib/ai';

export const dynamic = 'force-dynamic';

const SCHEMA = { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false };

const SYSTEM = `너는 대안학교 교사가 학교생활기록부를 쓰도록 돕는다. 학교생활기록부 기재요령의 문체를 따른다.
- 관찰된 사실과 근거(활동, 결과물, 변화)를 바탕으로 쓰고, 근거 없는 칭찬이나 과장은 쓰지 않는다.
- 활동은 "활동명(날짜) → 맡은 역할과 한 일 → 드러난 태도나 변화" 순서로 쓴다.
- 문장은 "~함", "~임", "~보임"처럼 명사형으로 끝맺는다. 학생 이름은 쓰지 않는다.
- 교외 수상, 사교육, 부모의 직업 등 기재요령이 금지한 내용은 쓰지 않는다.
- 주어진 글자 수 한도를 넘지 않는다. 자료가 부족하면 있는 자료로만 짧게 쓴다.`;

export async function POST(req: Request) {
  if (!hasKey()) return noKey();
  const { section, limit, context, existing } = (await req.json()) as { section: string; limit: number; context: string; existing?: string };
  try {
    const out = await askJson<{ text: string }>({
      instructions: SYSTEM,
      name: 'draft',
      schema: SCHEMA,
      parts: [{
        type: 'input_text',
        text: `항목: ${section}\n글자 수 한도: ${limit}자 (공백 포함)\n\n학생 기록:\n${context}\n\n${existing ? `교사가 써 둔 초안 (살려서 다듬기):\n${existing}\n\n` : ''}이 항목의 초안을 한 문단으로 써 줘.`,
      }],
    });
    return Response.json({ text: out.text });
  } catch (e) {
    return apiError(e);
  }
}
