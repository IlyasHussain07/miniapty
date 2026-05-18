import { v4 as uuidv4 } from 'uuid';
import { eq, and, inArray } from 'drizzle-orm';
import { getDb } from '../db/index';
import { walkthroughs, walkthroughAssignments } from '../db/schema';
import type { Walkthrough, Step } from '../types';

type WalkthroughRow = typeof walkthroughs.$inferSelect;

function rowToWalkthrough(row: WalkthroughRow): Walkthrough {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    origin: row.origin,
    pathPattern: row.pathPattern,
    steps: JSON.parse(row.steps) as Step[],
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

export function listWalkthroughs(
  userId: string,
  origin: string,
  pathPattern?: string,
  role?: 'author' | 'user'
): Walkthrough[] {
  const db = getDb();

  if (role === 'user') {
    // Users see walkthroughs assigned to them
    const assignedIds = db
      .select({ walkthroughId: walkthroughAssignments.walkthroughId })
      .from(walkthroughAssignments)
      .where(eq(walkthroughAssignments.assigneeId, userId))
      .all()
      .map(r => r.walkthroughId);

    if (assignedIds.length === 0) return [];

    const conditions = [inArray(walkthroughs.id, assignedIds), eq(walkthroughs.origin, origin)];
    if (pathPattern) conditions.push(eq(walkthroughs.pathPattern, pathPattern));

    return db
      .select()
      .from(walkthroughs)
      .where(and(...conditions))
      .all()
      .map(rowToWalkthrough);
  }

  // Authors (default) see their own walkthroughs
  const conditions = [eq(walkthroughs.userId, userId), eq(walkthroughs.origin, origin)];
  if (pathPattern) conditions.push(eq(walkthroughs.pathPattern, pathPattern));

  return db
    .select()
    .from(walkthroughs)
    .where(and(...conditions))
    .all()
    .map(rowToWalkthrough);
}

export function getWalkthrough(id: string): Walkthrough | null {
  const db = getDb();
  const row = db.select().from(walkthroughs).where(eq(walkthroughs.id, id)).get();
  return row ? rowToWalkthrough(row) : null;
}

export function createWalkthrough(
  userId: string,
  title: string,
  origin: string,
  pathPattern: string,
  steps: Step[]
): Walkthrough {
  const db = getDb();
  const now = new Date();
  const id = uuidv4();

  db.insert(walkthroughs)
    .values({ id, userId, title, origin, pathPattern, steps: JSON.stringify(steps), createdAt: now, updatedAt: now })
    .run();

  return getWalkthrough(id)!;
}

export function updateWalkthrough(
  id: string,
  userId: string,
  updates: { title?: string; pathPattern?: string; steps?: Step[] }
): Walkthrough {
  const db = getDb();
  const existing = getWalkthrough(id);
  if (!existing) throw Object.assign(new Error('Not found'), { code: 'NOT_FOUND' });
  if (existing.userId !== userId) throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });

  const now = new Date();
  db.update(walkthroughs)
    .set({
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.pathPattern !== undefined && { pathPattern: updates.pathPattern }),
      ...(updates.steps !== undefined && { steps: JSON.stringify(updates.steps) }),
      updatedAt: now,
    })
    .where(eq(walkthroughs.id, id))
    .run();

  return getWalkthrough(id)!;
}

export function deleteWalkthrough(id: string, userId: string): void {
  const db = getDb();
  const existing = getWalkthrough(id);
  if (!existing) throw Object.assign(new Error('Not found'), { code: 'NOT_FOUND' });
  if (existing.userId !== userId) throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });

  db.delete(walkthroughs).where(eq(walkthroughs.id, id)).run();
}

export function getAssignees(walkthroughId: string): string[] {
  const db = getDb();
  return db
    .select({ assigneeId: walkthroughAssignments.assigneeId })
    .from(walkthroughAssignments)
    .where(eq(walkthroughAssignments.walkthroughId, walkthroughId))
    .all()
    .map(r => r.assigneeId);
}

export function assignWalkthrough(walkthroughId: string, userIds: string[], authorId: string): string[] {
  const db = getDb();
  const existing = getWalkthrough(walkthroughId);
  if (!existing) throw Object.assign(new Error('Not found'), { code: 'NOT_FOUND' });
  if (existing.userId !== authorId) throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });

  // Delete existing assignments
  db.delete(walkthroughAssignments).where(eq(walkthroughAssignments.walkthroughId, walkthroughId)).run();

  // Insert new assignments
  const now = new Date();
  for (const userId of userIds) {
    db.insert(walkthroughAssignments)
      .values({ id: uuidv4(), walkthroughId, assigneeId: userId, createdAt: now })
      .run();
  }

  return userIds;
}

export function getAssignedWalkthroughs(userId: string): Walkthrough[] {
  const db = getDb();
  const assignedIds = db
    .select({ walkthroughId: walkthroughAssignments.walkthroughId })
    .from(walkthroughAssignments)
    .where(eq(walkthroughAssignments.assigneeId, userId))
    .all()
    .map(r => r.walkthroughId);

  if (assignedIds.length === 0) return [];

  return db
    .select()
    .from(walkthroughs)
    .where(inArray(walkthroughs.id, assignedIds))
    .all()
    .map(rowToWalkthrough);
}
