import type { Step, Walkthrough } from './types';

export type MessageToContent =
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'START_PLAYER'; walkthrough: Walkthrough; stepIndex: number }
  | { type: 'PLAYER_NEXT' }
  | { type: 'PLAYER_PREV' }
  | { type: 'STOP_PLAYER' };

export type MessageFromContent =
  | { type: 'STEP_CAPTURED'; step: Step }
  | { type: 'RECORDING_STOPPED' }
  | { type: 'PLAYER_STEP_CHANGED'; stepIndex: number }
  | { type: 'PLAYER_FINISHED' };

export type AnyMessage = MessageToContent | MessageFromContent | { type: 'TAB_UPDATED'; url: string; tabId: number };
