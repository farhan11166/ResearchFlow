import { useState, useEffect } from 'react';
import AuthPage from './AuthPage';
import ChatApp from './ChatApp';
import './index.css';

const API = 'http://localhost:3000';

export default function App() {
  const [authState, setAuthState] = useState<'loading' | 'authed' | 'guest'>('loading');

  useEffect(() => {
    // Check session by hitting the /auth/me endpoint — the HttpOnly cookie is
    // sent automatically by the browser (we never touch it with JS)
    fetch(`${API}/auth/me`, { credentials: 'include' })
      .then(r => r.ok ? setAuthState('authed') : setAuthState('guest'))
      .catch(() => setAuthState('guest'));
  }, []);

  if (authState === 'loading') {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', opacity: 0.4 }} />
      </div>
    );
  }

  return authState === 'authed'
    ? <ChatApp onLogout={() => setAuthState('guest')} />
    : <AuthPage onLogin={() => setAuthState('authed')} />;
}
