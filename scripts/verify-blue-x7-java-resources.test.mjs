import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyBlueX7Resources } from './verify-blue-x7-java-resources.mjs';

test('verifyBlueX7Resources validates all 32 algorithms, diagrams, and fixtures', () => {
  const result = verifyBlueX7Resources();
  assert.equal(result.valid, true, `Verification errors: ${result.errors.join(', ')}`);
  assert.equal(result.errors.length, 0);
});

test('verifyBlueX7Resources reports errors when resources are missing', () => {
  const result = verifyBlueX7Resources('/non-existent-root');
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.some((e) => e.includes('Missing algorithm orchestra file')));
  assert.ok(result.errors.some((e) => e.includes('Missing algorithm images manifest')));
});
