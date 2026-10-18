#!/usr/bin/env node
// Native Chromium cookie/transport acceptance. All proof and servers are synthetic.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer as httpServer } from 'node:http';
import { createServer as httpsServer } from 'node:https';
import { createSecureServer as http2Server } from 'node:http2';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const args = Object.fromEntries(
  process.argv
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const i = a.indexOf('=');
      return [a.slice(2, i), a.slice(i + 1)];
    }),
);
if (!process.versions.electron) await supervise();
else void nativePhase();

async function supervise() {
  const profile = mkdtempSync(join(tmpdir(), 'blue-native-session-'));
  const partition = `blueshare-native-restart-${randomUUID()}`;
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        join(profile, 'key.pem'),
        '-out',
        join(profile, 'cert.pem'),
        '-days',
        '1',
        '-subj',
        '/CN=blue-a.test',
        '-addext',
        'subjectAltName=DNS:blue-a.test,DNS:blue-b.test',
      ],
      { stdio: 'ignore' },
    );
    for (const phase of ['1', '2', '3', '4']) {
      await new Promise((resolve, reject) => {
        const child = spawn(
          require('electron'),
          [
            fileURLToPath(import.meta.url),
            `--phase=${phase}`,
            `--profile=${profile}`,
            `--partition=${partition}`,
          ],
          { stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } },
        );
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error(`Native phase ${phase} exceeded 60 seconds`));
        }, 60000);
        child.once('error', (e) => {
          clearTimeout(timer);
          reject(e);
        });
        child.once('exit', (code) => {
          clearTimeout(timer);
          code === 0 ? resolve() : reject(new Error(`Native phase ${phase} failed`));
        });
      });
    }
    console.log(
      'PASS: native memory-only and OS-encrypted restart phases; exact-partition restart, HTTPS/Secure/host-only, body stall and cleanup.',
    );
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}
async function nativePhase() {
  const { app, session, net } = require('electron');
  app.setPath('userData', args.profile);
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch(
    'host-resolver-rules',
    'MAP blue-a.test 127.0.0.1, MAP blue-b.test 127.0.0.1',
  );
  app.commandLine.appendSwitch('no-proxy-server');
  await app.whenReady();
  let exitCode = 0;
  const servers = [];
  try {
    if (args.phase === '3' || args.phase === '4') {
      await rememberedPhase();
      return;
    }
    assert.ok(args.partition?.startsWith('blueshare-native-restart-'));
    const nativeSession = session.fromPartition(args.partition, { cache: false });
    if (args.phase === '2') {
      const recorded = JSON.parse(
        readFileSync(join(args.profile, 'restart-identity.json'), 'utf8'),
      );
      assert.equal(args.partition, recorded.partition);
      assert.equal((await nativeSession.cookies.get({})).length, 0);
      assert.equal((await session.defaultSession.cookies.get({})).length, 0);
      console.log(
        `PASS phase 2: reopened identical nonpersistent partition on ${process.platform}; no proof retained.`,
      );
      return;
    }
    const { BlueShareTransport } = require('../dist/main/blueshare/transport.js');
    // Trust only the generated local test certificate, only in test partitions.
    const trustLocal = (target) =>
      target.setCertificateVerifyProc((request, callback) =>
        callback(['blue-a.test', 'blue-b.test'].includes(request.hostname) ? 0 : -2),
      );
    trustLocal(nativeSession);
    let redirected = false;
    let lostWrites = 0;
    let lastHttpVersion = '';
    let lastConnection;
    const connectionIds = new WeakMap();
    let nextConnection = 0;
    const http2Sessions = new Set();
    const handler = (req, res) => {
      lastHttpVersion = req.httpVersion;
      const connection = req.stream?.session ?? req.socket;
      if (!connectionIds.has(connection)) connectionIds.set(connection, ++nextConnection);
      lastConnection = connectionIds.get(connection);
      const route = new URL(req.url, 'https://blue-a.test').pathname.split('/').at(-1);
      if (route === 'login') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': [
            'session_token=synthetic-proof; Secure; HttpOnly; Path=/; SameSite=Lax',
            'dont_remember=1; Secure; HttpOnly; Path=/; SameSite=Lax',
            'restricted=synthetic-path; Secure; HttpOnly; Path=/api/blueshare/v1/private',
          ],
        });
        return res.end('{}');
      }
      if (route === 'lost') {
        // Count only a fully received activation, then lose its committed response.
        req.resume();
        req.on('end', () => {
          lostWrites++;
          if (res.stream) res.stream.session.destroy();
          else res.destroy();
        });
        return;
      }
      if (route === 'stall') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.flushHeaders();
        res.write('{');
        return;
      }
      if (route === 'large') {
        res.writeHead(200);
        res.end(Buffer.alloc(16 * 1024 * 1024 + 1));
        return;
      }
      if (route === 'redirect') {
        res.writeHead(302, { Location: `https://blue-b.test:${secure.address().port}/stolen` });
        res.end();
        return;
      }
      if (route === 'stolen') redirected = true;
      if (route === 'logout') {
        res.writeHead(200, { 'Set-Cookie': 'session_token=; Secure; HttpOnly; Path=/; Max-Age=0' });
        return res.end('{}');
      }
      if (route === 'late') {
        setTimeout(() => {
          if (!res.destroyed) {
            res.writeHead(200, { 'Set-Cookie': 'late=synthetic; Secure; Path=/' });
            res.end('{}');
          }
        }, 100);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ cookie: req.headers.cookie ?? '' }));
    };
    const secure = httpsServer(
      {
        key: readFileSync(join(args.profile, 'key.pem')),
        cert: readFileSync(join(args.profile, 'cert.pem')),
      },
      handler,
    );
    const plain = httpServer(handler);
    const multiplexed = http2Server(
      {
        allowHTTP1: true,
        key: readFileSync(join(args.profile, 'key.pem')),
        cert: readFileSync(join(args.profile, 'cert.pem')),
      },
      handler,
    );
    multiplexed.on('session', (connection) => {
      http2Sessions.add(connection);
      connection.on('close', () => http2Sessions.delete(connection));
    });
    multiplexed.closeAllConnections = () => {
      for (const connection of http2Sessions) connection.destroy();
    };
    servers.push(secure, plain, multiplexed);
    for (const server of servers)
      await new Promise((resolve, reject) =>
        server.listen(0, '127.0.0.1', resolve).once('error', reject),
      );
    const origin = `https://blue-a.test:${secure.address().port}`;
    const transport = new BlueShareTransport({ origin });
    const request = (options) =>
      transport.sendRequest({ ...options, session: nativeSession, partitionName: args.partition });
    await request({ routePath: '/login', method: 'POST', body: {} });
    const cookies = await nativeSession.cookies.get({ url: origin });
    assert.ok(
      cookies.some((c) => c.name === 'session_token' && c.secure && c.httpOnly && c.hostOnly),
    );
    assert.ok(cookies.some((c) => c.name === 'dont_remember'));
    assert.equal((await session.defaultSession.cookies.get({})).length, 0);
    const echo = JSON.parse((await request({ routePath: '/echo' })).body).cookie;
    assert.match(echo, /session_token=/);
    assert.match(echo, /dont_remember=/);
    assert.doesNotMatch(echo, /restricted=/);
    assert.match(
      JSON.parse((await request({ routePath: '/private/echo' })).body).cookie,
      /restricted=/,
    );
    // Same Session and host over plain HTTP: only the scheme changes for Secure.
    const insecureEcho = await new Promise((resolve, reject) => {
      const req = net.request({
        url: `http://blue-a.test:${plain.address().port}/echo`,
        session: nativeSession,
        credentials: 'include',
        redirect: 'error',
      });
      req.on('error', reject);
      req.on('response', (res) => {
        let body = '';
        res.on('data', (part) => (body += part));
        res.on('end', () => resolve(JSON.parse(body).cookie));
      });
      req.end();
    });
    assert.doesNotMatch(insecureEcho, /session_token=|dont_remember=|restricted=/);
    // Same Session and HTTPS, distinct hostname: proves host-only scoping.
    const other = new BlueShareTransport({
      origin: `https://blue-b.test:${secure.address().port}`,
    });
    assert.equal(
      JSON.parse((await other.sendRequest({ routePath: '/echo', session: nativeSession })).body)
        .cookie,
      '',
    );
    await assert.rejects(request({ routePath: '/redirect' }), /Redirect|network/);
    assert.equal(redirected, false);
    const http2Transport = new BlueShareTransport({
      origin: `https://blue-a.test:${multiplexed.address().port}`,
    });
    for (const [protocol, target] of [
      ['HTTP/1.1', transport],
      ['HTTP/2', http2Transport],
    ]) {
      for (const method of ['POST', 'DELETE']) {
        for (const warmed of [false, true]) {
          await nativeSession.closeAllConnections();
          let priorConnection;
          if (warmed) {
            // A raw native GET leaves the connection reusable even on HTTP/1.1.
            await new Promise((resolve, reject) => {
              const warm = net.request({
                url: target.buildUrl('/echo'),
                session: nativeSession,
                credentials: 'include',
              });
              warm.on('error', reject);
              warm.on('response', (response) => {
                response.on('data', () => {});
                response.on('end', resolve);
              });
              warm.end();
            });
            priorConnection = lastConnection;
            assert.equal(lastHttpVersion, protocol === 'HTTP/2' ? '2.0' : '1.1');
          }
          const before = lostWrites;
          await assert.rejects(
            target.sendRequest({
              routePath: '/lost',
              method,
              ...(method === 'POST' ? { body: { synthetic: true } } : {}),
              session: nativeSession,
            }),
          );
          assert.equal(
            lostWrites,
            before + 1,
            `${protocol} ${method}, warmed=${warmed}: exactly one full delivery; no replay`,
          );
          assert.equal(lastHttpVersion, protocol === 'HTTP/2' ? '2.0' : '1.1');
          if (warmed)
            assert.notEqual(
              lastConnection,
              priorConnection,
              'Mutation must use a fresh native connection',
            );
          console.log(`PASS no replay: ${protocol} ${method}, warmed=${warmed}`);
        }
      }
    }
    await assert.rejects(request({ routePath: '/stall', timeoutMs: 150 }), /timed out/);
    await assert.rejects(request({ routePath: '/large' }), /maximum size/);
    const late = request({ routePath: '/late' });
    transport.rotateSession();
    await late;
    const rotated = session.fromPartition(transport.getPartitionName(), { cache: false });
    trustLocal(rotated);
    assert.equal((await rotated.cookies.get({})).length, 0);
    await request({ routePath: '/logout', method: 'DELETE' });
    assert.ok(
      !(await nativeSession.cookies.get({ url: origin })).some((c) => c.name === 'session_token'),
    );
    await request({ routePath: '/login', method: 'POST', body: {} });
    assert.ok((await nativeSession.cookies.get({ url: origin })).length > 0);
    // Identity only; do not persist proof. Phase 2 reopens exactly this partition.
    writeFileSync(
      join(args.profile, 'restart-identity.json'),
      JSON.stringify({ partition: args.partition }),
    );
    console.log(
      `PASS phase 1: Electron ${process.versions.electron} on ${process.platform}; native HTTPS cookies, paths, hosts, redirect, body deadline/size, rotation, logout.`,
    );
  } catch (error) {
    console.error('Native session acceptance failed:', error.message);
    exitCode = 1;
  } finally {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise((resolve) => {
            server.closeAllConnections();
            server.close(resolve);
          }),
      ),
    );
    app.exit(exitCode);
  }
}

