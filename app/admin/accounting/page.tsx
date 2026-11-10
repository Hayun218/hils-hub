'use client';
// 회계: 비품 구입 신청 → 확인(OK) → 구입 완료(✅) → 전표. Slack #비품구입 절차를 옮겼다.
// 일반 교직원은 신청만, 회계 관리자(권한: 회계 승인)는 결재·구입 처리·전체 장부까지.
import { useMemo, useState } from 'react';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { DEMO_TODAY, won } from '@/lib/rules';
import type { PurchaseRequest, PurchaseStatus } from '@/lib/types';
import { downloadBlob } from '@/lib/formDocx';
import { PageHead, Badge, StatusBadge } from '@/components/ui';

const CATEGORIES = ['학습 소모품', '교재비', '청소·생활용품', '시설·비품', '행사비', '급식·기숙', '차량·교통', '기타'];
type Tab = '구입 신청' | '결재' | '구입 처리' | '전체 장부';
const LABEL: Record<PurchaseStatus, string> = { 신청: '신청', 승인: '확인 OK', 반려: '반려', 구매완료: '구입 완료 ✅', 전표등록: '전표 등록' };
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const dayLabel = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))} (${DOW[new Date(`${d}T00:00:00`).getDay()]})`;
const priceText = (p: PurchaseRequest) => (p.amountMin && p.amountMin !== p.amount ? `${p.amountMin.toLocaleString()}–${p.amount.toLocaleString()}원` : won(p.amount));

/** Slack "[비품 구입 신청]" 글에서 칸을 읽는다 */
function parseSlack(t: string) {
  const get = (k: string) => t.match(new RegExp(`${k}\\s*[:：]\\s*(.+)`))?.[1]?.replace(/\(편집됨\)/, '').trim() || '';
  const money = get('예상 금액').replace(/[,원\s]/g, '');
  const [a, b] = money.split(/[-~–]/).map(Number);
  return { item: get('신청 물품'), quantity: get('수량'), min: a || 0, max: b || a || 0, vendor: get('구입처'), reason: get('구입 목적') };
}

export default function AccountingPage() {
  const hub = useHub();
  const auth = useAuth();
  const manager = can(auth.me, 'accounting');
  const me = auth.me?.teacherId || '';
  const tabs: Tab[] = manager ? ['구입 신청', '결재', '구입 처리', '전체 장부'] : ['구입 신청'];
  const [tab, setTab] = useState<Tab>('구입 신청');
  const waiting = hub.purchases.filter(p => p.status === '신청');
  const toBuy = hub.purchases.filter(p => p.status === '승인');
  const month = DEMO_TODAY.slice(0, 7);
  const spent = hub.purchases.filter(p => (p.status === '구매완료' || p.status === '전표등록') && (p.purchasedAt || p.date).startsWith(month)).reduce((a, p) => a + (p.actualAmount ?? p.amount), 0);

  return (
    <div className="page">
      <PageHead
        title="회계 · 구입 신청"
        desc={<>비품 구입 신청 → 회계 확인(OK) → 구입 완료(✅) → 전표 등록. {manager ? '회계 관리자는 전체 신청과 장부를 봅니다.' : '신청한 내용과 진행 상태를 볼 수 있습니다.'}</>}
      />
      {manager && (
        <div className="grid g4" style={{ marginBottom: 14 }}>
          <div className="card stat"><div className="k">확인 대기</div><div className="v">{waiting.length}건</div><div className="s">{won(waiting.reduce((a, p) => a + p.amount, 0))}</div></div>
          <div className="card stat"><div className="k">구입할 것</div><div className="v">{toBuy.length}건</div><div className="s">확인 OK, 구입 전</div></div>
          <div className="card stat"><div className="k">{Number(month.slice(5))}월 지출</div><div className="v">{won(spent)}</div><div className="s">구입 완료 기준</div></div>
          <div className="card stat"><div className="k">전표 미등록</div><div className="v">{hub.purchases.filter(p => p.status === '구매완료').length}건</div><div className="s">영수증·카드 전표</div></div>
        </div>
      )}
      <div className="tabs">
        {tabs.map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}{t === '결재' && waiting.length ? ` ${waiting.length}` : t === '구입 처리' && toBuy.length ? ` ${toBuy.length}` : ''}</button>)}
      </div>
      {tab === '구입 신청' && <RequestTab me={me} />}
      {tab === '결재' && manager && <ApproveTab />}
      {tab === '구입 처리' && manager && <BuyTab me={me} />}
      {tab === '전체 장부' && manager && <LedgerTab />}
    </div>
  );
}

function RequestTab({ me }: { me: string }) {
  const hub = useHub();
  const blank = { item: '', quantity: '', min: '', max: '', vendor: '', reason: '', category: CATEGORIES[0], requester: me };
  const [f, setF] = useState(blank);
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState('');
  const set = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }));
  const mine = hub.purchases.filter(p => !me || p.requester === me).sort((a, b) => b.date.localeCompare(a.date));
  const submit = () => {
    const max = Number(f.max || f.min), min = Number(f.min || f.max);
    if (!f.item.trim() || !max) return;
    hub.addPurchase({ date: DEMO_TODAY, item: f.item.trim(), quantity: f.quantity || undefined, amount: max, amountMin: min !== max ? min : undefined, vendor: f.vendor || undefined, category: f.category, reason: f.reason, requester: f.requester });
    setMsg(`신청했습니다: ${f.item}`); setF(blank);
  };
  const fromSlack = () => {
    const x = parseSlack(paste);
    set({ item: x.item, quantity: x.quantity, min: x.min ? String(x.min) : '', max: x.max ? String(x.max) : '', vendor: x.vendor, reason: x.reason });
    setPaste('');
  };
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'start' }}>
      <div className="paper" style={{ minHeight: 0 }}>
        <h1 className="paper-title" style={{ fontSize: 20 }}>비 품 구 입 신 청</h1>
        <div className="paper-sub">신청일 {dayLabel(DEMO_TODAY)}</div>
        <table className="paper-table"><tbody>
          <tr><th>신청자</th><td><select value={f.requester} onChange={e => set({ requester: e.target.value })} aria-label="신청자"><option value="">선택</option>{hub.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></td></tr>
          <tr><th>신청 물품</th><td><input value={f.item} onChange={e => set({ item: e.target.value })} placeholder="예: 빨간 볼펜 1.0" aria-label="신청 물품" /></td></tr>
          <tr><th>수량</th><td><input value={f.quantity} onChange={e => set({ quantity: e.target.value })} placeholder="예: 3set (1 set = 4개)" aria-label="수량" /></td></tr>
          <tr><th>예상 금액</th><td><div className="row" style={{ flexWrap: 'nowrap' }}><input inputMode="numeric" value={f.min} onChange={e => set({ min: e.target.value })} placeholder="3,000" aria-label="예상 금액 최소" /><span>–</span><input inputMode="numeric" value={f.max} onChange={e => set({ max: e.target.value })} placeholder="6,000 (한 값이면 비워 둠)" aria-label="예상 금액 최대" /><span>원</span></div></td></tr>
          <tr><th>구입처</th><td><input value={f.vendor} onChange={e => set({ vendor: e.target.value })} placeholder="예: 다이소" aria-label="구입처" /></td></tr>
          <tr><th>구입 목적</th><td><input value={f.reason} onChange={e => set({ reason: e.target.value })} placeholder="예: 채점" aria-label="구입 목적" /></td></tr>
          <tr><th>예산 항목</th><td><select value={f.category} onChange={e => set({ category: e.target.value })} aria-label="예산 항목">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></td></tr>
        </tbody></table>
        <div className="paper-actions" style={{ marginTop: 6 }}>
          {msg && <span className="small" style={{ color: 'var(--green)' }}>{msg}</span>}
          <button className="btn primary" onClick={submit} disabled={!f.item.trim() || !(f.max || f.min)}>신청</button>
        </div>
        <details className="slack-paste">
          <summary>Slack에 올린 신청 글 붙여넣기</summary>
          <textarea value={paste} onChange={e => setPaste(e.target.value)} placeholder={'[비품 구입 신청]\n신청일: 11/2 (월)\n신청자: …\n신청 물품: …\n수량: …\n예상 금액: 3,000-6,000\n구입처: …\n구입 목적: …'} aria-label="Slack 글" />
          <button className="btn sm" onClick={fromSlack} disabled={!paste.trim()}>칸 채우기</button>
        </details>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px 6px' }}><h3 style={{ margin: 0 }}>{me ? '내 신청' : '신청 목록'}</h3></div>
        <table className="t small">
          <thead><tr><th>신청일</th><th>물품</th><th>예상</th><th>상태</th></tr></thead>
          <tbody>
            {mine.map(p => (
              <tr key={p.id}>
                <td>{dayLabel(p.date)}</td>
                <td><b>{p.item}</b>{p.quantity && <span className="muted"> · {p.quantity}</span>}{p.rejectReason && <div className="tiny" style={{ color: 'var(--red)' }}>반려: {p.rejectReason}</div>}{p.purchaseNote && <div className="tiny muted">{p.purchaseNote}</div>}</td>
                <td>{priceText(p)}</td>
                <td><StatusBadge s={p.status} /></td>
              </tr>
            ))}
            {mine.length === 0 && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 20 }}>신청한 내용이 없습니다</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApproveTab() {
  const hub = useHub();
  const auth = useAuth();
  const list = hub.purchases.filter(p => p.status === '신청').sort((a, b) => a.date.localeCompare(b.date));
  const decide = (p: PurchaseRequest, ok: boolean) => {
    const reason = ok ? undefined : prompt('반려 사유를 적어 주세요') || undefined;
    if (!ok && !reason) return;
    hub.updatePurchase(p.id, { status: ok ? '승인' : '반려', decidedBy: auth.me?.teacherId || auth.me?.name, decidedAt: DEMO_TODAY, rejectReason: reason });
  };
  return (
    <div className="card" style={{ padding: 0 }}>
      <table className="t">
        <thead><tr><th>신청일</th><th>신청자</th><th>물품 · 수량</th><th>예상 금액</th><th>구입처</th><th>목적</th><th /></tr></thead>
        <tbody>
          {list.map(p => (
            <tr key={p.id}>
              <td className="small">{dayLabel(p.date)}</td>
              <td className="small">{hub.teacherName(p.requester)}</td>
              <td><b>{p.item}</b>{p.quantity && <div className="tiny muted">{p.quantity}</div>}</td>
              <td className="small">{priceText(p)}</td>
              <td className="small">{p.vendor || '-'}</td>
              <td className="small">{p.reason}</td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="btn sm primary" onClick={() => decide(p, true)}>확인 OK</button>{' '}
                <button className="btn sm warn" onClick={() => decide(p, false)}>반려</button>
              </td>
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 28 }}>확인할 신청이 없습니다</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function BuyTab({ me }: { me: string }) {
  const hub = useHub();
  const list = hub.purchases.filter(p => p.status === '승인').sort((a, b) => a.date.localeCompare(b.date));
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [actual, setActual] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [report, setReport] = useState('');
  const done = () => {
    const ids = list.filter(p => pick[p.id]).map(p => p.id);
    if (!ids.length) return;
    const lines: string[] = [];
    ids.forEach(id => {
      const p = list.find(x => x.id === id)!;
      hub.updatePurchase(id, { status: '구매완료', purchasedBy: me || undefined, purchasedAt: DEMO_TODAY, actualAmount: Number(actual[id]) || p.amount, purchaseNote: note[id] || undefined });
      lines.push(`• ${p.item}${p.quantity ? ` ${p.quantity}` : ''}${note[id] ? ` (${note[id]})` : ''}`);
    });
    const d = new Date(`${DEMO_TODAY}T00:00:00`);
    const week = Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);
    setReport(`${d.getMonth() + 1}월${week}주차 비품구입 완료 했습니다\n${lines.join('\n')}\n\n확인완료는 OK 구입완료는 ✅ 이모지로 하도록 하겠습니다`);
    setPick({});
  };
  return (
    <div className="stack">
      <div className="card" style={{ padding: 0 }}>
        <table className="t">
          <thead><tr><th style={{ width: 36 }} /><th>물품 · 수량</th><th>신청자</th><th>예상</th><th>실제 금액</th><th>메모 (대체 구입 등)</th></tr></thead>
          <tbody>
            {list.map(p => (
              <tr key={p.id}>
                <td><input type="checkbox" checked={!!pick[p.id]} onChange={e => setPick({ ...pick, [p.id]: e.target.checked })} aria-label={`${p.item} 선택`} /></td>
                <td><b>{p.item}</b>{p.quantity && <span className="muted small"> · {p.quantity}</span>}<div className="tiny muted">{p.vendor || ''} {p.reason ? `· ${p.reason}` : ''}</div></td>
                <td className="small">{hub.teacherName(p.requester)}</td>
                <td className="small">{priceText(p)}</td>
                <td><input className="input" style={{ width: 110 }} inputMode="numeric" value={actual[p.id] || ''} onChange={e => setActual({ ...actual, [p.id]: e.target.value })} placeholder={String(p.amount)} aria-label="실제 금액" /></td>
                <td><input className="input" style={{ width: '100%' }} value={note[p.id] || ''} onChange={e => setNote({ ...note, [p.id]: e.target.value })} aria-label="메모" /></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 28 }}>구입할 항목이 없습니다</td></tr>}
          </tbody>
        </table>
        <div className="row" style={{ justifyContent: 'flex-end', padding: 12 }}>
          <button className="btn primary" onClick={done} disabled={!Object.values(pick).some(Boolean)}>선택한 항목 구입 완료 ✅</button>
        </div>
      </div>
      {report && (
        <div className="card">
          <div className="spread"><h3 style={{ margin: 0 }}>주간 구입 완료 보고</h3><button className="btn sm" onClick={() => navigator.clipboard?.writeText(report)}>복사</button></div>
          <p className="tiny muted">Slack 채널에 그대로 붙여 넣을 수 있습니다.</p>
          <pre className="report-pre">{report}</pre>
        </div>
      )}
    </div>
  );
}

function LedgerTab() {
  const hub = useHub();
  const [month, setMonth] = useState('전체');
  const [status, setStatus] = useState<PurchaseStatus | '전체'>('전체');
  const [cat, setCat] = useState('전체');
  const [voucher, setVoucher] = useState<PurchaseRequest | null>(null);
  const months = useMemo(() => [...new Set(hub.purchases.map(p => p.date.slice(0, 7)))].sort().reverse(), [hub.purchases]);
  const list = hub.purchases
    .filter(p => month === '전체' || p.date.startsWith(month))
    .filter(p => status === '전체' || p.status === status)
    .filter(p => cat === '전체' || p.category === cat)
    .sort((a, b) => b.date.localeCompare(a.date));
  const spentOf = (ps: PurchaseRequest[]) => ps.filter(p => p.status === '구매완료' || p.status === '전표등록').reduce((a, p) => a + (p.actualAmount ?? p.amount), 0);
  const byCat = CATEGORIES.map(c => ({ c, v: spentOf(list.filter(p => p.category === c)) })).filter(x => x.v);
  const max = Math.max(1, ...byCat.map(x => x.v));
  const exportCsv = () => {
    const rows = [['신청일', '신청자', '물품', '수량', '예상 금액', '실제 금액', '구입처', '목적', '항목', '상태', '구입일', '전표 번호'],
      ...list.map(p => [p.date, hub.teacherName(p.requester), p.item, p.quantity || '', priceText(p), p.actualAmount ?? '', p.vendor || '', p.reason, p.category, LABEL[p.status], p.purchasedAt || '', p.voucher?.no || ''])];
    const csv = '﻿' + rows.map(r => r.map(v => { const x = String(v ?? ''); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; }).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `HILS_구입장부_${month === '전체' ? '전체' : month}.csv`);
  };
  return (
    <div className="stack">
      <div className="card row">
        <select className="input" value={month} onChange={e => setMonth(e.target.value)} aria-label="월"><option value="전체">전체 기간</option>{months.map(m => <option key={m} value={m}>{m}</option>)}</select>
        <select className="input" value={status} onChange={e => setStatus(e.target.value as PurchaseStatus | '전체')} aria-label="상태"><option value="전체">전체 상태</option>{(Object.keys(LABEL) as PurchaseStatus[]).map(s => <option key={s} value={s}>{LABEL[s]}</option>)}</select>
        <select className="input" value={cat} onChange={e => setCat(e.target.value)} aria-label="항목"><option value="전체">전체 항목</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        <span className="small" style={{ marginLeft: 'auto' }}>{list.length}건 · 지출 <b>{won(spentOf(list))}</b></span>
        <button className="btn" onClick={exportCsv}>CSV 내려받기</button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 260px', alignItems: 'start' }}>
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="t small">
            <thead><tr><th>신청일</th><th>신청자</th><th>물품</th><th>예상</th><th>실제</th><th>항목</th><th>상태</th><th /></tr></thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id}>
                  <td>{p.date}</td><td>{hub.teacherName(p.requester)}</td>
                  <td><b>{p.item}</b>{p.quantity && <span className="muted"> · {p.quantity}</span>}{p.vendor && <div className="tiny muted">{p.vendor}</div>}</td>
                  <td>{priceText(p)}</td><td>{p.actualAmount != null ? won(p.actualAmount) : ''}</td>
                  <td>{p.category}</td><td><Badge tone={p.status === '반려' ? 'red' : p.status === '신청' ? 'gold' : p.status === '승인' ? 'line' : 'green'}>{LABEL[p.status]}</Badge></td>
                  <td>{p.status === '구매완료' && <button className="btn sm" onClick={() => setVoucher(p)}>전표</button>}{p.voucher && <span className="tiny muted">{p.voucher.no}</span>}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 24 }}>기록이 없습니다</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>항목별 지출</h3>
          {byCat.length === 0 && <p className="small muted">지출 없음</p>}
          {byCat.map(x => (
            <div key={x.c} style={{ marginBottom: 8 }}>
              <div className="spread small"><span>{x.c}</span><span>{won(x.v)}</span></div>
              <div className="bar"><span style={{ width: `${(x.v / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
      {voucher && <VoucherModal p={voucher} onClose={() => setVoucher(null)} />}
    </div>
  );
}

