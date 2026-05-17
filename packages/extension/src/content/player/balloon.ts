import type { Step } from '../../shared/types';

const BALLOON_STYLES = `
  :host { all: initial; font-family: system-ui, -apple-system, sans-serif; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .balloon {
    position: fixed;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08);
    padding: 16px;
    width: 300px;
    font-size: 14px;
    color: #1a202c;
    z-index: 2147483647;
    pointer-events: all;
    animation: mapty-in 0.15s ease-out;
  }

  @keyframes mapty-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .step-label {
    font-size: 11px;
    font-weight: 700;
    color: #718096;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 8px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 4px;
  }

  .title {
    font-size: 15px;
    font-weight: 700;
    color: #1a202c;
    line-height: 1.3;
  }

  .btn-x {
    background: none;
    border: none;
    cursor: pointer;
    color: #a0aec0;
    font-size: 20px;
    line-height: 1;
    padding: 0 0 0 8px;
    flex-shrink: 0;
  }
  .btn-x:hover { color: #4a5568; }

  .desc {
    color: #4a5568;
    line-height: 1.55;
    margin: 8px 0 14px;
    font-size: 13px;
  }

  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .btn {
    padding: 6px 14px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: opacity 0.12s;
  }
  .btn:hover { opacity: 0.82; }
  .btn-back { background: #edf2f7; color: #4a5568; }
  .btn-next { background: #2563eb; color: #fff; }

  .trigger-hint {
    font-size: 12px;
    font-weight: 600;
    color: #2563eb;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    padding: 5px 12px;
    flex: 1;
    text-align: center;
  }

  .ring {
    position: fixed;
    border: 2px solid #2563eb;
    border-radius: 5px;
    box-shadow: 0 0 0 4px rgba(37,99,235,0.18);
    pointer-events: none;
    z-index: 2147483646;
    transition: all 0.2s ease;
  }
`;

export interface BalloonCallbacks {
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export class BalloonPlayer {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private balloonEl!: HTMLDivElement;
  private ringEl!: HTMLDivElement;

  constructor(private callbacks: BalloonCallbacks) {
    this.host = document.createElement('div');
    this.host.id = 'mini-apty-balloon-host';
    Object.assign(this.host.style, {
      position: 'fixed', top: '0', left: '0',
      width: '0', height: '0',
      zIndex: '2147483647',
      pointerEvents: 'none',
    });

    this.shadow = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = BALLOON_STYLES;
    this.shadow.appendChild(style);

    this.ringEl = document.createElement('div');
    this.ringEl.className = 'ring';
    this.ringEl.style.display = 'none';
    this.shadow.appendChild(this.ringEl);

    this.balloonEl = document.createElement('div');
    this.balloonEl.className = 'balloon';
    this.balloonEl.style.display = 'none';
    this.shadow.appendChild(this.balloonEl);

    this.balloonEl.addEventListener('click', (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.classList.contains('btn-next')) this.callbacks.onNext();
      if (t.classList.contains('btn-back')) this.callbacks.onPrev();
      if (t.classList.contains('btn-x')) this.callbacks.onClose();
    });

    document.documentElement.appendChild(this.host);
  }

  show(step: Step, index: number, total: number, target: Element | null): void {
    this.renderBalloon(step, index, total);
    this.updateRing(target);
    this.positionBalloon(target);
  }

  private renderBalloon(step: Step, index: number, total: number): void {
    const trigger = step.advanceTrigger ?? 'next-button';
    const isLast = index === total - 1;

    let actionsHtml: string;
    if (trigger === 'click-target') {
      actionsHtml = `
        ${index > 0 ? '<button class="btn btn-back">← Back</button>' : ''}
        <span class="trigger-hint">👆 Click the highlighted element</span>
      `;
    } else if (trigger === 'input-change') {
      actionsHtml = `
        ${index > 0 ? '<button class="btn btn-back">← Back</button>' : ''}
        <span class="trigger-hint">⌨️ Type in the highlighted field</span>
      `;
    } else {
      actionsHtml = `
        ${index > 0 ? '<button class="btn btn-back">← Back</button>' : ''}
        <button class="btn btn-next">${isLast ? '✓ Done' : 'Next →'}</button>
      `;
    }

    this.balloonEl.innerHTML = `
      <div class="step-label">Step ${index + 1} of ${total}</div>
      <div class="header">
        <div class="title">${esc(step.title || '(untitled)')}</div>
        <button class="btn-x" aria-label="Close">×</button>
      </div>
      ${step.description ? `<div class="desc">${esc(step.description)}</div>` : ''}
      <div class="actions">${actionsHtml}</div>
    `;
    this.balloonEl.style.display = 'block';
    this.host.style.pointerEvents = 'all';
  }

  private updateRing(target: Element | null): void {
    if (!target) { this.ringEl.style.display = 'none'; return; }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    requestAnimationFrame(() => {
      const r = target.getBoundingClientRect();
      const pad = 5;
      Object.assign(this.ringEl.style, {
        display: 'block',
        top: `${r.top - pad}px`,
        left: `${r.left - pad}px`,
        width: `${r.width + pad * 2}px`,
        height: `${r.height + pad * 2}px`,
      });
    });
  }

  private positionBalloon(target: Element | null): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = 300 + 16;
    const bh = 160;

    if (!target) {
      Object.assign(this.balloonEl.style, { top: '20px', left: `${vw / 2 - bw / 2}px` });
      return;
    }

    const r = target.getBoundingClientRect();
    const belowSpace = vh - r.bottom;
    const aboveSpace = r.top;

    let top: number;
    if (belowSpace >= bh + 14) {
      top = r.bottom + 14;
    } else if (aboveSpace >= bh + 14) {
      top = r.top - bh - 14;
    } else {
      top = Math.max(10, Math.min(r.top, vh - bh - 10));
    }

    const left = Math.min(Math.max(r.left, 8), vw - bw - 8);

    Object.assign(this.balloonEl.style, { top: `${top}px`, left: `${left}px` });
  }

  hide(): void {
    this.balloonEl.style.display = 'none';
    this.ringEl.style.display = 'none';
    this.host.style.pointerEvents = 'none';
  }

  destroy(): void {
    this.host.remove();
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
