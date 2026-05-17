import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/index';
import type { Step } from '../../../shared/types';

export function WalkthroughEditor() {
  const { currentWalkthrough, updateWalkthrough, deleteWalkthrough, setView, isLoading } = useStore();
  const [title, setTitle] = useState('');
  const [pathPattern, setPathPattern] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    if (currentWalkthrough) {
      setTitle(currentWalkthrough.title);
      setPathPattern(currentWalkthrough.pathPattern);
      setSteps(currentWalkthrough.steps);
    }
  }, [currentWalkthrough]);

  if (!currentWalkthrough) {
    return (
      <div style={{ padding: 16 }}>
        <button onClick={() => setView('list')} style={link}>← Back to list</button>
      </div>
    );
  }

  function updateStep(i: number, updates: Partial<Step>) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, ...updates } : s));
  }

  async function handleSave() {
    await updateWalkthrough(currentWalkthrough!.id, { title, pathPattern, steps });
    setView('list');
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete "${currentWalkthrough!.title}"?`)) return;
    await deleteWalkthrough(currentWalkthrough!.id);
  }

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => setView('list')} style={link}>←</button>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1a202c' }}>Edit Walkthrough</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <label style={lbl}>Title
          <input value={title} onChange={e => setTitle(e.target.value)} style={inp} />
        </label>
        <label style={lbl}>Path pattern
          <input value={pathPattern} onChange={e => setPathPattern(e.target.value)} style={inp} />
        </label>
      </div>

      <h3 style={{ fontSize: 12, fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        Steps ({steps.length})
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {steps.length === 0 && (
          <p style={{ fontSize: 13, color: '#a0aec0', textAlign: 'center' }}>No steps. Go back and re-record.</p>
        )}
        {steps.map((step, i) => (
          <div key={step.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#718096', textTransform: 'uppercase' as const }}>
                Step {i + 1} &mdash; &lt;{step.fingerprint.tag}&gt;
              </span>
              <button
                onClick={() => setSteps(prev => prev.filter((_, idx) => idx !== i))}
                style={{ border: 'none', background: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: 16 }}
              >×</button>
            </div>
            <input
              value={step.title}
              onChange={e => updateStep(i, { title: e.target.value })}
              placeholder="Title"
              style={{ ...inp, marginBottom: 6 }}
            />
            <textarea
              value={step.description}
              onChange={e => updateStep(i, { description: e.target.value })}
              placeholder="Description"
              rows={2}
              style={{ ...inp, resize: 'vertical', marginBottom: 6 }}
            />
            <select
              value={step.advanceTrigger ?? 'next-button'}
              onChange={e => updateStep(i, { advanceTrigger: e.target.value as Step['advanceTrigger'] })}
              style={inp}
            >
              <option value="next-button">Advance: Next button click</option>
              <option value="click-target">Advance: Click this element</option>
              <option value="input-change">Advance: Input value changes</option>
            </select>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSave} disabled={isLoading} style={{ ...btnPrimary, flex: 1 }}>
          {isLoading ? 'Saving…' : 'Save Changes'}
        </button>
        <button onClick={handleDelete} disabled={isLoading} style={btnDanger}>Delete</button>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 };
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: '#4a5568' };
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a202c', background: '#fff' };
const btnPrimary: React.CSSProperties = { padding: '9px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 };
const btnDanger: React.CSSProperties = { padding: '9px 14px', border: '1px solid #fed7d7', borderRadius: 7, background: '#fff5f5', color: '#c53030', cursor: 'pointer', fontSize: 13, fontWeight: 700 };
const link: React.CSSProperties = { border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0 };
