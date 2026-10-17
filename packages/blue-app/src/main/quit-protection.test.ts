import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import {
  createSourceFile,
  forEachChild,
  isCallExpression,
  isFunctionDeclaration,
  ScriptTarget,
  transpileModule,
} from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { BlueData } from '@blue/data';
import { ProjectSession } from './project-session';
import { ProjectHistory } from './project-history';

// Execute the actual main-process handlers without starting Electron or its
// unrelated services. Keep the quit orchestration in main.ts rather than
// introducing a second owner just to provide a test seam.
const source = createSourceFile(
  'main.ts',
  readFileSync(join(__dirname, 'main.ts'), 'utf8'),
  ScriptTarget.Latest,
);
const functionNames = new Set([
  'requestQuit',
  'clearHistoryParticipantsForShutdown',
  'validateHistoryRequestSender',
  'isHistorySenderActive',
  'isHistoryWebContentsLive',
  'broadcastHistoryBoundary',
  'trackHistorySender',
]);
const handlerNames = new Set([
  'mainWindow.on:close',
  'app.on:before-quit',
  'app.on:window-all-closed',
]);
const snippets: string[] = [];
function collect(node: Parameters<typeof forEachChild>[0]): void {
  if (isFunctionDeclaration(node) && node.name && functionNames.has(node.name.text)) {
    snippets.push(node.getText(source));
  }
  if (isCallExpression(node)) {
    const event = node.arguments[0]?.getText(source).replace(/'/g, '');
    if (handlerNames.has(`${node.expression.getText(source)}:${event}`)) {
      snippets.push(`${node.getText(source)};`);
    }
  }
  forEachChild(node, collect);
}
collect(source);
const executable = transpileModule(snippets.join('\n'), {
  compilerOptions: { target: ScriptTarget.ES2022 },
}).outputText;

function setup(history?: ProjectHistory) {
  const handlers = new Map<string, (event: { preventDefault(): void }) => void>();
  const sender = {
    id: 1,
    isDestroyed: vi.fn().mockReturnValue(false),
    isCrashed: vi.fn().mockReturnValue(false),
    mainFrame: { isDestroyed: vi.fn().mockReturnValue(false), detached: false },
    send: vi.fn(),
    on: vi.fn<(event: string, callback: (...args: unknown[]) => void) => void>(),
    once: vi.fn<(event: string, callback: () => void) => void>(),
  };
  const historyParticipantSenders = new Map<string, unknown>([['ctx-live', sender]]);
  const participants = new Set(['ctx-live']);
  const mainWindow = {
    webContents: sender,
    isDestroyed: vi.fn().mockReturnValue(false),
    on: (event: string, handler: (event: { preventDefault(): void }) => void) =>
      handlers.set(event, handler),
  };
  const environment = {
    isQuitting: false,
    isQuitRequestPending: false,
    shutdownPromise: null,
    mainWindow,
    app: {
      exit: vi.fn(),
      on: (event: string, handler: (event: { preventDefault(): void }) => void) =>
        handlers.set(event, handler),
    },
    BrowserWindow: {
      getAllWindows: () => [mainWindow],
      fromWebContents: () => mainWindow,
    },
    historyParticipantSenders,
    historyAvailabilityBySender: new Map(),
    trackedHistorySenders: new WeakSet(),
    rebuildApplicationMenu: vi.fn(),
    projectHistory: history ?? {
      getParticipants: () => [...participants].map((contextId) => ({ contextId })),
      unregisterParticipant: ({ contextId }: { contextId: string }) =>
        participants.delete(contextId),
    },
    console: { error: vi.fn() },
    engineBridge: {
      isCurrentlyPlaying: () => true,
      stopPlayback: vi.fn().mockResolvedValue(undefined),
    },
    runTerminalProjectTransition: vi.fn(async (action: () => Promise<boolean>) => action()),
    confirmLibraryDraftTransition: vi.fn().mockResolvedValue(true),
    confirmSaveBeforeReplaceInsideBoundary: vi.fn().mockResolvedValue(true),
    requestSettingsWindowCloseForQuit: vi.fn().mockResolvedValue(true),
    doQuit: vi.fn(async () => {
      environment.isQuitting = true;
    }),
  };
  const context = createContext(environment);
  runInContext(executable, context);
  const api = runInContext(
    '({ requestQuit, validateHistoryRequestSender, isHistorySenderActive, trackHistorySender, broadcastHistoryBoundary })',
    context,
  ) as {
    requestQuit(): Promise<void>;
    isHistorySenderActive(contextId: string): boolean;
    trackHistorySender(contents: typeof sender): void;
    broadcastHistoryBoundary(channel: string, event: unknown): void;
    validateHistoryRequestSender(
      event: { sender: unknown },
      origin: { contextId: string },
    ): string | null;
  };
  const expectEditable = () => {
    expect([...participants]).toEqual(['ctx-live']);
    expect(historyParticipantSenders.get('ctx-live')).toBe(sender);
    expect(api.validateHistoryRequestSender({ sender }, { contextId: 'ctx-live' })).toBeNull();
    expect(environment.isQuitting).toBe(false);
    expect(environment.isQuitRequestPending).toBe(false);
  };
  return { api, environment, handlers, sender, expectEditable };
}

describe('Quit protection', () => {
  it('rejects crashed or disposed renderer frames even while their window survives', () => {
    const { api, sender } = setup();
    sender.isCrashed.mockReturnValue(true);
    expect(api.isHistorySenderActive('ctx-live')).toBe(false);
    sender.isCrashed.mockReturnValue(false);
    sender.mainFrame.isDestroyed.mockReturnValue(true);
    expect(api.isHistorySenderActive('ctx-live')).toBe(false);
    sender.mainFrame.isDestroyed.mockReturnValue(false);
    sender.mainFrame.detached = true;
    expect(api.isHistorySenderActive('ctx-live')).toBe(false);
  });

  it.each(['render-process-gone', 'did-navigate'])(
    'releases a pending quit on %s and tracks a recovered renderer again',
    async (eventName) => {
      const session = new ProjectSession();
      session.replace(new BlueData(), null);
      const prepared = vi.fn();
      const history = new ProjectHistory({
        session,
        barrierTimeoutMs: 100,
        broadcastPrepareBoundary: prepared,
      });
      const documentId = session.read().documentId!;
      history.registerParticipant({ contextId: 'ctx-live', documentId, acceptedRevision: 0 });
      history.registerParticipant({ contextId: 'ctx-other', documentId, acceptedRevision: 0 });
      const { api, environment, sender } = setup(history);
      environment.historyParticipantSenders.set('ctx-other', { id: 2 });
      environment.runTerminalProjectTransition.mockImplementation((action) =>
        history.runSettlementBarrier('replacement', action),
      );
      api.trackHistorySender(sender);
      const pending = api.requestQuit();
      await vi.waitFor(() => expect(prepared).toHaveBeenCalled());
      expect(environment.doQuit).not.toHaveBeenCalled();
      const loseRenderer = sender.on.mock.calls.find(([event]) => event === eventName)?.[1];
      expect(loseRenderer).toBeDefined();
      loseRenderer!({}, { reason: 'crashed', exitCode: 1 });
      expect(environment.doQuit).not.toHaveBeenCalled();
      expect(history.getParticipants().map(({ contextId }) => contextId)).toEqual(['ctx-other']);
      history.acknowledgeBoundary({
        contextId: 'ctx-other',
        barrierId: history.getActiveBarrier()!.barrierId,
        lastAcknowledgedRevision: 0,
        lastAcknowledgedSequence: 0,
        outstandingPrefixCount: 0,
      });
      await pending;
      expect(environment.doQuit).toHaveBeenCalledTimes(1);
      expect(environment.confirmSaveBeforeReplaceInsideBoundary).toHaveBeenCalledTimes(1);
      expect(environment.historyParticipantSenders.has('ctx-live')).toBe(false);
      expect(
        api.validateHistoryRequestSender({ sender }, { contextId: 'ctx-live' }),
      ).not.toBeNull();

      // Reload creates a new context on the same WebContents; cleanup must
      // remain subscribed after the first renderer loss.
      history.registerParticipant({ contextId: 'ctx-reloaded', documentId, acceptedRevision: 0 });
      environment.historyParticipantSenders.set('ctx-reloaded', sender);
      api.trackHistorySender(sender);
      loseRenderer!({}, { reason: 'killed', exitCode: 15 });
      expect(history.getParticipants().map(({ contextId }) => contextId)).toEqual(['ctx-other']);
      expect([...environment.historyParticipantSenders.keys()]).toEqual(['ctx-other']);
      expect(sender.on.mock.calls.filter(([event]) => event === eventName)).toHaveLength(1);
    },
  );

  it('skips dead frames when broadcasting boundaries and still reaches live windows', () => {
    const { api, environment, sender } = setup();
    const liveSender = { ...sender, send: vi.fn(), isCrashed: vi.fn().mockReturnValue(false) };
    environment.BrowserWindow.getAllWindows = () => [
      environment.mainWindow,
      { ...environment.mainWindow, webContents: liveSender },
    ];
    sender.isCrashed.mockReturnValue(true);
    api.broadcastHistoryBoundary('prepare', { barrierId: 'b' });
    expect(sender.send).not.toHaveBeenCalled();
    expect(liveSender.send).toHaveBeenCalledWith('prepare', { barrierId: 'b' });
  });

  it('distinguishes live participants from destroyed contents and windows', () => {
    const { api, environment, sender } = setup();
    expect(api.isHistorySenderActive('ctx-live')).toBe(true);
    expect(api.isHistorySenderActive('unknown')).toBe(false);
    sender.isDestroyed.mockReturnValue(true);
    expect(api.isHistorySenderActive('ctx-live')).toBe(false);
    sender.isDestroyed.mockReturnValue(false);
    environment.mainWindow.isDestroyed.mockReturnValue(true);
    expect(api.isHistorySenderActive('ctx-live')).toBe(false);
  });

  it('cleans up a destroyed sender by ID without removing another window', () => {
    const { api, environment, sender } = setup();
    environment.historyParticipantSenders.set('ctx-live', { id: sender.id });
    environment.historyParticipantSenders.set('ctx-other', { id: 2 });
    expect(api.validateHistoryRequestSender({ sender }, { contextId: 'ctx-live' })).toBeNull();
    expect(
      api.validateHistoryRequestSender({ sender: { id: 2 } }, { contextId: 'ctx-live' }),
    ).not.toBeNull();
    api.trackHistorySender(sender);
    api.trackHistorySender(sender);
    expect(sender.once).toHaveBeenCalledTimes(1);
    sender.once.mock.calls[0]![1]();
    expect(environment.projectHistory.getParticipants()).toEqual([]);
    expect([...environment.historyParticipantSenders.keys()]).toEqual(['ctx-other']);
  });

  it('aborts on settlement failure without clearing live ownership or invoking guards, and permits retry', async () => {
    const { api, environment, expectEditable } = setup();
    environment.runTerminalProjectTransition.mockRejectedValueOnce(new Error('settlement failed'));
    await api.requestQuit();
    expect(environment.doQuit).not.toHaveBeenCalled();
    expect(environment.confirmLibraryDraftTransition).not.toHaveBeenCalled();
    expect(environment.confirmSaveBeforeReplaceInsideBoundary).not.toHaveBeenCalled();
    expect(environment.requestSettingsWindowCloseForQuit).not.toHaveBeenCalled();
    expect(environment.engineBridge.stopPlayback).not.toHaveBeenCalled();
    expectEditable();
    await api.requestQuit();
    expect(environment.doQuit).toHaveBeenCalledTimes(1);
  });

  it.each([
    'confirmLibraryDraftTransition',
    'confirmSaveBeforeReplaceInsideBoundary',
    'requestSettingsWindowCloseForQuit',
  ] as const)('keeps editors usable after %s cancellation or failure', async (guard) => {
    const { api, environment, expectEditable } = setup();
    environment[guard].mockResolvedValueOnce(false);
    await api.requestQuit();
    expect(environment.doQuit).not.toHaveBeenCalled();
    expectEditable();
    environment[guard].mockRejectedValueOnce(new Error('guard failed'));
    await api.requestQuit();
    expect(environment.doQuit).not.toHaveBeenCalled();
    expectEditable();
    await api.requestQuit();
    expect(environment.doQuit).toHaveBeenCalledTimes(1);
  });

  it('keeps repeated close and app-quit events blocked while awaiting a save decision', async () => {
    const { api, environment, handlers, expectEditable } = setup();
    let resolveDecision!: (value: boolean) => void;
    environment.confirmSaveBeforeReplaceInsideBoundary.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveDecision = resolve;
      }),
    );
    const pending = api.requestQuit();
    await vi.waitFor(() =>
      expect(environment.confirmSaveBeforeReplaceInsideBoundary).toHaveBeenCalled(),
    );
    for (const eventName of ['close', 'close', 'before-quit', 'before-quit']) {
      const event = { preventDefault: vi.fn() };
      handlers.get(eventName)!(event);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    }
    handlers.get('window-all-closed')!({ preventDefault: vi.fn() });
    expect(environment.doQuit).not.toHaveBeenCalled();
    expect(environment.runTerminalProjectTransition).toHaveBeenCalledTimes(1);
    resolveDecision(false);
    await pending;
    expectEditable();
    await api.requestQuit();
    for (const eventName of ['close', 'before-quit']) {
      const event = { preventDefault: vi.fn() };
      handlers.get(eventName)!(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(environment.doQuit).toHaveBeenCalledTimes(1);
  });

  it('routes window-all-closed through the guarded quit path', async () => {
    const { environment, handlers, expectEditable } = setup();
    environment.confirmLibraryDraftTransition.mockResolvedValueOnce(false);
    handlers.get('window-all-closed')!({ preventDefault: vi.fn() });
    await vi.waitFor(() => expect(environment.confirmLibraryDraftTransition).toHaveBeenCalled());
    await vi.waitFor(() => expect(environment.isQuitRequestPending).toBe(false));
    expect(environment.doQuit).not.toHaveBeenCalled();
    expectEditable();
  });
});
