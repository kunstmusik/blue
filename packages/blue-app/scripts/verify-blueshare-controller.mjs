// Original synthetic fixtures for the pinned, disposable blue-site integration runner.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require = createRequire(join(process.cwd(), 'package.json'));
const appRequire = createRequire(new URL('../package.json', import.meta.url));
// Refuse arbitrary existing deployments before opening the database or seeding accounts.
const databaseUrl = new URL(process.env.BLUESHARE_TEST_DATABASE_URL ?? '');
assert.ok(['127.0.0.1', 'localhost'].includes(databaseUrl.hostname));
assert.match(databaseUrl.pathname, /^\/blueshare_test_[a-f0-9]+$/);
assert.equal(databaseUrl.username, 'blueshare_test');
assert.match(process.env.BLUESHARE_TEST_DB_CONTAINER ?? '', /^blueshare-test-db-[a-f0-9]+$/);
assert.match(process.env.BLUESHARE_TEST_PROXY_CONTAINER ?? '', /^blueshare-test-proxy-[a-f0-9]+$/);
for (const name of ['BLUESHARE_TEST_APP_URL', 'BLUESHARE_TEST_ORIGIN']) {
  const url = new URL(process.env[name] ?? '');
  assert.equal(url.protocol, 'http:');
  assert.equal(url.hostname, '127.0.0.1');
}
const { PrismaClient } = require('@prisma/client');
const { GenericInstrument, Effect, GenericScore } = appRequire('@blue/data');
const db = new PrismaClient({ datasourceUrl: process.env.BLUESHARE_TEST_DATABASE_URL });
const profile = mkdtempSync(join(tmpdir(), 'blue-actual-service-'));
let controlTimer;
try {
  const base = process.env.BLUESHARE_TEST_APP_URL,
    origin = process.env.BLUESHARE_TEST_ORIGIN;
  const users = [];
  for (const name of ['desktopalice', 'desktopbob']) {
    const response = await fetch(base + '/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({
        email: `${name}@example.invalid`,
        password: 'Test-only-password-2026!',
        name,
        username: name,
      }),
    });
    assert.equal(response.status, 200);
    users.push((await response.json()).user);
  }
  const instrument = new GenericInstrument();
  instrument.setName('Synthetic instrument');
  instrument.setText('  a1 oscili 0.1, 440\n; literal <include>\n');
  const effect = new Effect();
  effect.setName('Synthetic effect');
  effect.setCode('  aout = ain\n');
  const score = new GenericScore();
  score.setName('Synthetic score');
  score.setScoreText('  i1 0 1 0.5 440\n');
  const fixtures = {
    instrument: instrument.saveAsXML().toXml(),
    effect: effect.saveAsXML().toXml(),
    soundObject: score.saveAsXML().toXml(),
  };
  for (const kind of Object.keys(fixtures)) {
    const category = {
      instrument: db.instrumentCategory,
      effect: db.effectCategory,
      soundObject: db.soundObjectCategory,
    }[kind];
    const model = { instrument: db.instrument, effect: db.effect, soundObject: db.soundObject }[
      kind
    ];
    const field = {
      instrument: 'instrumentText',
      effect: 'effectText',
      soundObject: 'soundObjectText',
    }[kind];
    await category.createMany({
      data: [
        { id: 1, name: 'Synthetic root' },
        { id: 2, name: 'Synthetic nested', parentId: 1 },
        { id: 3, name: 'Synthetic empty' },
      ],
    });
    const common = {
      userId: users[0].id,
      categoryId: 1,
      name: `Synthetic ${kind}`,
      description: null,
      [field]: fixtures[kind],
      ...(kind === 'effect'
        ? {}
        : {
            blueType:
              kind === 'instrument'
                ? 'blue.orchestra.GenericInstrument'
                : 'blue.soundObject.GenericScore',
          }),
    };
    await model.createMany({
      data: [
        ...Array.from({ length: 31 }, (_, i) => ({
          ...common,
          id: i + 1,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        })),
        {
          ...common,
          id: 90,
          [field]: fixtures[kind].replace(`</${kind}>`, `<unexpected/></${kind}>`),
        },
      ],
    });
    const table = { instrument: 'instruments', effect: 'effects', soundObject: 'sound_objects' }[
      kind
    ];
    await db.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), 90, true)`);
  }
  writeFileSync(join(profile, 'fixtures.json'), JSON.stringify(fixtures));
  // Test-only control files live in the disposable profile. No production API or
  // desktop IPC is extended; the database was checked for a disposable identity above.
  let lastControl = 0;
  controlTimer = setInterval(async () => {
    const requestPath = join(profile, 'session-control-request.json');
    if (!existsSync(requestPath)) return;
    const request = JSON.parse(readFileSync(requestPath, 'utf8'));
    if (request.id <= lastControl) return;
    lastControl = request.id;
    try {
      const where = { userId: users[0].id };
      let result = null;
      if (request.action === 'age') {
        const expiresAt = new Date(Date.now() + 3600_000);
        await db.session.updateMany({
          where,
          data: {
            createdAt: new Date(Date.now() - 3 * 86400_000),
            updatedAt: new Date(0),
            expiresAt,
          },
        });
        result = expiresAt.toISOString();
      } else if (request.action === 'expiry') {
        await db.session.updateMany({ where, data: { expiresAt: new Date(0) } });
      } else if (request.action === 'revoke') {
        await db.session.deleteMany({ where });
      } else if (request.action === 'reset') {
        const headers = { Origin: origin, 'Content-Type': 'application/json' };
        const requested = await fetch(base + '/api/auth/request-password-reset', {
          method: 'POST',
          headers,
          body: JSON.stringify({ email: 'desktopalice@example.invalid', redirectTo: '/login' }),
        });
        assert.equal(requested.status, 200);
        const messages = readFileSync(process.env.BLUESHARE_TEST_MAIL_FILE, 'utf8')
          .trim()
          .split('\n')
          .map(JSON.parse);
        const mail = messages.findLast((message) =>
          message.to.includes('desktopalice@example.invalid'),
        );
        assert.ok(mail);
        const resetUrl = new URL(mail.text.match(/http[^\s]+/)[0]);
        assert.equal(resetUrl.origin, origin);
        assert.match(resetUrl.pathname, /^\/reset-password\//);
        const reset = await fetch(base + '/api/auth/reset-password', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            token: decodeURIComponent(resetUrl.pathname.split('/').at(-1)),
            newPassword: 'Test-only-password-2026!',
          }),
        });
        assert.equal(reset.status, 200);
        assert.equal(await db.session.count({ where }), 0);
      } else if (request.action === 'inspect') {
        const sessions = await db.session.findMany({ where });
        result = sessions.map((session) => session.expiresAt.toISOString());
      } else throw Error('Unknown test control');
      writeFileSync(
        join(profile, 'session-control-response.tmp'),
        JSON.stringify({ id: request.id, ok: true, result }),
      );
      renameSync(
        join(profile, 'session-control-response.tmp'),
        join(profile, 'session-control-response.json'),
      );
    } catch {
      writeFileSync(
        join(profile, 'session-control-response.tmp'),
        JSON.stringify({ id: request.id, ok: false }),
      );
      renameSync(
        join(profile, 'session-control-response.tmp'),
        join(profile, 'session-control-response.json'),
      );
    }
  }, 100);

  const code = await new Promise((resolve, reject) => {
    const child = spawn(
      appRequire('electron'),
      [fileURLToPath(new URL('./verify-blueshare-service.mjs', import.meta.url))],
      {
        stdio: 'inherit',
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '', BLUESHARE_TEST_PROFILE: profile },
      },
    );
    child.once('error', reject);
    child.once('exit', resolve);
  });
  assert.equal(code, 0);
  writeFileSync(
    join(tmpdir(), 'blue-remember-login-form.png'),
    readFileSync(join(profile, 'remembered-login-form.png')),
  );
} finally {
  clearInterval(controlTimer);
  await db.$disconnect();
  rmSync(profile, { recursive: true, force: true });
}
