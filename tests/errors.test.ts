import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AppError } from '@/lib/errors.js';

test('AppError defaults to a 500 status code', () => {
  const err = new AppError('boom');
  assert.equal(err.statusCode, 500);
  assert.equal(err.message, 'boom');
});

test('AppError accepts a custom status code', () => {
  const err = new AppError('not found', 404);
  assert.equal(err.statusCode, 404);
});
