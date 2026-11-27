import { describe, expect, it } from 'vite-plus/test';
import {
  AudioClip,
  BlueData,
  BlueSynthBuilder,
  BlueX7,
  Comment,
  GenericInstrument,
  GenericScore,
  Instance,
  PolyObject,
  SoundLayer,
  TimeDuration,
  TimePosition,
  TrackLayer,
  TrackLayerGroup,
} from '@blue/data';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler, type FetchLike } from '@modelcontextprotocol/server';
import type { McpAccessMode } from '../shared/mcp-server';
import {
  McpBridge,
  McpConsoleTailBuffer,
  type McpAuthContext,
  type McpDocumentReceipt,
  type McpEngineStatusSnapshot,
  type McpWriteOutcome,
} from './mcp-bridge';
import { createBlueMcpServer } from './mcp-tools';
import { createProjectHistory } from './project-history';
import { ProjectSession } from './project-session';

function createWriteContractFixture(): {
  session: ProjectSession;
  data: BlueData;
  libraryScore: GenericScore;
} {
  const data = new BlueData();
  const props = data.getProjectProperties();
  props.title = 'Contract Fixture';
  props.author = 'Ada';
  props.notes = 'Initial notes';
  props.sampleRate = '44100';
  props.ksmps = '64';
  props.nchnls = '2';
  props.diskSampleRate = '96000';
  props.diskKsmps = '16';
  props.diskChannels = '4';

  const generic = new GenericInstrument();
  generic.setName('Lead');
  generic.setText('a1 oscili 0.3, 440\nouts a1, a1');
  generic.setGlobalOrc('giWave ftgen 0, 0, 1024, 10, 1');
  generic.setGlobalSco('f0 10');
  data.getArrangement().addInstrument(generic, '1');

  const bsb = new BlueSynthBuilder();
  bsb.setName('Pad');
  bsb.setInstrumentText('a1 oscili 0.2, 220\nouts a1, a1');
  bsb.setAlwaysOnInstrumentText('gkTrim init 1');
  bsb.setGlobalOrc('; bsb orc');
  bsb.setGlobalSco('; bsb sco');
  data.getArrangement().addInstrument(bsb, '2');

  const bx7 = new BlueX7();
  bx7.setName('DX Keys');
  data.getArrangement().addInstrument(bx7, '3');

  const rootPoly = data.getScore()[0] as PolyObject;
  const layer0 = rootPoly[0]!;

  const score = new GenericScore();
  score.setName('Melody');
  score.setStartTime(TimePosition.beats(2));
  score.setSubjectiveDuration(TimeDuration.beats(4));
  score.setScoreText('i1 0 1 440');

  const libraryScore = new GenericScore();
  libraryScore.setName('Library Motif');
  libraryScore.setStartTime(TimePosition.beats(0));
  libraryScore.setSubjectiveDuration(TimeDuration.beats(2));
  libraryScore.setScoreText('i1 0 1 660');

  const instance = new Instance();
  instance.setSoundObject(libraryScore);
  instance.setName('Motif Ref');
  instance.setStartTime(TimePosition.beats(6));
  instance.setSubjectiveDuration(TimeDuration.beats(2));
  data.getSoundObjectLibrary().checkAndAddInstanceSoundObjects([instance]);

  const comment = new Comment();
  comment.setName('Annotation');
  comment.setText('Bridge section');
  comment.setStartTime(TimePosition.beats(8));
  comment.setSubjectiveDuration(TimeDuration.beats(2));

  const nestedPoly = new PolyObject();
  nestedPoly.setName('Nested Poly');
  nestedPoly.setStartTime(TimePosition.beats(12));
  nestedPoly.setSubjectiveDuration(TimeDuration.beats(4));
  const nestedLayer = new SoundLayer();
  const nestedScore = new GenericScore();
  nestedScore.setName('Inner Note');
  nestedScore.setStartTime(TimePosition.beats(1));
  nestedScore.setSubjectiveDuration(TimeDuration.beats(2));
  nestedScore.setScoreText('i2 0 1 330');
  nestedLayer.push(nestedScore);
  nestedPoly.push(nestedLayer);

  layer0.push(score, instance, comment, nestedPoly);

  const trackGroup = new TrackLayerGroup();
  trackGroup.setName('Audio Tracks');
  const track = new TrackLayer();
  const clip = new AudioClip();
  clip.setName('Kick Loop');
  clip.setStartTime(TimePosition.beats(0));
  clip.setSubjectiveDuration(TimeDuration.beats(4));
  track.push(clip);
  trackGroup.push(track);
  data.getScore().push(trackGroup);

  const session = new ProjectSession();
  session.replace(data, '/tmp/write-contract.blue');
  return { session, data, libraryScore };
}

