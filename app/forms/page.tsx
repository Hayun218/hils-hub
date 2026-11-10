'use client';
import Link from 'next/link';
import { FORMS } from '@/lib/forms';
import { useHub } from '@/lib/store';
import { PageHead, ArtLink, Badge } from '@/components/ui';

export default function FormsPage() {
  const hub = useHub();
  const count = (no: number) => hub.forms.filter(f => f.formNo === no).length;
  return (
    <div className="page">
      <PageHead
        title="별지 서식"
        desc="학칙이 정한 서식 8종. 웹에서 바로 작성해 기록으로 남기거나, Word로 내려받아 씁니다."
      />
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="t">
          <thead>
            <tr><th style={{ width: 70 }}>번호</th><th>서식</th><th>근거</th><th>작성 시점</th><th>작성자</th><th className="num">기록</th><th /></tr>
          </thead>
          <tbody>
            {FORMS.map(f => (
              <tr key={f.no}>
                <td className="muted">별지 {f.no}</td>
                <td>
                  <Link href={`/forms/${f.no}`} style={{ fontWeight: 600 }}>{f.title}</Link>
                  {f.privateForm && <> <Badge tone="line">비공개</Badge></>}
                </td>
                <td><div className="row" style={{ gap: 4 }}>{f.articles.map(a => <ArtLink key={a} no={a} />)}</div></td>
                <td className="small">{f.when}</td>
                <td className="small">{f.writer}</td>
                <td className="num">{count(f.no) || ''}</td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <Link className="btn sm primary" href={`/forms/${f.no}?new=1`}>작성</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny muted">서식 원문은 학칙과 함께 관리합니다 (content/forms). 원문을 고치면 입력 화면과 Word 파일이 함께 바뀝니다.</p>
    </div>
  );
}
