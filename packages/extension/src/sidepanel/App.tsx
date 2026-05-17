import React, { useEffect, useCallback, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { useStore } from './store/index';
import { LoginForm } from './components/Auth/LoginForm';
import { RegisterForm } from './components/Auth/RegisterForm';
import { WalkthroughList } from './components/WalkthroughList/index';
import { WalkthroughEditor } from './components/WalkthroughEditor/index';
import type { Step } from '../shared/types';

// ── Error Boundary ────────────────────────────────────────────────────────────

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: Error) {
    return { error: err.message };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[Mini Apty]', err, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, fontFamily: 'system-ui' }}>
          <p style={{ fontWeight: 700, color: '#c53030', marginBottom: 8 }}>Something went wrong</p>
          <p style={{ fontSize: 13, color: '#4a5568', marginBottom: 16 }}>{this.state.error}</p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Error Banner ──────────────────────────────────────────────────────────────

const ERROR_COLOR: Record<string, string> = {
  network: '#744210', auth: '#c53030', forbidden: '#c05621', validation: '#2c5282', unknown: '#742a2a',
};
const ERROR_LABEL: Record<string, string> = {
  network: 'Network error', auth: 'Auth error', forbidden: 'Permission denied',
  validation: 'Validation error', unknown: 'Error',
};

function ErrorBanner() {
  const { error, clearError } = useStore();
  if (!error) return null;

  return (
    <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 6, padding: '10px 12px', margin: '8px 12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <div>
        <strong style={{ color: ERROR_COLOR[error.type] ?? '#742a2a', fontSize: 12, display: 'block' }}>
          {ERROR_LABEL[error.type] ?? 'Error'}
        </strong>
        <span style={{ fontSize: 13, color: '#4a5568' }}>{error.message}</span>
      </div>
      <button onClick={clearError} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#a0aec0', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header() {
  const { userEmail, logout } = useStore();
  return (
    <header style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
      <span style={{ fontWeight: 800, fontSize: 15, color: '#2563eb', letterSpacing: '-0.01em' }}>Mini Apty</span>
      {userEmail && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#718096', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</span>
          <button onClick={logout} style={{ fontSize: 12, color: '#e53e3e', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>Logout</button>
        </div>
      )}
    </header>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────

export function App() {
  const { view, init, addPendingStep, stopRecording, stopPlayer } = useStore();

  useEffect(() => { init(); }, [init]);

  const onMessage = useCallback((msg: { type: string; step?: Step }) => {
    switch (msg.type) {
      case 'STEP_CAPTURED':
        if (msg.step) addPendingStep(msg.step);
        break;
      // RECORDING_STOPPED means the picker was cancelled (Esc), NOT that the whole
      // recording session ended. RecordingPanel handles its own picking state locally.
      // We intentionally do NOT call stopRecording() here.
      case 'PLAYER_FINISHED':
        stopPlayer();
        break;
    }
  }, [addPendingStep, stopPlayer]);

  useEffect(() => {
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [onMessage]);

  const showList = view === 'list' || view === 'recording';

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <Header />
        <ErrorBanner />
        <div style={{ flex: 1, overflow: 'auto' }}>
          {view === 'login'    && <LoginForm />}
          {view === 'register' && <RegisterForm />}
          {showList            && <WalkthroughList />}
          {view === 'editor'   && <WalkthroughEditor />}
        </div>
      </div>
    </ErrorBoundary>
  );
}
