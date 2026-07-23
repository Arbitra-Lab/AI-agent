import { Request, Response } from 'express';
import { createRateLimiter } from '../../src/auth/rateLimit';
import { RateLimitStore, RateLimitHit } from '../../src/auth/rateLimitStore';
import { RateLimitError, ServiceUnavailableError } from '../../src/lib/errors';

class FakeRateLimitStore implements RateLimitStore {
  private counts = new Map<string, number>();

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return { count, ttlMs: windowMs };
  }
}

class FailingRateLimitStore implements RateLimitStore {
  async hit(): Promise<RateLimitHit> {
    throw new Error('connect ECONNREFUSED 127.0.0.1:6379');
  }
}

function makeRes(): Response {
  return { setHeader: jest.fn() } as unknown as Response;
}

describe('createRateLimiter', () => {
  const preset = { points: 2, durationSeconds: 60 };

  it('allows requests within the limit', async () => {
    const limiter = createRateLimiter(new FakeRateLimitStore(), preset, 'test');
    const req = { id: 'r1', user: { id: 'user-1' } } as unknown as Request;
    const next = jest.fn();

    await limiter(req, makeRes(), next);
    await limiter(req, makeRes(), next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenNthCalledWith(1);
    expect(next).toHaveBeenNthCalledWith(2);
  });

  it('blocks requests over the limit with 429 and a Retry-After header', async () => {
    const limiter = createRateLimiter(new FakeRateLimitStore(), preset, 'test');
    const req = { id: 'r1', user: { id: 'user-1' } } as unknown as Request;
    const next = jest.fn();

    for (let i = 0; i < preset.points; i++) {
      await limiter(req, makeRes(), next);
    }
    const res = makeRes();
    await limiter(req, res, next);

    expect(next).toHaveBeenLastCalledWith(expect.any(RateLimitError));
    expect(res.setHeader).toHaveBeenCalledWith(
      'Retry-After',
      expect.any(String),
    );
  });

  it('keys by authenticated user id, isolating separate users', async () => {
    const store = new FakeRateLimitStore();
    const limiter = createRateLimiter(store, preset, 'test');
    const next = jest.fn();

    const reqA = { id: 'r1', user: { id: 'user-a' } } as unknown as Request;
    for (let i = 0; i < preset.points; i++) {
      await limiter(reqA, makeRes(), next);
    }

    const reqB = { id: 'r2', user: { id: 'user-b' } } as unknown as Request;
    next.mockClear();
    await limiter(reqB, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('keys by IP when unauthenticated', async () => {
    const store = new FakeRateLimitStore();
    const limiter = createRateLimiter(store, preset, 'test');
    const next = jest.fn();

    const req = { id: 'r1', ip: '203.0.113.5' } as unknown as Request;
    for (let i = 0; i < preset.points; i++) {
      await limiter(req, makeRes(), next);
    }
    const res = makeRes();
    await limiter(req, res, next);
    expect(next).toHaveBeenLastCalledWith(expect.any(RateLimitError));
  });

  it('fails closed with 503 when the store is unavailable, rather than allowing the request', async () => {
    const limiter = createRateLimiter(
      new FailingRateLimitStore(),
      preset,
      'test',
    );
    const req = { id: 'r1', ip: '203.0.113.5' } as unknown as Request;
    const next = jest.fn();
    const res = makeRes();

    await limiter(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ServiceUnavailableError));
    expect(res.setHeader).toHaveBeenCalledWith(
      'Retry-After',
      expect.any(String),
    );
  });
});