function createHarness(options: { accessMode?: McpAccessMode; authorized?: boolean } = {}) {
  const { session, data, libraryScore } = createWriteContractFixture();
  const history = createProjectHistory({ session });
  history.checkpointSave(session.read().stateId ?? undefined);
  const tail = new McpConsoleTailBuffer();

  let accessMode: McpAccessMode = options.accessMode ?? 'read-write';
  let authorized = options.authorized ?? true;

  const bridge = new McpBridge({
    readSession: () => session.read(),
    getSaveState: () => 'saved',
    isDirty: () => history.isDirty(),
    getEngineStatus: (): McpEngineStatusSnapshot => ({
      connected: true,
      available: true,
      playbackState: 'stopped',
      activeDocumentId: session.read().documentId,
      consoleTail: tail.read(),
    }),
    history,
  });

  const makeAuth = (action: McpAuthContext['action'], signal?: AbortSignal): McpAuthContext => ({
    listenerGeneration: 1,
    credentialEpoch: 1,
    accessMode,
    action,
    signal: signal ?? new AbortController().signal,
    isAuthorized: () => authorized,
  });

  const handler = createMcpHandler(
    () => createBlueMcpServer(bridge, (action, signal) => makeAuth(action, signal), '1.0.0-test'),
    { legacy: 'stateless', maxRequestBodySize: 2 * 1024 * 1024 },
  );

  const baseFetch: FetchLike = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    return handler.fetch(request);
  };

  async function createClient(legacyStateless = false): Promise<Client> {
    const client = new Client(
      { name: 'write-contract-client', version: '1.0.0' },
      {
        versionNegotiation: {
          mode: legacyStateless ? 'legacy' : { pin: '2026-07-28' },
        },
      },
    );
    await client.connect(
      new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8765/mcp'), {
        fetch: baseFetch,
      }),
    );
    return client;
  }

  function currentReceipt(): McpDocumentReceipt {
    const snap = session.read();
    return {
      documentId: snap.documentId!,
      revision: snap.revision,
      stateId: snap.stateId!,
    };
  }

  return {
    session,
    data,
    libraryScore,
    history,
    createClient,
    currentReceipt,
    setAccessMode: (mode: McpAccessMode) => {
      accessMode = mode;
    },
    setAuthorized: (next: boolean) => {
      authorized = next;
    },
  };
}

function parseErrorToolResult(result: {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content: Array<{ type: string; text?: string }>;
}): { code?: string; message: string } {
  expect(result.isError).toBe(true);
  if (result.structuredContent && typeof result.structuredContent.code === 'string') {
    return {
      code: result.structuredContent.code,
      message: String(result.structuredContent.message ?? ''),
    };
  }
  const text = result.content.find((entry) => entry.type === 'text')?.text ?? '';
  return { message: text };
}

