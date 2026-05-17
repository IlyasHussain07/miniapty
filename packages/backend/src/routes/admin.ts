import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index';
import { users } from '../db/schema';
import { requireAuthor } from '../middleware/requireAuthor';
import type { JwtPayload, AdminUser } from '../types';

const updateRoleSchema = z.object({
  role: z.enum(['author', 'user']),
});

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: Record<string, unknown> }>(
    '/admin/users',
    { preHandler: requireAuthor },
    async (request, reply) => {
      const db = getDb();
      const allUsers = db.select().from(users).all();
      const result: AdminUser[] = allUsers.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
      }));
      return reply.send(result);
    }
  );

  app.patch<{ Params: { id: string }; Body: { role: string } }>(
    '/admin/users/:id/role',
    { preHandler: requireAuthor },
    async (request, reply) => {
      const validation = updateRoleSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: 'Validation',
          message: validation.error.issues.map(i => i.message).join(', '),
        });
      }

      const payload = request.user as JwtPayload;
      const targetId = request.params.id;

      if (targetId === payload.userId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Cannot change your own role',
        });
      }

      const db = getDb();
      const user = db.select().from(users).where(eq(users.id, targetId)).get();
      if (!user) {
        return reply.status(404).send({
          error: 'NotFound',
          message: 'User not found',
        });
      }

      db.update(users).set({ role: validation.data.role }).where(eq(users.id, targetId)).run();

      const updated = db.select().from(users).where(eq(users.id, targetId)).get();
      return reply.send({
        id: updated.id,
        email: updated.email,
        role: updated.role,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
      } as AdminUser);
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/admin/users/:id',
    { preHandler: requireAuthor },
    async (request, reply) => {
      const payload = request.user as JwtPayload;
      const targetId = request.params.id;

      if (targetId === payload.userId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Cannot deactivate your own account',
        });
      }

      const db = getDb();
      const user = db.select().from(users).where(eq(users.id, targetId)).get();
      if (!user) {
        return reply.status(404).send({
          error: 'NotFound',
          message: 'User not found',
        });
      }

      if (!user.isActive) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'User already deactivated',
        });
      }

      db.update(users).set({ isActive: false }).where(eq(users.id, targetId)).run();

      return reply.status(204).send();
    }
  );

  app.patch<{ Params: { id: string } }>(
    '/admin/users/:id/activate',
    { preHandler: requireAuthor },
    async (request, reply) => {
      const targetId = request.params.id;

      const db = getDb();
      const user = db.select().from(users).where(eq(users.id, targetId)).get();
      if (!user) {
        return reply.status(404).send({
          error: 'NotFound',
          message: 'User not found',
        });
      }

      if (user.isActive) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'User is already active',
        });
      }

      db.update(users).set({ isActive: true }).where(eq(users.id, targetId)).run();

      const updated = db.select().from(users).where(eq(users.id, targetId)).get();
      if (!updated) {
        return reply.status(404).send({
          error: 'NotFound',
          message: 'User not found',
        });
      }
      return reply.send({
        id: updated.id,
        email: updated.email,
        role: updated.role,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
      });
    }
  );
}
