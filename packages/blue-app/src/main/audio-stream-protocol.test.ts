import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const protocolMock = vi.hoisted(() => ({
  handle: vi.fn(),
  registerSchemesAsPrivileged: vi.fn(),
}));

vi.mock('electron', () => ({ protocol: protocolMock }));

import {
  AUDIO_SCHEME,
  authorizeAudioFilePath,
  decodeAudioUrl,
  encodeAudioPath,
  readAuthorizedAudioFileBytes,
  registerBlueAudioProtocolHandler,
  registerBlueAudioScheme,
} from './audio-stream-protocol';

interface FakeRequest {
  url: string;
  headers: { get: (name: string) => string | null };
}

function makeRequest(url: string, range?: string): FakeRequest {
  return {
    url,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'range' ? (range ?? null) : null),
    },
  };
}

describe('blue-audio scheme registration', () => {
  it('registers the scheme as privileged before app ready', () => {
    registerBlueAudioScheme();
    expect(protocolMock.registerSchemesAsPrivileged).toHaveBeenCalledTimes(1);
    const args = protocolMock.registerSchemesAsPrivileged.mock.calls[0]![0] as Array<{
      scheme: string;
      privileges: {
        stream: boolean;
        supportFetchAPI?: boolean;
        bypassCSP?: boolean;
      };
    }>;
    expect(args[0]!.scheme).toBe(AUDIO_SCHEME);
    expect(args[0]!.privileges.stream).toBe(true);
    expect(args[0]!.privileges.supportFetchAPI).not.toBe(true);
    expect(args[0]!.privileges.bypassCSP).not.toBe(true);
  });
});

