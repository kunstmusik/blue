import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyBlueX7Resources } from './verify-blue-x7-java-resources.mjs';

test('verifyBlueX7Resources validates all 32 algorithms, diagrams, and fixtures', () => {
  const result = verifyBlueX7Resources();
  assert.equal(result.valid, true, `Verification errors: ${result.errors.join(', ')}`);
  assert.equal(result.errors.length, 0);
});
