import type { ElementFingerprint } from '../../shared/types';
import { captureFingerprint } from './fingerprint';

export interface PickerOptions {
  onCapture: (fp: ElementFingerprint) => void;
  onCancel: () => void;
}

// Elements we never want to capture (the picker's own UI)
const IGNORED_IDS = new Set(['mini-apty-picker-label']);

export function startElementPicker({ onCapture, onCancel }: PickerOptions): () => void {
  // Status label so user knows they're in pick mode
  const label = document.createElement('div');
  label.id = 'mini-apty-picker-label';
  Object.assign(label.style, {
    position: 'fixed',
    top: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#1d4ed8',
    color: '#fff',
    padding: '6px 16px',
    borderRadius: '20px',
    fontSize: '13px',
    fontFamily: 'system-ui, sans-serif',
    fontWeight: '600',
    zIndex: '2147483646',
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    letterSpacing: '0.01em',
  });
  label.textContent = '🎯 Click an element to capture  •  Esc to cancel';
  document.documentElement.appendChild(label);

  let highlighted: HTMLElement | null = null;
  let savedShadow = '';

  function applyHighlight(el: HTMLElement): void {
    if (highlighted === el) return;
    removeHighlight();
    highlighted = el;
    savedShadow = el.style.boxShadow;
    el.style.boxShadow = '0 0 0 2px #2563eb, 0 0 0 5px rgba(37,99,235,0.25)';
  }

  function removeHighlight(): void {
    if (highlighted) {
      highlighted.style.boxShadow = savedShadow;
      highlighted = null;
      savedShadow = '';
    }
  }

  function onMouseOver(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    if (IGNORED_IDS.has(t.id)) return;
    applyHighlight(t);
  }

  function onClick(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    if (IGNORED_IDS.has(t.id)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    removeHighlight();
    cleanup();
    onCapture(captureFingerprint(t));
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      cleanup();
      onCancel();
    }
  }

  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('keydown', onKeyDown, true);

  // Delay attaching the click listener so that the page-focus click (when the
  // user switches from the sidepanel to the page tab) is not accidentally captured.
  let clickTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    clickTimer = null;
    document.addEventListener('click', onClick, true);
  }, 300);

  function cleanup(): void {
    if (clickTimer !== null) { clearTimeout(clickTimer); clickTimer = null; }
    removeHighlight();
    label.remove();
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
  }

  return cleanup;
}
