import { describe, expect, it, vi } from 'vite-plus/test';
import {
  BlueData,
  BlueSynthBuilder,
  BlueX7,
  GenericInstrument,
  GenericScore,
  PatternLayer,
  PatternsLayerGroup,
  PolyObject,
  PythonObject,
  SoundLayer,
  TimeDuration,
  TimePosition,
  TrackLayer,
  TrackLayerGroup,
} from '@blue/data';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler, ProtocolError, type FetchLike } from '@modelcontextprotocol/server';
import { generateDiskCsdForScreen } from './csd-generation';
import {
  McpBridge,
  McpConsoleTailBuffer,
  buildMcpEngineStatusSnapshot,
  type McpAuthContext,
  type McpEngineStatusSnapshot,
  type McpInspectionLimits,
} from './mcp-bridge';
import {
  BLUE_ENGINE_STATUS_URI,
  BLUE_PROJECT_CSD_URI,
  BLUE_PROJECT_INSTRUMENTS_URI,
  BLUE_PROJECT_SUMMARY_URI,
} from './mcp-resources';
import { createBlueMcpServer } from './mcp-tools';
import { ProjectSession } from './project-session';

function createFixtureProject(): BlueData {
  const data = new BlueData();
  const props = data.getProjectProperties();
  props.title = 'Inspection Fixture';
  props.author = 'Ada';
  props.notes = 'Wave 1 test project';

  const generic = new GenericInstrument();
  generic.setName('Lead Synth');
  generic.setText('a1 oscili 0.3, 440\nouts a1, a1');
  generic.setGlobalOrc('giSine ftgen 0, 0, 4096, 10, 1');
  generic.setGlobalSco('f0 8');
  data.getArrangement().addInstrument(generic, '1');

  const bsb = new BlueSynthBuilder();
  bsb.setName('BSB Bass');
  bsb.setInstrumentText('a1 oscili 0.2, 110\nouts a1, a1');
  bsb.setAlwaysOnInstrumentText('gkLevel init 0.5');
  bsb.setGlobalOrc('gkGlobal init 1');
  bsb.setGlobalSco('i"always" 0 4');
  data.getArrangement().addInstrument(bsb, '2');

  const bx7 = new BlueX7();
  bx7.setName('FM Keys');
  data.getArrangement().addInstrument(bx7, '3');

  const rootPoly = data.getScore()[0] as PolyObject;
  rootPoly.setName('Root Group');
  const layer0 = rootPoly[0]!;
  layer0.setName('Layer A');

  const scoreA = new GenericScore();
  scoreA.setName('Note A');
  scoreA.setStartTime(TimePosition.beats(8));
  scoreA.setSubjectiveDuration(TimeDuration.beats(2));
  scoreA.setScoreText('i1 0 1 440');

  const scoreB = new GenericScore();
  scoreB.setName('Note B');
  scoreB.setStartTime(TimePosition.beats(2));
  scoreB.setSubjectiveDuration(TimeDuration.beats(2));
  scoreB.setScoreText('i1 0 1 220');

  const scoreC = new GenericScore();
  scoreC.setName('Note C');
  scoreC.setStartTime(TimePosition.beats(4));
  scoreC.setSubjectiveDuration(TimeDuration.beats(3));
  scoreC.setScoreText('i1 0 1 330');

  const nestedPoly = new PolyObject();
  nestedPoly.setName('Nested Group');
  nestedPoly.setStartTime(TimePosition.beats(12));
  nestedPoly.setSubjectiveDuration(TimeDuration.beats(4));
  const nestedLayer = new SoundLayer();
  nestedLayer.setName('Nested Layer');
  const nestedScore = new GenericScore();
  nestedScore.setName('Nested Note');
  nestedScore.setStartTime(TimePosition.beats(1));
  nestedScore.setSubjectiveDuration(TimeDuration.beats(2));
  nestedScore.setScoreText('i2 0 1 550');
  nestedLayer.push(nestedScore);
  nestedPoly.push(nestedLayer);

  // Push out of chronological order to verify sorting by (start, objectIndex)
  layer0.push(scoreA, scoreB, scoreC, nestedPoly);

  const trackGroup = new TrackLayerGroup();
  trackGroup.setName('Track Group');
  const track = new TrackLayer();
  track.setName('Track 1');
  const trackScore = new GenericScore();
  trackScore.setName('Track Phrase');
  trackScore.setStartTime(TimePosition.beats(0));
  trackScore.setSubjectiveDuration(TimeDuration.beats(4));
  trackScore.setScoreText('i1 0 2 880');
  track.push(trackScore);
  trackGroup.push(track);
  data.getScore().push(trackGroup);

  const patternsGroup = new PatternsLayerGroup();
  patternsGroup.setName('Pattern Group');
  const patternLayer = new PatternLayer();
  patternLayer.setName('Pattern 1');
  patternsGroup.push(patternLayer);
  data.getScore().push(patternsGroup);

  return data;
}

