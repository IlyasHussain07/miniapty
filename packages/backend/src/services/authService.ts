import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index';
import { users } from '../db/schema';
import type { User } from '../types';

const SALT_ROUNDS = 12;

export async function createUser(email: string, password: string): Promise<User> {
  const db = getDb();
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    throw Object.assign(new Error('Email already in use'), { code: 'EMAIL_TAKEN' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const now = new Date();
  const id = uuidv4();

  db.insert(users).values({ id, email, passwordHash, role: 'user', isActive: true, createdAt: now }).run();

  return { id, email, role: 'user', isActive: true, createdAt: now };
}

export async function verifyCredentials(email: string, password: string): Promise<User> {
  const db = getDb();
  const row = db.select().from(users).where(eq(users.email, email)).get();
  if (!row) {
    throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' });
  }

  const valid = await bcrypt.compare(password, row.passwordHash);
  if (!valid) {
    throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' });
  }

  if (!row.isActive) {
    throw Object.assign(new Error('Account is disabled'), { code: 'ACCOUNT_DISABLED' });
  }

  return { id: row.id, email: row.email, role: row.role, isActive: row.isActive, createdAt: row.createdAt };
}
