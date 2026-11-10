import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/lib/markdown';
import { SYSTEM_LINKS, formsForAnchor } from '@/lib/links';
import { PageHead } from '@/components/ui';
import Toc from './Toc';
import EditButton from './EditButton';

export const metadata = { title: '학칙 · HILS Hub' };
export const dynamic = 'force-dynamic'; // 편집 후 바로 새 원문을 읽는다

export default function HakchikPage() {
  const md = fs.readFileSync(path.join(process.cwd(), 'content', 'hakchik.md'), 'utf8');
  const { nodes, toc } = renderMarkdown(md, {
    skipTitle: true,
    afterHeading: (id) => {
      const forms = formsForAnchor(id);
      const sys = SYSTEM_LINKS[id] || [];
      if (!forms.length && !sys.length) return null;
      return (
        <div className="art-links">
          {forms.map(f => <Link key={f.no} className="chip sys" href={`/forms/${f.no}`}>별지 {f.no} {f.title}</Link>)}
          {sys.map(s => <Link key={s.href + s.label} className="chip" href={s.href}>→ {s.label}</Link>)}
        </div>
      );
    },
  });
  // 개정 이력의 마지막 행 버전을 현재 버전으로 표시 (이력이 없으면 문서 정보의 버전)
  const version = [...md.matchAll(/^\| (\d+\.\d+(?:\.\d+)?) \| \d{4}-\d{2}-\d{2} \|/gm)].pop()?.[1] || md.match(/^\| 버전 \| ([^|]+) \|/m)?.[1].trim();
  return (
    <div className="page">
      <PageHead
        title="HILS 교육 방향성"
        right={<EditButton />}
        desc={<>학교의 변하지 않는 기준. 문서 번호 HILS-EDU-001 · 버전 {version} · 조문의 <b>제○조, 별표, 별지</b>를 누르면 해당 위치나 서식으로 이동합니다.</>}
      />
      <div className="doc-layout">
        <Toc items={toc} />
        <article className="doc">{nodes}</article>
      </div>
    </div>
  );
}
