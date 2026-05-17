import { create } from 'zustand';
import { api, fetchWithCache } from '../api/client';
import { storage } from '../../shared/storage';
import type { Walkthrough, Step, ApiError, AdminUser } from '../../shared/types';

export type View = 'login' | 'register' | 'list' | 'editor' | 'recording' | 'admin';

interface State {
  // Auth
  token: string | null;
  userId: string | null;
  userEmail: string | null;
  userRole: 'author' | 'user' | null;
  // UI
  view: View;
  error: ApiError | null;
  isLoading: boolean;
  offlineMode: boolean;
  // Data
  walkthroughs: Walkthrough[];
  currentWalkthrough: Walkthrough | null;
  users: AdminUser[];
  // Recording
  isRecording: boolean;
  recordingTitle: string;
  recordingOrigin: string;
  recordingPath: string;
  pendingSteps: Step[];
  _lastCapturedXpath: string;
  _lastCapturedMs: number;
}

interface Actions {
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadWalkthroughs: (origin: string) => Promise<void>;
  saveWalkthrough: () => Promise<void>;
  updateWalkthrough: (id: string, data: { title?: string; pathPattern?: string; steps?: Step[] }) => Promise<void>;
  deleteWalkthrough: (id: string) => Promise<void>;
  setCurrentWalkthrough: (wt: Walkthrough | null) => void;
  startRecording: (title: string, origin: string, pathPattern: string) => void;
  stopRecording: () => void;
  addPendingStep: (step: Step) => void;
  updatePendingStep: (index: number, updates: Partial<Step>) => void;
  removePendingStep: (index: number) => void;
  startPlayer: (wt: Walkthrough) => Promise<void>;
  stopPlayer: () => void;
  loadUsers: () => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  activateUser: (id: string) => Promise<void>;
  updateUserRole: (id: string, role: 'author' | 'user') => Promise<void>;
  setView: (view: View) => void;
  clearError: () => void;
}

