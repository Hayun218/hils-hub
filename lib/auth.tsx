'use client';
// 시안용 로그인: 계정을 브라우저 localStorage에 둔다 (이 브라우저에서만 유효).
// 운영 단계에서는 같은 함수 이름을 유지한 채 Supabase Auth + staff 테이블로 바꾼다.
// 규칙
// 1. 처음 가입한 계정은 관리자로 바로 승인된다 (학교 시스템을 처음 여는 사람).
// 2. 그다음부터 가입한 계정은 '대기' 상태이고, 관리자가 승인해야 들어올 수 있다.
// 3. 권한은 관리자가 계정마다 부여한다 (lib/permissions.ts).
// 4. 시안 단계 편의: 개발 서버와 Vercel 시안 배포 모두 로그인 없이 관리자로 바로 들어간다.
//    로그아웃하면 그 탭에서는 로그인 화면이 보인다. 끄려면 환경 변수 NEXT_PUBLIC_AUTO_ADMIN=off
//    (Supabase Auth로 바꿀 때 이 자동 진입은 없앤다)
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Account, AccountStatus, Permission } from './types';

const KEY = 'hils-hub-auth-v1';
const MANUAL = 'hils-hub-manual-login'; // sessionStorage: 이 탭에서 로그아웃함
export const AUTO_ADMIN = process.env.NEXT_PUBLIC_AUTO_ADMIN !== 'off';
const DEV_ADMIN_EMAIL = 'admin@hils.local';

/** 승인된 관리자 계정을 찾고, 없으면 개발용 관리자 계정을 만든다 */
function withDevAdmin(x: Saved): Saved {
  const admin = x.accounts.find(a => a.status === '승인' && a.permissions.includes('admin'));
  if (admin) return { ...x, session: admin.id };
  const dev: Account = {
    id: crypto.randomUUID(), email: DEV_ADMIN_EMAIL, name: '관리자', status: '승인', permissions: ['admin'],
    createdAt: new Date().toISOString(), salt: '', hash: '', // 비밀번호 없음: 자동 진입 전용
  };
  return { accounts: [...x.accounts, dev], session: dev.id };
}

interface Saved { accounts: Account[]; session: string | null }

interface Auth {
  ready: boolean;
  me: Account | null;
  accounts: Account[];
  signup: (name: string, email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  logout: () => void;
  enterAsAdmin: () => void;
  setStatus: (id: string, status: AccountStatus) => void;
  setPermissions: (id: string, permissions: Permission[]) => void;
  linkTeacher: (id: string, teacherId: string | undefined) => void;
  removeAccount: (id: string) => void;
}

const Ctx = createContext<Auth | null>(null);

const norm = (e: string) => e.trim().toLowerCase();

async function hashPassword(password: string, salt: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved>({ accounts: [], session: null });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let x: Saved = { accounts: [], session: null };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) x = JSON.parse(raw);
    } catch {}
    let manual = false;
    try { manual = sessionStorage.getItem(MANUAL) === '1'; } catch {}
    if (AUTO_ADMIN && !manual && !x.accounts.some(a => a.id === x.session)) x = withDevAdmin(x);
    setSaved(x);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {}
  }, [saved, ready]);

  const auth = useMemo<Auth>(() => {
    const update = (id: string, patch: Partial<Account>) =>
      setSaved(x => ({ ...x, accounts: x.accounts.map(a => (a.id === id ? { ...a, ...patch } : a)) }));
    const me = saved.accounts.find(a => a.id === saved.session) || null;
    return {
      ready,
      me,
      accounts: saved.accounts,
      signup: async (name, email, password) => {
        if (!name.trim() || !email.trim()) return { ok: false, message: '이름과 이메일을 입력하세요' };
        if (password.length < 8) return { ok: false, message: '비밀번호는 8자 이상으로 정하세요' };
        if (saved.accounts.some(a => norm(a.email) === norm(email))) return { ok: false, message: '이미 가입한 이메일입니다' };
        // 개발용 자동 관리자 계정은 '첫 계정' 판정에서 뺀다
        const first = !saved.accounts.some(a => a.email !== DEV_ADMIN_EMAIL);
        const firstAdmin = first && !saved.accounts.some(a => a.status === '승인' && a.permissions.includes('admin'));
        const salt = crypto.randomUUID();
        const account: Account = {
          id: crypto.randomUUID(),
          email: norm(email),
          name: name.trim(),
          status: firstAdmin ? '승인' : '대기',
          permissions: firstAdmin ? ['admin'] : [],
          createdAt: new Date().toISOString(),
          salt,
          hash: await hashPassword(password, salt),
        };
        setSaved(x => ({ accounts: [...x.accounts, account], session: firstAdmin ? account.id : x.session }));
        return firstAdmin
          ? { ok: true, message: '첫 계정이라 관리자로 승인되었습니다' }
          : { ok: true, message: '가입 신청을 받았습니다. 관리자가 승인하면 로그인할 수 있습니다' };
      },
      login: async (email, password) => {
        const a = saved.accounts.find(x => norm(x.email) === norm(email));
        if (!a || !a.hash || (await hashPassword(password, a.salt)) !== a.hash) return { ok: false, message: '이메일 또는 비밀번호가 맞지 않습니다' };
        if (a.status === '대기') return { ok: false, message: '관리자 승인을 기다리는 중입니다' };
        if (a.status === '거절') return { ok: false, message: '가입이 승인되지 않았습니다. 관리자에게 문의하세요' };
        setSaved(x => ({ ...x, session: a.id }));
        return { ok: true, message: '' };
      },
      logout: () => {
        try { sessionStorage.setItem(MANUAL, '1'); } catch {}
        setSaved(x => ({ ...x, session: null }));
      },
      enterAsAdmin: () => {
        try { sessionStorage.removeItem(MANUAL); } catch {}
        setSaved(x => withDevAdmin(x));
      },
      setStatus: (id, status) => update(id, { status, approvedBy: status === '승인' ? me?.id : undefined }),
      setPermissions: (id, permissions) => update(id, { permissions }),
      linkTeacher: (id, teacherId) => update(id, { teacherId }),
      removeAccount: (id) => setSaved(x => ({ ...x, accounts: x.accounts.filter(a => a.id !== id) })),
    };
  }, [saved, ready]);

  return <Ctx.Provider value={auth}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider가 필요합니다');
  return v;
}
