// 브라우저에서 PDF의 글자를 뽑는다 (pdf.js). 서버·API 키가 필요 없다. 스캔 이미지 PDF는 글자가 없어 빈 문자열이 된다.
// 워커 파일: public/pdf.worker.min.mjs (node_modules/pdfjs-dist/legacy/build 에서 복사, 패키지 버전을 바꾸면 같이 바꾼다)
export interface PdfItem { s: string; x: number; y: number; w: number; page: number }

export async function pdfText(file: Blob): Promise<string> {
  return (await pdfRead(file)).text;
}

/** 글과 함께 글 조각의 위치(표의 칸 맞추기용)를 돌려준다 */
export async function pdfRead(file: Blob): Promise<{ text: string; items: PdfItem[] }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  const items: PdfItem[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const c = await page.getTextContent();
    // 글자 하나씩 나뉜 조각을 붙어 있는 것끼리 낱말로 합친다 (간격 2pt 이하)
    const raw = c.items.flatMap(it => ('str' in it && it.str.trim() ? [{ s: it.str.trim(), x: it.transform[4], y: it.transform[5], w: it.width, page: i }] : []))
      .sort((a, b) => b.y - a.y || a.x - b.x);
    for (const it of raw) {
      const last = items[items.length - 1];
      if (last && last.page === i && Math.abs(last.y - it.y) <= 2 && it.x - (last.x + last.w) <= 2 && it.x >= last.x) { last.s += it.s; last.w = it.x + it.w - last.x; }
      else items.push({ ...it });
    }
    // 같은 줄(y 좌표)끼리 묶어 줄 단위 글로 만든다
    const lines = new Map<number, { x: number; s: string }[]>();
    for (const it of c.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      const key = [...lines.keys()].find(k => Math.abs(k - y) <= 2) ?? y;
      lines.set(key, [...(lines.get(key) || []), { x: it.transform[4], s: it.str }]);
    }
    pages.push([...lines.entries()].sort((a, b) => b[0] - a[0]).map(([, xs]) => xs.sort((a, b) => a.x - b.x).map(x => x.s).join(' ')).join('\n'));
  }
  return { text: pages.join('\n'), items };
}
