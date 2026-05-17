import type { Walkthrough, Step, ApiError } from '../../shared/types';
import { storage } from '../../shared/storage';

const BASE = 'http://localhost:3000';

function classify(status: number, body: { message?: string }): ApiError {
  if (status === 401) return { type: 'auth',       message: body.message ?? 'Unauthorized', status };
  if (status === 403) return { type: 'forbidden',  message: body.message ?? 'Forbidden',    status };
  if (status === 400 || status === 422)
                      return { type: 'validation', message: body.message ?? 'Invalid input',status };
  return               { type: 'unknown',          message: body.message ?? 'Server error', status };
}

async function req<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw { type: 'network', message: 'Cannot reach server. Check the backend is running.' } as ApiError;
  }

  const text = await res.text();
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) throw classify(res.status, body as { message?: string });
  return body as T;
}

export interface AuthResult {
  token: string;
  user: { id: string; email: string };
}

export const api = {
  signup: (email: string, password: string) =>
    req<AuthResult>('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),

  login: (email: string, password: string) =>
    req<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  listWalkthroughs: (origin: string, token: string) =>
    req<Walkthrough[]>(`/walkthroughs?origin=${encodeURIComponent(origin)}`, {}, token),

  getWalkthrough: (id: string, token: string) =>
    req<Walkthrough>(`/walkthroughs/${id}`, {}, token),

  createWalkthrough: (
    data: { title: string; origin: string; pathPattern: string; steps: Step[] },
    token: string
  ) => req<Walkthrough>('/walkthroughs', { method: 'POST', body: JSON.stringify(data) }, token),

  updateWalkthrough: (
    id: string,
    data: { title?: string; pathPattern?: string; steps?: Step[] },
    token: string
  ) => req<Walkthrough>(`/walkthroughs/${id}`, { method: 'PUT', body: JSON.stringify(data) }, token),

  deleteWalkthrough: (id: string, token: string) =>
    req<void>(`/walkthroughs/${id}`, { method: 'DELETE' }, token),
};

export async function fetchWithCache(
  origin: string,
  token: string
): Promise<{ walkthroughs: Walkthrough[]; fromCache: boolean }> {
  try {
    const walkthroughs = await api.listWalkthroughs(origin, token);
    await storage.setCachedWalkthroughs(origin, walkthroughs);
    return { walkthroughs, fromCache: false };
  } catch (err) {
    const e = err as ApiError;
    if (e.type === 'network') {
      const cached = await storage.getCachedWalkthroughs(origin);
      if (cached) return { walkthroughs: cached, fromCache: true };
    }
    throw err;
  }
}
