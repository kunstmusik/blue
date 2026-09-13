import assert from 'node:assert/strict';
import test from 'node:test';

import { parseFlags } from './parse-cli-flags.mjs';

test('parses values, booleans, repeated flags, and ignores positionals', () => {
  assert.deepEqual(
    parseFlags(['generate', '--out', 'manifest.json', '--verbose', '--out', 'final.json']),
    { out: 'final.json', verbose: 'true' },
  );
});

test('preserves the legacy empty-value behavior when requested', () => {
  assert.deepEqual(parseFlags(['--profile', ''], { acceptEmptyValues: false }), {
    profile: 'true',
  });
});
