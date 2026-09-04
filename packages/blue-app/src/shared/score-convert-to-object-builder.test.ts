import { describe, expect, it } from 'vitest';
import {
  AddProcessor,
  BlueData,
  CompileData,
  Element,
  External,
  GenericScore,
  getExternalCommandExecutor,
  NoteProcessorChain,
  ObjectBuilder,
  PolyObject,
  PythonObject,
  setExternalCommandExecutor,
  TimeBehavior,
  TimeDuration,
  TimePosition,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createScoreDocumentSnapshot,
  type ScoreObjectEditorTargetSnapshot,
} from './project-editor';

/**
 * Builds a PolyObject-rooted score with a single layer holding `sObj` and
 * returns an editor target pointing at it.
 */
function buildTimelineData(sObj: PythonObject | External | GenericScore): {
  data: BlueData;
  target: ScoreObjectEditorTargetSnapshot;
} {
  const data = new BlueData();
  const rootGroup = data.getScore()[0];
  if (!(rootGroup instanceof PolyObject)) {
    throw new Error('Expected root score group to be PolyObject');
  }
  const rootLayer = rootGroup[0]!;
  rootLayer.push(sObj);

  const target: ScoreObjectEditorTargetSnapshot = {
    selectionId: 'sobj-0-0',
    selectedObjectType: sObj.constructor.name,
    editorObjectType: sObj.constructor.name,
    ownerKind: 'timeline',
    displayContext: 'timeline',
    location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
    supportsTimeBehavior: true,
    supportsRepeatPoint: true,
    supportsNoteProcessorChain: true,
  };

  return { data, target };
}

function noteProcessorChainWithValue(val: string): NoteProcessorChain {
  const chain = new NoteProcessorChain();
  const add = new AddProcessor();
  add.setVal(val);
  chain.addProcessor(add);
  return chain;
}

