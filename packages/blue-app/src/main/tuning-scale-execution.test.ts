import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { BlueData, Element, NoteProcessorChain, TuningProcessor } from '@blue/data';

import { generateDiskCsdForScreen, generateRealtimeCsdForScreen } from './csd-generation';

const scala = 'Tuning execution fixture\n1\n2\n';

function projectWithExternalScale(filename: string): BlueData {
  const data = new BlueData();
  const processor = TuningProcessor.loadFromXML(
    Element.parse(
      `<noteProcessor type="TuningProcessor"><scale>${filename}</scale></noteProcessor>`,
    ),
  );
  const chain = new NoteProcessorChain();
  chain.addProcessor(processor);
  data.getScore().setNoteProcessorChain(chain);
  return data;
}

describe('tuning dependencies at CSD execution boundaries', () => {
  let temporaryHome: string | null = null;
  let restoreHome: (() => void) | null = null;

  afterEach(() => {
    restoreHome?.();
    restoreHome = null;
    if (temporaryHome) fs.rmSync(temporaryHome, { recursive: true, force: true });
    temporaryHome = null;
  });

  function useTemporaryScaleDirectory(withScale: boolean): void {
    temporaryHome = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-tuning-host-'));
    const originalHome = process.env.HOME;
    const originalUserProfile = process.env.USERPROFILE;
    process.env.HOME = temporaryHome;
    process.env.USERPROFILE = temporaryHome;
    restoreHome = () => {
      if (originalHome === undefined) delete process.env.HOME;
      else process.env.HOME = originalHome;
      if (originalUserProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = originalUserProfile;
    };
    if (withScale) {
      const directory = path.join(temporaryHome, '.blue', 'scl');
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'execution.scl'), scala, 'utf8');
    }
  }

  it('resolves scales for disk and realtime generation on disposable project copies', async () => {
    useTemporaryScaleDirectory(true);
    const data = projectWithExternalScale('execution.scl');
    const before = data.saveToString();

    await expect(generateDiskCsdForScreen(data)).resolves.toContain('<CsoundSynthesizer>');
    await expect(generateRealtimeCsdForScreen(data)).resolves.toContain('<CsoundSynthesizer>');
    expect(data.saveToString()).toBe(before);
    const processor = data.getScore().getNoteProcessorChain().getProcessors()[0] as TuningProcessor;
    expect(processor.getScaleReference()).toEqual({ filename: 'execution.scl' });
  });

  it('blocks generation when a scale is absent while leaving the source project saveable', async () => {
    useTemporaryScaleDirectory(false);
    const data = projectWithExternalScale('missing.scl');
    const before = data.saveToString();

    await expect(generateRealtimeCsdForScreen(data)).rejects.toThrow(/missing\.scl/);
    expect(data.saveToString()).toBe(before);
  });
});
