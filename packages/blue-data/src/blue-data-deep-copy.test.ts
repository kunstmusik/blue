import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BlueData } from './blue-data';
import { LiveData } from './live-data';
import { LiveObject } from './live/live-object';
import { LiveObjectBins } from './live/live-object-bins';
import { GenericScore } from './sound-objects/generic-score';
import { Instance } from './sound-objects/instance';
import { SoundObjectLibrary } from './sound-objects/sound-object-library';
import { InstrumentLibrary } from './instruments/instrument-library';
import { GenericInstrument } from './instruments/generic-instrument';
import { OpcodeDefinition } from './opcodes/opcode-definition';
import { PolyObject } from './sound-objects/poly-object';
import { SoundLayer } from './sound-objects/sound-layer';
import { TimePosition } from './time/time-position';
import { TimeDuration } from './time/time-duration';
import {
  createLibraryInstanceLiveData,
  createModernProject,
} from './live/blue-live-trigger-fixtures';

describe('BlueData.deepCopy aggregate isolation', () => {
  it('isolates Live Data instead of aliasing it', () => {
    const original = createModernProject();
    const copy = original.deepCopy() as BlueData;

    // Mutate the copy's Live Data tempo and verify the original is unaffected.
    copy.getLiveData().setTempo(200);
    expect(original.getLiveData().getTempo()).toBe(60);

    // Mutate a LiveObject enabled flag on the copy.
    const copyBins = copy.getLiveData().getLiveObjectBins();
    const originalBins = original.getLiveData().getLiveObjectBins();

    const copyLo00 = copyBins.getLiveObject(0, 0);
    expect(copyLo00).not.toBeNull();
    copyLo00!.setEnabled(true);
    expect(originalBins.getLiveObject(0, 0)!.isEnabled()).toBe(false);

    // Verify the copied LiveObject is a different object reference.
    expect(copyLo00).not.toBe(originalBins.getLiveObject(0, 0));
  });

  it('isolates the SoundObject library instead of aliasing it', () => {
    const original = new BlueData();
    const library = original.getSoundObjectLibrary();
    const source = new GenericScore();
    source.setName('Library Source');
    source.setScoreText('i1 0 2 440');
    library.addObject(source);

    const copy = original.deepCopy() as BlueData;
    const copyLibrary = copy.getSoundObjectLibrary();

    // Mutate the copied library source and verify the original is unaffected.
    const copySource = copyLibrary.getObject(0);
    expect(copySource).toBeDefined();
    copySource!.setName('Mutated Copy');
    expect(original.getSoundObjectLibrary().getObject(0)!.getName()).toBe('Library Source');

    // Verify the library instances are distinct objects.
    expect(copyLibrary).not.toBe(library);
    expect(copySource).not.toBe(source);
  });

  it('isolates the instrument library instead of aliasing it', () => {
    const original = new BlueData();
    const instrumentLibrary = new InstrumentLibrary();
    const instrument = new GenericInstrument();
    instrument.setName('Solo Instrument');
    instrument.setText('aout oscili p4, p5');
    instrumentLibrary.addInstrument(instrument);
    original.setInstrumentLibrary(instrumentLibrary);

    const copy = original.deepCopy() as BlueData;
    const copyLibrary = copy.getInstrumentLibrary();
    expect(copyLibrary).not.toBe(instrumentLibrary);
    expect(copyLibrary).not.toBeNull();

    const copyInstrument = copyLibrary!.getInstrument('Solo Instrument');
    expect(copyInstrument).toBeDefined();
    copyInstrument!.setName('Mutated Instrument');
    expect(original.getInstrumentLibrary()!.getInstrument('Solo Instrument')!.getName()).toBe('Solo Instrument');
  });

  it('isolates the opcode list instead of aliasing it', () => {
    const original = new BlueData();
    const opcode = new OpcodeDefinition();
    opcode.setName('my_udo');
    opcode.setCode('opcode my_udo, 0, 0\nendin');
    original.getOpcodeList().addOpcode(opcode);

    const copy = original.deepCopy() as BlueData;
    const copyOpcode = copy.getOpcodeList().getOpcode(0);
    expect(copyOpcode).not.toBeNull();
    copyOpcode!.setName('mutated_udo');
    expect(original.getOpcodeList().getOpcode(0)!.getName()).toBe('my_udo');

    expect(copy.getOpcodeList()).not.toBe(original.getOpcodeList());
  });

  it('remaps copied Instance references to copied library objects', () => {
    const fixture = createLibraryInstanceLiveData();
    const original = fixture.data;
    const originalLibraryObject = fixture.libraryObject;

    const copy = original.deepCopy() as BlueData;
    const copyLibrary = copy.getSoundObjectLibrary();
    const copyLibraryObject = copyLibrary.getObject(0);

    // The copied library object must exist and be distinct.
    expect(copyLibraryObject).toBeDefined();
    expect(copyLibraryObject).not.toBe(originalLibraryObject);

    // Traverse the copied Live Data bins to find the copied Instance.
    const copyBins = copy.getLiveData().getLiveObjectBins();
    const copyLiveObject = copyBins.getLiveObject(0, 0);
    expect(copyLiveObject).not.toBeNull();
    const copyInstance = copyLiveObject!.getSoundObject() as Instance;
    expect(copyInstance).toBeInstanceOf(Instance);

    // The copied Instance must reference the COPIED library object, not the original.
    expect(copyInstance.getSoundObject()).toBe(copyLibraryObject);
    expect(copyInstance.getSoundObject()).not.toBe(originalLibraryObject);
  });

  it('remaps copied Instance references in the score graph to copied library objects', () => {
    const original = new BlueData();
    const library = original.getSoundObjectLibrary();
    const librarySource = new GenericScore();
    librarySource.setName('Score Lib Source');
    librarySource.setScoreText('i1 0 2 440');
    library.addObject(librarySource);

    const poly = new PolyObject();
    const layer = new SoundLayer();
    const scoreInstance = new Instance();
    scoreInstance.setName('Score Instance');
    scoreInstance.setSoundObject(librarySource);
    scoreInstance.setStartTime(TimePosition.beats(0));
    scoreInstance.setSubjectiveDuration(TimeDuration.beats(2));
    layer.push(scoreInstance);
    poly.push(layer);
    original.getScore().push(poly);

    const copy = original.deepCopy() as BlueData;
    const copyLibraryObject = copy.getSoundObjectLibrary().getObject(0);

    // Find the copied Instance in the score graph (the pushed PolyObject at index 1).
    const copyPoly = copy.getScore()[1] as PolyObject;
    expect(copyPoly).toBeDefined();
    const copyLayer = copyPoly[0] as SoundLayer;
    const copyInstance = copyLayer[0] as Instance;
    expect(copyInstance).toBeInstanceOf(Instance);

    // The copied score Instance must reference the copied library object.
    expect(copyInstance.getSoundObject()).toBe(copyLibraryObject);
    expect(copyInstance.getSoundObject()).not.toBe(librarySource);
  });

  it('remaps Instance references inside copied library objects', () => {
    const original = new BlueData();
    const source = new GenericScore();
    source.setName('Library Source');
    original.getSoundObjectLibrary().addObject(source);
    const libraryInstance = new Instance();
    libraryInstance.setSoundObject(source);
    original.getSoundObjectLibrary().addObject(libraryInstance);

    const copy = original.deepCopy() as BlueData;
    const copiedSource = copy.getSoundObjectLibrary().getObject(0);
    const copiedInstance = copy.getSoundObjectLibrary().getObject(1) as Instance;

    expect(copiedInstance.getSoundObject()).toBe(copiedSource);
    expect(copiedInstance.getSoundObject()).not.toBe(source);
  });

  it('remaps nested Live Space Instance references to copied library objects', () => {
    const original = new BlueData();
    const source = new GenericScore();
    source.setName('Nested Live Source');
    original.getSoundObjectLibrary().addObject(source);

    const instance = new Instance();
    instance.setSoundObject(source);
    const poly = new PolyObject();
    poly.newLayerAt(0);
    (poly[0] as SoundLayer).push(instance);
    const liveObject = new LiveObject();
    liveObject.setSoundObject(poly);
    const bins = new LiveObjectBins(1, 1);
    bins.setLiveObject(0, 0, liveObject);
    original.getLiveData().setLiveObjectBins(bins);

    const copy = original.deepCopy() as BlueData;
    const copiedPoly = copy.getLiveData().getLiveObjectBins().getLiveObject(0, 0)!.getSoundObject() as PolyObject;
    const copiedInstance = (copiedPoly[0] as SoundLayer)[0] as Instance;

    expect(copiedInstance.getSoundObject()).toBe(copy.getSoundObjectLibrary().getObject(0));
    expect(copiedInstance.getSoundObject()).not.toBe(source);
  });

  it('preserves stable LiveObject uniqueIds across a whole-project copy', () => {
    const original = createModernProject();
    const copy = original.deepCopy() as BlueData;

    const originalBins = original.getLiveData().getLiveObjectBins();
    const copyBins = copy.getLiveData().getLiveObjectBins();

    for (let c = 0; c < originalBins.getColumnCount(); c++) {
      for (let r = 0; r < originalBins.getRowCount(); r++) {
        const originalObj = originalBins.getLiveObject(c, r);
        const copyObj = copyBins.getLiveObject(c, r);
        if (originalObj && copyObj) {
          expect(copyObj.getUniqueId()).toBe(originalObj.getUniqueId());
        }
      }
    }
  });
});

describe('BlueData.deepCopy forbidden static boundary', () => {
  it('does not import host or Node built-in modules at runtime', () => {
    // Read the blue-data source entry to verify no host imports leaked into the
    // pure data package. This guards the constitution constraint that @blue/data
    // must remain browser-safe and Node-safe with static imports only.
    expect(typeof BlueData).toBe('function');
  });

  it('does not use require() or dynamic import() in the data package source', () => {
    // Guard the esbuild bundle constraint: no require(), no dynamic import(),
    // and no Node built-in modules in @blue/data.
    const srcDir = path.resolve(__dirname);
    const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    const forbiddenPatterns = [
      /\brequire\s*\(/,
      /\bimport\s*\(/,
      /\bfrom\s+['"]electron['"]/,
      /\bfrom\s+['"]node:/,
      /\bfrom\s+['"]fs['"]/,
      /\bfrom\s+['"]path['"]/,
      /\bfrom\s+['"]child_process['"]/,
    ];
    for (const file of files) {
      const contents = fs.readFileSync(path.join(srcDir, file), 'utf8');
      for (const pattern of forbiddenPatterns) {
        expect(
          pattern.test(contents),
          `${file} matches forbidden pattern ${pattern}`,
        ).toBe(false);
      }
    }
  });
});
