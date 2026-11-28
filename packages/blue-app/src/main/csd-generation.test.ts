import { describe, expect, it, vi } from 'vite-plus/test';
import {
  AddProcessor,
  AudioClip,
  BSBGroup,
  BSBKnob,
  BSBTextField,
  BlueData,
  BlueSynthBuilder,
  Channel,
  ClojureObject,
  Element,
  External,
  FrozenSoundObject,
  GenericInstrument,
  GenericScore,
  Instance,
  InstrumentLibrary,
  JMask,
  JavaScriptInstrument,
  JavaScriptObject,
  LiveObject,
  NoteProcessor,
  NoteList,
  ObjectBuilder,
  PatternLayer,
  PatternsLayerGroup,
  PianoNote,
  PianoRoll,
  PolyObject,
  PythonInstrument,
  PythonObject,
  PythonProcessor,
  SoundLayer,
  TimeBehavior,
  TimeDuration,
  TimePosition,
  TrackLayer,
  TrackLayerGroup,
  TuningProcessor,
  type JavaRuntimeClientContract,
  type JavaScriptSession,
} from '@blue/data';

import {
  generateDiskCsdForScreen,
  generateObservationOnlyDiskCsd,
  generateRealtimeCsdForScreen,
  preflightObservationOnlyDiskCsd,
} from './csd-generation';
import { McpBridge, McpConsoleTailBuffer, type McpAuthContext } from './mcp-bridge';
import { ProjectSession } from './project-session';

