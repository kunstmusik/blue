import { describe, expect, it } from 'vitest';
import {
  BlueData,
  External,
  PolyObject,
  GenericScore,
} from '@blue/data';
import {
  createScoreObjectEditorDocument,
} from '../shared/project-editor';
import { executeExternalTest, executeExternalTestSync } from './external-executor';
import type { ScoreObjectEditorRequest } from '../shared/project-editor';
import { setExternalCommandExecutor } from '@blue/data';

function makeProjectWithExternal(commandLine: string, text: string): { data: BlueData; request: ScoreObjectEditorRequest } {
  setExternalCommandExecutor({
    execute(cmd, body, dir) {
      const res = executeExternalTestSync({ commandLine: cmd, text: body, projectDir: dir });
      if (!res.ok) throw new Error(res.error);
      return res.output;
    }
  });
  const data = new BlueData();
  const score = data.getScore();
  const lg = score[0] as PolyObject;
  const layer = lg[0];

  const ext = new External();
  ext.setCommandLine(commandLine);
  ext.setText(text);
  ext.setName('TestExternal');
  layer.push(ext);

  const request: ScoreObjectEditorRequest = {
    target: {
      selectionId: 'sobj-0-0',
      selectedObjectType: 'External',
      editorObjectType: 'External',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex: 0 },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    },
  };
  return { data, request };
}

describe('External test pipeline (BlueData → document → executor)', () => {
  it('creates external editor document with correct command line and text', () => {
    const { data, request } = makeProjectWithExternal('python script.py', 'print("i1 0 1")');
    const doc = createScoreObjectEditorDocument(data, request);
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('external');
    if (doc!.editor.kind === 'external') {
      expect(doc!.editor.commandLine).toBe('python script.py');
      expect(doc!.editor.scoreText).toBe('print("i1 0 1")');
    }
  });

  it('returns empty external document for no command and no text', () => {
    const { data, request } = makeProjectWithExternal('', '');
    const doc = createScoreObjectEditorDocument(data, request);
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('external');
    if (doc!.editor.kind === 'external') {
      expect(doc!.editor.commandLine).toBe('');
      expect(doc!.editor.scoreText).toBe('');
    }
  });

  it('executes external test using document data', async () => {
    const { data, request } = makeProjectWithExternal('node -e "process.stdout.write(\'i1 0 1\')"', '');
    const doc = createScoreObjectEditorDocument(data, request);
    expect(doc).not.toBeNull();
    expect(doc!.editor.kind).toBe('external');

    const result = await executeExternalTest({
      commandLine: (doc!.editor as { commandLine: string }).commandLine,
      text: (doc!.editor as { scoreText: string }).scoreText,
      projectDir: null,
    });
    expect(result.ok).toBe(true);
    expect(result.output).toContain('i1 0 1');
  });

  it('executes external test with text body piped via cat', async () => {
    const catCmd = process.platform === 'win32' ? 'type' : 'cat';
    const { data, request } = makeProjectWithExternal(catCmd, 'i1 0 2\ni2 1 1\n');
    const doc = createScoreObjectEditorDocument(data, request);
    expect(doc).not.toBeNull();

    const result = await executeExternalTest({
      commandLine: (doc!.editor as { commandLine: string }).commandLine,
      text: (doc!.editor as { scoreText: string }).scoreText,
      projectDir: null,
    });
    expect(result.ok).toBe(true);
    expect(result.output).toContain('i1 0 2');
    expect(result.output).toContain('i2 1 1');
  });

  it('handles command failure gracefully', async () => {
    const { data, request } = makeProjectWithExternal('false', '');
    const doc = createScoreObjectEditorDocument(data, request);

    const result = await executeExternalTest({
      commandLine: (doc!.editor as { commandLine: string }).commandLine,
      text: (doc!.editor as { scoreText: string }).scoreText,
      projectDir: null,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('mirrors Java Blue flow: empty command + empty text = no test', async () => {
    const result = await executeExternalTest({
      commandLine: '',
      text: '',
      projectDir: null,
    });
    expect(result.ok).toBe(false);
  });

  it('mirrors Java Blue flow: command with text but $infile substitution', async () => {
    const { data, request } = makeProjectWithExternal('cat $infile', 'i1 0 1\ni2 1 1\n');
    const doc = createScoreObjectEditorDocument(data, request);

    const result = await executeExternalTest({
      commandLine: (doc!.editor as { commandLine: string }).commandLine,
      text: (doc!.editor as { scoreText: string }).scoreText,
      projectDir: null,
    });
    expect(result.ok).toBe(true);
    expect(result.output).toContain('i1 0 1');
  });

  it('generates notes from External object and stringifies NoteList (parity with main process IPC)', () => {
    const { data } = makeProjectWithExternal('cat', 'i1 0 1\ni2 1 1');
    const score = data.getScore();
    const lg = score[0] as PolyObject;
    const layer = lg[0];
    const ext = layer[0] as External;

    const noteList = ext.generateForCSD(
      data.getScore().getTimeContext(),
      { getCloneDataDirectives: () => '' } as any,
      0.0,
      -1.0,
    );

    expect(noteList.length).toBe(2);
    const output = noteList.toString();
    expect(output).toContain('i1');
    expect(output).toContain('i2');
    expect(output).toContain('0.0');
    expect(output).toContain('2'); // duration is 2.0 because of scaling
  });
});
