'use client';
import { useState } from 'react';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { ApproveTab, BuyTab } from '@/components/Accounting';
import { PageHead } from '@/components/ui';

export default function ApprovePage() {
  const hub = useHub();
  const auth = useAuth();
  const [tab, setTab] = useState<'결재' | '구입 처리'>('결재');
  if (!can(auth.me, 'accounting')) return <div className="page"><PageHead title="결재 · 구입 처리" /><div className="callout red">회계 승인 권한이 있는 교직원만 봅니다.</div></div>;
  const waiting = hub.purchases.filter(p => p.status === '신청').length;
  const toBuy = hub.purchases.filter(p => p.status === '승인').length;
  return (
    <div className="page">
      <PageHead title="결재 · 구입 처리" desc="신청을 확인(OK)하거나 반려하고, 확인한 물품을 구입한 뒤 구입 완료(✅)로 바꿉니다." />
      <div className="tabs">
        <button className={tab === '결재' ? 'on' : ''} onClick={() => setTab('결재')}>결재 {waiting || ''}</button>
        <button className={tab === '구입 처리' ? 'on' : ''} onClick={() => setTab('구입 처리')}>구입 처리 {toBuy || ''}</button>
      </div>
      {tab === '결재' ? <ApproveTab /> : <BuyTab me={auth.me?.teacherId || ''} />}
    </div>
  );
}
