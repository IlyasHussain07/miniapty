import type { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../types';

export async function requireAuthor(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
    return;
  }
  const payload = request.user as JwtPayload;
  if (payload.role !== 'author') {
    reply.status(403).send({ error: 'Forbidden', message: 'Author role required' });
  }
}