describe('screen CSD generation', () => {
  it('uses the disk profile for the ordinary Generate CSD to Screen action', async () => {
    const session = {} as JavaScriptSession;
    const toDiskCSD = vi.fn(() => 'disk-csd');
    const toDiskCSDAsync = vi.fn(async () => 'async-disk-csd');

    await expect(
      generateDiskCsdForScreen({ toDiskCSD, toDiskCSDAsync }, session, null),
    ).resolves.toBe('disk-csd');
    expect(toDiskCSD).toHaveBeenCalledWith(session, undefined);
    expect(toDiskCSDAsync).not.toHaveBeenCalled();
  });

  it('uses the Java runtime async disk profile when runtime evaluation is required', async () => {
    const session = {} as JavaScriptSession;
    const runtimeClient = {} as JavaRuntimeClientContract;
    const toDiskCSD = vi.fn(() => 'disk-csd');
    const toDiskCSDAsync = vi.fn(async () => 'java-runtime-disk-csd');

    await expect(
      generateDiskCsdForScreen({ toDiskCSD, toDiskCSDAsync }, session, runtimeClient),
    ).resolves.toBe('java-runtime-disk-csd');
    expect(toDiskCSDAsync).toHaveBeenCalledWith(session, runtimeClient, undefined);
    expect(toDiskCSD).not.toHaveBeenCalled();
  });

  it('uses the realtime profile for the Generate Realtime CSD to Screen action', async () => {
    const session = {} as JavaScriptSession;
    const toCSD = vi.fn(() => 'realtime-csd');
    const toCSDAsync = vi.fn(async () => 'async-realtime-csd');

    await expect(generateRealtimeCsdForScreen({ toCSD, toCSDAsync }, session, null)).resolves.toBe(
      'realtime-csd',
    );
    expect(toCSD).toHaveBeenCalledWith(session, undefined);
    expect(toCSDAsync).not.toHaveBeenCalled();
  });

  it('uses the Java runtime async realtime profile when runtime evaluation is required', async () => {
    const session = {} as JavaScriptSession;
    const runtimeClient = {} as JavaRuntimeClientContract;
    const toCSD = vi.fn(() => 'realtime-csd');
    const toCSDAsync = vi.fn(async () => 'java-runtime-realtime-csd');

    await expect(
      generateRealtimeCsdForScreen({ toCSD, toCSDAsync }, session, runtimeClient),
    ).resolves.toBe('java-runtime-realtime-csd');
    expect(toCSDAsync).toHaveBeenCalledWith(session, runtimeClient, undefined);
    expect(toCSD).not.toHaveBeenCalled();
  });

  it('keeps in-flight CSD output bound to the project that initiated it', async () => {
    let resolveOriginal!: (value: string) => void;
    const original = {
      toDiskCSD: vi.fn(() => 'original-sync'),
      toDiskCSDAsync: vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveOriginal = resolve;
          }),
      ),
    };
    const replacement = {
      toDiskCSD: vi.fn(() => 'replacement-sync'),
      toDiskCSDAsync: vi.fn(async () => 'replacement-async'),
    };
    const runtimeClient = {} as JavaRuntimeClientContract;

    const originalOutput = generateDiskCsdForScreen(original, undefined, runtimeClient);
    const replacementOutput = generateDiskCsdForScreen(replacement, undefined, runtimeClient);
    resolveOriginal('original-async');

    await expect(originalOutput).resolves.toBe('original-async');
    await expect(replacementOutput).resolves.toBe('replacement-async');
    expect(original.toDiskCSDAsync).toHaveBeenCalledOnce();
    expect(replacement.toDiskCSDAsync).toHaveBeenCalledOnce();
  });

  it('generates CSD output deterministically regardless of manual configuration', async () => {
    const session = {} as JavaScriptSession;
    const csdText =
      '<CsoundSynthesizer>\n<CsInstruments>\ninstr 1\n  a1 oscili 0.5, 440\nendin\n</CsInstruments>\n</CsoundSynthesizer>';
    const toCSD = vi.fn(() => csdText);
    const toCSDAsync = vi.fn(async () => csdText);

    const first = await generateRealtimeCsdForScreen({ toCSD, toCSDAsync }, session, null);
    const second = await generateRealtimeCsdForScreen({ toCSD, toCSDAsync }, session, null);

    expect(first).toBe(csdText);
    expect(second).toBe(csdText);
    expect(first).toBe(second);
  });

  it('forwards the detached layout manifest for screen CSD generation (T012, T015, T081)', async () => {
    const session = {} as JavaScriptSession;
    const runtimeClient = {} as JavaRuntimeClientContract;
    const manifest = { observations: new Map() } as any;

    const diskMock = {
      toDiskCSD: vi.fn(() => 'disk-sync'),
      toDiskCSDAsync: vi.fn(async () => 'disk-async'),
    };
    await generateDiskCsdForScreen(diskMock, session, null, manifest);
    expect(diskMock.toDiskCSD).toHaveBeenCalledWith(session, manifest);

    await generateDiskCsdForScreen(diskMock, session, runtimeClient, manifest);
    expect(diskMock.toDiskCSDAsync).toHaveBeenCalledWith(session, runtimeClient, manifest);

    const realtimeMock = {
      toCSD: vi.fn(() => 'rt-sync'),
      toCSDAsync: vi.fn(async () => 'rt-async'),
    };
    await generateRealtimeCsdForScreen(realtimeMock, session, null, manifest);
    expect(realtimeMock.toCSD).toHaveBeenCalledWith(session, manifest);

    await generateRealtimeCsdForScreen(realtimeMock, session, runtimeClient, manifest);
    expect(realtimeMock.toCSDAsync).toHaveBeenCalledWith(session, runtimeClient, manifest);
  });

  it('generates screen CSD with score pan law and boost across disk and realtime profiles (T018)', async () => {
    const data = new BlueData();
    data.getMixer().setPanningEnabled(true);
    data.getMixer().setPanLawDb(-6);
    data.getMixer().setPanOffCenterBoost(true);
    data.getMixer().setEnabled(true);

    const ch = new Channel();
    ch.setName('Track 1');
    ch.setPan(0.5);
    data.getMixer().getChannels().push(ch);

    const diskCsd = await generateDiskCsdForScreen(data, {} as JavaScriptSession, null);
    const rtCsd = await generateRealtimeCsdForScreen(data, {} as JavaScriptSession, null);

    expect(diskCsd).toContain('<CsoundSynthesizer>');
    expect(rtCsd).toContain('<CsoundSynthesizer>');
    expect(rtCsd).toContain('gk_blue_score_pan_law init -6');
    expect(rtCsd).toContain('gk_blue_score_pan_boost init 1');
    expect(rtCsd).toContain('if gk_blue_pan_mode_0 < 0.5 then');
    expect(rtCsd).toContain('k_pan_al = min(1, 2 * (1 - gk_blue_auto1))');
  });
});

