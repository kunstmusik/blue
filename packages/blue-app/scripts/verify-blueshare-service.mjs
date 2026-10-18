#!/usr/bin/env node
// Run only from the isolated blue-site integration harness, with original fixtures.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { release } from 'node:os';
import { createRequire } from 'node:module';
import { createServer, request as httpRequest } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const appRoot = fileURLToPath(new URL('..', import.meta.url));
function acceptanceFingerprint(paths) {
  const hash = createHash('sha256');
  for (const path of [...paths].sort())
    hash
      .update(path)
      .update('\0')
      .update(
        createHash('sha256')
          .update(readFileSync(join(appRoot, path)))
          .digest(),
      );
  return hash.digest('hex');
}
void run();
async function run() {
  const { app } = require('electron');
  const origin = process.env.BLUESHARE_TEST_ORIGIN;
  const profile = process.env.BLUESHARE_TEST_PROFILE;
  assert.ok(profile && /^http:\/\/127\.0\.0\.1:\d+$/.test(origin ?? ''));
  assert.match(process.env.BLUESHARE_TEST_DATABASE_URL ?? '', /\/blueshare_test_[a-z0-9]+$/);
  app.setPath('userData', profile);
  app.disableHardwareAcceleration();
  await app.whenReady();
  console.log(
    'Acceptance identity:',
    JSON.stringify({
      desktopHead: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: appRoot,
        encoding: 'utf8',
      }).trim(),
      sourceFingerprint: acceptanceFingerprint([
        'src/main/main.ts',
        'src/main/blueshare/service.ts',
        'src/main/blueshare/remembered-session.ts',
        'src/main/blueshare/transport.ts',
        'src/main/blueshare/ipc.ts',
        'src/shared/blueshare.ts',
        'src/preload/preload.ts',
        'src/renderer/types/global.d.ts',
        'src/renderer/components/blueshare/use-blueshare.ts',
        'src/renderer/components/blueshare/BlueShareDialog.tsx',
        'src/renderer/components/blueshare/BlueShareTrees.tsx',
        'src/renderer/components/libraries/LibraryTree.tsx',
        'src/renderer/components/libraries/LibraryContextMenu.tsx',
        'src/renderer/components/blueshare/blueshare-query.ts',
        'scripts/verify-blueshare-service.mjs',
        'scripts/verify-blueshare-controller.mjs',
        'scripts/blueshare-acceptance-renderer.tsx',
      ]),
      compiledFingerprint: acceptanceFingerprint([
        'dist/main/blueshare/service.js',
        'dist/main/blueshare/remembered-session.js',
        'dist/main/blueshare/transport.js',
        'dist/main/blueshare/ipc.js',
        'dist/preload/preload.js',
      ]),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      os: `${process.platform}/${process.arch}/${release()}`,
    }),
  );
  let library, service, proxy;
  let exitCode = 0;
  try {
    const { BlueShareService } = require('../dist/main/blueshare/service.js');
    const { BlueShareTransport } = require('../dist/main/blueshare/transport.js');
    const { UnifiedLibraryService } = require('../dist/main/unified-library/service.js');
    const {
      UnifiedLibraryProjectAdapter,
    } = require('../dist/main/unified-library/project-adapter.js');
    const { ProjectSession } = require('../dist/main/project-session.js');
    const { ProjectHistory } = require('../dist/main/project-history.js');
    const { BlueData } = require('@blue/data');
    const fixtures = JSON.parse(readFileSync(join(profile, 'fixtures.json'), 'utf8'));
    const project = new ProjectSession();
    project.replace(new BlueData(), join(profile, 'synthetic.blue'));
    const history = new ProjectHistory({
      session: project,
      reconciliation: { reconcileCommit: async () => [], drainPreviews: async () => {} },
    });
    history.markClean();
    const initial = project.read();
    const initialXml = initial.data.saveToString();
    const projectAdapter = new UnifiedLibraryProjectAdapter(() => ({
      data: project.read().data,
      sessionId: initial.sessionId,
      revision: initial.revision,
      commit: async () => {
        throw new Error('BlueShare attempted project mutation');
      },
    }));
    library = new UnifiedLibraryService(
      join(profile, 'blue_libraries.sqlite'),
      undefined,
      projectAdapter,
    );
    assert.equal((await library.start()).phase, 'ready');
    let loseNextWrite = false,
      writes = 0;
    // Controlled fault relay only: native Chromium still owns all cookie processing.
    // The isolated service's configured Origin is restored at this testing relay.
    const nextAt = { read: 0, write: 0, login: 0 };
    proxy = createServer(async (req, res) => {
      // Pace this high-volume acceptance run within the unchanged production
      // proxy limits. This test relay never retries a request.
      const lane =
        req.method === 'POST' && req.url.endsWith('/session')
          ? 'login'
          : req.method === 'GET'
            ? 'read'
            : 'write';
      const spacing = { read: 510, write: 6100, login: 12100 }[lane];
      const delay = Math.max(0, nextAt[lane] - Date.now());
      nextAt[lane] = Date.now() + delay + spacing;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      const write = req.method !== 'GET' && /\/resources(?:\/\d+)?$/.test(req.url);
      if (write) writes++;
      const lose = write && loseNextWrite;
      if (lose) loseNextWrite = false;
      const upstream = httpRequest(
        new URL(req.url, origin),
        { method: req.method, headers: { ...req.headers, host: new URL(origin).host, origin } },
        (response) => {
          if (lose) {
            response.resume();
            response.once('end', () => setTimeout(() => res.destroy(), 1000));
          } else {
            res.writeHead(response.statusCode, response.headers);
            response.pipe(res);
          }
        },
      );
      upstream.on('error', () => res.destroy());
      req.pipe(upstream);
    });
    await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
    const transport = new BlueShareTransport({
      origin: `http://127.0.0.1:${proxy.address().port}`,
    });
    const { RememberedSessionStore } = require('../dist/main/blueshare/remembered-session.js');
    const { safeStorage } = require('electron');
    const rememberedSession = new RememberedSessionStore({
      filePath: join(profile, 'remembered.enc'),
      origin: transport.getOrigin(),
      encryption: safeStorage,
    });
    service = new BlueShareService({ transport, libraryService: library, rememberedSession });
    const value = (result) => {
      assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result.error));
      return result.value;
    };
    const sender = { id: 1, isDestroyed: () => false };
    const ctx = value(service.openDialog(sender)).contextId;
    const credentials = (name) => ({
      email: `${name}@example.invalid`,
      password: 'Test-only-password-2026!',
    });
    value(
      await service.signIn(
        ctx,
        'login',
        credentials('desktopalice').email,
        credentials('desktopalice').password,
      ),
    );
    const allMine = async (kind) => {
      const items = [];
      let cursor = null;
      do {
        const page = value(await service.listMine(ctx, 'mine', kind, cursor));
        items.push(...page.items);
        cursor = page.nextBeforeId;
      } while (cursor !== null);
      assert.equal(new Set(items.map((i) => i.id)).size, items.length);
      return items;
    };
    for (const kind of ['instrument', 'effect', 'soundObject']) {
      assert.equal(value(await service.getCategories(ctx, 'categories', kind)).length, 3);
      assert.equal(value(await service.getLatest(ctx, 'latest', kind)).items.length, 10);
      let cursor = null,
        publicCount = 0;
      do {
        const page = value(await service.listResources(ctx, 'page', kind, null, cursor));
        publicCount += page.items.length;
        cursor = page.nextBeforeId;
      } while (cursor !== null);
      assert.ok(publicCount > 25);
      const imported = value(await service.importResource(ctx, 'import', { kind, id: 1 }));
      const node = imported.affectedNodes.find((n) => n.nodeKind === 'item');
      assert.ok(node);
      const source = async () =>
        value(await service.preparePublishSource(ctx, 'prepare', node.key, node.revision));
      const seed = await source();
      const description = '  exact public text\n\tsecond line  ';
      const published = value(
        await service.publishResource(ctx, 'publish', seed.sourceToken, 1, description),
      );
      assert.equal(published.xml, fixtures[kind]);
      assert.equal(published.description, description);
      assert.ok((await allMine(kind)).some((i) => i.id === published.id));
      // Denial from a second native account, followed by correct account restoration.
      value(
        await service.signIn(
          ctx,
          'bob',
          credentials('desktopbob').email,
          credentials('desktopbob').password,
        ),
      );
      const denied = await service.removeResource(ctx, 'denied', { kind, id: published.id });
      assert.equal(denied.ok, false);
      assert.equal(denied.error.status, 403);
      value(
        await service.signIn(
          ctx,
          'alice',
          credentials('desktopalice').email,
          credentials('desktopalice').password,
        ),
      );
      const beforeCancel = writes;
      const abandoned = value(service.openDialog(sender)).contextId;
      service.closeDialog(abandoned);
      assert.equal(
        (await service.removeResource(abandoned, 'cancelled', { kind, id: published.id })).ok,
        false,
      );
      assert.equal(writes, beforeCancel);
      value(await service.removeResource(ctx, 'remove', { kind, id: published.id }));
      assert.equal(
        (await service.getResource(ctx, 'removed', { kind, id: published.id })).error.status,
        410,
      );
      // A real committed publish loses its response. No adapter/fake server is involved.
      const uncertainSeed = await source();
      const before = writes;
      loseNextWrite = true;
      const uncertain = await service.publishResource(
        ctx,
        'lost-publish',
        uncertainSeed.sourceToken,
        1,
        description,
      );
      assert.equal(uncertain.ok, false);
      assert.equal(uncertain.error.outcome, 'unknown');
      assert.equal(writes, before + 1);
      const reconciled = (await allMine(kind)).filter((i) => i.description === description);
      assert.equal(reconciled.length, 1);
      const target = reconciled[0];
      assert.equal(
        value(await service.fetchResourceDetail({ kind, id: target.id })).xml,
        fixtures[kind],
      );
      loseNextWrite = true;
      const removal = await service.removeResource(ctx, 'lost-remove', { kind, id: target.id });
      assert.equal(removal.ok, false);
      assert.equal(removal.error.outcome, 'unknown');
      assert.ok(!(await allMine(kind)).some((i) => i.id === target.id));
      value(await service.removeResource(ctx, 'explicit-remove-retry', { kind, id: target.id }));
      const revision = library.getSnapshot().contentRevision;
      assert.equal((await service.importResource(ctx, 'unsupported', { kind, id: 90 })).ok, false);
      assert.equal(library.getSnapshot().contentRevision, revision);
      assert.equal(project.read().data.saveToString(), initialXml);
      assert.equal(project.read().revision, initial.revision);
      assert.equal(history.isDirty(), false);
      console.log(
        `PASS actual service: ${kind}, native account isolation, pages/import/exact publish/owned/remove, denied/cancelled/lost committed writes, project invariance.`,
      );
    }
    value(await service.signOut(ctx, 'logout'));
    assert.equal(service.getAccountSnapshot().state, 'signedOut');
    await library.stop();
    assert.equal((await library.start()).phase, 'ready');
    assert.deepEqual(library.getSnapshot().userItemCounts, {
      instrument: 1,
      effect: 1,
      soundObject: 1,
      udo: 0,
    });
    console.log('PASS actual service: native sign-out and imported-copy restart persistence.');
    value(
      await service.signIn(
        ctx,
        'remembered-login',
        credentials('desktopalice').email,
        credentials('desktopalice').password,
        undefined,
        true,
      ),
    );
    assert.equal(service.getAccountSnapshot().persistenceWarning, undefined);
    const remembered = await rememberedSession.load();
    assert.ok(remembered);
    assert.ok(Date.parse(remembered.expiresAt) - Date.now() > 6.9 * 86400_000);
    const restoredService = new BlueShareService({
      transport: new BlueShareTransport({ origin: transport.getOrigin() }),
      rememberedSession,
    });
    const restoredContext = value(
      restoredService.openDialog({ id: 2, isDestroyed: () => false }),
    ).contextId;
    assert.equal(
      value(await restoredService.getAccount(restoredContext)).user.username,
      'desktopalice',
    );
    value(await restoredService.signOut(restoredContext, 'restored-out'));
    assert.equal(await rememberedSession.load(), null);
    restoredService.shutdown();
    value(await service.signOut(ctx, 'retired-original-out'));
    console.log(
      'PASS actual service: seven-day remembered cookie persistence, verified restoration and durable/remote logout.',
    );

    let controlId = 0;
    const control = async (action) => {
      const id = ++controlId;
      writeFileSync(join(profile, 'session-control-request.tmp'), JSON.stringify({ id, action }));
      renameSync(
        join(profile, 'session-control-request.tmp'),
        join(profile, 'session-control-request.json'),
      );
      const until = Date.now() + 15_000;
      while (Date.now() < until) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const responsePath = join(profile, 'session-control-response.json');
        if (!existsSync(responsePath)) continue;
        const checked = JSON.parse(readFileSync(responsePath, 'utf8'));
        if (checked.id !== id) continue;
        assert.equal(checked.ok, true, `Disposable session control failed: ${action}`);
        return checked.result;
      }
      throw Error(`Disposable session control timed out: ${action}`);
    };
    for (const invalidation of ['expiry', 'revoke', 'reset']) {
      value(
        await service.signIn(
          ctx,
          'remembered-invalidation',
          credentials('desktopalice').email,
          credentials('desktopalice').password,
          undefined,
          true,
        ),
      );
      const retained = await rememberedSession.load();
      assert.ok(retained);
      assert.ok((await transport.snapshotCookies()).length > 0);
      if (invalidation === 'expiry') {
        const fixedExpiry = await control('age');
        for (let activity = 0; activity < 2; activity++) {
          assert.equal(value(await service.verifySession(ctx)).expiresAt, fixedExpiry);
          value(await service.listMine(ctx, 'activity', 'effect', null));
        }
        const storedExpiries = await control('inspect');
        assert.ok(
          storedExpiries.length > 0 && storedExpiries.every((expiry) => expiry === fixedExpiry),
        );
        console.log(
          'PASS actual database: old active session retains unchanged authoritative expiry after repeated session and protected-read activity.',
        );
      }
      await control(invalidation);
      // Retained encrypted proof and Chromium cookies must not confer authority
      // after the real database/reset flow invalidates their session.
      assert.ok(await rememberedSession.load());
      assert.ok((await transport.snapshotCookies()).length > 0);
      const beforeWrites = writes;
      const rejected = await service.verifySession(ctx);
      assert.equal(rejected.ok, false);
      assert.equal(rejected.error.status, 401);
      assert.equal(service.getAccountSnapshot().state, 'signedOut');
      assert.equal(await rememberedSession.load(), null);
      await rememberedSession.save(retained);
      const rejectedRestore = new BlueShareService({
        transport: new BlueShareTransport({ origin: transport.getOrigin() }),
        rememberedSession,
      });
      const rejectedContext = value(
        rejectedRestore.openDialog({ id: 3, isDestroyed: () => false }),
      ).contextId;
      assert.equal(value(await rejectedRestore.getAccount(rejectedContext)).state, 'signedOut');
      assert.equal(await rememberedSession.load(), null);
      assert.equal(
        (
          await rejectedRestore.removeResource(rejectedContext, 'forbidden', {
            kind: 'effect',
            id: 1,
          })
        ).ok,
        false,
      );
      assert.equal(writes, beforeWrites);
      rejectedRestore.shutdown();
      console.log(
        `PASS actual database: ${invalidation} rejects retained cookies and restart proof, deletes local record and prevents protected writes.`,
      );
    }
    await renderedAcceptance({
      inspectionContext: ctx,
      service,
      library,
      profile,
      fixtures,
      project,
      history,
      initialXml,
      initial,
      getWriteCount: () => writes,
      setLoseNextWrite: () => {
        loseNextWrite = true;
      },
    });
  } catch (error) {
    console.error('Actual-service acceptance failed:', error.stack);
    exitCode = 1;
  } finally {
    service?.shutdown();
    await library?.stop();
    if (proxy)
      await new Promise((resolve) => {
        proxy.closeAllConnections();
        proxy.close(resolve);
      });
    app.exit(exitCode);
  }
}

