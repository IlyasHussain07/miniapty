import { startElementPicker } from './recorder/elementPicker';
import { resolveElement } from './player/elementResolver';
import { BalloonPlayer } from './player/balloon';
import type { MessageToContent, MessageFromContent } from '../shared/messages';
import type { Step, Walkthrough, ElementFingerprint } from '../shared/types';

function guessTitle(fp: ElementFingerprint): string {
  const text = fp.innerText?.trim();
  if (text) return text.length > 50 ? text.slice(0, 47) + '…' : text;
  if (fp.ariaLabel) return fp.ariaLabel;
  if (fp.placeholder) return fp.placeholder;
  if (fp.name) return fp.name;
  if (fp.id) return `#${fp.id}`;
  return `<${fp.tag}>`;
}

// Guard against double-injection (manifest + scripting API can both inject this file).
// Only the first instance runs; subsequent injections are silently skipped.
const g = globalThis as typeof globalThis & { __miniAptyInjected?: boolean };
if (g.__miniAptyInjected) {
  // Already running — do nothing.
} else {
  g.__miniAptyInjected = true;

  let cancelPicker: (() => void) | null = null;
  let captureLocked = false;
  let lastCapturedXpath = '';
  let lastCaptureMs = 0;
  let balloon: BalloonPlayer | null = null;
  let activeWalkthrough: Walkthrough | null = null;
  let currentStepIndex = 0;
  let advanceTriggerCleanup: (() => void) | null = null;

  function send(msg: MessageFromContent): void {
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  chrome.runtime.onMessage.addListener((message: MessageToContent, _sender, sendResponse) => {
    handle(message);
    sendResponse({ ok: true });
    return true;
  });

  function handle(msg: MessageToContent): void {
    switch (msg.type) {
      case 'START_RECORDING': startRecording(); break;
      case 'STOP_RECORDING':  stopRecording();  break;
      case 'START_PLAYER':    startPlayer(msg.walkthrough, msg.stepIndex); break;
      case 'PLAYER_NEXT':     advance(1);  break;
      case 'PLAYER_PREV':     advance(-1); break;
      case 'STOP_PLAYER':     stopPlayer(); break;
    }
  }

  // ── Recording ────────────────────────────────────────────────────────────────

  function startRecording(): void {
    if (cancelPicker) cancelPicker();

    cancelPicker = startElementPicker({
      onCapture: fp => {
        const now = Date.now();
        // Drop if locked OR if the exact same element fires again within 400ms.
        if (captureLocked) return;
        if (fp.xpath === lastCapturedXpath && now - lastCaptureMs < 400) return;
        captureLocked = true;
        lastCapturedXpath = fp.xpath;
        lastCaptureMs = now;
        setTimeout(() => { captureLocked = false; }, 300);

        cancelPicker = null;
        const step: Step = {
          id: crypto.randomUUID(),
          title: guessTitle(fp),
          description: '',
          fingerprint: fp,
          advanceTrigger: 'next-button',
        };
        send({ type: 'STEP_CAPTURED', step });
        // Auto-restart so the user can keep clicking elements without pressing
        // "Capture Next Element" each time. Stopped only by STOP_RECORDING.
        startRecording();
      },
      onCancel: () => {
        cancelPicker = null;
        send({ type: 'RECORDING_STOPPED' });
      },
    });
  }

  function stopRecording(): void {
    if (cancelPicker) { cancelPicker(); cancelPicker = null; }
    send({ type: 'RECORDING_STOPPED' });
  }

  // ── Player ───────────────────────────────────────────────────────────────────

  function startPlayer(wt: Walkthrough, stepIndex: number): void {
    stopPlayer();
    activeWalkthrough = wt;
    currentStepIndex = stepIndex;
    balloon = new BalloonPlayer({ onNext: () => advance(1), onPrev: () => advance(-1), onClose: stopPlayer });
    showStep();
  }

  function showStep(): void {
    if (!balloon || !activeWalkthrough) return;
    clearAdvanceTrigger();

    const step = activeWalkthrough.steps[currentStepIndex];
    if (!step) return;

    const target = resolveElement(step.fingerprint);
    balloon.show(step, currentStepIndex, activeWalkthrough.steps.length, target);

    if (target) {
      if (step.advanceTrigger === 'click-target') {
        const handler = () => { clearAdvanceTrigger(); advance(1); };
        target.addEventListener('click', handler, { once: true });
        advanceTriggerCleanup = () => target.removeEventListener('click', handler);
      } else if (step.advanceTrigger === 'input-change') {
        const handler = () => { clearAdvanceTrigger(); advance(1); };
        target.addEventListener('change', handler, { once: true });
        advanceTriggerCleanup = () => target.removeEventListener('change', handler);
      }
    }
  }

  function clearAdvanceTrigger(): void {
    advanceTriggerCleanup?.();
    advanceTriggerCleanup = null;
  }

  function advance(delta: number): void {
    if (!activeWalkthrough) return;
    clearAdvanceTrigger();
    const next = currentStepIndex + delta;

    if (next >= activeWalkthrough.steps.length) {
      stopPlayer();
      send({ type: 'PLAYER_FINISHED' });
      return;
    }
    if (next < 0) return;

    currentStepIndex = next;
    send({ type: 'PLAYER_STEP_CHANGED', stepIndex: currentStepIndex });
    showStep();
  }

  function stopPlayer(): void {
    clearAdvanceTrigger();
    balloon?.destroy();
    balloon = null;
    activeWalkthrough = null;
    currentStepIndex = 0;
  }
}
