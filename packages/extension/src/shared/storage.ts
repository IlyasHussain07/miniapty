import type { Walkthrough, PlayerProgress } from './types';

export interface StoredUser {
  id: string;
  email: string;
  role: 'author' | 'user';
}

async function get<T>(key: string): Promise<T | null> {
  return new Promise(resolve => {
    chrome.storage.local.get(key, result => resolve((result[key] as T) ?? null));
  });
}

async function set(key: string, value: unknown): Promise<void> {
  return new Promise(resolve => chrome.storage.local.set({ [key]: value }, resolve));
}

async function remove(key: string): Promise<void> {
  return new Promise(resolve => chrome.storage.local.remove(key, resolve));
}

export const storage = {
  getToken: () => get<string>('auth_token'),
  setToken: (token: string) => set('auth_token', token),
  clearToken: () => remove('auth_token'),

  getUser: () => get<StoredUser>('auth_user'),
  setUser: (user: StoredUser) => set('auth_user', user),
  clearUser: () => remove('auth_user'),

  getCachedWalkthroughs: (cacheKey: string) =>
    get<Walkthrough[]>(`wt_cache_${cacheKey}`),
  setCachedWalkthroughs: (cacheKey: string, wts: Walkthrough[]) =>
    set(`wt_cache_${cacheKey}`, wts),

  getPlayerProgress: () => get<PlayerProgress>('player_progress'),
  setPlayerProgress: (p: PlayerProgress) => set('player_progress', p),
  clearPlayerProgress: () => remove('player_progress'),
};
