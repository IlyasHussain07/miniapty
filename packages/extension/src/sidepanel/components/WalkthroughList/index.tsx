import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/index';
import type { Walkthrough, Step } from '../../../shared/types';

// ── Main list view ────────────────────────────────────────────────────────────

export function WalkthroughList() {
  const {
    view, walkthroughs, loadWalkthroughs, deleteWalkthrough,
    setCurrentWalkthrough, setView, startRecording, startPlayer, offlineMode, isLoading,
    userRole, users, loadUsers, assignWalkthrough,
  } = useStore();

  const [currentOrigin, setCurrentOrigin] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPath, setNewPath] = useState('/');
  const [assigningWtId, setAssigningWtId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const url = tabs[0]?.url;
      if (!url) return;
      try {
        const { origin, pathname } = new URL(url);
        setCurrentOrigin(origin);
        setNewPath(pathname);
        loadWalkthroughs(origin);
      } catch { /* ignore non-URL tabs */ }
    });
  }, []);

  function handleEdit(wt: Walkthrough) {
    setCurrentWalkthrough(wt);
    setView('editor');
  }

  function handleStartNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !currentOrigin) return;
    setShowNewForm(false);
    startRecording(newTitle.trim(), currentOrigin, newPath);
  }

  if (view === 'recording') return <RecordingPanel origin={currentOrigin} />;

  return (
    <div style={{ padding: 14 }}>
      {offlineMode && (
        <div style={{ background: '#fffbeb', border: '1px solid #f6e05e', borderRadius: 6, padding: '7px 12px', marginBottom: 10, fontSize: 12, color: '#744210' }}>
          Offline — showing cached data
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1a202c' }}>Walkthroughs</h2>
        {userRole === 'author' && (
          <button onClick={() => setShowNewForm(v => !v)} style={btnOutline}>
            {showNewForm ? 'Cancel' : '+ New'}
          </button>
        )}
      </div>

      {showNewForm && (
        <form onSubmit={handleStartNew} style={card}>
          <label style={lbl}>Title
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Login flow" required style={inp} autoFocus />
          </label>
          <label style={lbl}>Path pattern
            <input value={newPath} onChange={e => setNewPath(e.target.value)} placeholder="/login" style={inp} />
          </label>
          <p style={{ fontSize: 11, color: '#718096' }}>Origin: <strong>{currentOrigin || '(navigate to a page first)'}</strong></p>
          <button type="submit" disabled={!currentOrigin} style={btnPrimary}>Start Recording</button>
        </form>
      )}

      {isLoading && <p style={{ color: '#a0aec0', fontSize: 13, textAlign: 'center', marginTop: 24 }}>Loading…</p>}

      {!isLoading && walkthroughs.length === 0 && !showNewForm && (
        <p style={{ color: '#a0aec0', fontSize: 13, textAlign: 'center', marginTop: 32 }}>
          No walkthroughs yet for this site.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: showNewForm ? 10 : 0 }}>
        {walkthroughs.map(wt => (
          <div key={wt.id}>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#1a202c', marginBottom: 3 }}>{wt.title}</p>
                  <p style={{ fontSize: 12, color: '#718096' }}>
                    {wt.pathPattern} &middot; {wt.steps.length} step{wt.steps.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button onClick={() => startPlayer(wt)} title="Preview" style={btnIconBlue}>▶</button>
                  {userRole === 'author' && (
                    <>
                      <button onClick={() => handleEdit(wt)} title="Edit" style={btnIcon}>✎</button>
                      <button onClick={() => { if (confirm(`Delete "${wt.title}"?`)) deleteWalkthrough(wt.id); }} title="Delete" style={{ ...btnIcon, color: '#e53e3e' }}>×</button>
                      <button
                        onClick={async () => {
                          if (assigningWtId === wt.id) {
                            setAssigningWtId(null);
                          } else {
                            if (users.length === 0) await loadUsers();
                            setAssigningWtId(wt.id);
                            setSelectedUserIds(new Set(wt.assignedTo ?? []));
                          }
                        }}
                        title="Assign"
                        style={{ ...btnIcon, ...(assigningWtId === wt.id ? { background: '#fef3c7', color: '#d97706' } : {}) }}
                      >
                        👥
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {assigningWtId === wt.id && userRole === 'author' && (
              <div style={{ ...card, marginTop: -8, paddingTop: 12, borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0, background: '#fafafa' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#4a5568', marginBottom: 10 }}>Assign to users:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {users.map(u => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#2d3748', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(u.id)}
                        onChange={e => {
                          const next = new Set(selectedUserIds);
                          if (e.target.checked) next.add(u.id);
                          else next.delete(u.id);
                          setSelectedUserIds(next);
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>{u.email}</span>
                      {!u.isActive && <span style={{ fontSize: 11, color: '#a0aec0' }}>(inactive)</span>}
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={async () => {
                      await assignWalkthrough(wt.id, Array.from(selectedUserIds));
                      setAssigningWtId(null);
                    }}
                    style={{ ...btnPrimary, flex: 1, padding: '7px' }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setAssigningWtId(null)}
                    style={{ ...btnOutline, flex: 1, padding: '7px' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Recording panel ───────────────────────────────────────────────────────────

function RecordingPanel({ origin }: { origin: string }) {
  const { pendingSteps, updatePendingStep, removePendingStep, saveWalkthrough, stopRecording, isLoading, recordingTitle, recordingPath } = useStore();
  // 'active' = picker running on page, 'paused' = Esc was pressed, 'unavailable' = restricted page
  const [pickerState, setPickerState] = React.useState<'active' | 'paused' | 'unavailable'>('active');

  React.useEffect(() => {
    const handler = (msg: { type: string }) => {
      if (msg.type === 'STEP_CAPTURED') setPickerState('active');
      if (msg.type === 'RECORDING_STOPPED') setPickerState('paused');
      if (msg.type === 'CONTENT_SCRIPT_UNAVAILABLE') setPickerState('unavailable');
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  function resume() {
    setPickerState('active');
    chrome.runtime.sendMessage({ type: 'START_RECORDING' }).catch(() => {});
  }

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1a202c' }}>Recording</h2>
          <p style={{ fontSize: 11, color: '#718096', marginTop: 2 }}>{recordingTitle} &middot; {recordingPath}</p>
        </div>
        {pickerState === 'active' && (
          <button onClick={() => chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }).catch(() => {})} style={{ ...btnIcon, color: '#ea580c', fontSize: 13 }}>⏸ Pause</button>
        )}
      </div>

      {pickerState === 'unavailable' && (
        <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#c53030' }}>
          Cannot inject into this page. Navigate to an http/https site and reload it.
        </div>
      )}

      {pickerState === 'active' && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>🎯</span>
          <span><strong>Picker active</strong> — switch to the page and click any element. Press Esc to pause.</span>
        </div>
      )}

      {pickerState === 'paused' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ background: '#fffbeb', border: '1px solid #f6e05e', borderRadius: 6, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: '#744210' }}>
            Picker paused (Esc pressed).
          </div>
          <button onClick={resume} style={{ ...btnPrimary, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span>🎯</span> Resume Capture
          </button>
        </div>
      )}

      {pendingSteps.length === 0 && pickerState === 'active' && (
        <p style={{ fontSize: 13, color: '#a0aec0', textAlign: 'center' }}>
          No steps yet — go to the page and click an element.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pendingSteps.map((step, i) => (
          <StepCard key={step.id} step={step} index={i}
            onChange={(u: Partial<Step>) => updatePendingStep(i, u)}
            onRemove={() => removePendingStep(i)}
          />
        ))}
      </div>

      {pendingSteps.length > 0 && pickerState === 'paused' && (
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={saveWalkthrough} disabled={isLoading} style={{ ...btnPrimary, flex: 1 }}>
            {isLoading ? 'Saving…' : `Save Walkthrough (${pendingSteps.length} step${pendingSteps.length !== 1 ? 's' : ''})`}
          </button>
          <button onClick={() => { stopRecording(); }} style={{ ...btnOutline, flex: 1, color: '#e53e3e' }}>
            Discard
          </button>
        </div>
      )}
    </div>
  );
}

function StepCard({ step, index, onChange, onRemove }: {
  step: Step;
  index: number;
  onChange: (u: Partial<Step>) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ ...card, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#718096', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
          Step {index + 1} &mdash; &lt;{step.fingerprint.tag}&gt;
          {step.fingerprint.id && ` #${step.fingerprint.id}`}
        </span>
        <button onClick={onRemove} style={{ border: 'none', background: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
      <input
        value={step.title}
        onChange={e => onChange({ title: e.target.value })}
        placeholder="Step title (required)"
        style={{ ...inp, marginBottom: 6 }}
      />
      <textarea
        value={step.description}
        onChange={e => onChange({ description: e.target.value })}
        placeholder="Description (optional)"
        rows={2}
        style={{ ...inp, resize: 'vertical', marginBottom: 6 }}
      />
      <select
        value={step.advanceTrigger ?? 'next-button'}
        onChange={e => onChange({ advanceTrigger: e.target.value as Step['advanceTrigger'] })}
        style={inp}
      >
        <option value="next-button">Advance: Next button click</option>
        <option value="click-target">Advance: Click this element</option>
        <option value="input-change">Advance: Input value changes</option>
      </select>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 };
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: '#4a5568', marginBottom: 8 };
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a202c', background: '#fff' };
const btnPrimary: React.CSSProperties = { padding: '9px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 };
const btnOutline: React.CSSProperties = { padding: '5px 12px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#4a5568' };
const btnIcon: React.CSSProperties = { padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 5, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 };
const btnIconBlue: React.CSSProperties = { ...btnIcon, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' };