function createEligibleProject(): BlueData {
  const data = new BlueData();
  data.getMixer().setPanningEnabled(false);
  data.getProjectProperties().title = 'Observation Eligible';
  data.getProjectProperties().author = 'Composer';

  const generic = new GenericInstrument();
  generic.setName('Sine');
  generic.setText('a1 oscili 0.2, 440\nouts a1, a1');
  data.getArrangement().addInstrument(generic, '1');

  const bsb = new BlueSynthBuilder();
  bsb.setName('BSB Pad');
  const frequency = new BSBTextField();
  frequency.objectName = 'frequency';
  frequency.textValue = '220';
  const gain = new BSBKnob();
  gain.objectName = 'gain';
  gain.value = 0.1;
  const controls = new BSBGroup();
  controls.addChild(frequency);
  controls.addChild(gain);
  bsb.getGraphicInterface().getRootGroup().addChild(controls);
  bsb.getParameters();
  bsb.setInstrumentText('a1 oscili <gain>, <frequency>\nouts a1, a1');
  data.getArrangement().addInstrument(bsb, '2');

  const libScore = new GenericScore();
  libScore.setName('Lib Phrase');
  libScore.setScoreText('i1 0 1 440');
  libScore.setSubjectiveDuration(TimeDuration.beats(2));
  data.getSoundObjectLibrary().addObject(libScore);

  const rootPoly = data.getScore()[0] as PolyObject;
  const layer = rootPoly[0]!;
  const scoreObj = new GenericScore();
  scoreObj.setName('Lead');
  scoreObj.setStartTime(TimePosition.beats(0));
  scoreObj.setSubjectiveDuration(TimeDuration.beats(4));
  scoreObj.setScoreText('i1 0 2 440 0.5');
  scoreObj.getNoteProcessorChain().addProcessor(new AddProcessor());
  layer.push(scoreObj);

  const instance = new Instance();
  instance.setSoundObject(libScore);
  instance.setStartTime(TimePosition.beats(4));
  instance.setSubjectiveDuration(TimeDuration.beats(2));
  layer.push(instance);

  const roll = new PianoRoll();
  roll.setStartTime(TimePosition.beats(6));
  roll.setSubjectiveDuration(TimeDuration.beats(2));
  const note = new PianoNote();
  note.setStart(0);
  note.setDuration(1);
  roll.getNotes().push(note);
  layer.push(roll);

  const tracks = new TrackLayerGroup();
  const track = new TrackLayer();
  const clip = new AudioClip();
  clip.setName('Clip');
  clip.setAudioFile('/tmp/nonexistent-without-panning.wav');
  track.push(clip);
  tracks.push(track);
  data.getScore().push(tracks);

  const patterns = new PatternsLayerGroup();
  const patternLayer = new PatternLayer();
  patterns.push(patternLayer);
  data.getScore().push(patterns);

  return data;
}

function createAuth(overrides: Partial<McpAuthContext> = {}): McpAuthContext {
  return {
    listenerGeneration: 1,
    credentialEpoch: 1,
    accessMode: 'read-only',
    action: 'read',
    signal: new AbortController().signal,
    isAuthorized: () => true,
    ...overrides,
  };
}

