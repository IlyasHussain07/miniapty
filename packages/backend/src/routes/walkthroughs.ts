import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import type { JwtPayload } from '../types';
import {
  listWalkthroughs,
  getWalkthrough,
  createWalkthrough,
  updateWalkthrough,
  deleteWalkthrough,
} from '../services/walkthroughService';

const stepSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(100),
  description: z.string().max(500),
  fingerprint: z.object({
    tag: z.string(),
    id: z.string().optional(),
    dataTestId: z.string().optional(),
    ariaLabel: z.string().optional(),
    ariaRole: z.string().optional(),
    name: z.string().optional(),
    placeholder: z.string().optional(),
    inputType: z.string().optional(),
    innerText: z.string().optional(),
    href: z.string().optional(),
    xpath: z.string(),
    classes: z.array(z.string()),
    rect: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  }),
  advanceTrigger: z.enum(['next-button', 'click-target', 'input-change']).optional(),
});

const createSchema = z.object({
  title: z.string().min(1).max(200),
  origin: z.string().url(),
  pathPattern: z.string().min(1),
  steps: z.array(stepSchema),
});

const updateSchema = createSchema.partial().omit({ origin: true });

export async function walkthroughRoutes(app: FastifyInstance): Promise<void> {
  app.get('/walkthroughs', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as JwtPayload;
    const { origin, path } = request.query as { origin?: string; path?: string };

    if (!origin) {
      return reply.status(400).send({ error: 'Validation', message: 'origin query param is required' });
    }

    return reply.send(listWalkthroughs(userId, origin, path));
  });

  app.post('/walkthroughs', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as JwtPayload;
    const result = createSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'Validation',
        message: result.error.issues.map(i => i.message).join(', '),
      });
    }

    const wt = createWalkthrough(userId, result.data.title, result.data.origin, result.data.pathPattern, result.data.steps);
    return reply.status(201).send(wt);
  });

  app.get('/walkthroughs/:id', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const wt = getWalkthrough(id);
    if (!wt) return reply.status(404).send({ error: 'NotFound', message: 'Walkthrough not found' });
    if (wt.userId !== userId) return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });

    return reply.send(wt);
  });

  app.put('/walkthroughs/:id', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const result = updateSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: 'Validation',
        message: result.error.issues.map(i => i.message).join(', '),
      });
    }

    try {
      return reply.send(updateWalkthrough(id, userId, result.data));
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'NOT_FOUND') return reply.status(404).send({ error: 'NotFound' });
      if (code === 'FORBIDDEN') return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
      throw err;
    }
  });

  app.delete('/walkthroughs/:id', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    try {
      deleteWalkthrough(id, userId);
      return reply.status(204).send();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'NOT_FOUND') return reply.status(404).send({ error: 'NotFound' });
      if (code === 'FORBIDDEN') return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
      throw err;
    }
  });
}
