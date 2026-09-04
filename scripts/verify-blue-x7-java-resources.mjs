import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

export function verifyBlueX7Resources(root = repoRoot) {
  const errors = [];

  // 1. Verify algorithm orchestra file and 32 algorithms
  const orcPath = path.join(
    root,
    'packages/blue-data/src/instruments/blue-x7/algorithm-orchestra.ts',
  );
  if (!fs.existsSync(orcPath)) {
    errors.push(`Missing algorithm orchestra file: ${orcPath}`);
  } else {
    const orcContent = fs.readFileSync(orcPath, 'utf-8');
    for (let i = 1; i <= 32; i++) {
      if (
        !orcContent.includes(`  ${i}: `) &&
        !orcContent.includes(`"${i}":`) &&
        !orcContent.includes(`${i}: "`)
      ) {
        errors.push(`Missing algorithm ${i} ORC definition in algorithm-orchestra.ts`);
      }
    }
  }

  // 2. Verify 32 algorithm GIF diagrams
  const assetDir = path.join(root, 'packages/blue-app/src/renderer/assets/blue-x7');
  for (let i = 1; i <= 32; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    const gifPath = path.join(assetDir, `algo${num}.gif`);
    if (!fs.existsSync(gifPath)) {
      errors.push(`Missing algorithm diagram: ${gifPath}`);
    }
  }

  // 3. Verify SysEx test fixtures
  const fixtureDir = path.join(root, 'packages/blue-data/src/instruments/blue-x7/test-fixtures');
  const requiredFixtures = [
    'java-default.blue.xml',
    'boundary-and-unknown.blue.xml',
    'expected-decode.json',
    'single-voice.syx',
    'voice-bank.syx',
  ];
  for (const fix of requiredFixtures) {
    const fixPath = path.join(fixtureDir, fix);
    if (!fs.existsSync(fixPath)) {
      errors.push(`Missing test fixture: ${fixPath}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

if (process.argv[1] === __filename) {
  const result = verifyBlueX7Resources();
  if (!result.valid) {
    console.error('BlueX7 Resource Verification Failed:');
    result.errors.forEach((e) => console.error(` - ${e}`));
    process.exit(1);
  } else {
    console.log('BlueX7 Resources Verified: all 32 ORCs, diagrams, and fixtures are intact.');
  }
}
