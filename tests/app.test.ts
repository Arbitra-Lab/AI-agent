import request from 'supertest';
jest.setTimeout(20000);
import { createApp } from '../src/app';

// Mock both dependency checks so this suite runs without real Postgres/Redis.
jest.mock('../src/lib/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../src/lib/redis', () => ({
  pingRedis: jest.fn(),
  closeRedis: jest.fn(),
}));

import { pool } from '../src/lib/db';
import { pingRedis } from '../src/lib/redis';

describe('GET /health', () => {
  it('returns 200 with status, version, and uptime', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.version).toBe('string');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('does not touch Postgres or Redis', async () => {
    const app = createApp();
    await request(app).get('/health');

    expect(pool.query).not.toHaveBeenCalled();
    expect(pingRedis).not.toHaveBeenCalled();
  });
});

describe('GET /ready', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 when Postgres and Redis are both reachable', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    (pingRedis as jest.Mock).mockResolvedValueOnce(true);

    const app = createApp();
    const res = await request(app).get('/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      checks: { postgres: 'ok', redis: 'ok' },
    });
  });

  it('returns 503 when Postgres is unreachable', async () => {
    (pool.query as jest.Mock).mockRejectedValueOnce(new Error('connection refused'));
    (pingRedis as jest.Mock).mockResolvedValueOnce(true);

    const app = createApp();
    const res = await request(app).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'unavailable',
      checks: { postgres: 'unavailable', redis: 'ok' },
    });
  });

  it('returns 503 when Redis is unreachable', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    (pingRedis as jest.Mock).mockResolvedValueOnce(false);

    const app = createApp();
    const res = await request(app).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'unavailable',
      checks: { postgres: 'ok', redis: 'unavailable' },
    });
  });

  it('returns 503 when both are unreachable', async () => {
    (pool.query as jest.Mock).mockRejectedValueOnce(new Error('connection refused'));
    (pingRedis as jest.Mock).mockResolvedValueOnce(false);

    const app = createApp();
    const res = await request(app).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unavailable');
  });
});

describe('security middleware', () => {
  it('sets helmet security headers', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-dns-prefetch-control']).toBeDefined();
  });

  it('enforces the JSON body size limit', async () => {
    const app = createApp();
    // Body well over the 1mb limit configured in createApp().
    const oversizedPayload = { data: 'x'.repeat(2 * 1024 * 1024) };

    const res = await request(app)
      .post('/health')
      .send(oversizedPayload);

    // /health only handles GET, so this also exercises the request pipeline
    // (body parser rejects oversized payload before reaching a route).
    expect(res.status).toBe(413);
  });
});

describe('unmatched routes', () => {
  it('returns a 404 JSON error for unknown routes', async () => {
    const app = createApp();
    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
