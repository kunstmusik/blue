import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  BlueData,
  Element,
  GenericScore,
  NoteProcessorChain,
  PolyObject,
  TuningProcessor,
} from '@blue/data';
import {
  parseScalaScale,
  prepareProjectTuningDependencies,
  resolveTuningDependencies,
} from './tuning-scale-dependencies';

const scala =
  '! original synthetic fixture\nThree degree example\n3\n 700.0 fifth\n3/2\n2 period\n';

function processor(filename = 'original.scl') {
  return TuningProcessor.loadFromXML(
    Element.parse(
      `<noteProcessor type="TuningProcessor"><scale>${filename}</scale><baseFrequency>440</baseFrequency></noteProcessor>`,
    ),
  );
}

describe('host tuning dependencies', () => {
  it('reads cents, ratios and period with implicit unison', () => {
    expect(parseScalaScale(scala)).toMatchObject({
      scaleName: 'Three degree example',
      octave: 2,
      ratios: [1, Math.pow(2, 700 / 1200), 1.5],
    });
  });

  it('accepts signed cents, integer ratios, empty descriptions and zero degrees', () => {
    expect(parseScalaScale('Descending scale\r2\r-5.0\r2\r')).toMatchObject({
      scaleName: 'Descending scale',
      octave: 2,
      ratios: [1, Math.pow(2, -5 / 1200)],
    });
    expect(parseScalaScale('One octave\n1\n2\n').octave).toBe(2);
    expect(parseScalaScale('! empty description\n\n0\n')).toMatchObject({
      scaleName: '',
      octave: 1,
      ratios: [1],
    });
  });

  it.each(['name\n2\n2/0\n2\n', 'name\n2\n1junk\n2\n', 'name\n2\n700.0\n', 'name\n-1\n'])(
    'rejects invalid/unrepresentable Scala text',
    (text) => {
      expect(() => parseScalaScale(text)).toThrow();
    },
  );

  it('resolves only a detached compilation candidate and retains canonical path', () => {
    const source = new BlueData();
    const nested = new GenericScore();
    const chain = new NoteProcessorChain();
    chain.addProcessor(processor());
    nested.setNoteProcessorChain(chain);
    (source.getScore()[0] as PolyObject).addSoundObject(0, nested);
    const before = source.saveToString();
    const paths: string[] = [];

    const prepared = prepareProjectTuningDependencies(source, {
      scaleDirectory: '/native/scales',
      readFile: (filename) => {
        paths.push(filename);
        return scala;
      },
    });

    expect(prepared).not.toBe(source);
    expect(paths).toEqual(['/native/scales/original.scl']);
    const resolved = (prepared.getScore()[0] as PolyObject)[0]![0]!
      .getNoteProcessorChain()
      .getProcessors()[0] as TuningProcessor;
    expect(resolved.getScaleReference()).toBeNull();
    expect(resolved.getBaseFrequency()).toBe('440');
    expect(source.saveToString()).toBe(before);
  });

  it('keeps synthetic Windows filenames in native host path handling', () => {
    const filename = String.raw`C:\Users\composer\.blue\scl\microtonal.scl`;
    const source = new BlueData();
    const chain = new NoteProcessorChain();
    chain.addProcessor(processor(filename));
    source.getScore().setNoteProcessorChain(chain);
    const before = source.saveToString();
    const scaleDirectory = path.join(os.tmpdir(), 'blue-native-scl');
    const readPaths: string[] = [];

    const prepared = prepareProjectTuningDependencies(source, {
      scaleDirectory,
      readFile: (nativePath) => {
        readPaths.push(nativePath);
        return scala;
      },
    });

    expect(readPaths).toEqual([
      path.isAbsolute(filename) ? filename : path.join(scaleDirectory, filename),
    ]);
    expect(prepared).not.toBe(source);
    expect(
      (
        source.getScore().getNoteProcessorChain().getProcessors()[0] as TuningProcessor
      ).getScaleReference()?.filename,
    ).toBe(filename);
    expect(source.saveToString()).toBe(before);
  });

  it('leaves missing dependencies saveable and fails preparation without canonical mutation', () => {
    const source = new BlueData();
    const chain = new NoteProcessorChain();
    chain.addProcessor(processor('missing.scl'));
    source.getScore().setNoteProcessorChain(chain);
    const before = source.saveToString();

    expect(() =>
      prepareProjectTuningDependencies(source, {
        readFile: () => {
          throw new Error('not found');
        },
      }),
    ).toThrow(/missing\.scl/);
    expect(source.saveToString()).toBe(before);
  });

  it('blocks malformed external scales with the retained filename in the error', () => {
    const source = new BlueData();
    const chain = new NoteProcessorChain();
    chain.addProcessor(processor('malformed.scl'));
    source.getScore().setNoteProcessorChain(chain);
    const before = source.saveToString();

    expect(() =>
      prepareProjectTuningDependencies(source, {
        readFile: () => 'Invalid scale\n2\nnot-a-ratio\n2\n',
      }),
    ).toThrow(/malformed\.scl/);
    expect(source.saveToString()).toBe(before);
  });

  it('preflights every insertion dependency before resolving the candidate', () => {
    const source = new GenericScore();
    const chain = new NoteProcessorChain();
    chain.addProcessor(processor('valid.scl'));
    chain.addProcessor(processor('missing.scl'));
    source.setNoteProcessorChain(chain);
    const before = source.saveAsXML().toXml();

    expect(() =>
      resolveTuningDependencies(source, {
        readFile: (filename) => {
          if (filename.endsWith('missing.scl')) throw new Error('not found');
          return scala;
        },
      }),
    ).toThrow(/missing\.scl/);
    expect(source.saveAsXML().toXml()).toBe(before);
  });
});