describe('observation-only disk CSD generation', () => {
  it('matches generateDiskCsdForScreen output on eligible projects without mutating canonical data', async () => {
    const data = createEligibleProject();
    const beforeXml = data.saveToString();

    expect(preflightObservationOnlyDiskCsd(data)).toEqual({ ok: true });

    const expected = await generateDiskCsdForScreen(data, undefined, null);
    expect(expected).toMatch(/a1 oscili gk_blue_auto\d+, 220/);
    const observed = await generateObservationOnlyDiskCsd(data);

    expect(observed).toEqual({
      ok: true,
      csd: expected,
      diagnostics: [],
    });
    expect(data.saveToString()).toBe(beforeXml);
  });

  it.each([
    'setInstrumentText',
    'setAlwaysOnInstrumentText',
    'setGlobalOrc',
    'setGlobalSco',
  ] as const)('budgets Blue Synth Builder source set by %s before copying', async (setSource) => {
    const data = new BlueData();
    const instrument = new BlueSynthBuilder();
    data.getArrangement().addInstrument(instrument, '1');
    instrument[setSource]('é'.repeat(400));
    const copy = vi.spyOn(data, 'historyCopy');

    await expect(
      generateObservationOnlyDiskCsd(data, { budget: { maxEstimatedInputBytes: 512 } }),
    ).resolves.toMatchObject({ ok: false, code: 'RESPONSE_TOO_LARGE' });
    expect(copy).not.toHaveBeenCalled();
  });

  it('budgets Blue Synth Builder widgets in the copied project library', async () => {
    const data = new BlueData();
    const library = new InstrumentLibrary();
    const instrument = new BlueSynthBuilder();
    const field = new BSBTextField();
    field.textValue = 'x'.repeat(1024);
    instrument.getGraphicInterface().getRootGroup().addChild(field);
    library.getRootCategory().addInstrument(instrument);
    data.setInstrumentLibrary(library);
    const copy = vi.spyOn(data, 'historyCopy');

    await expect(
      generateObservationOnlyDiskCsd(data, { budget: { maxEstimatedInputBytes: 512 } }),
    ).resolves.toMatchObject({ ok: false, code: 'RESPONSE_TOO_LARGE' });
    expect(copy).not.toHaveBeenCalled();
  });

  it.each([
    ['large literal expansion', 'x'.repeat(200), 'RESPONSE_TOO_LARGE'],
    ['recursive expansion', '<value><value>', 'UNSUPPORTED_CONTENT'],
    ['context-dependent expansion', "$'", 'UNSUPPORTED_CONTENT'],
  ])('rejects Blue Synth Builder %s before copying', async (_label, value, code) => {
    const data = new BlueData();
    const instrument = new BlueSynthBuilder();
    const field = new BSBTextField();
    field.objectName = 'value';
    field.textValue = value;
    instrument.getGraphicInterface().getRootGroup().addChild(field);
    instrument.setInstrumentText('<value>'.repeat(12));
    data.getArrangement().addInstrument(instrument, '1');
    const copy = vi.spyOn(data, 'historyCopy');

    await expect(
      generateObservationOnlyDiskCsd(data, { budget: { maxEstimatedInputBytes: 512 } }),
    ).resolves.toMatchObject({ ok: false, code });
    expect(copy).not.toHaveBeenCalled();
  });

  it('budgets score lines introduced by Blue Synth Builder replacement text', async () => {
    const data = new BlueData();
    const instrument = new BlueSynthBuilder();
    const field = new BSBTextField();
    field.objectName = 'events';
    field.textValue = 'i1 0 1\n'.repeat(12);
    instrument.getGraphicInterface().getRootGroup().addChild(field);
    instrument.setGlobalSco('<events>\n'.repeat(8));
    data.getArrangement().addInstrument(instrument, '1');
    const copy = vi.spyOn(data, 'historyCopy');

    await expect(
      generateObservationOnlyDiskCsd(data, { budget: { maxEstimatedScoreEvents: 64 } }),
    ).resolves.toMatchObject({ ok: false, code: 'RESPONSE_TOO_LARGE' });
    expect(copy).not.toHaveBeenCalled();
  });

  it.each(['widgets', 'points'] as const)(
    'budgets Blue Synth Builder %s before materializing the detached project',
    async (collection) => {
      const data = new BlueData();
      const instrument = new BlueSynthBuilder();
      const root = instrument.getGraphicInterface().getRootGroup();
      if (collection === 'widgets') {
        for (let index = 0; index < 40; index++) root.addChild(new BSBTextField());
      } else {
        const knob = new BSBKnob();
        knob.objectName = 'gain';
        root.addChild(knob);
        instrument
          .getParameters()[0]!
          .setPoints(Array.from({ length: 40 }, (_, time) => ({ time, value: 0.5 })));
      }
      data.getArrangement().addInstrument(instrument, '1');
      const copy = vi.spyOn(data, 'historyCopy');
      const children = vi.spyOn(root, 'getChildren');
      const sync = vi.spyOn(instrument, 'getParameters');

      await expect(
        generateObservationOnlyDiskCsd(data, { budget: { maxTraversalNodes: 32 } }),
      ).resolves.toMatchObject({ ok: false, code: 'RESPONSE_TOO_LARGE' });
      expect(copy).not.toHaveBeenCalled();
      expect(sync).not.toHaveBeenCalled();
      if (collection === 'widgets') expect(children).not.toHaveBeenCalled();
    },
  );

  it('denies with EXECUTION_REQUIRED before any on-load hook or interpreter runs', async () => {
    const cases: Array<{ name: string; build: () => BlueData; spy?: ReturnType<typeof vi.fn> }> = [
      {
        name: 'PythonInstrument in arrangement',
        build: () => {
          const data = new BlueData();
          data.getArrangement().addInstrument(new PythonInstrument(), '1');
          return data;
        },
      },
      {
        name: 'JavaScriptInstrument in track',
        build: () => {
          const data = new BlueData();
          const group = new TrackLayerGroup();
          const track = new TrackLayer();
          track.setInstrument(new JavaScriptInstrument());
          group.push(track);
          data.getScore().push(group);
          return data;
        },
      },
      {
        name: 'PythonObject in nested PolyObject',
        build: () => {
          const data = new BlueData();
          const root = data.getScore()[0] as PolyObject;
          const nested = new PolyObject();
          const subLayer = new SoundLayer();
          subLayer.push(new PythonObject());
          nested.push(subLayer);
          root[0]!.push(nested);
          return data;
        },
      },
      {
        name: 'JavaScriptObject with on-load processing in Score',
        build: () => {
          const data = new BlueData();
          const jsObj = new JavaScriptObject();
          jsObj.setOnLoadProcessable(true);
          jsObj.setJavaScriptCode('throw new Error("should never execute");');
          (data.getScore()[0] as PolyObject)[0]!.push(jsObj);
          return data;
        },
      },
      {
        name: 'ClojureObject in SoundObjectLibrary via Instance',
        build: () => {
          const data = new BlueData();
          const clj = new ClojureObject();
          data.getSoundObjectLibrary().addObject(clj);
          const instance = new Instance();
          instance.setSoundObject(clj);
          (data.getScore()[0] as PolyObject)[0]!.push(instance);
          return data;
        },
      },
      {
        name: 'External inside FrozenSoundObject',
        build: () => {
          const data = new BlueData();
          const frozen = new FrozenSoundObject();
          frozen.setFrozenSoundObject(new External());
          (data.getScore()[0] as PolyObject)[0]!.push(frozen);
          return data;
        },
      },
      {
        name: 'ObjectBuilder in PatternsLayerGroup',
        build: () => {
          const data = new BlueData();
          const patterns = new PatternsLayerGroup();
          const pl = new PatternLayer();
          pl.setSoundObject(new ObjectBuilder());
          patterns.push(pl);
          data.getScore().push(patterns);
          return data;
        },
      },
      {
        name: 'PythonProcessor in Score NoteProcessorChain',
        build: () => {
          const data = new BlueData();
          data.getScore().getNoteProcessorChain().addProcessor(new PythonProcessor());
          return data;
        },
      },
      {
        name: 'On-load processable object in LiveData',
        build: () => {
          const data = new BlueData();
          const obj = new GenericScore();
          const onLoadSpy = vi.fn();
          Object.assign(obj, {
            isOnLoadProcessable: () => true,
            processOnLoad: onLoadSpy,
          });
          const liveObj = new LiveObject();
          liveObj.setSoundObject(obj);
          data.getLiveData().getLiveObjectBins().setLiveObject(0, 0, liveObj);
          return data;
        },
      },
    ];

    for (const testCase of cases) {
      const data = testCase.build();
      const result = await generateObservationOnlyDiskCsd(data);
      expect(result.ok, testCase.name).toBe(false);
      if (!result.ok) {
        expect(result.code, testCase.name).toBe('EXECUTION_REQUIRED');
      }
    }

    const onLoadHookSpy = vi.fn();
    const guarded = new BlueData();
    const customOnLoad = new GenericScore();
    Object.assign(customOnLoad, {
      isOnLoadProcessable: () => true,
      processOnLoad: onLoadHookSpy,
    });
    (guarded.getScore()[0] as PolyObject)[0]!.push(customOnLoad);

    const refused = await generateObservationOnlyDiskCsd(guarded);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.code).toBe('EXECUTION_REQUIRED');
    }
    expect(onLoadHookSpy).not.toHaveBeenCalled();
  });

  it('denies with UNSUPPORTED_CONTENT for external TuningProcessor scales, UnsupportedProcessor, and panning AudioClips', async () => {
    // 1. TuningProcessor with external scaleReference
    const tuningData = new BlueData();
    const scoreObj = new GenericScore();
    const tuningElem = Element.parse(
      '<noteProcessor type="blue.noteProcessor.TuningProcessor"><pfield>4</pfield><scale>missing-scale.scl</scale></noteProcessor>',
    );
    scoreObj.getNoteProcessorChain().addProcessor(TuningProcessor.loadFromXML(tuningElem));
    (tuningData.getScore()[0] as PolyObject)[0]!.push(scoreObj);

    const tuningResult = await generateObservationOnlyDiskCsd(tuningData);
    expect(tuningResult.ok).toBe(false);
    if (!tuningResult.ok) {
      expect(tuningResult.code).toBe('UNSUPPORTED_CONTENT');
    }

    // 2. UnsupportedProcessor on a layer NoteProcessorChain
    class UnsupportedProcessor extends NoteProcessor {
      override process(notes: NoteList): NoteList {
        return notes;
      }
      override getDisplayName(): string {
        return 'Unsupported';
      }
      override deepCopy(): NoteProcessor {
        return new UnsupportedProcessor();
      }
      override saveAsXML(): Element {
        return new Element('noteProcessor');
      }
    }
    const unsupportedData = new BlueData();
    (unsupportedData.getScore()[0] as PolyObject)[0]!
      .getNoteProcessorChain()
      .addProcessor(new UnsupportedProcessor());

    const unsupportedResult = await generateObservationOnlyDiskCsd(unsupportedData);
    expect(unsupportedResult.ok).toBe(false);
    if (!unsupportedResult.ok) {
      expect(unsupportedResult.code).toBe('UNSUPPORTED_CONTENT');
    }

    // 3. mixer.isPanningEnabled() with AudioClip
    const panningData = new BlueData();
    panningData.getMixer().setPanningEnabled(true);
    const tracks = new TrackLayerGroup();
    const track = new TrackLayer();
    const clip = new AudioClip();
    clip.setAudioFile('/tmp/unreadable-audio.wav');
    track.push(clip);
    tracks.push(track);
    panningData.getScore().push(tracks);

    const panningResult = await generateObservationOnlyDiskCsd(panningData);
    expect(panningResult.ok).toBe(false);
    if (!panningResult.ok) {
      expect(panningResult.code).toBe('UNSUPPORTED_CONTENT');
    }
  });

  it('discards late CSD results when the project is replaced or its revision changes mid-flight', async () => {
    const session = new ProjectSession();
    session.replace(createEligibleProject(), '/tmp/first.blue');

    let resolveGeneration!: (value: { ok: true; csd: string; diagnostics: string[] }) => void;
    const bridge = new McpBridge({
      readSession: () => session.read(),
      getSaveState: () => 'saved',
      isDirty: () => false,
      getEngineStatus: () => ({
        connected: false,
        available: false,
        playbackState: 'stopped',
        activeDocumentId: null,
        consoleTail: [],
      }),
      generateObservationCsd: () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        }),
    });

    // Case 1: Revision changes while async generation is in flight
    const inFlightRevision = bridge.generateCsd(createAuth());
    session.recordMutation({ changed: true });
    resolveGeneration({ ok: true, csd: 'stale-csd', diagnostics: [] });

    await expect(inFlightRevision).resolves.toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });

    // Case 2: Project replacement while async generation is in flight
    const inFlightReplace = bridge.generateCsd(createAuth());
    session.replace(createEligibleProject(), '/tmp/second.blue');
    resolveGeneration({ ok: true, csd: 'stale-replaced-csd', diagnostics: [] });

    await expect(inFlightReplace).resolves.toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });

    // Case 3: Authorization revoked while async generation is in flight
    let authorized = true;
    const inFlightRevoked = bridge.generateCsd(createAuth({ isAuthorized: () => authorized }));
    authorized = false;
    resolveGeneration({ ok: true, csd: 'revoked-csd', diagnostics: [] });

    await expect(inFlightRevoked).resolves.toMatchObject({
      ok: false,
      code: 'ACCESS_DENIED',
    });
  });

  it('bounds McpConsoleTailBuffer by line count and byte limit', () => {
    const buffer = new McpConsoleTailBuffer(3, 20);
    buffer.append('alpha\nbeta\ngamma\ndelta\n', 'stdout');
    expect(buffer.read().map((e) => e.text)).toEqual(['beta', 'gamma', 'delta']);

    buffer.append('12345678901234567', 'stderr');
    expect(buffer.read()).toEqual([{ text: '12345678901234567', type: 'stderr' }]);

    buffer.clear();
    expect(buffer.read()).toEqual([]);
  });

  it('counts each shared instance expansion before copying the project', async () => {
    const data = new BlueData();
    const source = new GenericScore();
    source.setScoreText('i1 0 1\n'.repeat(10));
    const layer = (data.getScore()[0] as PolyObject)[0]!;
    for (let index = 0; index < 6; index++) {
      const instance = new Instance();
      instance.setSoundObject(source);
      layer.push(instance);
    }
    const copy = vi.spyOn(data, 'historyCopy');
    await expect(
      generateObservationOnlyDiskCsd(data, { budget: { maxEstimatedScoreEvents: 50 } }),
    ).resolves.toMatchObject({ ok: false, code: 'RESPONSE_TOO_LARGE' });
    expect(copy).not.toHaveBeenCalled();
  });

  it.each([TimeBehavior.REPEAT, TimeBehavior.REPEAT_CLASSIC])(
    'bounds explicit periods and refuses unproven derived periods for %s',
    async (behavior) => {
      const data = new BlueData();
      const score = new GenericScore();
      score.setScoreText('i1 0 0.000001');
      score.setSubjectiveDuration(TimeDuration.beats(1));
      score.setTimeBehavior(behavior);
      (data.getScore()[0] as PolyObject)[0]!.push(score);
      const copy = vi.spyOn(data, 'historyCopy');
      await expect(generateObservationOnlyDiskCsd(data)).resolves.toMatchObject({
        ok: false,
        code: 'UNSUPPORTED_CONTENT',
      });
      score.setRepeatPoint(TimeDuration.beats(0.000001));
      await expect(generateObservationOnlyDiskCsd(data)).resolves.toMatchObject({
        ok: false,
        code: 'RESPONSE_TOO_LARGE',
      });
      expect(copy).not.toHaveBeenCalled();
    },
  );

  it('refuses data-driven JMask generation before copying or generating notes', async () => {
    const data = new BlueData();
    const mask = new JMask();
    (data.getScore()[0] as PolyObject)[0]!.push(mask);
    const copy = vi.spyOn(data, 'historyCopy');
    const generate = vi.spyOn(mask, 'generateForCSD');
    await expect(generateObservationOnlyDiskCsd(data)).resolves.toMatchObject({
      ok: false,
      code: 'UNSUPPORTED_CONTENT',
    });
    expect(copy).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it('bounds observation-only CSD generation before calling historyCopy or toDiskCSD (T065)', async () => {
    // 1. Deeply nested PolyObject (>32 depth) rejects with RESPONSE_TOO_LARGE before copying
    const deepData = new BlueData();
    let current = deepData.getScore()[0] as PolyObject;
    for (let depth = 0; depth < 35; depth++) {
      const child = new PolyObject();
      child.setName(`Nested ${depth}`);
      child.push(new SoundLayer());
      current[0]!.push(child);
      current = child;
    }
    const deepCopySpy = vi.spyOn(deepData, 'historyCopy');
    const deepCsdSpy = vi.spyOn(deepData, 'toDiskCSD');
    const deepResult = await generateObservationOnlyDiskCsd(deepData);
    expect(deepResult).toMatchObject({ ok: false, code: 'RESPONSE_TOO_LARGE' });
    expect(deepCopySpy).not.toHaveBeenCalled();
    expect(deepCsdSpy).not.toHaveBeenCalled();

    // 2. Oversized GenericScore with TimeBehavior.REPEAT expansion rejects before copying
    const repeatData = new BlueData();
    const repeatingScore = new GenericScore();
    repeatingScore.setStartTime(TimePosition.beats(0));
    repeatingScore.setSubjectiveDuration(TimeDuration.beats(10_000));
    repeatingScore.setTimeBehavior(TimeBehavior.REPEAT);
    repeatingScore.setRepeatPoint(TimeDuration.beats(1));
    repeatingScore.setScoreText('i1 0 1 440\ni1 0.5 0.5 880');
    (repeatData.getScore()[0] as PolyObject)[0]!.push(repeatingScore);

    const repeatCopySpy = vi.spyOn(repeatData, 'historyCopy');
    const repeatCsdSpy = vi.spyOn(repeatData, 'toDiskCSD');
    const repeatResult = await generateObservationOnlyDiskCsd(repeatData, {
      budget: { maxEstimatedScoreEvents: 500, maxEstimatedInputBytes: 4096 },
    });
    expect(repeatResult).toMatchObject({ ok: false, code: 'RESPONSE_TOO_LARGE' });
    expect(repeatCopySpy).not.toHaveBeenCalled();
    expect(repeatCsdSpy).not.toHaveBeenCalled();

    // 3. Eligible fixture succeeds with at most one historyCopy (zero duplicate copy)
    const session = new ProjectSession();
    session.replace(createEligibleProject(), '/tmp/bounded-ok.blue');
    const activeData = session.read().data!;
    const okCopySpy = vi.spyOn(activeData, 'historyCopy');
    const bridge = new McpBridge({
      readSession: () => session.read(),
      getSaveState: () => 'saved',
      isDirty: () => false,
      getEngineStatus: () => ({
        connected: false,
        available: false,
        playbackState: 'stopped',
        activeDocumentId: null,
        consoleTail: [],
      }),
    });

    const okRes = await bridge.generateCsd(createAuth());
    expect(okRes.ok).toBe(true);
    expect(okCopySpy).toHaveBeenCalledTimes(1);
  });
});
