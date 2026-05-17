import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { authRoutes } from './routes/auth';
import { walkthroughRoutes } from './routes/walkthroughs';

export function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? true });

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (
        origin.startsWith('chrome-extension://') ||
        origin.startsWith('http://localhost') ||
        process.env.NODE_ENV === 'test'
      ) {
        return cb(null, true);
      }
      cb(null, false);
    },
    credentials: true,
  });

  app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-must-change',
    sign: { expiresIn: '7d' },
  });

  app.register(authRoutes);
  app.register(walkthroughRoutes);

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const status = error.statusCode ?? 500;
    reply.status(status).send({
      error: status >= 500 ? 'InternalServerError' : error.name,
      message: status >= 500 ? 'An unexpected error occurred' : error.message,
    });
  });

  return app;
}