describe('blue-audio path encode/decode', () => {
  it('round-trips an absolute posix path', () => {
    const p = '/tmp/renders/final mix.wav';
    const url = encodeAudioPath(p);
    expect(url).toMatch(/^blue-audio:\/\/file\//);
    expect(decodeAudioUrl(url)).toBe(p);
  });

  it('round-trips paths with spaces, unicode, parentheses, and slashes', () => {
    const cases = [
      'C:\\Users\\Steven\\renders\\café.wav',
      '/home/Steven/документы/файл.aiff',
      '/tmp/with (parens) & symbols [x].flac',
      '/a/中文/文件.wav',
    ];
    for (const c of cases) {
      expect(decodeAudioUrl(encodeAudioPath(c))).toBe(c);
    }
  });

  it('returns null for a malformed url', () => {
    expect(decodeAudioUrl('not a url')).toBeNull();
  });
});

describe('blue-audio protocol handler', () => {
  type Handler = (request: FakeRequest) => Promise<Response>;
  let handler: Handler | undefined;
  const tempFiles: string[] = [];

  beforeEach(() => {
    protocolMock.handle.mockImplementation((_scheme, fn: Handler) => {
      handler = fn;
    });
    registerBlueAudioProtocolHandler();
  });

  afterEach(() => {
    for (const file of tempFiles.splice(0)) {
      fs.rmSync(file, { force: true });
    }
    handler = undefined;
    protocolMock.handle.mockReset();
  });

  it('streams the full file with a 200 when no range is requested', async () => {
    const file = path.join(os.tmpdir(), `blue-audio-${Date.now()}.bin`);
    tempFiles.push(file);
    fs.writeFileSync(file, Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(authorizeAudioFilePath(file)).toBe(true);

    const res = await handler!(makeRequest(encodeAudioPath(file)));
    expect(res.status).toBe(200);
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    expect(res.headers.get('Content-Length')).toBe('8');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(Array.from(buf)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('returns 206 with the requested byte range', async () => {
    const file = path.join(os.tmpdir(), `blue-audio-${Date.now()}.bin`);
    tempFiles.push(file);
    fs.writeFileSync(file, Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(authorizeAudioFilePath(file)).toBe(true);

    const res = await handler!(makeRequest(encodeAudioPath(file), 'bytes=2-5'));
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 2-5/8');
    expect(res.headers.get('Content-Length')).toBe('4');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(Array.from(buf)).toEqual([2, 3, 4, 5]);
  });

  it('clamps an open-ended range to the end of the file', async () => {
    const file = path.join(os.tmpdir(), `blue-audio-${Date.now()}.bin`);
    tempFiles.push(file);
    fs.writeFileSync(file, Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(authorizeAudioFilePath(file)).toBe(true);

    const res = await handler!(makeRequest(encodeAudioPath(file), 'bytes=6-'));
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 6-7/8');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(Array.from(buf)).toEqual([6, 7]);
  });

  it('rejects an unregistered path before probing it', async () => {
    const res = await handler!(makeRequest(encodeAudioPath('/no/such/file.wav')));
    expect(res.status).toBe(403);
  });

  it('rejects an existing path that main did not authorize', async () => {
    const file = path.join(os.tmpdir(), `blue-audio-${Date.now()}.bin`);
    tempFiles.push(file);
    fs.writeFileSync(file, Buffer.from([0, 1, 2, 3]));

    const res = await handler!(makeRequest(encodeAudioPath(file)));
    expect(res.status).toBe(403);
  });

  it('sniffs the content type from the file extension', async () => {
    const file = path.join(os.tmpdir(), `blue-audio-${Date.now()}.wav`);
    tempFiles.push(file);
    fs.writeFileSync(file, 'x');
    expect(authorizeAudioFilePath(file)).toBe(true);
    const res = await handler!(makeRequest(encodeAudioPath(file)));
    expect(res.headers.get('Content-Type')).toBe('audio/wav');
  });

  it('supports suffix ranges', async () => {
    const file = path.join(os.tmpdir(), `blue-audio-${Date.now()}.bin`);
    tempFiles.push(file);
    fs.writeFileSync(file, Buffer.from([0, 1, 2, 3]));
    expect(authorizeAudioFilePath(file)).toBe(true);
    const res = await handler!(makeRequest(encodeAudioPath(file), 'bytes=-2'));
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 2-3/4');
    expect(Array.from(Buffer.from(await res.arrayBuffer()))).toEqual([2, 3]);
  });

  it('returns 416 when the range header is malformed', async () => {
    const file = path.join(os.tmpdir(), `blue-audio-${Date.now()}.bin`);
    tempFiles.push(file);
    fs.writeFileSync(file, Buffer.from([0, 1, 2, 3]));
    expect(authorizeAudioFilePath(file)).toBe(true);
    const res = await handler!(makeRequest(encodeAudioPath(file), 'bytes=abc'));
    expect(res.status).toBe(416);
    expect(res.headers.get('Content-Range')).toBe('bytes */4');
  });
});

describe('authorized audio byte reads', () => {
  const tempFiles: string[] = [];

  afterEach(() => {
    for (const file of tempFiles.splice(0)) {
      fs.rmSync(file, { force: true });
    }
  });

  it('does not read an existing path that main did not authorize', async () => {
    const file = path.join(os.tmpdir(), `blue-audio-unapproved-${Date.now()}.bin`);
    tempFiles.push(file);
    fs.writeFileSync(file, Buffer.from([4, 5, 6]));

    await expect(readAuthorizedAudioFileBytes(file)).resolves.toBeNull();
  });

  it('reads exact bytes after main authorizes the file', async () => {
    const file = path.join(os.tmpdir(), `blue-audio-approved-${Date.now()}.bin`);
    tempFiles.push(file);
    fs.writeFileSync(file, Buffer.from([4, 5, 6]));
    expect(authorizeAudioFilePath(file)).toBe(true);

    const bytes = await readAuthorizedAudioFileBytes(file);
    expect(bytes).not.toBeNull();
    expect(Array.from(new Uint8Array(bytes!))).toEqual([4, 5, 6]);
  });
});
