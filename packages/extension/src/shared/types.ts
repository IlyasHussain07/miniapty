export interface ElementFingerprint {
  tag: string;
  id?: string;
  dataTestId?: string;
  ariaLabel?: string;
  ariaRole?: string;
  name?: string;
  placeholder?: string;
  inputType?: string;
  innerText?: string;
  href?: string;
  xpath: string;
  classes: string[];
  rect: { x: number; y: number; w: number; h: number };
}

export type AdvanceTrigger = 'next-button' | 'click-target' | 'input-change';

export interface Step {
  id: string;
  title: string;
  description: string;
  fingerprint: ElementFingerprint;
  advanceTrigger?: AdvanceTrigger;
}

export interface Walkthrough {
  id: string;
  userId: string;
  title: string;
  origin: string;
  pathPattern: string;
  steps: Step[];
  createdAt: string;
  updatedAt: string;
  assignedTo?: string[];
}

export interface PlayerProgress {
  walkthroughId: string;
  currentStepIndex: number;
  url: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'author' | 'user';
  isActive: boolean;
  createdAt: string;
}

export type ApiErrorType = 'network' | 'auth' | 'forbidden' | 'validation' | 'unknown';

export interface ApiError {
  type: ApiErrorType;
  message: string;
  status?: number;
}
