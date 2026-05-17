import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../app';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('POST /auth/signup', () => {
  it('creates a user and returns a JWT', async () => {
    const res = await supertest(app.server)
      .post('/auth/signup')
      .send({ email: 'signup@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('signup@example.com');
    expect(res.body.user.id).toBeDefined();
  });

  it('rejects duplicate email with 409', async () => {
    await supertest(app.server)
      .post('/auth/signup')
      .send({ email: 'dup@example.com', password: 'password123' });

    const res = await supertest(app.server)
      .post('/auth/signup')
      .send({ email: 'dup@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
  });

  it('rejects short password with 400', async () => {
    const res = await supertest(app.server)
      .post('/auth/signup')
      .send({ email: 'new@example.com', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation');
  });

  it('rejects invalid email with 400', async () => {
    const res = await supertest(app.server)
      .post('/auth/signup')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  beforeAll(async () => {
    await supertest(app.server)
      .post('/auth/signup')
      .send({ email: 'login@example.com', password: 'password123' });
  });

  it('returns a token on valid credentials', async () => {
    const res = await supertest(app.server)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('returns 401 on wrong password', async () => {
    const res = await supertest(app.server)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 401 on unknown email', async () => {
    const res = await supertest(app.server)
      .post('/auth/login')
      .send({ email: 'ghost@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await supertest(app.server).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
