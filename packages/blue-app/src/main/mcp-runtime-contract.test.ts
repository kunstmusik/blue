import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
  BlueData,
  GenericInstrument,
  GenericScore,
  PolyObject,
  PythonObject,
  TimeDuration,
  TimePosition,
} from '@blue/data';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import {
  McpServer,
  createMcpHandler,
  type CallToolResult,
  type FetchLike,
  type ServerContext,
} from '@modelcontextprotocol/server';
import * as z from 'zod';

vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
  dialog: { showSaveDialog: vi.fn() },
  shell: { showItemInFolder: vi.fn() },
}));

import {
  createDefaultProgramSettings,
  type ProgramSettingsSnapshot,
} from '../shared/program-settings';
import type { McpAccessMode } from '../shared/mcp-server';
import type { McpAuthContext, McpDocumentReceipt, McpResult } from './mcp-bridge';
import { createGuardedMcpPlaybackController } from './mcp-playback';
import { validateMcpWavFilename } from './mcp-render';
import { ProjectHistory } from './project-history';
import { ProjectSession } from './project-session';
import { createRenderFreezeCoordinator } from './render-freeze-coordinator';
import type { EngineRuntimeService } from './engine-runtime';

function createSineProject(): BlueData {
  const data = new BlueData();
  data.getMixer().setEnabled(false);
  const instr = new GenericInstrument();
  instr.setName('Sine');
  instr.setText('a1 oscili 0.3, 440\nouts a1, a1');
  data.getArrangement().addInstrument(instr, '1');

  const score = new GenericScore();
  score.setName('Sine Note');
  score.setStartTime(TimePosition.beats(0));
  score.setSubjectiveDuration(TimeDuration.beats(2));
  score.setScoreText('i1 0 2');
  (data.getScore()[0] as PolyObject)[0]!.push(score);
  return data;
}

const receiptSchema = z
  .object({
    documentId: z.string().min(1).max(200),
    revision: z.number().int().min(0),
    stateId: z.string().min(1).max(200),
  })
  .strict();

const transportInputSchema = z
  .object({
    expected: receiptSchema,
  })
  .strict();

const renderToDiskInputSchema = z
  .object({
    expected: receiptSchema,
    filename: z
      .string()
      .min(1)
      .max(255)
      .refine((value) => validateMcpWavFilename(value).ok, {
        message: 'filename must be a valid single-leaf WAV filename.',
      }),
    destination: z.enum(['project', 'choose']).optional(),
  })
  .strict();

function toToolResult<T extends object>(result: McpResult<T>): CallToolResult {
  if (!result.ok) {
    const payload = { code: result.code, message: result.message };
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(result.value) }],
    structuredContent: result.value as Record<string, unknown>,
  };
}

