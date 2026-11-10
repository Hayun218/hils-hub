// 교재 최신판·구매 링크 찾기. GET /api/books?q=제목&publisher=출판사&isbn=
// 키가 있으면 알라딘(ALADIN_TTB_KEY) → 카카오(KAKAO_REST_API_KEY) 순서로, 없으면 Google Books(키 없이)로 찾는다.
// 서점 검색 링크(알라딘·교보·YES24)는 키 없이 늘 함께 준다. 학생 정보는 보내지 않는다 (책 제목·출판사만).
import type { BookEdition } from '@/lib/types';
import { storeLinks } from '@/lib/books';

export const dynamic = 'force-dynamic';

const norm = (s: string) => s.replace(/<[^>]+>/g, '').replace(/[\s·:()\[\]\-_,.]/g, '').toLowerCase();
const day = (s?: string) => (s || '').slice(0, 10);

async function aladin(q: string, key: string): Promise<BookEdition[]> {
  const u = new URL('https://www.aladin.co.kr/ttb/api/ItemSearch.aspx');
  Object.entries({ ttbkey: key, Query: q, QueryType: 'Keyword', MaxResults: '20', start: '1', SearchTarget: 'Book', output: 'js', Version: '20131101', Sort: 'PublishTime' }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { cache: 'no-store' });
  if (!r.ok) throw new Error(`알라딘 ${r.status}`);
  const j = await r.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (j.item || []).map((x: any) => ({ title: x.title, author: x.author, publisher: x.publisher, date: day(x.pubDate), isbn: x.isbn13 || x.isbn, link: x.link, price: x.priceSales ? `${x.priceSales}원` : undefined, cover: x.cover, source: '알라딘' }));
}

async function kakao(q: string, key: string): Promise<BookEdition[]> {
  const u = new URL('https://dapi.kakao.com/v3/search/book');
  u.searchParams.set('query', q); u.searchParams.set('sort', 'latest'); u.searchParams.set('size', '20');
  const r = await fetch(u, { headers: { Authorization: `KakaoAK ${key}` }, cache: 'no-store' });
  if (!r.ok) throw new Error(`카카오 ${r.status}`);
  const j = await r.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (j.documents || []).map((x: any) => ({ title: x.title, author: (x.authors || []).join(', '), publisher: x.publisher, date: day(x.datetime), isbn: String(x.isbn || '').split(' ').pop() || '', link: x.url, price: x.sale_price > 0 ? `${x.sale_price}원` : x.price ? `${x.price}원` : undefined, cover: x.thumbnail, source: '카카오(다음 책)' }));
}

async function google(q: string, key?: string): Promise<BookEdition[]> {
  const u = new URL('https://www.googleapis.com/books/v1/volumes');
  u.searchParams.set('q', q); u.searchParams.set('orderBy', 'newest'); u.searchParams.set('maxResults', '20'); u.searchParams.set('printType', 'books');
  if (key) u.searchParams.set('key', key);
  const r = await fetch(u, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Google Books ${r.status}`);
  const j = await r.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (j.items || []).map((x: any) => {
    const v = x.volumeInfo || {};
    const isbn = (v.industryIdentifiers || []).find((i: { type: string }) => i.type === 'ISBN_13')?.identifier || (v.industryIdentifiers || [])[0]?.identifier || '';
    return { title: [v.title, v.subtitle].filter(Boolean).join(': '), author: (v.authors || []).join(', '), publisher: v.publisher || '', date: day(v.publishedDate), isbn, link: x.saleInfo?.buyLink || v.infoLink || '', cover: v.imageLinks?.thumbnail, source: 'Google Books' };
  });
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get('q') || '').trim();
  const publisher = (sp.get('publisher') || '').trim();
  const isbn = (sp.get('isbn') || '').trim();
  if (!q && !isbn) return Response.json({ error: '교재 이름을 넣어 주세요.' }, { status: 400 });
  const query = [q, publisher].filter(Boolean).join(' ') || isbn;
  let editions: BookEdition[] = [];
  let source = '';
  const errors: string[] = [];
  const tries: [string, () => Promise<BookEdition[]>][] = [];
  if (process.env.ALADIN_TTB_KEY) tries.push(['알라딘', () => aladin(query, process.env.ALADIN_TTB_KEY!)]);
  if (process.env.KAKAO_REST_API_KEY) tries.push(['카카오', () => kakao(query, process.env.KAKAO_REST_API_KEY!)]);
  tries.push(['Google Books', () => google(isbn && !q ? `isbn:${isbn}` : `intitle:${q}${publisher ? ` inpublisher:${publisher}` : ''}`, process.env.GOOGLE_BOOKS_API_KEY)]);
  for (const [name, run] of tries) {
    try { editions = await run(); source = name; if (editions.length) break; } catch (e) { errors.push(String((e as Error).message || e)); }
  }
  const keyless = !process.env.ALADIN_TTB_KEY && !process.env.KAKAO_REST_API_KEY;
  if (!editions.length && keyless) {
    errors.push('자동으로 최신판을 찾으려면 서버에 ALADIN_TTB_KEY(알라딘 Open API, 무료)를 넣어 주세요. 그 전에는 서점 검색 링크로 확인합니다.');
  }
  // 제목 낱말이 들어 있고 (출판사를 적었으면) 출판사가 맞는 판만, 새 판부터
  const words = q.split(/\s+/).map(norm).filter(w => w.length >= 2);
  const fit = editions.filter(e => (!words.length || words.every(w => norm(e.title).includes(w))) && (!publisher || norm(e.publisher).includes(norm(publisher)) || norm(publisher).includes(norm(e.publisher))));
  const list = (fit.length ? fit : editions).filter(e => e.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  return Response.json({ editions: list, source, stores: storeLinks(q || isbn), errors, exact: fit.length > 0 });
}