describe('MCP write contract (T020)', () => {
  it('exposes all 11 tools in read-write mode and omits write tools in read-only mode', async () => {
    const rwHarness = createHarness({ accessMode: 'read-write' });
    const rwClient = await rwHarness.createClient();
    const rwTools = await rwClient.listTools();
    expect(rwTools.tools.map((t) => t.name).sort()).toEqual([
      'generate_csd',
      'get_instrument',
      'get_project_summary',
      'list_score_objects',
      'render_to_disk',
      'set_project_properties',
      'transport_play',
      'transport_stop',
      'update_instrument_code',
      'update_score_object',
      'upsert_instrument',
    ]);
    await rwClient.close();

    const roHarness = createHarness({ accessMode: 'read-only' });
    const roClient = await roHarness.createClient();
    const roTools = await roClient.listTools();
    expect(roTools.tools.map((t) => t.name).sort()).toEqual([
      'generate_csd',
      'get_instrument',
      'get_project_summary',
      'list_score_objects',
    ]);
    await roClient.close();

    const legacyRoClient = await roHarness.createClient(true);
    const legacyRoTools = await legacyRoClient.listTools();
    expect(legacyRoTools.tools.map((t) => t.name).sort()).toEqual([
      'generate_csd',
      'get_instrument',
      'get_project_summary',
      'list_score_objects',
    ]);
    await legacyRoClient.close();
  });

  it('rejects cached write tool calls with ACCESS_DENIED when switched to read-only across modern and legacy transports', async () => {
    const harness = createHarness({ accessMode: 'read-write' });
    const modernClient = await harness.createClient(false);
    const legacyClient = await harness.createClient(true);
    const receipt = harness.currentReceipt();

    harness.setAccessMode('read-only');

    const modernResult = await modernClient.callTool({
      name: 'update_instrument_code',
      arguments: {
        expected: receipt,
        instrumentId: '1',
        changes: { text: 'should not commit' },
      },
    });
    expect(parseErrorToolResult(modernResult as never).code).toBe('ACCESS_DENIED');

    const legacyResult = await legacyClient.callTool({
      name: 'set_project_properties',
      arguments: {
        expected: receipt,
        changes: { title: 'Blocked Title' },
      },
    });
    expect(parseErrorToolResult(legacyResult as never).code).toBe('ACCESS_DENIED');
    expect(harness.session.read().revision).toBe(receipt.revision);
    expect(harness.history.isDirty()).toBe(false);

    await modernClient.close();
    await legacyClient.close();
  });

  it('rejects malformed or out-of-range write inputs via strict schemas', async () => {
    const harness = createHarness({ accessMode: 'read-write' });
    const client = await harness.createClient();
    const receipt = harness.currentReceipt();

    const extraFieldResult = await client.callTool({
      name: 'set_project_properties',
      arguments: {
        expected: receipt,
        changes: { title: 'Valid' },
        extraKey: true,
      },
    });
    expect(parseErrorToolResult(extraFieldResult as never).message).toMatch(/validation/i);

    const emptyChangesResult = await client.callTool({
      name: 'update_instrument_code',
      arguments: {
        expected: receipt,
        instrumentId: '1',
        changes: {},
      },
    });
    expect(parseErrorToolResult(emptyChangesResult as never).message).toMatch(/validation/i);

    const invalidInstrumentIdResult = await client.callTool({
      name: 'upsert_instrument',
      arguments: {
        expected: receipt,
        instrumentId: '1 bad id',
        changes: { name: 'Bad' },
      },
    });
    expect(parseErrorToolResult(invalidInstrumentIdResult as never).message).toMatch(/validation/i);

    const badDurationResult = await client.callTool({
      name: 'update_score_object',
      arguments: {
        expected: receipt,
        locator: { layerGroupPath: [0], layerIndex: 0, objectIndex: 0 },
        changes: { duration: 0 },
      },
    });
    expect(parseErrorToolResult(badDurationResult as never).message).toMatch(/validation/i);

    const badSampleRateResult = await client.callTool({
      name: 'set_project_properties',
      arguments: {
        expected: receipt,
        changes: { sampleRate: 0 },
      },
    });
    expect(parseErrorToolResult(badSampleRateResult as never).message).toMatch(/validation/i);

    expect(harness.session.read().revision).toBe(receipt.revision);
    await client.close();
  });

  it('handles instrument code updates, upsert create/update, score object updates, properties, no-ops, and chained receipts', async () => {
    const harness = createHarness({ accessMode: 'read-write' });
    const client = await harness.createClient();
    let receipt = harness.currentReceipt();

    // 1. Update GenericInstrument code
    const genericRes = await client.callTool({
      name: 'update_instrument_code',
      arguments: {
        expected: receipt,
        instrumentId: '1',
        changes: { text: 'a1 oscili 0.4, 880\nouts a1, a1', globalOrc: '; updated orc' },
      },
    });
    expect(genericRes.isError).not.toBe(true);
    const genericOut = genericRes.structuredContent as unknown as McpWriteOutcome;
    expect(genericOut.changed).toBe(true);
    expect(genericOut.receipt.revision).toBe(receipt.revision + 1);
    const staleReceipt = receipt;
    receipt = genericOut.receipt;

    // Stale receipt is rejected with CONFLICT
    const conflictRes = await client.callTool({
      name: 'update_instrument_code',
      arguments: {
        expected: staleReceipt,
        instrumentId: '1',
        changes: { text: 'a1 oscili 0.1, 100' },
      },
    });
    expect(parseErrorToolResult(conflictRes as never).code).toBe('CONFLICT');

    // Incompatible BSB fields on GenericInstrument -> INVALID_INPUT; BlueX7 -> UNSUPPORTED_CONTENT; missing -> NOT_FOUND
    const badGenericField = await client.callTool({
      name: 'update_instrument_code',
      arguments: {
        expected: receipt,
        instrumentId: '1',
        changes: { instrumentText: 'invalid' },
      },
    });
    expect(parseErrorToolResult(badGenericField as never).code).toBe('INVALID_INPUT');

    const badBsbField = await client.callTool({
      name: 'update_instrument_code',
      arguments: {
        expected: receipt,
        instrumentId: '2',
        changes: { text: 'invalid' },
      },
    });
    expect(parseErrorToolResult(badBsbField as never).code).toBe('INVALID_INPUT');

    const unsupportedInstr = await client.callTool({
      name: 'update_instrument_code',
      arguments: {
        expected: receipt,
        instrumentId: '3',
        changes: { text: 'cannot edit' },
      },
    });
    expect(parseErrorToolResult(unsupportedInstr as never).code).toBe('UNSUPPORTED_CONTENT');

    const missingInstr = await client.callTool({
      name: 'update_instrument_code',
      arguments: {
        expected: receipt,
        instrumentId: '999',
        changes: { text: 'missing' },
      },
    });
    expect(parseErrorToolResult(missingInstr as never).code).toBe('NOT_FOUND');

    // 2. Update BSB code
    const bsbRes = await client.callTool({
      name: 'update_instrument_code',
      arguments: {
        expected: receipt,
        instrumentId: '2',
        changes: {
          instrumentText: 'a1 oscili 0.25, 330\nouts a1, a1',
          alwaysOnInstrumentText: 'gkTrim init 0.8',
        },
      },
    });
    expect(bsbRes.isError).not.toBe(true);
    receipt = (bsbRes.structuredContent as unknown as McpWriteOutcome).receipt;

    // No-op update returns changed: false without incrementing revision
    const noopInstrRes = await client.callTool({
      name: 'update_instrument_code',
      arguments: {
        expected: receipt,
        instrumentId: '2',
        changes: { instrumentText: 'a1 oscili 0.25, 330\nouts a1, a1' },
      },
    });
    const noopInstrOut = noopInstrRes.structuredContent as unknown as McpWriteOutcome;
    expect(noopInstrOut.changed).toBe(false);
    expect(noopInstrOut.receipt).toEqual(receipt);

    // 3. Upsert create new + update existing (preserving BSB type)
    const createWithoutName = await client.callTool({
      name: 'upsert_instrument',
      arguments: {
        expected: receipt,
        instrumentId: 'LeadSynth',
        changes: { enabled: true },
      },
    });
    expect(parseErrorToolResult(createWithoutName as never).code).toBe('INVALID_INPUT');

    const createInstrRes = await client.callTool({
      name: 'upsert_instrument',
      arguments: {
        expected: receipt,
        instrumentId: 'LeadSynth',
        changes: { name: 'Named Lead', enabled: false },
      },
    });
    expect(createInstrRes.isError).not.toBe(true);
    const createdInstrOut = createInstrRes.structuredContent as unknown as McpWriteOutcome;
    expect(createdInstrOut.changed).toBe(true);
    receipt = createdInstrOut.receipt;
    expect(harness.data.getArrangement().getInstrumentById('LeadSynth')).toBeInstanceOf(
      GenericInstrument,
    );

    const updateExistingBsbRes = await client.callTool({
      name: 'upsert_instrument',
      arguments: {
        expected: receipt,
        instrumentId: '2',
        changes: { name: 'Pad Renamed', enabled: false },
      },
    });
    expect(updateExistingBsbRes.isError).not.toBe(true);
    receipt = (updateExistingBsbRes.structuredContent as unknown as McpWriteOutcome).receipt;
    const bsbAfter = harness.data.getArrangement().getInstrumentById('2');
    expect(bsbAfter).toBeInstanceOf(BlueSynthBuilder);
    expect(bsbAfter?.getName()).toBe('Pad Renamed');
    expect((bsbAfter as BlueSynthBuilder).getInstrumentText()).toBe(
      'a1 oscili 0.25, 330\nouts a1, a1',
    );

    // 4. Score object updates across GenericScore, nested PolyObject, Instance, Comment, AudioClip
    const renameOnlyRes = await client.callTool({
      name: 'update_score_object',
      arguments: {
        expected: receipt,
        locator: { layerGroupPath: [0], layerIndex: 0, objectIndex: 2 },
        changes: { name: 'Section Marker' },
      },
    });
    expect(renameOnlyRes.isError).not.toBe(true);
    const renameOnlyOut = renameOnlyRes.structuredContent as unknown as McpWriteOutcome;
    expect(renameOnlyOut.changed).toBe(true);
    receipt = renameOnlyOut.receipt;
    expect(((harness.data.getScore()[0] as PolyObject)[0]![2] as Comment).getName()).toBe(
      'Section Marker',
    );

    // Unchanged name returns changed: false without advancing receipt
    const noopNameRes = await client.callTool({
      name: 'update_score_object',
      arguments: {
        expected: receipt,
        locator: { layerGroupPath: [0], layerIndex: 0, objectIndex: 2 },
        changes: { name: 'Section Marker' },
      },
    });
    const noopNameOut = noopNameRes.structuredContent as unknown as McpWriteOutcome;
    expect(noopNameOut.changed).toBe(false);
    expect(noopNameOut.receipt).toEqual(receipt);

    const scoreUpdateRes = await client.callTool({
      name: 'update_score_object',
      arguments: {
        expected: receipt,
        locator: { layerGroupPath: [0], layerIndex: 0, objectIndex: 0 },
        changes: { name: 'Melody Renamed', start: 3, duration: 5, text: 'i1 0 2 550' },
      },
    });
    expect(scoreUpdateRes.isError).not.toBe(true);
    receipt = (scoreUpdateRes.structuredContent as unknown as McpWriteOutcome).receipt;
    expect(((harness.data.getScore()[0] as PolyObject)[0]![0] as GenericScore).getName()).toBe(
      'Melody Renamed',
    );
    expect((scoreUpdateRes.structuredContent as unknown as McpWriteOutcome).receipt.revision).toBe(
      noopNameOut.receipt.revision + 1,
    );

    const nestedScoreRes = await client.callTool({
      name: 'update_score_object',
      arguments: {
        expected: receipt,
        locator: { layerGroupPath: [0, 0, 3], layerIndex: 0, objectIndex: 0 },
        changes: { text: 'i2 0 1 660' },
      },
    });
    expect(nestedScoreRes.isError).not.toBe(true);
    receipt = (nestedScoreRes.structuredContent as unknown as McpWriteOutcome).receipt;

    // Instance rejects text edits, accepts name + timing edits without modifying library object
    const instanceTextRejected = await client.callTool({
      name: 'update_score_object',
      arguments: {
        expected: receipt,
        locator: { layerGroupPath: [0], layerIndex: 0, objectIndex: 1 },
        changes: { text: 'forbidden' },
      },
    });
    expect(parseErrorToolResult(instanceTextRejected as never).code).toBe('UNSUPPORTED_CONTENT');

    const instanceTimingRes = await client.callTool({
      name: 'update_score_object',
      arguments: {
        expected: receipt,
        locator: { layerGroupPath: [0], layerIndex: 0, objectIndex: 1 },
        changes: { name: 'Motif Instance Renamed', start: 7, duration: 3 },
      },
    });
    expect(instanceTimingRes.isError).not.toBe(true);
    receipt = (instanceTimingRes.structuredContent as unknown as McpWriteOutcome).receipt;
    expect(((harness.data.getScore()[0] as PolyObject)[0]![1] as Instance).getName()).toBe(
      'Motif Instance Renamed',
    );
    expect(harness.libraryScore.getName()).toBe('Library Motif');
    expect(harness.libraryScore.getScoreText()).toBe('i1 0 1 660');
    expect(
      harness.libraryScore.getStartTime().toBeats(harness.data.getScore().getTimeContext()),
    ).toBe(0);

    // Comment & AudioClip reject text edits; AudioClip accepts name + timing edits
    const commentTextRejected = await client.callTool({
      name: 'update_score_object',
      arguments: {
        expected: receipt,
        locator: { layerGroupPath: [0], layerIndex: 0, objectIndex: 2 },
        changes: { text: 'not GenericScore' },
      },
    });
    expect(parseErrorToolResult(commentTextRejected as never).code).toBe('UNSUPPORTED_CONTENT');

    const clipTextRejected = await client.callTool({
      name: 'update_score_object',
      arguments: {
        expected: receipt,
        locator: { layerGroupPath: [1], layerIndex: 0, objectIndex: 0 },
        changes: { text: 'not GenericScore' },
      },
    });
    expect(parseErrorToolResult(clipTextRejected as never).code).toBe('UNSUPPORTED_CONTENT');

    const clipTimingRes = await client.callTool({
      name: 'update_score_object',
      arguments: {
        expected: receipt,
        locator: { layerGroupPath: [1], layerIndex: 0, objectIndex: 0 },
        changes: { name: 'Kick Loop V2', start: 2 },
      },
    });
    expect(clipTimingRes.isError).not.toBe(true);
    receipt = (clipTimingRes.structuredContent as unknown as McpWriteOutcome).receipt;
    expect((harness.data.getScore()[1] as TrackLayerGroup)[0]![0]!.getName()).toBe('Kick Loop V2');

    const missingObjRes = await client.callTool({
      name: 'update_score_object',
      arguments: {
        expected: receipt,
        locator: { layerGroupPath: [0], layerIndex: 0, objectIndex: 99 },
        changes: { start: 1 },
      },
    });
    expect(parseErrorToolResult(missingObjRes as never).code).toBe('NOT_FOUND');

    // 5. Project properties update realtime settings without touching disk settings
    const propsRes = await client.callTool({
      name: 'set_project_properties',
      arguments: {
        expected: receipt,
        changes: {
          title: 'Updated Title',
          sampleRate: 48000,
          ksmps: 32,
          nchnls: 6,
        },
      },
    });
    expect(propsRes.isError).not.toBe(true);
    const propsOut = propsRes.structuredContent as unknown as McpWriteOutcome;
    expect(propsOut.changed).toBe(true);
    const propsAfter = harness.data.getProjectProperties();
    expect(propsAfter.title).toBe('Updated Title');
    expect(propsAfter.sampleRate).toBe('48000');
    expect(propsAfter.ksmps).toBe('32');
    expect(propsAfter.nchnls).toBe('6');
    expect(propsAfter.diskSampleRate).toBe('96000');
    expect(propsAfter.diskKsmps).toBe('16');
    expect(propsAfter.diskChannels).toBe('4');

    await client.close();
  });

  it('delegates transport_play, transport_stop, and render_to_disk through McpBridge with pre-effect fences and terminal result preservation', async () => {
    const { session } = createWriteContractFixture();
    let accessMode: McpAccessMode = 'read-write';
    let authorized = true;
    const bridge = new McpBridge({
      readSession: () => session.read(),
      getSaveState: () => 'saved',
      isDirty: () => false,
      getEngineStatus: () => ({
        connected: true,
        available: true,
        playbackState: 'stopped',
        activeDocumentId: null,
        consoleTail: [],
      }),
      runtime: {
        transportPlay: async (_auth, expected) => ({
          ok: true,
          value: { receipt: expected, status: 'started', playing: true },
        }),
        transportStop: async (_auth, expected) => ({
          ok: true,
          value: { receipt: expected, status: 'stopped', playing: false },
        }),
        renderToDisk: async (auth, input) => {
          if (input.filename === 'pending-revoked.wav') {
            authorized = false;
            if (!auth.isAuthorized()) {
              return {
                ok: false,
                code: 'ACCESS_DENIED',
                message: 'Revoked before publication.',
              };
            }
          }
          // Simulate publication succeeding first, then revocation afterwards.
          const committed = {
            ok: true as const,
            value: {
              outputPath: `/tmp/${input.filename}`,
              receipt: input.expected,
            },
          };
          if (input.destination === 'choose') {
            authorized = false;
          }
          return committed;
        },
      },
    });

    const handler = createMcpHandler(
      () =>
        createBlueMcpServer(
          bridge,
          (action, signal) => ({
            listenerGeneration: 1,
            credentialEpoch: 1,
            accessMode,
            action,
            signal: signal ?? new AbortController().signal,
            isAuthorized: () => authorized,
          }),
          '1.0.0-test',
        ),
      { legacy: 'stateless', maxRequestBodySize: 2 * 1024 * 1024 },
    );

    const client = new Client(
      { name: 'runtime-bridge-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await client.connect(
      new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8765/mcp'), {
        fetch: async (input, init) =>
          handler.fetch(input instanceof Request ? input : new Request(input, init)),
      }),
    );

    const snap = session.read();
    const receipt: McpDocumentReceipt = {
      documentId: snap.documentId!,
      revision: snap.revision,
      stateId: snap.stateId!,
    };

    const playRes = await client.callTool({
      name: 'transport_play',
      arguments: { expected: receipt },
    });
    expect(playRes.isError).not.toBe(true);
    expect(playRes.structuredContent).toMatchObject({ status: 'started', playing: true });

    const stopRes = await client.callTool({
      name: 'transport_stop',
      arguments: { expected: receipt },
    });
    expect(stopRes.isError).not.toBe(true);
    expect(stopRes.structuredContent).toMatchObject({ status: 'stopped', playing: false });

    const invalidFileRes = await client.callTool({
      name: 'render_to_disk',
      arguments: { expected: receipt, filename: '../evil.wav' },
    });
    expect(invalidFileRes.isError).toBe(true);

    const renderOkRes = await client.callTool({
      name: 'render_to_disk',
      arguments: { expected: receipt, filename: 'mix.wav', destination: 'project' },
    });
    expect(renderOkRes.isError).not.toBe(true);
    expect(renderOkRes.structuredContent).toMatchObject({
      outputPath: '/tmp/mix.wav',
      receipt,
    });

    // Pending work revoked before effect fails closed with ACCESS_DENIED
    const pendingRevokedRes = await client.callTool({
      name: 'render_to_disk',
      arguments: { expected: receipt, filename: 'pending-revoked.wav', destination: 'project' },
    });
    expect(parseErrorToolResult(pendingRevokedRes as never).code).toBe('ACCESS_DENIED');

    // Committed publication followed by revocation preserves the terminal success result (T052)
    authorized = true;
    const committedThenRevokedRes = await client.callTool({
      name: 'render_to_disk',
      arguments: { expected: receipt, filename: 'committed.wav', destination: 'choose' },
    });
    expect(committedThenRevokedRes.isError).not.toBe(true);
    expect(committedThenRevokedRes.structuredContent).toMatchObject({
      outputPath: '/tmp/committed.wav',
      receipt,
    });

    // Read-only mode denies runtime tools even with cached tool names
    authorized = true;
    accessMode = 'read-only';
    const roPlayRes = await client.callTool({
      name: 'transport_play',
      arguments: { expected: receipt },
    });
    expect(parseErrorToolResult(roPlayRes as never).code).toBe('ACCESS_DENIED');

    await client.close();
  });
});