function VoucherModal({ p, onClose }: { p: PurchaseRequest; onClose: () => void }) {
  const hub = useHub();
  const [v, setV] = useState({ no: '', date: p.purchasedAt || DEMO_TODAY, method: '법인카드' as '법인카드' | '계좌이체' | '현금', vendor: p.vendor || '', amount: String(p.actualAmount ?? p.amount) });
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>전표 등록 · {p.item}</h2>
        <div className="grid g2" style={{ marginTop: 10 }}>
          <label className="field">전표 번호<input value={v.no} onChange={e => setV({ ...v, no: e.target.value })} placeholder="C-2027-0001" /></label>
          <label className="field">결제일<input type="date" value={v.date} onChange={e => setV({ ...v, date: e.target.value })} /></label>
          <label className="field">결제 수단<select value={v.method} onChange={e => setV({ ...v, method: e.target.value as typeof v.method })}><option>법인카드</option><option>계좌이체</option><option>현금</option></select></label>
          <label className="field">거래처<input value={v.vendor} onChange={e => setV({ ...v, vendor: e.target.value })} /></label>
          <label className="field">금액<input inputMode="numeric" value={v.amount} onChange={e => setV({ ...v, amount: e.target.value })} /></label>
        </div>
        <p className="tiny muted">영수증·카드 전표 사진 업로드는 Supabase Storage 연결 때 붙입니다.</p>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn" onClick={onClose}>취소</button>
          <button className="btn primary" disabled={!v.no} onClick={() => { hub.updatePurchase(p.id, { status: '전표등록', voucher: { ...v, amount: Number(v.amount) } }); onClose(); }}>등록</button>
        </div>
      </div>
    </div>
  );
}