export const useStore = create<State & Actions>((set, get) => ({
  token: null,
  userId: null,
  userEmail: null,
  userRole: null,
  view: 'login',
  error: null,
  isLoading: false,
  offlineMode: false,
  walkthroughs: [],
  currentWalkthrough: null,
  users: [],
  isRecording: false,
  recordingTitle: '',
  recordingOrigin: '',
  recordingPath: '/',
  pendingSteps: [],
  _lastCapturedXpath: '',
  _lastCapturedMs: 0,

  async init() {
    const [token, user] = await Promise.all([storage.getToken(), storage.getUser()]);
    if (token && user) {
      set({ token, userId: user.id, userEmail: user.email, userRole: user.role ?? null, view: 'list' });
    } else {
      set({ view: 'login' });
    }
  },

  async login(email, password) {
    set({ isLoading: true, error: null });
    try {
      const r = await api.login(email, password);
      await Promise.all([storage.setToken(r.token), storage.setUser(r.user)]);
      set({ token: r.token, userId: r.user.id, userEmail: r.user.email, userRole: r.user.role, view: 'list', isLoading: false });
    } catch (err) {
      set({ error: err as ApiError, isLoading: false });
    }
  },

  async register(email, password) {
    set({ isLoading: true, error: null });
    try {
      const r = await api.signup(email, password);
      await Promise.all([storage.setToken(r.token), storage.setUser(r.user)]);
      set({ token: r.token, userId: r.user.id, userEmail: r.user.email, userRole: r.user.role, view: 'list', isLoading: false });
    } catch (err) {
      set({ error: err as ApiError, isLoading: false });
    }
  },

  async logout() {
    await Promise.all([storage.clearToken(), storage.clearUser(), storage.clearPlayerProgress()]);
    set({ token: null, userId: null, userEmail: null, userRole: null, walkthroughs: [], currentWalkthrough: null, users: [], view: 'login', error: null });
  },

  async loadWalkthroughs(origin) {
    const { token } = get();
    if (!token) return;
    set({ isLoading: true, error: null });
    try {
      const { walkthroughs, fromCache } = await fetchWithCache(origin, token);
      set({ walkthroughs, offlineMode: fromCache, isLoading: false });
    } catch (err) {
      set({ error: err as ApiError, isLoading: false });
    }
  },

  async saveWalkthrough() {
    const { token, recordingTitle, recordingOrigin, recordingPath, pendingSteps } = get();
    if (!token) return;
    set({ isLoading: true, error: null });
    try {
      const wt = await api.createWalkthrough(
        { title: recordingTitle, origin: recordingOrigin, pathPattern: recordingPath, steps: pendingSteps },
        token
      );
      set(s => ({ walkthroughs: [wt, ...s.walkthroughs], isRecording: false, pendingSteps: [], view: 'list', isLoading: false }));
    } catch (err) {
      set({ error: err as ApiError, isLoading: false });
    }
  },

  async updateWalkthrough(id, data) {
    const { token } = get();
    if (!token) return;
    set({ isLoading: true, error: null });
    try {
      const updated = await api.updateWalkthrough(id, data, token);
      set(s => ({
        walkthroughs: s.walkthroughs.map(w => w.id === id ? updated : w),
        currentWalkthrough: s.currentWalkthrough?.id === id ? updated : s.currentWalkthrough,
        isLoading: false,
      }));
    } catch (err) {
      set({ error: err as ApiError, isLoading: false });
    }
  },

  async deleteWalkthrough(id) {
    const { token } = get();
    if (!token) return;
    set({ isLoading: true, error: null });
    try {
      await api.deleteWalkthrough(id, token);
      set(s => ({
        walkthroughs: s.walkthroughs.filter(w => w.id !== id),
        currentWalkthrough: s.currentWalkthrough?.id === id ? null : s.currentWalkthrough,
        view: 'list',
        isLoading: false,
      }));
    } catch (err) {
      set({ error: err as ApiError, isLoading: false });
    }
  },

  setCurrentWalkthrough: wt => set({ currentWalkthrough: wt }),

  startRecording(title, origin, pathPattern) {
    set({ isRecording: true, recordingTitle: title, recordingOrigin: origin, recordingPath: pathPattern, pendingSteps: [], view: 'recording' });
    chrome.runtime.sendMessage({ type: 'START_RECORDING' }).catch(() => {});
  },

  stopRecording() {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }).catch(() => {});
    set({ isRecording: false, view: 'list' });
  },

  addPendingStep: step => set(s => {
    const now = Date.now();
    if (step.fingerprint.xpath === s._lastCapturedXpath && now - s._lastCapturedMs < 500) {
      return s; // same element arrived twice within 500 ms — discard the duplicate
    }
    return {
      pendingSteps: [...s.pendingSteps, step],
      _lastCapturedXpath: step.fingerprint.xpath,
      _lastCapturedMs: now,
    };
  }),

  updatePendingStep: (index, updates) =>
    set(s => ({ pendingSteps: s.pendingSteps.map((p, i) => i === index ? { ...p, ...updates } : p) })),

  removePendingStep: index =>
    set(s => ({ pendingSteps: s.pendingSteps.filter((_, i) => i !== index) })),

  async startPlayer(wt) {
    await storage.setPlayerProgress({ walkthroughId: wt.id, currentStepIndex: 0, url: '' });
    chrome.runtime.sendMessage({ type: 'START_PLAYER', walkthrough: wt, stepIndex: 0 }).catch(() => {});
  },

  stopPlayer() {
    chrome.runtime.sendMessage({ type: 'STOP_PLAYER' }).catch(() => {});
    storage.clearPlayerProgress().catch(() => {});
  },

  async loadUsers() {
    const { token } = get();
    if (!token) return;
    set({ isLoading: true, error: null });
    try {
      const users = await api.listUsers(token);
      set({ users, isLoading: false });
    } catch (err) {
      set({ error: err as ApiError, isLoading: false });
    }
  },

  async deleteUser(id: string) {
    const { token } = get();
    if (!token) return;
    set({ isLoading: true, error: null });
    try {
      await api.deleteUser(id, token);
      set(s => ({
        users: s.users.filter(u => u.id !== id),
        isLoading: false,
      }));
    } catch (err) {
      set({ error: err as ApiError, isLoading: false });
    }
  },

  async activateUser(id: string) {
    const { token } = get();
    if (!token) return;
    set({ isLoading: true, error: null });
    try {
      const updated = await api.activateUser(id, token);
      set(s => ({
        users: s.users.map(u => u.id === id ? updated : u),
        isLoading: false,
      }));
    } catch (err) {
      set({ error: err as ApiError, isLoading: false });
    }
  },

  async updateUserRole(id: string, role: 'author' | 'user') {
    const { token } = get();
    if (!token) return;
    set({ isLoading: true, error: null });
    try {
      const updated = await api.updateUserRole(id, role, token);
      set(s => ({
        users: s.users.map(u => u.id === id ? updated : u),
        isLoading: false,
      }));
    } catch (err) {
      set({ error: err as ApiError, isLoading: false });
    }
  },

  setView: view => set({ view }),
  clearError: () => set({ error: null }),
}));