async function renderedAcceptance({
  inspectionContext,
  service,
  library,
  profile,
  fixtures,
  project,
  history,
  initialXml,
  initial,
  setLoseNextWrite,
  getWriteCount,
}) {
  const { BrowserWindow, ipcMain } = require('electron');
  const { registerBlueShareIpc } = require('../dist/main/blueshare/ipc.js');
  const { registerUnifiedLibraryIpc } = require('../dist/main/unified-library/ipc.js');
  const { build } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react');
  const { default: tailwindcss } = await import('@tailwindcss/vite');
  const output = join(profile, 'renderer');
  await build({
    configFile: false,
    root: appRoot,
    plugins: [react(), tailwindcss()],
    logLevel: 'warn',
    build: {
      outDir: output,
      emptyOutDir: true,
      cssCodeSplit: false,
      rollupOptions: {
        input: join(appRoot, 'scripts/blueshare-acceptance-renderer.tsx'),
        output: {
          format: 'iife',
          inlineDynamicImports: true,
          entryFileNames: 'renderer.js',
          assetFileNames: 'renderer.[ext]',
        },
      },
    },
  });
  mkdirSync(output, { recursive: true });
  writeFileSync(
    join(output, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="renderer.css"></head><body><div id="root"></div><script src="renderer.js"></script></body></html>',
  );
  const window = new BrowserWindow({
    show: false,
    width: 1400,
    height: 1000,
    webPreferences: {
      preload: join(appRoot, 'dist/preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  const disposers = [
    registerBlueShareIpc({ ipcMain, service, getWindows: () => [window] }),
    registerUnifiedLibraryIpc({ ipcMain, service: library, getWindows: () => [window] }),
  ];
  const evaluate = (code) => window.webContents.executeJavaScript(code);
  const waitFor = async (expression, label) => {
    const until = Date.now() + 30_000;
    while (Date.now() < until) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(
      `Rendered UI timed out: ${label}. ${await evaluate('document.body.innerText')}`,
    );
  };
  const click = async (label) => {
    await waitFor(
      `Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled)`,
      label,
    );
    await evaluate(
      `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled).click()`,
    );
  };
  const fill = async (id, value) => {
    await evaluate(
      `(() => { const element = document.getElementById(${JSON.stringify(id)}); const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)}); element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); })()`,
    );
  };
  const selectSource = async (name) => {
    await waitFor(
      '!!document.querySelector(\'[aria-label="Your library"] [role=treeitem]\')',
      'local library tree',
    );
    // Expand the real library hierarchy, including the Imported folder.
    await evaluate(`(() => {
      const tree = document.querySelector('[aria-label="Your library"]');
      tree.querySelectorAll('[role=treeitem][aria-expanded=false] > button[aria-label^="Expand "]').forEach(b => b.click());
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await evaluate(`(() => {
      const tree = document.querySelector('[aria-label="Your library"]');
      tree.querySelectorAll('[role=treeitem][aria-expanded=false] > button[aria-label^="Expand "]').forEach(b => b.click());
    })()`);
    await waitFor(
      `Array.from(document.querySelectorAll('[aria-label="Your library"] button')).some(b => b.textContent === ${JSON.stringify(name)})`,
      'nested local source',
    );
    await evaluate(
      `Array.from(document.querySelectorAll('[aria-label="Your library"] button')).find(b => b.textContent === ${JSON.stringify(name)}).click()`,
    );
  };
  const selectDestination = async () => {
    await evaluate(
      `document.querySelector('[aria-label="Destination categories"] [data-library-node-id$="-1"] > button:last-child').click()`,
    );
  };
  const verifyProject = () => {
    assert.equal(project.read().data.saveToString(), initialXml);
    assert.equal(project.read().revision, initial.revision);
    assert.equal(history.isDirty(), false);
  };
  try {
    await window.loadFile(join(output, 'index.html'));
    await click('Open Blue Share');
    await click('Manage');
    await waitFor("!!document.getElementById('blueshare-login-email')", 'sign-in form');
    await fill('blueshare-login-email', 'desktopalice@example.invalid');
    await fill('blueshare-login-password', 'Test-only-password-2026!');
    await evaluate("document.querySelector('input[type=checkbox]').click()");
    await waitFor("document.querySelector('input[type=checkbox]').checked", 'remembered checkbox');
    await new Promise((resolve) => setTimeout(resolve, 150));
    writeFileSync(
      join(profile, 'remembered-login-form.png'),
      (await window.webContents.capturePage()).toPNG(),
    );
    await click('Sign in');
    await waitFor("document.body.innerText.includes('desktopalice')", 'native account');
    assert.equal(service.getAccountSnapshot().persistenceWarning, undefined);
    assert.ok(Date.parse(service.getAccountSnapshot().expiresAt) - Date.now() > 6.9 * 86400_000);
    writeFileSync(
      join(profile, 'remembered-login-ui.png'),
      (await window.webContents.capturePage()).toPNG(),
    );
    for (const [kind, label] of [
      ['instrument', 'Instruments'],
      ['effect', 'Effects'],
      ['soundObject', 'SoundObjects'],
    ]) {
      console.log(`Checking rendered workflows: ${kind}`);
      const sourceName = kind === 'soundObject' ? 'Synthetic score' : `Synthetic ${kind}`;
      await click(label);
      await click('Import');
      await waitFor("document.querySelectorAll('tbody tr').length === 10", `${kind} latest`);
      await click('Synthetic root');
      await waitFor("document.querySelectorAll('tbody tr').length === 25", `${kind} first page`);
      await click('Load More');
      await waitFor("document.querySelectorAll('tbody tr').length > 25", `${kind} pagination`);
      // ID 1 is valid and original; unsupported ID 90 remains an atomic rejection fixture.
      await evaluate(
        `Array.from(document.querySelectorAll('tbody tr')).filter(b => b.getAttribute('aria-label') === 'Select Synthetic ${kind}').at(-1).click()`,
      );
      await waitFor(
        "Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Import to Library' && !b.disabled)",
        `${kind} detail`,
      );
      await click('Import to Library');
      await waitFor(
        "document.body.innerText.includes('Imported to') || document.body.innerText.includes('imported to') || document.body.innerText.includes('successfully imported')",
        `${kind} import receipt`,
      );
      verifyProject();
      await click('Export');
      await selectSource(sourceName);
      await waitFor("document.body.innerText.includes('Payload Size')", `${kind} source review`);
      await selectDestination();
      const description = `  rendered ${kind} exact public text\n\tsecond line  `;
      await fill('export-description-textarea', description);
      await click('Publish to Blue Share');
      await waitFor(
        "document.body.innerText.includes('successfully published')",
        `${kind} publish receipt`,
      );
      const page = await service.listMine(inspectionContext, 'acceptance-inspect', kind);
      assert.equal(page.ok, true);
      const created = page.value.items.find((item) => item.description === description);
      assert.ok(created);
      assert.equal(
        (await service.fetchResourceDetail({ kind, id: created.id })).value.xml,
        fixtures[kind],
      );
      verifyProject();
      await click('Import');
      await click('Latest Submissions');
      await waitFor(
        "document.querySelectorAll('tbody tr').length === 10",
        `${kind} invalidated public latest`,
      );
      await evaluate("document.querySelector('tbody tr').click()");
      await waitFor(
        `document.body.textContent.includes(${JSON.stringify(description)})`,
        `${kind} publicly visible exact description`,
      );
      await click('Manage');
      await waitFor(
        `!!document.querySelector('tr[aria-label="Select ${created.name}"]')`,
        `${kind} owned item`,
      );
      await evaluate(`document.querySelector('tr[aria-label="Select ${created.name}"]').click()`);
      await click('Remove Submission');
      assert.equal(
        await evaluate("document.activeElement?.getAttribute('data-action-id')"),
        'cancel',
      );
      await click('Cancel');
      assert.equal((await service.fetchResourceDetail({ kind, id: created.id })).ok, true);
      await click('Remove Submission');
      await click('Remove');
      await waitFor("document.body.innerText.includes('Removing…')", `${kind} pending removal`);
      await evaluate("document.querySelectorAll('tbody tr')[1].click()");
      assert.equal(
        await evaluate("document.querySelector('[data-testid=manage-remove-btn]').disabled"),
        true,
      );
      // A repeated button activation must not dispatch, and late success must retain
      // the second row (ID 90), which becomes first after the new publication is removed.
      await evaluate("document.querySelector('[data-testid=manage-remove-btn]').click()");
      await waitFor(
        "document.querySelector('tbody tr')?.getAttribute('aria-selected') === 'true' && !document.querySelector('[data-testid=manage-remove-btn]')?.disabled",
        `${kind} newer owned selection after removal`,
      );
      assert.equal(
        await evaluate("document.body.innerText.includes('successfully removed')"),
        false,
      );
      assert.equal((await service.fetchResourceDetail({ kind, id: created.id })).error.status, 410);
      verifyProject();
      await click('Import');
      await waitFor(
        "document.body.innerText.includes('permanently removed (410)')",
        `${kind} invalidated public detail`,
      );
      assert.equal(
        await evaluate(
          "Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Import to Library').disabled",
        ),
        true,
      );
      console.log(
        `PASS rendered actual service: ${kind} Import/Export/Manage, pagination, exact XML/description, confirmation cancellation/focus, project/history invariance.`,
      );
      const waitHost = async (predicate) => {
        const until = Date.now() + 30_000;
        while (!predicate()) {
          assert.ok(Date.now() < until, 'Native write dispatch timed out');
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      };
      const prepare = async (description) => {
        await click('Export');
        await selectSource(sourceName);
        await waitFor("document.body.innerText.includes('Payload Size')", `${kind} renewed review`);
        await selectDestination();
        await fill('export-description-textarea', description);
      };
      const traverseMine = async () => {
        await click('Manage');
        await click('Fetch submissions');
        await waitFor("!document.body.innerText.includes('Fetching…')", `${kind} owned refresh`);
        while (
          await evaluate(
            "Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Load More')",
          )
        ) {
          await click('Load More');
          await waitFor(
            "!Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Loading…')",
            `${kind} owned continuation`,
          );
        }
      };
      const unknownDescription = `  rendered uncertain ${kind}\n  exact draft  `;
      await prepare(unknownDescription);
      let beforeWrite = getWriteCount();
      setLoseNextWrite();
      await click('Publish to Blue Share');
      await waitHost(() => getWriteCount() === beforeWrite + 1);
      const otherLabel = kind === 'instrument' ? 'Effects' : 'Instruments';
      await click(otherLabel);
      await fill('export-description-textarea', `Newer ${otherLabel} draft`);
      await waitFor(
        `document.body.innerText.includes('Return to ${kind}')`,
        `${kind} off-view publication recovery`,
      );
      assert.equal(
        await evaluate("document.body.innerText.includes('Publication outcome is uncertain')"),
        false,
      );
      assert.equal(
        await evaluate("document.getElementById('export-description-textarea').value"),
        `Newer ${otherLabel} draft`,
      );
      await click(label);
      assert.equal(
        await evaluate("document.getElementById('export-description-textarea').value"),
        unknownDescription,
      );
      await traverseMine();
      await click('Export');
      await waitFor(
        "document.body.innerText.includes('Submissions refreshed after uncertain publication')",
        `${kind} explicit publication reconciliation`,
      );
      await click('Restore submitted draft for review');
      assert.equal(
        await evaluate("document.getElementById('export-description-textarea').value"),
        unknownDescription,
      );
      assert.equal(getWriteCount(), beforeWrite + 1);
      const uncertainPage = (await service.listMine(inspectionContext, 'inspect-unknown', kind))
        .value;
      const uncertainItems = uncertainPage.items.filter(
        (item) => item.description === unknownDescription,
      );
      assert.equal(uncertainItems.length, 1);
      const uncertainItem = uncertainItems[0];
      assert.equal(
        (await service.fetchResourceDetail({ kind, id: uncertainItem.id })).value.xml,
        fixtures[kind],
      );
      // Renew review clears the reconciled publish guard, but never resubmits.
      await prepare(unknownDescription);
      await click('Manage');
      await waitFor(
        `!!document.querySelector('tr[aria-label="Select ${uncertainItem.name}"]')`,
        `${kind} uncertain item`,
      );
      await evaluate(
        `document.querySelector('tr[aria-label="Select ${uncertainItem.name}"]').click()`,
      );
      await click('Remove Submission');
      beforeWrite = getWriteCount();
      setLoseNextWrite();
      await click('Remove');
      await waitHost(() => getWriteCount() === beforeWrite + 1);
      await click(otherLabel);
      await waitFor(
        `document.body.innerText.includes('Return to ${kind}')`,
        `${kind} off-view removal recovery`,
      );
      assert.equal(
        await evaluate("document.body.innerText.includes('Removal outcome is uncertain')"),
        false,
      );
      await click(label);
      await traverseMine();
      await waitFor(
        "document.body.innerText.includes('already removed')",
        `${kind} confirmed absence after complete traversal`,
      );
      assert.equal(getWriteCount(), beforeWrite + 1);
      assert.equal(
        (await service.fetchResourceDetail({ kind, id: uncertainItem.id })).error.status,
        410,
      );
      verifyProject();
      console.log(
        `PASS rendered lifecycle: ${kind}, lost committed POST/DELETE, kind navigation, exact origin draft recovery, full reconciliation, no replay or project/history change.`,
      );
    }
    await click('Sign out');
    await waitFor("!!document.getElementById('blueshare-login-email')", 'sign out');
    await fill('blueshare-login-email', 'desktopbob@example.invalid');
    await fill('blueshare-login-password', 'Test-only-password-2026!');
    await click('Sign in');
    await waitFor(
      "document.body.innerText.includes('desktopbob') && document.body.innerText.includes('No submissions found')",
      'account replacement and empty owned list',
    );
    assert.equal(await evaluate("document.querySelectorAll('tbody tr').length"), 0);
    await click('Sign out');
    await waitFor(
      "!!document.getElementById('blueshare-login-email')",
      'replacement account sign out',
    );
    await evaluate("document.querySelector('button[aria-label=Close]').click()");
    await waitFor("!document.querySelector('[role=dialog]')", 'dialog disposal');
    console.log(
      `PASS rendered native UI: Electron ${process.versions.electron}, ${process.platform}/${process.arch}, actual preload/checked IPC and disposable SQLite.`,
    );
  } finally {
    for (const dispose of disposers.reverse()) dispose();
    window.destroy();
  }
}