async function rememberedPhase() {
  const { safeStorage, session } = require('electron');
  const { RememberedSessionStore } = require('../dist/main/blueshare/remembered-session.js');
  const { BlueShareTransport } = require('../dist/main/blueshare/transport.js');
  const { BlueShareService } = require('../dist/main/blueshare/service.js');
  assert.ok(
    safeStorage.isEncryptionAvailable(),
    'OS-protected storage must be available for remembered acceptance',
  );
  assert.notEqual(safeStorage.getSelectedStorageBackend?.(), 'basic_text');
  const identityFile = join(args.profile, 'remembered-identity.json');
  let identity = args.phase === '4' ? JSON.parse(readFileSync(identityFile, 'utf8')) : null;
  const user = { id: 'synthetic', name: 'Synthetic', username: 'synthetic' };
  let revoked = false;
  const server = httpsServer(
    {
      key: readFileSync(join(args.profile, 'key.pem')),
      cert: readFileSync(join(args.profile, 'cert.pem')),
    },
    (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          const remembered = JSON.parse(body).rememberMe === true;
          identity.expiresAt = new Date(
            Date.now() + (remembered ? 7 : 1) * 86400_000,
          ).toISOString();
          res.setHeader('Set-Cookie', [
            `session_token=synthetic-remembered-proof; Secure; HttpOnly; Path=/; SameSite=Lax${remembered ? '; Max-Age=604800' : ''}`,
            `remember_marker=synthetic-marker; Secure; HttpOnly; Path=/api/blueshare; SameSite=Strict${remembered ? '; Max-Age=604800' : ''}`,
          ]);
          res.end(JSON.stringify({ user }));
        });
        return;
      }
      if (req.method === 'DELETE') {
        revoked = true;
        res.end(JSON.stringify({ signedOut: true }));
        return;
      }
      if (revoked || !req.headers.cookie?.includes('session_token=synthetic-remembered-proof')) {
        res.statusCode = 401;
        res.end(
          JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Session unavailable' } }),
        );
        return;
      }
      assert.ok(req.headers.cookie.includes('remember_marker=synthetic-marker'));
      res.end(JSON.stringify({ user, expiresAt: identity.expiresAt }));
    },
  );
  await new Promise((resolve) => server.listen(identity?.port ?? 0, '127.0.0.1', resolve));
  if (!identity) identity = { port: server.address().port, expiresAt: null };
  const origin = `https://blue-a.test:${identity.port}`;
  const transport = new BlueShareTransport({ origin });
  const native = session.fromPartition(transport.getPartitionName(), { cache: false });
  native.setCertificateVerifyProc((request, callback) =>
    callback(request.hostname === 'blue-a.test' ? 0 : -3),
  );
  // Restore creates a fresh partition; trust only this test certificate on its native requests.
  const rotate = transport.rotateSession.bind(transport);
  transport.rotateSession = () => {
    rotate();
    session
      .fromPartition(transport.getPartitionName(), { cache: false })
      .setCertificateVerifyProc((request, callback) =>
        callback(request.hostname === 'blue-a.test' ? 0 : -3),
      );
  };
  const filePath = join(args.profile, 'remembered.enc');
  const store = new RememberedSessionStore({ filePath, origin, encryption: safeStorage });
  const service = new BlueShareService({ transport, rememberedSession: store });
  const opened = service.openDialog({ id: 1, isDestroyed: () => false });
  assert.equal(opened.ok, true);
  const ctx = opened.value.contextId;
  try {
    if (args.phase === '3') {
      assert.equal(
        (await service.signIn(ctx, 'ordinary', 'synthetic@example.invalid', 'synthetic-password'))
          .ok,
        true,
      );
      assert.equal(await store.load(), null);
      assert.equal(
        (
          await service.signIn(
            ctx,
            'remembered',
            'synthetic@example.invalid',
            'synthetic-password',
            undefined,
            true,
          )
        ).ok,
        true,
      );
      assert.equal(service.getAccountSnapshot().persistenceWarning, undefined);
      assert.ok(await store.load());
      assert.ok(!readFileSync(filePath).includes(Buffer.from('synthetic-remembered-proof')));
      writeFileSync(identityFile, JSON.stringify(identity));
    } else {
      assert.equal(opened.value.account.state, 'signedOut');
      assert.equal(
        (await session.fromPartition(args.partition, { cache: false }).cookies.get({})).length,
        0,
      );
      assert.equal((await service.getAccount(ctx)).value.state, 'signedIn');
      const restored = session.fromPartition(transport.getPartitionName(), { cache: false });
      const cookies = await restored.cookies.get({ domain: 'blue-a.test' });
      assert.ok(cookies.every((c) => c.secure && c.httpOnly && c.hostOnly));
      assert.ok(cookies.some((c) => c.path === '/api/blueshare'));
      assert.equal((await session.defaultSession.cookies.get({})).length, 0);
      revoked = true;
      assert.equal((await service.verifySession(ctx)).ok, false);
      assert.equal(await store.load(), null);
      assert.equal(service.getAccountSnapshot().state, 'signedOut');
      revoked = false;
      assert.equal(
        (
          await service.signIn(
            ctx,
            'remembered-again',
            'synthetic@example.invalid',
            'synthetic-password',
            undefined,
            true,
          )
        ).ok,
        true,
      );
      await new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      });
      assert.deepEqual((await service.signOut(ctx, 'offline-out')).value, {
        signedOut: true,
        remoteRevocationConfirmed: false,
      });
      assert.equal(await store.load(), null);
    }
    console.log(
      `PASS native remembered phase ${args.phase}: ${process.platform}, real OS encryption, cookie attributes, validated restart/revocation/offline sign-out.`,
    );
  } finally {
    service.shutdown();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
