import { describe, expect, it } from 'vitest';
import { prepareCommandLine, shouldUseOutFile } from '../shared/external-executor';
import { createMainExternalExecutor, executeExternalTest } from './external-executor';

const EXTERNAL_PROCESS_TEST_TIMEOUT = 35_000;

describe('prepareCommandLine', () => {
  it('appends infile when $infile is absent', () => {
    expect(prepareCommandLine('python', 'input.txt')).toBe('python input.txt');
  });

  it('replaces $infile placeholder', () => {
    expect(prepareCommandLine('python $infile', 'input.txt')).toBe('python input.txt');
  });

  it('replaces multiple $infile placeholders', () => {
    expect(prepareCommandLine('cat $infile $infile', 'input.txt')).toBe('cat input.txt input.txt');
  });

  it('replaces $outfile when provided', () => {
    expect(prepareCommandLine('python $infile -o $outfile', 'in.txt', 'out.txt')).toBe('python in.txt -o out.txt');
  });

  it('appends infile and replaces $outfile', () => {
    expect(prepareCommandLine('tool -o $outfile', 'in.txt', 'out.sco')).toBe('tool -o out.sco in.txt');
  });

  it('trims trailing whitespace', () => {
    expect(prepareCommandLine('python ', 'input.txt')).toBe('python  input.txt');
  });
});

describe('shouldUseOutFile', () => {
  it('returns true when $outfile is present', () => {
    expect(shouldUseOutFile('python $infile -o $outfile')).toBe(true);
  });

  it('returns false when $outfile is absent', () => {
    expect(shouldUseOutFile('python $infile')).toBe(false);
  });

  it('returns false for empty command line', () => {
    expect(shouldUseOutFile('')).toBe(false);
  });
});

describe('executeExternalTest', () => {
  it('returns error when both commandLine and text are empty', async () => {
    const result = await executeExternalTest({ commandLine: '', text: '', projectDir: null });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No command line or text');
  });

  it('returns error when both commandLine and text are whitespace', async () => {
    const result = await executeExternalTest({ commandLine: '  ', text: '  ', projectDir: null });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No command line or text');
  });

  it('executes a command and returns stdout', async () => {
    const result = await executeExternalTest({
      commandLine: 'node -e "process.stdout.write(\'i1 0 1\')"',
      text: '',
      projectDir: null,
    });
    expect(result.ok).toBe(true);
    expect(result.output).toContain('i1 0 1');
  }, EXTERNAL_PROCESS_TEST_TIMEOUT);

  it('writes text to temp file and passes it to command', async () => {
    const result = await executeExternalTest({
      commandLine: 'node -e "process.stdout.write(require(\'fs\').readFileSync(process.argv[1],\'utf8\'))"',
      text: 'i1 0 2\ni2 1 1\n',
      projectDir: null,
    });
    expect(result.ok).toBe(true);
    expect(result.output).toContain('i1 0 2');
    expect(result.output).toContain('i2 1 1');
  }, EXTERNAL_PROCESS_TEST_TIMEOUT);

  it('returns error for failing command', async () => {
    const result = await executeExternalTest({
      commandLine: 'false',
      text: '',
      projectDir: null,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  }, EXTERNAL_PROCESS_TEST_TIMEOUT);

  it('returns error for nonexistent command', async () => {
    const result = await executeExternalTest({
      commandLine: 'nonexistent_command_xyz_12345',
      text: '',
      projectDir: null,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  }, EXTERNAL_PROCESS_TEST_TIMEOUT);

  it('handles $outfile mode', async () => {
    const result = await executeExternalTest({
      commandLine: 'node -e "require(\'fs\').copyFileSync(process.argv[1],process.argv[2])" $infile $outfile',
      text: 'i1 0 1\n',
      projectDir: null,
    });
    expect(result.ok).toBe(true);
    expect(result.output).toContain('i1 0 1');
  }, EXTERNAL_PROCESS_TEST_TIMEOUT);
});

describe('createMainExternalExecutor', () => {
  it('creates an executor that runs commands synchronously and returns output', () => {
    const executor = createMainExternalExecutor(() => null);
    const output = executor.execute('node -e "process.stdout.write(\'test output\')"', '', null);
    expect(output).toBe('test output');
  });

  it('throws an error when command execution fails', () => {
    const executor = createMainExternalExecutor(() => null);
    expect(() => executor.execute('false', '', null)).toThrow();
  });
});
