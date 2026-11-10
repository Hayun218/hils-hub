'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useHub } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import type { Permission } from '@/lib/types';
import { DEMO_TODAY, QUARTER_LABEL, quarterOf } from '@/lib/rules';
import AuthScreen from './AuthScreen';

interface Leaf { href: string; label: string; badge?: string; perm?: Permission }
interface Group { id: string; label: string; items: (Leaf | Group)[] }
type Node = Leaf | Group;
const isGroup = (n: Node): n is Group => 'items' in n;

const MENU: Node[] = [
  { href: '/', label: '대시보드' },
  {
    id: 'students', label: '학생관리', items: [
      { href: '/students', label: '학생 명단' },
      { href: '/records/attendance', label: '출석 현황' },
      { href: '/records/interviews', label: '면담 일지' },
      { href: '/records/life', label: '생활 기록' },
      { href: '/records/schoolrecord', label: '학교생활기록부' },
      { href: '/students/graduation', label: '졸업 요건 · 과제' },
    ],
  },
  {
    id: 'subjects', label: '교과관리', items: [
      { href: '/reports/template', label: '교과 로드맵' },
      { href: '/subjects/plans', label: '과목 운영안' },
      { href: '/admin/timetable', label: '시간표' },
      { href: '/records/diagnosis', label: '진단평가' },
      { href: '/records/grades', label: '성적 입력' },
      { href: '/reports', label: '학습 진도 보고서' },
    ],
  },
  {
    id: 'admin', label: '행정관리', items: [
      { href: '/admin/calendar', label: '학사일정' },
      { href: '/admin/duty', label: '당번표' },
    ],
  },
  {
    id: 'finance', label: '회계', items: [
      { href: '/admin/accounting', label: '구입 신청' },
      { href: '/admin/accounting/approve', label: '결재 · 구입 처리', perm: 'accounting' },
      { href: '/admin/accounting/ledger', label: '회계 장부', perm: 'accounting' },
    ],
  },
  {
    id: 'rules', label: '학칙 · 서식', items: [
      { href: '/hakchik', label: '학칙' },
      { href: '/forms', label: '별지 서식' },
    ],
  },
];

const OPEN_KEY = 'hils-hub-menu-v3';

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() || '/';
  const hub = useHub();
  const auth = useAuth();
  const [open, setOpen] = useState<Record<string, boolean>>({ students: true, subjects: true, admin: true, finance: true, rules: true, accounts: true });
  useEffect(() => {
    try { const raw = localStorage.getItem(OPEN_KEY); if (raw) setOpen(JSON.parse(raw)); } catch {}
  }, []);
  const toggle = (id: string) => setOpen(o => {
    const next = { ...o, [id]: !o[id] };
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch {}
    return next;
  });

  if (!auth.ready) return null;
  if (!auth.me) return <AuthScreen />;

  const leaves: string[] = [];
  const collect = (ns: Node[]) => ns.forEach(n => (isGroup(n) ? collect(n.items) : leaves.push(n.href)));
  collect(MENU);
  // 가장 길게 맞는 메뉴 하나만 켠다 (/reports/template는 교과 로드맵만)
  const best = leaves.filter(h => (h === '/' ? path === '/' : path === h || path.startsWith(h + '/'))).sort((a, b) => b.length - a.length)[0];
  const on = (href: string) => href === best || (href === '/admin/staff' && path.startsWith('/admin/staff')) || (href === '/admin/users' && path.startsWith('/admin/users'));
  const contains = (g: Group): boolean => g.items.some(n => (isGroup(n) ? contains(n) : on(n.href)));
  const isAdmin = can(auth.me, 'admin');
  const pending = auth.accounts.filter(a => a.status === '대기').length;
  const menu: Node[] = isAdmin ? [...MENU, {
    id: 'accounts', label: '계정관리', items: [
      { href: '/admin/staff', label: '교직원 · 담임' },
      { href: '/admin/users', label: '계정 승인 · 권한', badge: pending ? String(pending) : undefined },
    ],
  }] : MENU;

  // 권한이 없는 메뉴는 숨기고, 항목이 하나뿐인 그룹은 접기 없이 그 항목만 보인다
  const allowed = (ns: Node[]): Node[] => ns.flatMap((n): Node[] => {
    if (!isGroup(n)) return !n.perm || can(auth.me, n.perm) ? [n] : [];
    const items = allowed(n.items);
    if (!items.length) return [];
    if (items.length === 1 && !isGroup(items[0])) return [{ ...(items[0] as Leaf), label: n.label }];
    return [{ ...n, items } as Group];
  });
  const render = (nodes: Node[], depth: number): ReactNode => allowed(nodes).map(n => {
    if (!isGroup(n)) {
      return (
        <Link key={n.href} href={n.href} className={`nav-leaf d${depth}${on(n.href) ? ' on' : ''}`}>
          <span>{n.label}</span>
          {n.badge && <span className="n">{n.badge}</span>}
        </Link>
      );
    }
    const isOpen = open[n.id] ?? true;
    return (
      <div key={n.id} className={`nav-group-wrap d${depth}`}>
        <button type="button" className={`nav-toggle d${depth}${contains(n) ? ' has-on' : ''}`} aria-expanded={isOpen} onClick={() => toggle(n.id)}>
          <span className={`caret${isOpen ? ' open' : ''}`} aria-hidden>▸</span>{n.label}
        </button>
        {isOpen && <div className="nav-children">{render(n.items, depth + 1)}</div>}
      </div>
    );
  });

  return (
    <div className="app">
      <aside className="side">
        <Link href="/" className="brand"><img className="brand-logo" src="/hils-logo.png" alt="" /><div><b>HILS Hub</b><span>학교 운영 시스템</span></div></Link>
        <nav className="nav">{render(menu, 0)}</nav>
        <div className="side-foot">
          <div>{DEMO_TODAY} · {QUARTER_LABEL[quarterOf(DEMO_TODAY)]}</div>
          <div>재학 {hub.students.filter(s => s.status === '재학').length}명</div>
          <div className="user-box">
            <b>{auth.me.name}</b>{isAdmin && <span> · 관리자</span>}
            <div className="row" style={{ marginTop: 6, gap: 6 }}>
              <button type="button" onClick={auth.logout}>로그아웃</button>
              <button type="button" title={hub.source === 'roster' ? '학생 명단은 reference/private의 실제 명단, 기록은 이 브라우저에만 저장' : '가상 시연 데이터'}
                onClick={() => { if (confirm('입력한 기록을 지우고 명단을 처음 상태로 되돌릴까요? (계정은 그대로)')) hub.reset(); }}>데이터 초기화</button>
            </div>
          </div>
          <div className="tiny" style={{ marginTop: 8, opacity: 0.7 }}>시안 · 기록은 이 브라우저에만 저장</div>
        </div>
      </aside>
      <div className="main">
        <div className="demo-banner no-print">2027학년도부터 사용할 HILS 학교 운영 시스템 <b>시안</b>입니다. 데이터베이스 연결 전이라 입력한 기록은 이 브라우저에만 저장되고, 학생 이름은 가상입니다.</div>
        {children}
      </div>
    </div>
  );
}
