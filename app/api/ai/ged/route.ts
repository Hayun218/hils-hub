// 검정고시 성적증명서 사진·스캔본을 읽어 회차·과목별 점수로 (OpenAI). 글자가 있는 PDF는 브라우저에서 AI 없이 읽는다 (lib/gedParse.ts).
// 파일은 저장하지 않고 이 요청에만 쓴다.
import { apiError, askJson, filePart, hasKey, noKey } from '@/lib/ai';

export const dynamic = 'force-dynamic';

const SCHEMA = {
  type: 'object',
  properties: {
    level: { type: 'string', enum: ['초졸', '중졸', '고졸'] },
    round: { type: 'string' },
    date: { type: 'string' },
    status: { type: 'string', enum: ['합격', '불합격', '일부 과목 합격', '응시 예정'] },
    scores: { type: 'array', items: { type: 'object', properties: { subject: { type: 'string' }, score: { type: 'string' } }, required: ['subject', 'score'], additionalProperties: false } },
    electives: { type: 'string' },
  },
  required: ['level', 'round', 'date', 'status', 'scores', 'electives'],
  additionalProperties: false,
};

const GUIDE = `이 파일은 한국 검정고시(초졸·중졸·고졸) 성적증명서 또는 합격증명서야. 다음을 읽어 줘.
- level: 초등학교 졸업학력이면 초졸, 중학교면 중졸, 고등학교면 고졸
- round: "2027년 제1회"처럼 연도와 회차
- date: 시험일 YYYY-MM-DD (없으면 빈 문자열)
- status: 전 과목 합격이면 합격, 일부 과목만 60점 이상이면 일부 과목 합격, 그 밖에는 불합격
- scores: 과목별 점수. 과목 이름은 반드시 다음 목록의 이름을 쓴다.
  초졸: 국어, 수학, 사회, 과학, 선택1, 선택2
  중졸: 국어, 수학, 영어, 사회, 과학, 선택
  고졸: 국어, 수학, 영어, 사회, 과학, 한국사, 선택
  선택 과목(도덕, 기술·가정, 체육, 음악, 미술 등)은 "선택"(초졸은 "선택1", "선택2")으로 쓰고 실제 과목 이름은 electives에 쉼표로 적는다.
  면제·이전 합격 과목은 점수 칸에 "면제" 또는 "기합격"으로 쓴다.
- 이름, 주민등록번호, 수험번호 같은 개인정보는 어디에도 적지 않는다.`;

export async function POST(req: Request) {
  if (!hasKey()) return noKey();
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: '파일이 없습니다.' }, { status: 400 });
  try {
    const out = await askJson({ name: 'ged', schema: SCHEMA, parts: [await filePart(file), { type: 'input_text', text: GUIDE }] });
    return Response.json(out);
  } catch (e) {
    return apiError(e);
  }
}
