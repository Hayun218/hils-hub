// AI 공통 설정 (서버 전용): OpenAI Responses API를 fetch로 부른다 (SDK 없이).
// 필요한 환경 변수: OPENAI_API_KEY (.env.local / Vercel 환경 변수). 모델은 OPENAI_MODEL로 바꿀 수 있다.
// 개인정보: 호출하는 쪽에서 학생 이름을 '학생'으로 바꾸고 비공개 기록(제38조)은 넣지 않는다.

export const MODEL = process.env.OPENAI_MODEL || 'gpt-5';
const URL = 'https://api.openai.com/v1/responses';

export const hasKey = () => !!process.env.OPENAI_API_KEY;
export const noKey = () => Response.json({ error: 'AI 기능을 쓰려면 서버에 OPENAI_API_KEY를 설정해야 합니다 (.env.local 또는 Vercel 환경 변수).' }, { status: 503 });

export type Part =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'input_file'; filename: string; file_data: string };

/** 올린 파일(사진·PDF)을 요청에 넣을 조각으로 */
export async function filePart(file: File): Promise<Part> {
  const b64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  return pdf
    ? { type: 'input_file', filename: file.name || 'file.pdf', file_data: `data:application/pdf;base64,${b64}` }
    : { type: 'input_image', image_url: `data:${file.type || 'image/png'};base64,${b64}` };
}

export class AiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** JSON 스키마(strict)에 맞는 답을 받는다. schema는 모든 칸이 required, additionalProperties: false 여야 한다 */
export async function askJson<T>(opts: { instructions?: string; parts: Part[]; name: string; schema: object; maxTokens?: number }): Promise<T> {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      instructions: opts.instructions,
      input: [{ role: 'user', content: opts.parts }],
      text: { format: { type: 'json_schema', name: opts.name, schema: opts.schema, strict: true } },
      max_output_tokens: opts.maxTokens ?? 16000,
    }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiError(res.status, body?.error?.message || `AI 서버 오류 (${res.status})`);
  if (body.status === 'incomplete') throw new AiError(502, '답이 길어 중간에 끊겼습니다. 다시 시도해 주세요.');
  let text = '';
  for (const item of body.output || []) {
    if (item.type !== 'message') continue;
    for (const c of item.content || []) {
      if (c.type === 'refusal') throw new AiError(422, '이 내용으로는 답을 만들 수 없습니다.');
      if (c.type === 'output_text') text += c.text;
    }
  }
  try { return JSON.parse(text) as T; } catch { throw new AiError(502, '답을 읽지 못했습니다. 다시 시도해 주세요.'); }
}

export function apiError(e: unknown) {
  if (e instanceof AiError) {
    if (e.status === 429) return Response.json({ error: '요청이 많거나 사용 한도를 넘었습니다. 잠시 뒤에 다시 시도해 주세요.' }, { status: 429 });
    if (e.status === 401) return Response.json({ error: 'OPENAI_API_KEY가 올바르지 않습니다.' }, { status: 401 });
    if (e.status === 400) return Response.json({ error: `요청 오류: ${e.message}` }, { status: 400 });
    return Response.json({ error: e.message }, { status: e.status >= 400 && e.status < 600 ? e.status : 502 });
  }
  return Response.json({ error: 'AI 서버에 연결하지 못했습니다.' }, { status: 502 });
}
