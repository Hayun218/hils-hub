'use client';
import { useState } from 'react';
import { useAuth, AUTO_ADMIN } from '@/lib/auth';

export default function AuthScreen() {
  const auth = useAuth();
  const first = auth.accounts.length === 0;
  const [mode, setMode] = useState<'login' | 'signup'>(first ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = mode === 'login' ? await auth.login(email, password) : await auth.signup(name, email, password);
    setBusy(false);
    setMsg(r.message ? { ok: r.ok, text: r.message } : null);
    if (r.ok && mode === 'signup' && !first) { setMode('login'); setPassword(''); }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card stack" onSubmit={submit}>
        <div>
          <img className="logo" src="/hils-logo.png" alt="HILS 로고" />
          <h1>HILS Hub</h1>
          <p className="sub">교직원 전용 학교 운영 시스템</p>
        </div>
        <div className="seg">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setMsg(null); }}>로그인</button>
          <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setMsg(null); }}>회원가입</button>
        </div>
        {mode === 'signup' && (
          <label className="field">이름<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" required /></label>
        )}
        <label className="field">이메일<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label className="field">비밀번호
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'signup' ? 8 : undefined} />
        </label>
        {mode === 'signup' && (
          <p className="tiny muted" style={{ margin: 0 }}>
            {first ? '처음 가입하는 계정은 관리자가 됩니다.' : '가입 후 관리자가 승인하면 로그인할 수 있습니다.'}
          </p>
        )}
        {msg && <div className={`callout small ${msg.ok ? '' : 'red'}`}>{msg.text}</div>}
        <button className="btn primary" type="submit" disabled={busy} style={{ justifyContent: 'center' }}>
          {mode === 'login' ? '로그인' : first ? '관리자로 가입' : '가입 신청'}
        </button>
        {AUTO_ADMIN && (
          <button type="button" className="btn" style={{ justifyContent: 'center' }} onClick={auth.enterAsAdmin}>관리자로 바로 들어가기 (시안)</button>
        )}
        <p className="tiny muted" style={{ margin: 0, textAlign: 'center' }}>시안: 계정은 이 브라우저에만 저장됩니다.</p>
      </form>
    </div>
  );
}
