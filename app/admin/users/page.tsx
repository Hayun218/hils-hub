'use client';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/store';
import { PERMISSIONS, can } from '@/lib/permissions';
import type { Account, Permission } from '@/lib/types';
import { PageHead, Badge } from '@/components/ui';

const TONE = { 대기: 'gold', 승인: 'green', 거절: 'red' } as const;

export default function UsersPage() {
  const auth = useAuth();
  const hub = useHub();
  if (!can(auth.me, 'admin')) {
    return <div className="page"><PageHead title="교직원 계정" /><div className="callout red">관리자만 볼 수 있습니다.</div></div>;
  }
  const order = { 대기: 0, 승인: 1, 거절: 2 };
  const list = [...auth.accounts].sort((a, b) => order[a.status] - order[b.status] || a.createdAt.localeCompare(b.createdAt));
  const pending = list.filter(a => a.status === '대기').length;
  const admins = auth.accounts.filter(a => a.status === '승인' && a.permissions.includes('admin'));

  const toggle = (a: Account, p: Permission, on: boolean) => {
    if (p === 'admin' && !on && admins.length === 1 && admins[0].id === a.id) {
      alert('관리자가 한 명뿐이라 관리자 권한을 끌 수 없습니다. 다른 사람에게 먼저 관리자 권한을 주세요.');
      return;
    }
    auth.setPermissions(a.id, on ? [...a.permissions, p] : a.permissions.filter(x => x !== p));
  };

  const linkNew = (a: Account) => {
    const t = hub.addTeacher({ name: a.name, subjects: [], areas: [] });
    auth.linkTeacher(a.id, t.id);
  };

  return (
    <div className="page">
      <PageHead
        title="교직원 계정"
        desc={<>가입 신청을 승인하고 권한을 줍니다. 승인 대기 {pending}명. 권한은 학칙의 역할(제35조)에 맞춰 줍니다.</>}
      />

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="t">
          <thead>
            <tr>
              <th>이름</th><th>상태</th><th>연결된 교사</th>
              {PERMISSIONS.map(p => <th key={p.key} title={p.desc} style={{ textAlign: 'center' }}>{p.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.map(a => {
              const isMe = a.id === auth.me?.id;
              const isAdmin = a.permissions.includes('admin');
              return (
                <tr key={a.id}>
                  <td>
                    <b>{a.name}</b>{isMe && <span className="tiny muted"> (나)</span>}
                    <div className="tiny muted">{a.email} · {a.createdAt.slice(0, 10)} 가입</div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Badge tone={TONE[a.status]}>{a.status}</Badge>
                    <div className="row" style={{ marginTop: 6, gap: 6 }}>
                      {a.status !== '승인' && <button className="btn sm primary" onClick={() => auth.setStatus(a.id, '승인')}>승인</button>}
                      {a.status === '대기' && <button className="btn sm warn" onClick={() => auth.setStatus(a.id, '거절')}>거절</button>}
                      {a.status === '승인' && !isMe && <button className="btn sm" onClick={() => { if (confirm(`${a.name} 계정의 승인을 취소할까요? 다시 로그인할 수 없게 됩니다.`)) auth.setStatus(a.id, '대기'); }}>승인 취소</button>}
                      {a.status === '거절' && <button className="btn sm" onClick={() => { if (confirm(`${a.name} 계정을 지울까요?`)) auth.removeAccount(a.id); }}>삭제</button>}
                    </div>
                  </td>
                  <td>
                    <select className="input" style={{ padding: '4px 6px' }} value={a.teacherId || ''} onChange={e => auth.linkTeacher(a.id, e.target.value || undefined)} aria-label={`${a.name} 교사 연결`}>
                      <option value="">연결 안 함</option>
                      {hub.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {!a.teacherId && <button className="btn sm" style={{ marginLeft: 6 }} onClick={() => linkNew(a)}>새 교사로 등록</button>}
                  </td>
                  {PERMISSIONS.map(p => (
                    <td key={p.key} style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        aria-label={`${a.name} ${p.label}`}
                        checked={a.permissions.includes(p.key) || (p.key !== 'admin' && isAdmin)}
                        disabled={a.status !== '승인' || (p.key !== 'admin' && isAdmin)}
                        onChange={e => toggle(a, p.key, e.target.checked)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>권한 설명</h3>
        <table className="t small">
          <tbody>{PERMISSIONS.map(p => <tr key={p.key}><td style={{ width: 140 }}><b>{p.label}</b></td><td>{p.desc}</td></tr>)}</tbody>
        </table>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          시안 단계에서는 관리자·학칙 편집 권한만 화면에서 막습니다. 나머지 권한은 Supabase 연결 때 RLS로 함께 적용합니다.
        </p>
      </div>
    </div>
  );
}
