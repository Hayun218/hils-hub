import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHead({ title, desc, right }: { title: string; desc?: ReactNode; right?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {right && <div className="row">{right}</div>}
    </div>
  );
}

export function Stat({ k, v, s }: { k: string; v: ReactNode; s?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'green' | 'gold' | 'orange' | 'red' | 'deep' | 'line' }) {
  return <span className={`badge ${tone || ''}`}>{children}</span>;
}

/** 조문 링크 칩: 제33조 → /hakchik#art33 */
export function ArtLink({ no, label }: { no: number; label?: string }) {
  return <Link className="chip" href={`/hakchik#art${no}`}>{label || `제${no}조`}</Link>;
}

export function FormLink({ no, label }: { no: number; label?: string }) {
  return <Link className="chip sys" href={`/forms/${no}`}>{label || `별지 ${no}`}</Link>;
}

const STATUS_TONE: Record<string, 'green' | 'gold' | 'orange' | 'red' | 'deep' | 'line'> = {
  재학: 'green', 체험입학: 'gold', 문의: 'line', 졸업: 'deep', 퇴교: 'red',
  신청: 'gold', 승인: 'green', 반려: 'red', 구매완료: 'orange', 전표등록: 'deep',
};
export function StatusBadge({ s }: { s: string }) {
  return <Badge tone={STATUS_TONE[s]}>{s}</Badge>;
}