function createHarness(options: { inspectionLimits?: Partial<McpInspectionLimits> } = {}) {
  const session = new ProjectSession();
  session.replace(createFixtureProject(), '/tmp/fixture.blue');

  const consoleTail = new McpConsoleTailBuffer();
  consoleTail.append('Csound version 6.18\n0dBFS level = 1.0\n', 'stdout');

  let dirty = false;
  let saveState: 'none' | 'unsaved' | 'saved' | 'modified' = 'saved';
  let engineState: McpEngineStatusSnapshot = {
    connected: false,
    available: true,
    playbackState: 'stopped',
    activeDocumentId: null,
    consoleTail: consoleTail.read(),
  };

  const bridge = new McpBridge({
    readSession: () => session.read(),
    getSaveState: () => saveState,
    isDirty: () => dirty,
    getEngineStatus: () => ({
      ...engineState,
      consoleTail: consoleTail.read(),
    }),
    inspectionLimits: options.inspectionLimits,
  });

  const makeAuth = (action: McpAuthContext['action'], signal?: AbortSignal): McpAuthContext => ({
    listenerGeneration: 1,
    credentialEpoch: 1,
    accessMode: 'read-only',
    action,
    signal: signal ?? new AbortController().signal,
    isAuthorized: () => true,
  });

  const handler = createMcpHandler(
    () => createBlueMcpServer(bridge, (action, signal) => makeAuth(action, signal), '3.0.0-test'),
    { legacy: 'stateless', maxRequestBodySize: 2 * 1024 * 1024 },
  );

  const fetch: FetchLike = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    return handler.fetch(request);
  };

  return {
    session,
    consoleTail,
    bridge,
    handler,
    fetch,
    setDirty: (next: boolean) => {
      dirty = next;
      saveState = next ? 'modified' : 'saved';
    },
    setEngineState: (next: Partial<McpEngineStatusSnapshot>) => {
      engineState = { ...engineState, ...next };
    },
  };
}