describe('convertScoreObjectToObjectBuilder patch', () => {
  it('converts a PythonObject, copying code and shared properties', () => {
    const python = new PythonObject();
    python.setName('My Python');
    python.setPythonCode('score = "i1 0 2 440"');
    python.setStartTime(TimePosition.beats(3));
    python.setSubjectiveDuration(TimeDuration.beats(5));
    python.setBackgroundColor(0x112233);
    python.setTimeBehavior(TimeBehavior.SCALE);
    python.setNoteProcessorChain(noteProcessorChainWithValue('7'));

    const { data, target } = buildTimelineData(python);

    const result = applyProjectDocumentPatch(data, {
      score: { type: 'convertScoreObjectToObjectBuilder', target },
    });

    expect(result).toBe(true);
    const layer = (data.getScore()[0] as PolyObject)[0]!;
    expect(layer).toHaveLength(1);
    const converted = layer[0]!;
    expect(converted).toBeInstanceOf(ObjectBuilder);

    const builder = converted as ObjectBuilder;
    // Java copies: name, npc, timeBehavior, startTime, subjectiveDuration, color, code.
    expect(builder.getName()).toBe('My Python');
    expect(builder.getCode()).toBe('score = "i1 0 2 440"');
    expect(builder.getStartTime().toBeats(data.getScore().getTimeContext())).toBe(3);
    expect(builder.getSubjectiveDuration().toBeats(data.getScore().getTimeContext())).toBe(5);
    expect(builder.getBackgroundColor()).toBe(0x112233);
    expect(builder.getTimeBehavior()).toBe(TimeBehavior.SCALE);
    expect(builder.getNoteProcessorChain().getProcessors()).toHaveLength(1);
    // languageType defaults to PYTHON for a PythonObject source.
    expect(builder.getLanguageType()).toBe('PYTHON');
    // The PythonObject's onLoadProcessable flag has no ObjectBuilder equivalent.
    // commandLine stays at its constructor default.
    expect(builder.getCommandLine()).toBe('');
  });

  it('converts an External, copying code, command line, and setting EXTERNAL language', () => {
    const external = new External();
    external.setName('My External');
    external.setText('print("hello")');
    external.setCommandLine('python3 #{file}');
    external.setStartTime(TimePosition.beats(1.5));
    external.setSubjectiveDuration(TimeDuration.beats(2.5));
    external.setBackgroundColor(0x445566);
    external.setNoteProcessorChain(noteProcessorChainWithValue('3'));

    const { data, target } = buildTimelineData(external);

    const result = applyProjectDocumentPatch(data, {
      score: { type: 'convertScoreObjectToObjectBuilder', target },
    });

    expect(result).toBe(true);
    const layer = (data.getScore()[0] as PolyObject)[0]!;
    const builder = layer[0] as ObjectBuilder;
    expect(builder).toBeInstanceOf(ObjectBuilder);
    expect(builder.getName()).toBe('My External');
    expect(builder.getCode()).toBe('print("hello")');
    expect(builder.getCommandLine()).toBe('python3 #{file}');
    expect(builder.getLanguageType()).toBe('EXTERNAL');
    expect(builder.getBackgroundColor()).toBe(0x445566);
    expect(builder.getNoteProcessorChain().getProcessors()).toHaveLength(1);
  });

  it('removes the source and appends the builder like Java Blue', () => {
    const python = new PythonObject();
    python.setPythonCode('score = "i1 0 1"');
    const { data, target } = buildTimelineData(python);
    // Java's action calls remove(source) and add(builder), which places the
    // converted object after existing equal-start objects.
    const other = new GenericScore();
    other.setScoreText('i2 0 1');
    (data.getScore()[0] as PolyObject)[0]!.push(other);

    applyProjectDocumentPatch(data, {
      score: { type: 'convertScoreObjectToObjectBuilder', target },
    });

    const layer = (data.getScore()[0] as PolyObject)[0]!;
    expect(layer).toHaveLength(2);
    expect(layer[0]).toBe(other);
    expect(layer[1]).toBeInstanceOf(ObjectBuilder);
  });

  it('deep-copies the note processor chain so later edits stay independent', () => {
    const python = new PythonObject();
    python.setNoteProcessorChain(noteProcessorChainWithValue('1'));
    const { data, target } = buildTimelineData(python);

    applyProjectDocumentPatch(data, {
      score: { type: 'convertScoreObjectToObjectBuilder', target },
    });

    const builder = (data.getScore()[0] as PolyObject)[0][0] as ObjectBuilder;
    builder.getNoteProcessorChain().clear();

    expect(builder.getNoteProcessorChain().getProcessors()).toHaveLength(0);
    expect(python.getNoteProcessorChain().getProcessors()).toHaveLength(1);
  });

  it('preserves the stable renderer selection identity', () => {
    const python = new PythonObject();
    const { data } = buildTimelineData(python);
    const before = createScoreDocumentSnapshot(data).layerGroups[0]!.layers[0]!.items[0]!;

    applyProjectDocumentPatch(data, {
      score: { type: 'convertScoreObjectToObjectBuilder', target: before.editorTarget },
    });

    const after = createScoreDocumentSnapshot(data).layerGroups[0]!.layers[0]!.items[0]!;
    expect(after.objectId).toBe(before.objectId);
    expect(after.objectType).toBe('ObjectBuilder');
  });

  it('keeps a converted External executable as an EXTERNAL ObjectBuilder', () => {
    const previousExecutor = getExternalCommandExecutor();
    const external = new External();
    external.setText('source text');
    external.setCommandLine('score-generator');
    const { data, target } = buildTimelineData(external);

    setExternalCommandExecutor({
      execute(commandLine, textBody) {
        expect(commandLine).toBe('score-generator');
        expect(textBody).toBe('source text');
        return 'i4 0 1 550';
      },
    });

    try {
      applyProjectDocumentPatch(data, {
        score: { type: 'convertScoreObjectToObjectBuilder', target },
      });

      const builder = (data.getScore()[0] as PolyObject)[0][0] as ObjectBuilder;
      const notes = builder.generateForCSD(
        data.getScore().getTimeContext(),
        CompileData.createEmptyCompileData(),
        0,
        -1,
      );

      expect(notes).toHaveLength(1);
      expect(notes.getNote(0).getPField(1)).toBe('4');
    } finally {
      setExternalCommandExecutor(previousExecutor);
    }
  });

  it('returns false for an unsupported source type (GenericScore)', () => {
    const score = new GenericScore();
    score.setScoreText('i1 0 1');
    const { data, target } = buildTimelineData(score);

    const result = applyProjectDocumentPatch(data, {
      score: { type: 'convertScoreObjectToObjectBuilder', target },
    });

    expect(result).toBe(false);
    expect((data.getScore()[0] as PolyObject)[0][0]).toBe(score);
  });

  it('returns false when the target location does not resolve', () => {
    const python = new PythonObject();
    const { data, target } = buildTimelineData(python);
    target.location = {
      rootGroupIndex: 9,
      containerPath: [],
      layerIndex: 0,
      objectIndex: 0,
    };

    const result = applyProjectDocumentPatch(data, {
      score: { type: 'convertScoreObjectToObjectBuilder', target },
    });

    expect(result).toBe(false);
  });

  it('round-trips the converted ObjectBuilder through XML', () => {
    const external = new External();
    external.setName('Round Trip');
    external.setText('body code');
    external.setCommandLine('cmd');
    const { data, target } = buildTimelineData(external);

    applyProjectDocumentPatch(data, {
      score: { type: 'convertScoreObjectToObjectBuilder', target },
    });

    const builder = (data.getScore()[0] as PolyObject)[0][0] as ObjectBuilder;
    const xml = builder.saveAsXML().toXml();

    // Reload from the serialized XML and verify the converted fields survive.
    const reloaded = ObjectBuilder.loadFromXML(Element.parse(xml));

    expect(reloaded.getName()).toBe('Round Trip');
    expect(reloaded.getCode()).toBe('body code');
    expect(reloaded.getCommandLine()).toBe('cmd');
    expect(reloaded.getLanguageType()).toBe('EXTERNAL');
  });
});
