'use client';
import { useAuth } from '@/lib/auth';
import { RequestTab } from '@/components/Accounting';
import { PageHead } from '@/components/ui';

export default function PurchaseRequestPage() {
  const auth = useAuth();
  return (
    <div className="page">
      <PageHead title="구입 신청" desc="비품 구입 신청 → 회계 확인(OK) → 구입 완료(✅). 신청한 내용과 진행 상태를 볼 수 있습니다." />
      <RequestTab me={auth.me?.teacherId || ''} />
    </div>
  );
}
