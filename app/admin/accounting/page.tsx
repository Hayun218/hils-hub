'use client';
import { useState } from 'react';
import { useHub } from '@/lib/store';
import type { PurchaseRequest, PurchaseStatus } from '@/lib/types';
import { DEMO_TODAY, won } from '@/lib/rules';
import { PageHead, Stat, StatusBadge, Badge } from '@/components/ui';

const CATEGORIES = ['교재비', '학습 소모품', '시설·비품', '행사비', '급식·기숙', '차량·교통', '기타'];
const STEPS: PurchaseStatus[] = ['신청', '승인', '구매완료', '전표등록'];

/** 구입 신청 → 학교장 승인(또는 반려) → 구매 → 전표(카드 매출전표·영수증) 등록. 목업. */
export default function AccountingPage() {
  const hub = useHub();
  const [role, setRole] = useState<'교사' | '학교장'>('교사');
  const [me, setMe] = useState('t2');
  const [filter, setFilter] = useState<PurchaseStatus | '전체'>('전체');
  const [form, setForm] = useState({ item: '', amount: '', category: '교재비', reason: '' });
  const [voucherFor, setVoucherFor] = useState<PurchaseRequest | null>(null);

  const list = hub.purchases.filter(p => filter === '전체' || p.status === filter);
  const approved = hub.purchases.filter(p => ['승인', '구매완료', '전표등록'].includes(p.status));
  const byCat = CATEGORIES.map(c => ({ c, v: approved.filter(p => p.category === c).reduce((a, p) => a + p.amount, 0) })).filter(x => x.v);
  const max = Math.max(1, ...byCat.map(x => x.v));

  const submit = () => {
    if (!form.item || !form.amount) return;
    hub.addPurchase({ date: DEMO_TODAY, item: form.item, amount: Number(form.amount), category: form.category, reason: form.reason, requester: me });
    setForm({ item: '', amount: '', category: form.category, reason: '' });
  };

  return (
    <div className="page">
      <PageHead
        title="회계 · 구입 신청"
        desc="신청 → 학교장 승인 → 구매 → 전표 등록. 모든 지출이 신청서 한 건에 묶여 증빙까지 따라갑니다. (목업)"
        right={<div className="seg">{(['교사', '학교장'] as const).map(r => <button key={r} className={role === r ? 'on' : ''} onClick={() => setRole(r)}>{r} 화면</button>)}</div>}
      />

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat k="결재 대기" v={hub.purchases.filter(p => p.status === '신청').length} s={won(hub.purchases.filter(p => p.status === '신청').reduce((a, p) => a + p.amount, 0))} />
        <Stat k="승인 누계" v={won(approved.reduce((a, p) => a + p.amount, 0))} s={`${approved.length}건`} />
        <Stat k="전표 미등록" v={hub.purchases.filter(p => p.status === '구매완료').length} s="구매 후 증빙 필요" />
        <Stat k="전표 등록 완료" v={hub.purchases.filter(p => p.status === '전표등록').length} s="결산 반영" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="card" style={{ padding: 0 }}>
          <div className="spread" style={{ padding: '14px 18px' }}>
            <div className="seg">{(['전체', '신청', '승인', '구매완료', '전표등록', '반려'] as const).map(s => <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>{s}</button>)}</div>
          </div>
          <table className="t">
            <thead><tr><th>신청일</th><th>품목</th><th>항목</th><th className="num">금액</th><th>신청자</th><th>진행</th><th /></tr></thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id}>
                  <td className="small">{p.date}</td>
                  <td><div>{p.item}</div><div className="tiny muted">{p.reason}</div>{p.voucher && <div className="tiny muted">전표 {p.voucher.no} · {p.voucher.method} · {p.voucher.vendor}</div>}</td>
                  <td className="small">{p.category}</td>
                  <td className="num">{won(p.amount)}</td>
                  <td className="small">{hub.teacherName(p.requester)}</td>
                  <td>
                    <StatusBadge s={p.status} />
                    {p.status !== '반려' && <div className="tiny muted" style={{ marginTop: 2 }}>{STEPS.indexOf(p.status) + 1}/4</div>}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {p.status === '신청' && role === '학교장' && <>
                        <button className="btn sm primary" onClick={() => hub.updatePurchase(p.id, { status: '승인', decidedBy: 'principal', decidedAt: DEMO_TODAY })}>승인</button>
                        <button className="btn sm warn" onClick={() => hub.updatePurchase(p.id, { status: '반려', decidedBy: 'principal', decidedAt: DEMO_TODAY })}>반려</button>
                      </>}
                      {p.status === '신청' && role === '교사' && <span className="tiny muted">학교장 결재 대기</span>}
                      {p.status === '승인' && <button className="btn sm" onClick={() => hub.updatePurchase(p.id, { status: '구매완료' })}>구매 완료</button>}
                      {p.status === '구매완료' && <button className="btn sm accent" onClick={() => setVoucherFor(p)}>전표 등록</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="stack">
          <div className="card">
            <h3>구입 신청</h3>
            <div className="stack">
              <label className="field">신청자<select value={me} onChange={e => setMe(e.target.value)}>{hub.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              <label className="field">품목<input value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} placeholder="예: 영어 원서 10권" /></label>
              <div className="grid g2">
                <label className="field">금액(원)<input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label>
                <label className="field">예산 항목<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
              </div>
              <label className="field">사유<input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="어떤 수업·활동에 쓰는지" /></label>
              <button className="btn primary" onClick={submit} disabled={!form.item || !form.amount}>신청</button>
            </div>
          </div>
          <div className="card">
            <h3>항목별 집행 (승인 이후)</h3>
            {byCat.map(x => (
              <div key={x.c} style={{ marginBottom: 8 }}>
                <div className="spread small"><span>{x.c}</span><span>{won(x.v)}</span></div>
                <div style={{ height: 6, background: 'var(--deep10)', borderRadius: 3 }}><div style={{ width: `${(x.v / max) * 100}%`, height: '100%', background: 'var(--green)', borderRadius: 3 }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {voucherFor && <VoucherModal p={voucherFor} onClose={() => setVoucherFor(null)} />}
    </div>
  );
}

function VoucherModal({ p, onClose }: { p: PurchaseRequest; onClose: () => void }) {
  const hub = useHub();
  const n = hub.purchases.filter(x => x.voucher).length + 13;
  const [v, setV] = useState({ no: `C-2027-${String(n).padStart(4, '0')}`, date: DEMO_TODAY, method: '법인카드' as '법인카드' | '계좌이체' | '현금', vendor: '', amount: p.amount });
  const diff = v.amount !== p.amount;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>전표 등록 · {p.item}</h2>
        <p className="small muted" style={{ marginTop: 0 }}>카드 매출전표나 영수증 정보를 입력합니다. 운영 단계에서는 사진을 첨부해 Supabase Storage에 보관합니다.</p>
        <div className="grid g2">
          <label className="field">전표 번호<input value={v.no} onChange={e => setV({ ...v, no: e.target.value })} /></label>
          <label className="field">결제일<input type="date" value={v.date} onChange={e => setV({ ...v, date: e.target.value })} /></label>
          <label className="field">결제 수단<select value={v.method} onChange={e => setV({ ...v, method: e.target.value as typeof v.method })}><option>법인카드</option><option>계좌이체</option><option>현금</option></select></label>
          <label className="field">거래처<input value={v.vendor} onChange={e => setV({ ...v, vendor: e.target.value })} /></label>
          <label className="field">실제 결제 금액<input type="number" value={v.amount} onChange={e => setV({ ...v, amount: Number(e.target.value) })} /></label>
          <label className="field">증빙 사진<input type="file" accept="image/*" disabled /></label>
        </div>
        {diff && <div className="callout gold small" style={{ marginTop: 10 }}>신청 금액({won(p.amount)})과 다릅니다. 차액 {won(v.amount - p.amount)} 사유를 확인하세요.</div>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
          <Badge tone="line">신청 {won(p.amount)}</Badge>
          <button className="btn" onClick={onClose}>취소</button>
          <button className="btn primary" disabled={!v.vendor} onClick={() => { hub.updatePurchase(p.id, { status: '전표등록', voucher: v }); onClose(); }}>등록</button>
        </div>
      </div>
    </div>
  );
}