function createRuntimeHarness(projectDir: string) {
  const session = new ProjectSession();
  session.replace(createSineProject(), path.join(projectDir, 'sine.blue'));

  const history = new ProjectHistory({
    session,
    publishUpdated: () => undefined,
    retainedEntryLimit: 20,
  });

  let accessMode: McpAccessMode = 'read-write';
  let authorized = true;
  let revokeAfterCommit = false;
  let engineAvailable = true;
  let playing = false;
  let playingDocId: string | null = null;
  let pickerFolder: string | null = projectDir;

  const settings: ProgramSettingsSnapshot = createDefaultProgramSettings(process.platform);

  const getReceipt = (): McpDocumentReceipt | null => {
    const snap = session.read();
    if (!snap.data || !snap.documentId || !snap.stateId) return null;
    return {
      documentId: snap.documentId,
      revision: snap.revision,
      stateId: snap.stateId,
    };
  };

  let engineRuntimeService: EngineRuntimeService | null = {
    executeCsound: async (request, hooks) => {
      const preLaunch = hooks?.beforeLaunch?.();
      if (preLaunch && !preLaunch.ok) {
        return {
          operationId: request.operationId,
          state: preLaunch.code === 'CANCELLED' ? 'cancelled' : 'failed',
          exitCode: null,
          signal: null,
          stdout: '',
          stderr: preLaunch.message,
          errorCode: preLaunch.code,
          message: preLaunch.message,
        };
      }
      if (request.kind === 'confined-render') {
        fs.writeFileSync(path.join(request.rootPath, request.outputFilename), 'RIFF-WAV');
      } else {
        const outIdx = request.args.indexOf('-o');
        const outputPath = request.args[outIdx + 1]!;
        fs.writeFileSync(outputPath, 'RIFF-WAV');
      }
      return {
        operationId: request.operationId,
        state: 'completed',
        exitCode: 0,
        signal: null,
        stdout: '',
        stderr: '',
        errorCode: null,
        message: 'completed',
      };
    },
  } as unknown as EngineRuntimeService;

  const coordinator = createRenderFreezeCoordinator({
    getCurrentData: () => session.read().data,
    getCurrentFilePath: () => session.read().filePath,
    getCurrentProjectDirectory: () =>
      session.read().filePath ? path.dirname(session.read().filePath!) : null,
    getCurrentProjectSessionId: () => session.read().sessionId,
    getCurrentProjectSessionDocumentId: () => session.read().documentId ?? '',
    getCurrentProjectRevision: () => session.read().revision,
    getCurrentProjectStateId: () => session.read().stateId,
    getCurrentProjectDocument: () => null,
    getMainWindow: () => null,
    getEngineRuntimeService: () => engineRuntimeService,
    getJavaScriptSession: () => null,
    getProjectHistory: () => history,
    loadProgramSettings: () => settings,
    getConfiguredWorkDirectory: () => projectDir,
    runProjectOnLoad: async () => null,
    transferProjectEditorIdentities: () => undefined,
    authorizeAudioFilePath: () => true,
    broadcastToWorkbenchWindows: () => undefined,
    rebuildApplicationMenuIfChanged: () => undefined,
  });

  const playbackController = createGuardedMcpPlaybackController({
    getCurrentReceipt: getReceipt,
    isEngineAvailable: () => engineAvailable,
    isCurrentlyPlaying: () => playing,
    getPlayingDocumentId: () => playingDocId,
    confirmPlayback: async () => 'approved',
    startPlayback: async (fence) => {
      const gate = fence.check();
      if (!gate.ok) return gate;
      playing = true;
      playingDocId = session.read().documentId;
      if (revokeAfterCommit) {
        authorized = false;
      }
      return { ok: true, value: undefined };
    },
    stopPlayback: async () => {
      playing = false;
      playingDocId = null;
    },
  });

  const makeAuth = (signal?: AbortSignal): McpAuthContext => ({
    listenerGeneration: 1,
    credentialEpoch: 1,
    accessMode,
    action: 'runtime',
    signal: signal ?? new AbortController().signal,
    isAuthorized: () => authorized,
  });

  const createServer = () => {
    const server = new McpServer(
      { name: 'Blue', version: '3.0.0-test' },
      { capabilities: { tools: { listChanged: true } } },
    );

    const writeToolNames = new Set(['transport_play', 'transport_stop', 'render_to_disk']);

    server.registerTool(
      'transport_play',
      { title: 'Transport Play', inputSchema: transportInputSchema },
      async (args, ctx: ServerContext) => {
        const auth = makeAuth(ctx?.mcpReq?.signal);
        return toToolResult(await playbackController.transportPlay(auth, args.expected));
      },
    );

    server.registerTool(
      'transport_stop',
      { title: 'Transport Stop', inputSchema: transportInputSchema },
      async (args, ctx: ServerContext) => {
        const auth = makeAuth(ctx?.mcpReq?.signal);
        return toToolResult(await playbackController.transportStop(auth, args.expected));
      },
    );

    server.registerTool(
      'render_to_disk',
      { title: 'Render to Disk', inputSchema: renderToDiskInputSchema },
      async (args, ctx: ServerContext) => {
        const auth = makeAuth(ctx?.mcpReq?.signal);
        if (auth.accessMode !== 'read-write') {
          return toToolResult({
            ok: false,
            code: 'ACCESS_DENIED',
            message: 'Read-write MCP access is required to render to disk.',
          });
        }
        const snap = session.read();
        if (!snap.data) {
          return toToolResult({
            ok: false,
            code: 'NO_ACTIVE_PROJECT',
            message: 'No active project is open.',
          });
        }
        const destination = args.destination ?? 'project';
        let nativeRoot: string | null = null;
        if (destination === 'choose') {
          if (!pickerFolder) {
            return toToolResult({
              ok: false,
              code: 'CANCELLED',
              message: 'Folder selection was cancelled.',
            });
          }
          nativeRoot = pickerFolder;
        } else {
          nativeRoot = snap.filePath ? path.dirname(snap.filePath) : null;
          if (!nativeRoot) {
            return toToolResult({
              ok: false,
              code: 'OUTPUT_REJECTED',
              message: 'Unsaved project requires destination "choose".',
            });
          }
        }
        return toToolResult(
          await coordinator.handleMcpRenderToDisk({
            auth,
            expectedReceipt: args.expected,
            getCurrentReceipt: getReceipt,
            nativeRoot,
            filename: args.filename,
          }),
        );
      },
    );

    if (accessMode === 'read-only') {
      // Hide write/runtime tools in tools/list while keeping tools/call returning structured ACCESS_DENIED.
      const innerServer = server.server as unknown as {
        _requestHandlers: Map<
          string,
          (req: unknown, ctx: unknown) => Promise<{ tools: Array<{ name: string }> }>
        >;
      };
      const defaultListTools = innerServer._requestHandlers.get('tools/list')!;
      server.server.setRequestHandler('tools/list', async (req, ctx) => {
        const listed = await defaultListTools(req, ctx);
        return {
          ...listed,
          tools: listed.tools.filter((tool) => !writeToolNames.has(tool.name)),
        };
      });
    }

    return server;
  };

  const handler = createMcpHandler(() => createServer(), {
    legacy: 'stateless',
    maxRequestBodySize: 2 * 1024 * 1024,
  });

  const fetch: FetchLike = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    return handler.fetch(request);
  };

  return {
    session,
    history,
    coordinator,
    handler,
    fetch,
    getReceipt,
    setAccessMode: (next: McpAccessMode) => {
      accessMode = next;
    },
    setAuthorized: (next: boolean) => {
      authorized = next;
    },
    setRevokeAfterCommit: (next: boolean) => {
      revokeAfterCommit = next;
    },
    isPlaying: () => playing,
    setEngineAvailable: (next: boolean) => {
      engineAvailable = next;
    },
    setEngineRuntimeService: (svc: EngineRuntimeService | null) => {
      engineRuntimeService = svc;
    },
    setPickerFolder: (folder: string | null) => {
      pickerFolder = folder;
    },
  };
}

