import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createUser, verifyCredentials } from '../services/authService';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/signup', async (request, reply) => {
    const result = credentialsSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'Validation',
        message: result.error.issues.map(i => i.message).join(', '),
      });
    }

    try {
      const user = await createUser(result.data.email, result.data.password);
      const token = app.jwt.sign({ userId: user.id, email: user.email });
      return reply.status(201).send({ token, user: { id: user.id, email: user.email } });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'EMAIL_TAKEN') {
        return reply.status(409).send({ error: 'Conflict', message: 'Email already in use' });
      }
      throw err;
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const result = credentialsSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'Validation',
        message: result.error.issues.map(i => i.message).join(', '),
      });
    }

    try {
      const user = await verifyCredentials(result.data.email, result.data.password);
      const token = app.jwt.sign({ userId: user.id, email: user.email });
      return reply.send({ token, user: { id: user.id, email: user.email } });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'INVALID_CREDENTIALS') {
        return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
      }
      throw err;
    }
  });
}