describe('MCP inspection contract', () => {
  it('supports modern discovery, all 4 resources, and all 4 read tools', async () => {
    const harness = createHarness();
    const client = new Client(
      { name: 'blue-test-modern', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8765/mcp'), {
      fetch: harness.fetch,
    });
    await client.connect(transport);
    expect(client.getProtocolEra()).toBe('modern');

    try {
      const resourcesList = await client.listResources();
      expect(resourcesList.resources.map((r) => r.uri)).toEqual([
        BLUE_PROJECT_SUMMARY_URI,
        BLUE_PROJECT_CSD_URI,
        BLUE_PROJECT_INSTRUMENTS_URI,
        BLUE_ENGINE_STATUS_URI,
      ]);

      const toolsList = await client.listTools();
      expect(toolsList.tools.map((t) => t.name)).toEqual([
        'get_project_summary',
        'get_instrument',
        'list_score_objects',
        'generate_csd',
      ]);

      // Read all 4 resources
      const summaryResource = await client.readResource({ uri: BLUE_PROJECT_SUMMARY_URI });
      const summaryJson = JSON.parse((summaryResource.contents[0] as { text: string }).text);
      expect(summaryJson.title).toBe('Inspection Fixture');
      expect(summaryJson.author).toBe('Ada');
      expect(summaryJson.projectPath).toBe('/tmp/fixture.blue');
      expect(summaryJson.isDirty).toBe(false);
      expect(summaryJson.saveState).toBe('saved');
      expect(summaryJson.receipt.documentId).toBe(harness.session.read().documentId);
      expect(summaryJson.instruments).toHaveLength(3);
      expect(summaryJson.soundLayers.map((l: { groupType: string }) => l.groupType)).toEqual([
        'polyObject',
        'polyObject',
        'track',
        'patterns',
      ]);

      const instrumentsResource = await client.readResource({
        uri: BLUE_PROJECT_INSTRUMENTS_URI,
      });
      const instrumentsJson = JSON.parse(
        (instrumentsResource.contents[0] as { text: string }).text,
      );
      expect(instrumentsJson.instruments).toEqual([
        { id: '1', name: 'Lead Synth', type: 'GenericInstrument', enabled: true },
        { id: '2', name: 'BSB Bass', type: 'BlueSynthBuilder', enabled: true },
        { id: '3', name: 'FM Keys', type: 'BlueX7', enabled: true },
      ]);

      const csdResource = await client.readResource({ uri: BLUE_PROJECT_CSD_URI });
      const expectedCsd = await generateDiskCsdForScreen(
        harness.session.read().data!,
        undefined,
        null,
      );
      expect((csdResource.contents[0] as { text: string }).text).toBe(expectedCsd);

      const engineResource = await client.readResource({ uri: BLUE_ENGINE_STATUS_URI });
      const engineJson = JSON.parse((engineResource.contents[0] as { text: string }).text);
      expect(engineJson).toMatchObject({
        connected: false,
        available: true,
        playbackState: 'stopped',
        activeDocumentId: null,
      });
      expect(engineJson.consoleTail).toHaveLength(2);

      // Call all 4 read tools
      const summaryTool = await client.callTool({ name: 'get_project_summary', arguments: {} });
      expect(summaryTool.isError).not.toBe(true);
      expect(summaryTool.structuredContent).toEqual(summaryJson);

      const genericInstrTool = await client.callTool({
        name: 'get_instrument',
        arguments: { instrumentId: '1' },
      });
      expect(genericInstrTool.structuredContent).toMatchObject({
        id: '1',
        name: 'Lead Synth',
        type: 'GenericInstrument',
        enabled: true,
        code: {
          text: 'a1 oscili 0.3, 440\nouts a1, a1',
          globalOrc: 'giSine ftgen 0, 0, 4096, 10, 1',
          globalSco: 'f0 8',
        },
      });

      const bsbInstrTool = await client.callTool({
        name: 'get_instrument',
        arguments: { instrumentId: '2' },
      });
      expect(bsbInstrTool.structuredContent).toMatchObject({
        id: '2',
        type: 'BlueSynthBuilder',
        code: {
          instrumentText: 'a1 oscili 0.2, 110\nouts a1, a1',
          alwaysOnInstrumentText: 'gkLevel init 0.5',
          globalOrc: 'gkGlobal init 1',
          globalSco: 'i"always" 0 4',
        },
      });

      const bx7InstrTool = await client.callTool({
        name: 'get_instrument',
        arguments: { instrumentId: '3' },
      });
      expect(bx7InstrTool.structuredContent).toMatchObject({
        id: '3',
        type: 'BlueX7',
        code: null,
      });

      const missingInstrTool = await client.callTool({
        name: 'get_instrument',
        arguments: { instrumentId: '999' },
      });
      expect(missingInstrTool.isError).toBe(true);
      expect(missingInstrTool.structuredContent).toMatchObject({ code: 'NOT_FOUND' });

      // list_score_objects: half-open [2, 8) selects Note B (2..4) and Note C (4..7), excludes Note A (8..10)
      const listFiltered = await client.callTool({
        name: 'list_score_objects',
        arguments: {
          layer: { layerGroupPath: [0], layerIndex: 0 },
          start: 2,
          end: 8,
        },
      });
      expect(listFiltered.isError).not.toBe(true);
      expect(
        (listFiltered.structuredContent as { objects: Array<{ name: string; text?: string }> })
          .objects,
      ).toMatchObject([
        { name: 'Note B', start: 2, duration: 2, text: 'i1 0 1 220', locator: { objectIndex: 1 } },
        { name: 'Note C', start: 4, duration: 3, text: 'i1 0 1 330', locator: { objectIndex: 2 } },
      ]);

      // Pagination across all 4 objects in root layer
      const page1 = await client.callTool({
        name: 'list_score_objects',
        arguments: {
          layer: { layerGroupPath: [0], layerIndex: 0 },
          offset: 0,
          limit: 2,
        },
      });
      expect(page1.structuredContent).toMatchObject({
        nextOffset: 2,
      });
      expect(
        (page1.structuredContent as { objects: Array<{ name: string }> }).objects.map(
          (o) => o.name,
        ),
      ).toEqual(['Note B', 'Note C']);

      const page2 = await client.callTool({
        name: 'list_score_objects',
        arguments: {
          layer: { layerGroupPath: [0], layerIndex: 0 },
          offset: 2,
          limit: 2,
        },
      });
      expect(page2.structuredContent).toMatchObject({
        nextOffset: null,
      });
      expect(
        (page2.structuredContent as { objects: Array<{ name: string }> }).objects.map(
          (o) => o.name,
        ),
      ).toEqual(['Note A', 'Nested Group']);

      // Nested PolyObject resolution via [0, 0, 3]
      const nestedList = await client.callTool({
        name: 'list_score_objects',
        arguments: {
          layer: { layerGroupPath: [0, 0, 3], layerIndex: 0 },
        },
      });
      expect(
        (nestedList.structuredContent as { objects: Array<{ name: string }> }).objects.map(
          (o) => o.name,
        ),
      ).toEqual(['Nested Note']);

      // TrackLayerGroup resolution via [1]
      const trackList = await client.callTool({
        name: 'list_score_objects',
        arguments: {
          layer: { layerGroupPath: [1], layerIndex: 0 },
        },
      });
      expect(
        (trackList.structuredContent as { objects: Array<{ name: string }> }).objects.map(
          (o) => o.name,
        ),
      ).toEqual(['Track Phrase']);

      // generate_csd tool
      const csdTool = await client.callTool({ name: 'generate_csd', arguments: {} });
      expect(csdTool.isError).not.toBe(true);
      expect(csdTool.structuredContent).toEqual({
        receipt: summaryJson.receipt,
        csd: expectedCsd,
        diagnostics: [],
      });
    } finally {
      await transport.close();
      await client.close();
      await harness.handler.close();
    }
  });

  it('rejects malformed or non-strict tool inputs and surfaces structured EXECUTION_REQUIRED errors', async () => {
    const harness = createHarness();
    const client = new Client(
      { name: 'blue-test-validation', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8765/mcp'), {
      fetch: harness.fetch,
    });
    await client.connect(transport);

    try {
      // Unknown extra fields rejected by .strict()
      const extraFieldRes = await client.callTool({
        name: 'get_project_summary',
        arguments: { unexpected: true },
      });
      expect(extraFieldRes.isError).toBe(true);
      expect((extraFieldRes.content[0] as { text: string }).text).toContain(
        'Input validation error',
      );

      // Blank instrumentId rejected
      const blankIdRes = await client.callTool({
        name: 'get_instrument',
        arguments: { instrumentId: '   ' },
      });
      expect(blankIdRes.isError).toBe(true);
      expect((blankIdRes.content[0] as { text: string }).text).toContain('Input validation error');

      // Unpaired start without end rejected
      const unpairedStartRes = await client.callTool({
        name: 'list_score_objects',
        arguments: {
          layer: { layerGroupPath: [0], layerIndex: 0 },
          start: 0,
        },
      });
      expect(unpairedStartRes.isError).toBe(true);
      expect((unpairedStartRes.content[0] as { text: string }).text).toContain(
        'Input validation error',
      );

      // limit > 500 rejected
      const overLimitRes = await client.callTool({
        name: 'list_score_objects',
        arguments: {
          layer: { layerGroupPath: [0], layerIndex: 0 },
          limit: 501,
        },
      });
      expect(overLimitRes.isError).toBe(true);
      expect((overLimitRes.content[0] as { text: string }).text).toContain(
        'Input validation error',
      );

      // Even-length layerGroupPath rejected
      const evenPathRes = await client.callTool({
        name: 'list_score_objects',
        arguments: {
          layer: { layerGroupPath: [0, 0], layerIndex: 0 },
        },
      });
      expect(evenPathRes.isError).toBe(true);
      expect((evenPathRes.content[0] as { text: string }).text).toContain('Input validation error');

      // Add a PythonObject to trigger EXECUTION_REQUIRED tool error
      (harness.session.read().data!.getScore()[0] as PolyObject)[0]!.push(new PythonObject());
      harness.session.recordMutation({ changed: true });

      const csdFailure = await client.callTool({ name: 'generate_csd', arguments: {} });
      expect(csdFailure.isError).toBe(true);
      expect(csdFailure.structuredContent).toMatchObject({
        code: 'EXECUTION_REQUIRED',
      });
    } finally {
      await transport.close();
      await client.close();
      await harness.handler.close();
    }
  });

  it('delivers notifications/resources/updated over modern subscriptions/listen', async () => {
    const harness = createHarness();
    const client = new Client(
      { name: 'blue-test-subscribe', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8765/mcp'), {
      fetch: harness.fetch,
    });
    await client.connect(transport);

    const updatedUris: string[] = [];
    let resolveNotification!: () => void;
    const twoNotificationsReceived = new Promise<void>((resolve) => {
      resolveNotification = () => {
        if (updatedUris.length >= 2) resolve();
      };
    });

    client.setNotificationHandler('notifications/resources/updated', (notification) => {
      updatedUris.push(notification.params.uri);
      resolveNotification();
    });

    const subscription = await client.listen({
      resourceSubscriptions: [BLUE_PROJECT_SUMMARY_URI, BLUE_PROJECT_CSD_URI],
    });
    expect(subscription.honoredFilter.resourceSubscriptions).toEqual([
      BLUE_PROJECT_SUMMARY_URI,
      BLUE_PROJECT_CSD_URI,
    ]);

    try {
      harness.session.read().data!.getProjectProperties().title = 'Updated Title';
      harness.session.recordMutation({ changed: true });
      harness.setDirty(true);

      harness.handler.notify.resourceUpdated(BLUE_PROJECT_SUMMARY_URI);
      harness.handler.notify.resourceUpdated(BLUE_PROJECT_CSD_URI);
      harness.handler.notify.resourceUpdated(BLUE_PROJECT_INSTRUMENTS_URI); // Not subscribed

      await twoNotificationsReceived;
      expect(updatedUris).toEqual([BLUE_PROJECT_SUMMARY_URI, BLUE_PROJECT_CSD_URI]);

      const updatedSummary = await client.readResource({ uri: BLUE_PROJECT_SUMMARY_URI });
      const parsed = JSON.parse((updatedSummary.contents[0] as { text: string }).text);
      expect(parsed.title).toBe('Updated Title');
      expect(parsed.isDirty).toBe(true);
      expect(parsed.receipt.revision).toBe(1);
    } finally {
      await subscription.close();
      await transport.close();
      await client.close();
      await harness.handler.close();
    }
  });

  it('serves legacy 2025-06-18 stateless discovery, resource reads, and tool calls', async () => {
    const harness = createHarness();

    // Verify exact 2025-06-18 stateless handshake + discovery + reads + calls
    const legacyClient = new Client(
      { name: 'blue-test-legacy', version: '1.0.0' },
      { versionNegotiation: { mode: 'legacy' } },
    );
    const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8765/mcp'), {
      fetch: harness.fetch,
      protocolVersion: '2025-06-18',
    });
    await legacyClient.connect(transport);
    expect(legacyClient.getProtocolEra()).toBe('legacy');

    try {
      const tools = await legacyClient.listTools();
      expect(tools.tools.map((t) => t.name)).toContain('get_project_summary');

      const resources = await legacyClient.listResources();
      expect(resources.resources.map((r) => r.uri)).toContain(BLUE_ENGINE_STATUS_URI);

      const summary = await legacyClient.callTool({
        name: 'get_project_summary',
        arguments: {},
      });
      expect(summary.isError).not.toBe(true);
      expect(summary.structuredContent).toMatchObject({ title: 'Inspection Fixture' });

      const engineRes = await legacyClient.readResource({ uri: BLUE_ENGINE_STATUS_URI });
      expect(JSON.parse((engineRes.contents[0] as { text: string }).text).available).toBe(true);

      // Direct HTTP POST simulating a 2025-06-18 MCP-Protocol-Version header request
      const rawResponse = await harness.handler.fetch(
        new Request('http://127.0.0.1:8765/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'MCP-Protocol-Version': '2025-06-18',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 42,
            method: 'tools/call',
            params: {
              name: 'get_instrument',
              arguments: { instrumentId: '1' },
            },
          }),
        }),
      );
      expect(rawResponse.status).toBe(200);
      const bodyText = await rawResponse.text();
      expect(bodyText).toContain('Lead Synth');
    } finally {
      await transport.close();
      await legacyClient.close();
      await harness.handler.close();
    }
  });

  it('returns recoverable NO_ACTIVE_PROJECT errors when no project is open while keeping blue://engine/status available', async () => {
    const harness = createHarness();
    harness.session.close();
    harness.setEngineState({
      connected: false,
      available: false,
      playbackState: 'stopped',
      activeDocumentId: null,
    });

    const client = new Client(
      { name: 'blue-test-no-project', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8765/mcp'), {
      fetch: harness.fetch,
    });
    await client.connect(transport);

    try {
      for (const uri of [
        BLUE_PROJECT_SUMMARY_URI,
        BLUE_PROJECT_CSD_URI,
        BLUE_PROJECT_INSTRUMENTS_URI,
      ]) {
        await expect(client.readResource({ uri })).rejects.toThrowError(ProtocolError);
        try {
          await client.readResource({ uri });
        } catch (error) {
          expect(ProtocolError.isInstance(error)).toBe(true);
          expect((error as ProtocolError).message).toContain('NO_ACTIVE_PROJECT');
        }
      }

      const toolChecks = [
        client.callTool({ name: 'get_project_summary', arguments: {} }),
        client.callTool({ name: 'get_instrument', arguments: { instrumentId: '1' } }),
        client.callTool({
          name: 'list_score_objects',
          arguments: { layer: { layerGroupPath: [0], layerIndex: 0 } },
        }),
        client.callTool({ name: 'generate_csd', arguments: {} }),
      ];

      for (const promise of toolChecks) {
        const res = await promise;
        expect(res.isError).toBe(true);
        expect(res.structuredContent).toMatchObject({
          code: 'NO_ACTIVE_PROJECT',
        });
      }

      // blue://engine/status remains available with no active project
      const engineRes = await client.readResource({ uri: BLUE_ENGINE_STATUS_URI });
      const engineJson = JSON.parse((engineRes.contents[0] as { text: string }).text);
      expect(engineJson).toMatchObject({
        connected: false,
        available: false,
        playbackState: 'stopped',
        activeDocumentId: null,
      });
    } finally {
      await transport.close();
      await client.close();
      await harness.handler.close();
    }
  });

  it('reports real stopped, unavailable, playing, and replaced-project engine states through blue://engine/status (T058)', async () => {
    let runtimeState = {
      isQuitting: false,
      hasBridge: true,
      hasRuntimeService: true,
      isPlaying: false,
      activeSessionAcceptingCommands: false,
      activePlaybackDocumentId: null as string | null,
    };

    const session = new ProjectSession();
    session.replace(createFixtureProject(), '/tmp/doc-one.blue');
    const docOneId = session.read().documentId!;
    const tail = new McpConsoleTailBuffer();
    const bridge = new McpBridge({
      readSession: () => session.read(),
      getSaveState: () => 'saved',
      isDirty: () => false,
      getEngineStatus: () =>
        buildMcpEngineStatusSnapshot({
          ...runtimeState,
          consoleTail: tail.read(),
        }),
    });

    const handler = createMcpHandler(
      () =>
        createBlueMcpServer(
          bridge,
          (action, signal) => ({
            listenerGeneration: 1,
            credentialEpoch: 1,
            accessMode: 'read-only',
            action,
            signal: signal ?? new AbortController().signal,
            isAuthorized: () => true,
          }),
          '3.0.0-test',
        ),
      { legacy: 'stateless', maxRequestBodySize: 2 * 1024 * 1024 },
    );

    const client = new Client(
      { name: 'blue-test-engine-status', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8765/mcp'), {
      fetch: async (input, init) =>
        handler.fetch(input instanceof Request ? input : new Request(input, init)),
    });
    await client.connect(transport);

    const readStatus = async (): Promise<McpEngineStatusSnapshot> => {
      const res = await client.readResource({ uri: BLUE_ENGINE_STATUS_URI });
      return JSON.parse((res.contents[0] as { text: string }).text) as McpEngineStatusSnapshot;
    };

    try {
      // 1. Stopped idle engine: available, not connected, activeDocumentId is null even with open project
      expect(await readStatus()).toMatchObject({
        connected: false,
        available: true,
        playbackState: 'stopped',
        activeDocumentId: null,
      });

      // 2. Playing docOne
      runtimeState = {
        ...runtimeState,
        isPlaying: true,
        activeSessionAcceptingCommands: true,
        activePlaybackDocumentId: docOneId,
      };
      expect(await readStatus()).toMatchObject({
        connected: true,
        available: true,
        playbackState: 'playing',
        activeDocumentId: docOneId,
      });

      // 3. Project replaced to docTwo while docOne continues playing -> still reports docOne
      session.replace(createFixtureProject(), '/tmp/doc-two.blue');
      expect(session.read().documentId).not.toBe(docOneId);
      expect(await readStatus()).toMatchObject({
        connected: true,
        available: true,
        playbackState: 'playing',
        activeDocumentId: docOneId,
      });

      // 4. Playback stops -> activeDocumentId clears to null (does not echo docTwo)
      runtimeState = {
        ...runtimeState,
        isPlaying: false,
        activeSessionAcceptingCommands: false,
        activePlaybackDocumentId: null,
      };
      expect(await readStatus()).toMatchObject({
        connected: false,
        available: true,
        playbackState: 'stopped',
        activeDocumentId: null,
      });

      // 5. Runtime unavailable / disposed -> connected=false, available=false
      runtimeState = {
        ...runtimeState,
        hasBridge: false,
        hasRuntimeService: false,
      };
      expect(await readStatus()).toMatchObject({
        connected: false,
        available: false,
        playbackState: 'stopped',
        activeDocumentId: null,
      });
    } finally {
      await transport.close();
      await client.close();
      await handler.close();
    }
  });

  it('bounds inspection traversal depth, work, and response sizes with explicit diagnostics (T059)', async () => {
    // 1. Deeply nested PolyObject (>32 depth default) aborts traversal explicitly
    const deepHarness = createHarness();
    let currentPoly = deepHarness.session.read().data!.getScore()[0] as PolyObject;
    for (let depth = 0; depth < 35; depth++) {
      const child = new PolyObject();
      child.setName(`Depth ${depth}`);
      child.push(new SoundLayer());
      currentPoly[0]!.push(child);
      currentPoly = child;
    }

    const deepClient = new Client(
      { name: 'blue-test-bounds', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    const deepTransport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8765/mcp'), {
      fetch: deepHarness.fetch,
    });
    await deepClient.connect(deepTransport);

    try {
      const deepSummary = await deepClient.callTool({
        name: 'get_project_summary',
        arguments: {},
      });
      expect(deepSummary.isError).toBe(true);
      expect(deepSummary.structuredContent).toMatchObject({ code: 'RESPONSE_TOO_LARGE' });

      await expect(deepClient.readResource({ uri: BLUE_PROJECT_SUMMARY_URI })).rejects.toThrowError(
        /RESPONSE_TOO_LARGE/,
      );
    } finally {
      await deepTransport.close();
      await deepClient.close();
      await deepHarness.handler.close();
    }

    // 2. list_score_objects skips getScoreText() for out-of-page items, preserves pagination, and bounds response size
    const boundedHarness = createHarness({
      inspectionLimits: {
        maxResponseBytes: 4096,
        maxInstruments: 5,
        maxSoundLayers: 5,
        maxTraversalNodes: 40,
        maxScoreLayerScanObjects: 25,
      },
    });
    const rootPoly = boundedHarness.session.read().data!.getScore()[0] as PolyObject;
    const layer = rootPoly[0]!;
    const outOfPageSpies: Array<ReturnType<typeof vi.spyOn>> = [];
    for (let i = 0; i < 6; i++) {
      const note = new GenericScore();
      note.setName(`Bounded Note ${i}`);
      note.setStartTime(TimePosition.beats(20 + i));
      note.setSubjectiveDuration(TimeDuration.beats(1));
      note.setScoreText(`i1 0 1 ${400 + i}`);
      outOfPageSpies.push(vi.spyOn(note, 'getScoreText'));
      layer.push(note);
    }

    const client = new Client(
      { name: 'blue-test-bounds-2', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8765/mcp'), {
      fetch: boundedHarness.fetch,
    });
    await client.connect(transport);

    try {
      const pageRes = await client.callTool({
        name: 'list_score_objects',
        arguments: {
          layer: { layerGroupPath: [0], layerIndex: 0 },
          offset: 0,
          limit: 2,
        },
      });
      expect(pageRes.isError).not.toBe(true);
      expect(pageRes.structuredContent).toMatchObject({ nextOffset: 2 });
      // Late items (indices 20..25) were NOT materialized via getScoreText() when paginating first 2 items
      for (const spy of outOfPageSpies) {
        expect(spy).not.toHaveBeenCalled();
      }

      // Oversized GenericInstrument triggers RESPONSE_TOO_LARGE on get_instrument
      (
        boundedHarness.session
          .read()
          .data!.getArrangement()
          .getInstrumentById('1') as GenericInstrument
      ).setText('; '.padEnd(5000, 'x'));
      const oversizedInstr = await client.callTool({
        name: 'get_instrument',
        arguments: { instrumentId: '1' },
      });
      expect(oversizedInstr.isError).toBe(true);
      expect(oversizedInstr.structuredContent).toMatchObject({ code: 'RESPONSE_TOO_LARGE' });

      // Oversized generated CSD triggers RESPONSE_TOO_LARGE before copying on generate_csd and blue://project/csd (T059, T065)
      const activeDataForCsd = boundedHarness.session.read().data!;
      const copySpy = vi.spyOn(activeDataForCsd, 'historyCopy');
      const toDiskCsdSpy = vi.spyOn(activeDataForCsd, 'toDiskCSD');
      const oversizedCsdTool = await client.callTool({ name: 'generate_csd', arguments: {} });
      expect(oversizedCsdTool.isError).toBe(true);
      expect(oversizedCsdTool.structuredContent).toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
      await expect(client.readResource({ uri: BLUE_PROJECT_CSD_URI })).rejects.toThrowError(
        /RESPONSE_TOO_LARGE/,
      );
      expect(copySpy).not.toHaveBeenCalled();
      expect(toDiskCsdSpy).not.toHaveBeenCalled();
      copySpy.mockRestore();
      toDiskCsdSpy.mockRestore();

      // Too many instruments short-circuits blue://project/instruments and get_project_summary
      for (let k = 10; k < 16; k++) {
        const extra = new GenericInstrument();
        extra.setName(`Extra ${k}`);
        boundedHarness.session.read().data!.getArrangement().addInstrument(extra, String(k));
      }
      await expect(client.readResource({ uri: BLUE_PROJECT_INSTRUMENTS_URI })).rejects.toThrowError(
        /RESPONSE_TOO_LARGE/,
      );
      const tooManySummary = await client.callTool({
        name: 'get_project_summary',
        arguments: {},
      });
      expect(tooManySummary.isError).toBe(true);
      expect(tooManySummary.structuredContent).toMatchObject({ code: 'RESPONSE_TOO_LARGE' });

      // Oversized scan count on list_score_objects returns RESPONSE_TOO_LARGE
      for (let i = 0; i < 20; i++) {
        const extraNote = new GenericScore();
        extraNote.setName(`Overflow ${i}`);
        extraNote.setStartTime(TimePosition.beats(50 + i));
        extraNote.setSubjectiveDuration(TimeDuration.beats(1));
        layer.push(extraNote);
      }
      const scanOverflow = await client.callTool({
        name: 'list_score_objects',
        arguments: { layer: { layerGroupPath: [0], layerIndex: 0 }, limit: 5 },
      });
      expect(scanOverflow.isError).toBe(true);
      expect(scanOverflow.structuredContent).toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
    } finally {
      await transport.close();
      await client.close();
      await boundedHarness.handler.close();
    }
  });
});
