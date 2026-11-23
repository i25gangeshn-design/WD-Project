import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCredentials, validateQuantity, validateImage } from '../lib/validation.js';

test('credential validation rejects malformed email and short registration passwords', () => {
  assert.equal(validateCredentials({ email: 'bad', password: 'short', confirmPassword: 'other' }, 'signup').ok, false);
  assert.equal(validateCredentials({ email: 'crew@example.com', password: 'long-enough-password', confirmPassword: 'long-enough-password', name: 'Crew' }, 'signup').ok, true);
});
test('quantity validation accepts zero and rejects decimals and negative values', () => {
  assert.deepEqual(validateQuantity('0'), { ok: true, value: 0 });
  assert.equal(validateQuantity(2.5).ok, false);
  assert.equal(validateQuantity(-1).ok, false);
});
test('image validation enforces MIME and file size limits', () => {
  assert.equal(validateImage({ type: 'image/png', size: 1000 }).ok, true);
  assert.equal(validateImage({ type: 'image/svg+xml', size: 1000 }).ok, false);
  assert.equal(validateImage({ type: 'image/jpeg', size: 1_600_000 }).ok, false);
});
