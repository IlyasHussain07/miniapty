import React, { useState } from 'react';
import { useStore } from '../../store/index';

export function LoginForm() {
  const { login, isLoading, setView } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div style={wrap}>
      <h2 style={heading}>Sign In</h2>
      <form onSubmit={async e => { e.preventDefault(); await login(email, password); }} style={form}>
        <label style={lbl}>Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" style={inp} />
        </label>
        <label style={lbl}>Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="current-password" style={inp} />
        </label>
        <button type="submit" disabled={isLoading} style={btnPrimary}>
          {isLoading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <p style={footer}>
        No account?{' '}
        <button onClick={() => setView('register')} style={link}>Create one</button>
      </p>
    </div>
  );
}

const wrap: React.CSSProperties  = { padding: 24 };
const heading: React.CSSProperties = { fontSize: 18, fontWeight: 800, marginBottom: 20, color: '#1a202c' };
const form: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 14 };
const lbl: React.CSSProperties   = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, fontWeight: 600, color: '#4a5568' };
const inp: React.CSSProperties   = { padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, fontWeight: 400, outline: 'none', color: '#1a202c' };
const btnPrimary: React.CSSProperties = { padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 14, marginTop: 4 };
const footer: React.CSSProperties = { marginTop: 18, fontSize: 13, color: '#718096', textAlign: 'center' };
const link: React.CSSProperties   = { border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0 };
