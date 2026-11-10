'use client';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { LedgerTab } from '@/components/Accounting';
import { PageHead } from '@/components/ui';

export default function LedgerPage() {
  const auth = useAuth();
  if (!can(auth.me, 'accounting')) return <div className="page"><PageHead title="회계 장부" /><div className="callout red">회계 승인 권한이 있는 교직원만 봅니다.</div></div>;
  return (
    <div className="page">
      <PageHead title="회계 장부" desc="모든 구입 신청과 지출. 월·상태·항목으로 걸러 보고, 전표를 등록하고, CSV로 내려받습니다." />
      <LedgerTab />
    </div>
  );
}
