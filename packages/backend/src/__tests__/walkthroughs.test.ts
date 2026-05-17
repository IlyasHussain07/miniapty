import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../app';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let ownerToken: string;
let otherToken: string;

const sampleStep = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Click login button',
  description: 'Click the main login button to proceed',
  fingerprint: {
    tag: 'button',
    innerText: 'Login',
    xpath: '/html/body/div/button',
    classes: ['btn-primary'],
    rect: { x: 100, y: 200, w: 80, h: 40 },
  },
  advanceTrigger: 'click-target' as const,
};

beforeAll(async () => {
  app = buildApp({ logger: false });
  await app.ready();

  const r1 = await supertest(app.server)
    .post('/auth/signup')
    .send({ email: 'owner-wt@example.com', password: 'password123' });
  ownerToken = r1.body.token;

  const r2 = await supertest(app.server)
    .post('/auth/signup')
    .send({ email: 'other-wt@example.com', password: 'password123' });
  otherToken = r2.body.token;
});

afterAll(async () => {
  await app.close();
});

describe('Walkthrough CRUD', () => {
  let walkthroughId: string;

  it('returns 401 without token', async () => {
    const res = await supertest(app.server).get('/walkthroughs?origin=https://example.com');
    expect(res.status).toBe(401);
  });

  it('creates a walkthrough', async () => {
    const res = await supertest(app.server)
      .post('/walkthroughs')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Login Flow',
        origin: 'https://example.com',
        pathPattern: '/login',
        steps: [sampleStep],
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('Login Flow');
    walkthroughId = res.body.id;
  });

  it('lists walkthroughs for origin', async () => {
    const res = await supertest(app.server)
      .get('/walkthroughs?origin=https://example.com')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('gets walkthrough by id', async () => {
    const res = await supertest(app.server)
      .get(`/walkthroughs/${walkthroughId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.steps).toHaveLength(1);
  });

  it('returns 403 when another user fetches the walkthrough', async () => {
    const res = await supertest(app.server)
      .get(`/walkthroughs/${walkthroughId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('updates a walkthrough', async () => {
    const res = await supertest(app.server)
      .put(`/walkthroughs/${walkthroughId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Updated Login Flow' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Login Flow');
  });

  it('returns 403 when another user tries to update', async () => {
    const res = await supertest(app.server)
      .put(`/walkthroughs/${walkthroughId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('returns 403 when another user tries to delete', async () => {
    const res = await supertest(app.server)
      .delete(`/walkthroughs/${walkthroughId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('deletes a walkthrough', async () => {
    const res = await supertest(app.server)
      .delete(`/walkthroughs/${walkthroughId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(204);
  });

  it('returns 404 after deletion', async () => {
    const res = await supertest(app.server)
      .get(`/walkthroughs/${walkthroughId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
  });
});