describe('MCP runtime tool contract', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeTempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-mcp-runtime-contract-'));
    tempDirs.push(dir);
    return dir;
  }

  it('denies runtime tools in read-only mode and hides them from tools/list', async () => {
    const dir = makeTempDir();
    const h = createRuntimeHarness(dir);
    h.setAccessMode('read-only');

    const client = new Client(
      { name: 'runtime-contract-ro', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8765/mcp'), {
      fetch: h.fetch,
    });
    await client.connect(transport);

    try {
      const listed = await client.listTools();
      expect(listed.tools).toEqual([]);

      const receipt = h.getReceipt()!;
      for (const call of [
        { name: 'transport_play', arguments: { expected: receipt } },
        { name: 'transport_stop', arguments: { expected: receipt } },
        { name: 'render_to_disk', arguments: { expected: receipt, filename: 'out.wav' } },
      ]) {
        const res = await client.callTool(call);
        expect(res.isError).toBe(true);
        expect(res.structuredContent).toMatchObject({ code: 'ACCESS_DENIED' });
      }
      expect(fs.existsSync(path.join(dir, 'out.wav'))).toBe(false);
    } finally {
      await transport.close();
      await client.close();
      await h.handler.close();
    }
  });

  it('validates strict schemas, idempotent transport, and terminal render outcomes', async () => {
    const dir = makeTempDir();
    const h = createRuntimeHarness(dir);
    const client = new Client(
      { name: 'runtime-contract-rw', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8765/mcp'), {
      fetch: h.fetch,
    });
    await client.connect(transport);

    try {
      const receipt = h.getReceipt()!;

      // Strict schema rejections
      const badReceiptRes = await client.callTool({
        name: 'transport_play',
        arguments: { expected: { documentId: 'x', revision: -1, stateId: 's' } },
      });
      expect(badReceiptRes.isError).toBe(true);

      const extraArgRes = await client.callTool({
        name: 'render_to_disk',
        arguments: { expected: receipt, filename: 'ok.wav', extra: true },
      });
      expect(extraArgRes.isError).toBe(true);

      const badFileRes = await client.callTool({
        name: 'render_to_disk',
        arguments: { expected: receipt, filename: '../escape.wav' },
      });
      expect(badFileRes.isError).toBe(true);

      const reservedFileRes = await client.callTool({
        name: 'render_to_disk',
        arguments: { expected: receipt, filename: 'CON.wav' },
      });
      expect(reservedFileRes.isError).toBe(true);

      // Idempotent transport cycle
      const stopInitial = await client.callTool({
        name: 'transport_stop',
        arguments: { expected: receipt },
      });
      expect(stopInitial.isError).not.toBe(true);
      expect(stopInitial.structuredContent).toMatchObject({
        status: 'already_stopped',
        playing: false,
      });

      const playFirst = await client.callTool({
        name: 'transport_play',
        arguments: { expected: receipt },
      });
      expect(playFirst.isError).not.toBe(true);
      expect(playFirst.structuredContent).toMatchObject({ status: 'started', playing: true });

      const playSecond = await client.callTool({
        name: 'transport_play',
        arguments: { expected: receipt },
      });
      expect(playSecond.isError).not.toBe(true);
      expect(playSecond.structuredContent).toMatchObject({
        status: 'already_playing',
        playing: true,
      });

      const stopAfterPlay = await client.callTool({
        name: 'transport_stop',
        arguments: { expected: receipt },
      });
      expect(stopAfterPlay.isError).not.toBe(true);
      expect(stopAfterPlay.structuredContent).toMatchObject({ status: 'stopped', playing: false });

      // Render succeeds for project destination
      const renderOk = await client.callTool({
        name: 'render_to_disk',
        arguments: { expected: receipt, filename: 'final.wav' },
      });
      expect(renderOk.isError).not.toBe(true);
      expect(renderOk.structuredContent).toMatchObject({
        receipt,
        outputPath: path.join(fs.realpathSync(dir), 'final.wav'),
      });
      expect(fs.readFileSync(path.join(dir, 'final.wav'), 'utf8')).toBe('RIFF-WAV');

      // Existing file rejected without overwrite
      const renderExisting = await client.callTool({
        name: 'render_to_disk',
        arguments: { expected: receipt, filename: 'final.wav' },
      });
      expect(renderExisting.isError).toBe(true);
      expect(renderExisting.structuredContent).toMatchObject({ code: 'OUTPUT_REJECTED' });

      // Choose destination cancelled locally
      h.setPickerFolder(null);
      const renderChooseCancelled = await client.callTool({
        name: 'render_to_disk',
        arguments: { expected: receipt, filename: 'picked.wav', destination: 'choose' },
      });
      expect(renderChooseCancelled.isError).toBe(true);
      expect(renderChooseCancelled.structuredContent).toMatchObject({ code: 'CANCELLED' });

      // Unavailable engine returns ENGINE_UNAVAILABLE for play & render
      h.setEngineAvailable(false);
      const playUnavailable = await client.callTool({
        name: 'transport_play',
        arguments: { expected: receipt },
      });
      expect(playUnavailable.isError).toBe(true);
      expect(playUnavailable.structuredContent).toMatchObject({ code: 'ENGINE_UNAVAILABLE' });

      h.setEngineRuntimeService(null);
      const renderUnavailable = await client.callTool({
        name: 'render_to_disk',
        arguments: { expected: receipt, filename: 'unavailable.wav' },
      });
      expect(renderUnavailable.isError).toBe(true);
      expect(renderUnavailable.structuredContent).toMatchObject({ code: 'ENGINE_UNAVAILABLE' });

      // Scripted project rejected with EXECUTION_REQUIRED
      (h.session.read().data!.getScore()[0] as PolyObject)[0]!.push(new PythonObject());
      h.session.recordMutation({ changed: true });
      const newReceipt = h.getReceipt()!;
      const renderScripted = await client.callTool({
        name: 'render_to_disk',
        arguments: { expected: newReceipt, filename: 'scripted.wav' },
      });
      expect(renderScripted.isError).toBe(true);
      expect(renderScripted.structuredContent).toMatchObject({ code: 'EXECUTION_REQUIRED' });

      // No project returns NO_ACTIVE_PROJECT
      h.session.close();
      const noProjectPlay = await client.callTool({
        name: 'transport_play',
        arguments: { expected: newReceipt },
      });
      expect(noProjectPlay.isError).toBe(true);
      expect(noProjectPlay.structuredContent).toMatchObject({ code: 'NO_ACTIVE_PROJECT' });
    } finally {
      await transport.close();
      await client.close();
      await h.handler.close();
    }
  });

  it('rejects concurrent MCP render with BUSY while UI render/freeze is active', async () => {
    const dir = makeTempDir();
    const h = createRuntimeHarness(dir);
    h.session.read().data!.getProjectProperties().fileName = 'ui-render.wav';
    h.session.recordMutation({ changed: true });
    let releaseUiRender!: () => void;
    const uiRenderStarted = new Promise<void>((resolve) => {
      h.setEngineRuntimeService({
        executeCsound: async (request) => {
          resolve();
          await new Promise<void>((done) => {
            releaseUiRender = done;
          });
          const outIdx = request.args.indexOf('-o');
          fs.writeFileSync(request.args[outIdx + 1]!, 'UI-WAV');
          return {
            operationId: request.operationId,
            state: 'completed',
            exitCode: 0,
            signal: null,
            stdout: '',
            stderr: '',
            errorCode: null,
            message: 'completed',
          };
        },
      } as unknown as EngineRuntimeService);
    });

    const uiRenderPromise = h.coordinator.handleRenderToDisk('render', 'ui-render-1');
    await uiRenderStarted;

    const client = new Client(
      { name: 'runtime-contract-busy', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8765/mcp'), {
      fetch: h.fetch,
    });
    await client.connect(transport);

    try {
      const receipt = h.getReceipt()!;
      const busyRes = await client.callTool({
        name: 'render_to_disk',
        arguments: { expected: receipt, filename: 'concurrent.wav' },
      });
      expect(busyRes.isError).toBe(true);
      expect(busyRes.structuredContent).toMatchObject({ code: 'BUSY' });
      expect(fs.existsSync(path.join(dir, 'concurrent.wav'))).toBe(false);
    } finally {
      releaseUiRender();
      await uiRenderPromise;
      await transport.close();
      await client.close();
      await h.handler.close();
    }
  });

  it('distinguishes pending revoked runtime calls from committed playback or published audio (T052)', async () => {
    const dir = makeTempDir();
    const h = createRuntimeHarness(dir);
    const client = new Client(
      { name: 'runtime-contract-t052', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8765/mcp'), {
      fetch: h.fetch,
    });
    await client.connect(transport);

    try {
      const receipt = h.getReceipt()!;

      // 1. Pending revocation BEFORE playback start -> ACCESS_DENIED, playback never started
      h.setAuthorized(false);
      const pendingPlay = await client.callTool({
        name: 'transport_play',
        arguments: { expected: receipt },
      });
      expect(pendingPlay.isError).toBe(true);
      expect(pendingPlay.structuredContent).toMatchObject({ code: 'ACCESS_DENIED' });
      expect(h.isPlaying()).toBe(false);

      // 2. Pending revocation before native engine launch -> ACCESS_DENIED, no output WAV
      h.setAuthorized(true);
      let launchRequested = false;
      h.setEngineRuntimeService({
        executeCsound: async (request, hooks) => {
          launchRequested = true;
          h.setAuthorized(false);
          const preLaunch = hooks?.beforeLaunch?.();
          if (preLaunch && !preLaunch.ok) {
            return {
              operationId: request.operationId,
              state: preLaunch.code === 'CANCELLED' ? 'cancelled' : 'failed',
              exitCode: null,
              signal: null,
              stdout: '',
              stderr: preLaunch.message,
              errorCode: preLaunch.code,
              message: preLaunch.message,
            };
          }
          if (request.kind === 'confined-render') {
            fs.writeFileSync(path.join(request.rootPath, request.outputFilename), 'RIFF-WAV');
          }
          return {
            operationId: request.operationId,
            state: 'completed',
            exitCode: 0,
            signal: null,
            stdout: '',
            stderr: '',
            errorCode: null,
            message: 'completed',
          };
        },
      } as unknown as EngineRuntimeService);
      const pendingRender = await client.callTool({
        name: 'render_to_disk',
        arguments: { expected: receipt, filename: 'pre-pub-revoked.wav' },
      });
      expect(launchRequested).toBe(true);
      expect(pendingRender.isError).toBe(true);
      expect(pendingRender.structuredContent).toMatchObject({ code: 'ACCESS_DENIED' });
      expect(fs.existsSync(path.join(dir, 'pre-pub-revoked.wav'))).toBe(false);

      // 3. Committed playback followed immediately by authority revocation -> preserves 'started'
      h.setAuthorized(true);
      h.setRevokeAfterCommit(true);
      const committedPlay = await client.callTool({
        name: 'transport_play',
        arguments: { expected: receipt },
      });
      expect(committedPlay.isError).not.toBe(true);
      expect(committedPlay.structuredContent).toMatchObject({
        receipt,
        status: 'started',
        playing: true,
      });
      expect(h.isPlaying()).toBe(true);

      // 4. Committed render -> terminal success returned without error even if revoked post-commit
      h.setRevokeAfterCommit(false);
      h.setAuthorized(true);
      h.setEngineRuntimeService({
        executeCsound: async (request, hooks) => {
          const preLaunch = hooks?.beforeLaunch?.();
          if (preLaunch && !preLaunch.ok) {
            return {
              operationId: request.operationId,
              state: 'failed',
              exitCode: null,
              signal: null,
              stdout: '',
              stderr: preLaunch.message,
              errorCode: preLaunch.code,
              message: preLaunch.message,
            };
          }
          if (request.kind === 'confined-render') {
            fs.writeFileSync(path.join(request.rootPath, request.outputFilename), 'RIFF-WAV');
          }
          h.setAuthorized(false);
          return {
            operationId: request.operationId,
            state: 'completed',
            exitCode: 0,
            signal: null,
            stdout: '',
            stderr: '',
            errorCode: null,
            message: 'completed',
          };
        },
      } as unknown as EngineRuntimeService);
      const committedRender = await client.callTool({
        name: 'render_to_disk',
        arguments: { expected: receipt, filename: 'committed-ok.wav' },
      });
      expect(committedRender.isError).not.toBe(true);
      expect(committedRender.structuredContent).toMatchObject({
        receipt,
        outputPath: path.join(fs.realpathSync(dir), 'committed-ok.wav'),
      });
      expect(fs.readFileSync(path.join(dir, 'committed-ok.wav'), 'utf8')).toBe('RIFF-WAV');
    } finally {
      await transport.close();
      await client.close();
      await h.handler.close();
    }
  });
});
