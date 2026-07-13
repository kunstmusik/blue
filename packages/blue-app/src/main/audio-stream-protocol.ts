/**
 * blue-audio:// privileged scheme.
 *
 * Registers a custom protocol that streams audio files from disk to the
 * renderer's <audio> element. Supports HTTP-style byte-range requests so
 * Chromium's native media pipeline can seek natively without loading the
 * whole file into renderer memory.
 *
 * URLs take the form `blue-audio://file/<base64url(absolutePath)>`. The path
 * is base64url-encoded so spaces, unicode, and slashes survive URL parsing
 * intact. The encoded value must not be stored in the hostname because
 * Chromium canonicalizes hostnames to lowercase.
 *
 * `registerBlueAudioScheme()` MUST be called synchronously before
 * `app.whenReady()` (it calls `protocol.registerSchemesAsPrivileged`).
 * `registerBlueAudioProtocolHandler()` is called once the app is ready.
 */
import { protocol } from "electron";
import * as fs from "fs";
import * as path from "path";
import { Readable } from "node:stream";

export const AUDIO_SCHEME = "blue-audio";

const CONTENT_TYPES: Record<string, string> = {
  wav: "audio/wav",
  wave: "audio/wav",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  au: "audio/basic",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  w64: "audio/x-w64",
  opus: "audio/ogg",
  weba: "audio/webm",
};

const authorizedAudioFilePaths = new Set<string>();

/** Call before app.whenReady(). Marks the scheme as standard + streamable. */
export function registerBlueAudioScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: AUDIO_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        stream: true,
      },
    },
  ]);
}

/** Encode an absolute filesystem path into a blue-audio:// URL. */
export function encodeAudioPath(absolutePath: string): string {
  const encoded = Buffer.from(absolutePath, "utf-8").toString("base64url");
  return `${AUDIO_SCHEME}://file/${encoded}`;
}

/** Decode a blue-audio:// URL back into an absolute path. Returns null on failure. */
export function decodeAudioUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== `${AUDIO_SCHEME}:` || parsed.hostname !== "file") {
      return null;
    }
    const encoded = parsed.pathname.slice(1);
    if (!encoded) return null;
    const decoded = Buffer.from(encoded, "base64url").toString("utf-8");
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

/** Authorize a file selected through main-process UI or produced by a Play render. */
export function authorizeAudioFilePath(filePath: string): boolean {
  try {
    const canonicalPath = fs.realpathSync(filePath);
    if (!fs.statSync(canonicalPath).isFile()) return false;
    authorizedAudioFilePaths.add(canonicalPath);
    return true;
  } catch {
    return false;
  }
}

/** Resolve a renderer-supplied path only when main has explicitly authorized it. */
export async function resolveAuthorizedAudioFilePath(
  filePath: string,
): Promise<string | null> {
  try {
    const canonicalPath = await fs.promises.realpath(filePath);
    return authorizedAudioFilePaths.has(canonicalPath) ? canonicalPath : null;
  } catch {
    return null;
  }
}

/** Read bytes for a path previously authorized by the main process. */
export async function readAuthorizedAudioFileBytes(
  filePath: string,
): Promise<ArrayBuffer | null> {
  const authorizedPath = await resolveAuthorizedAudioFilePath(filePath);
  if (!authorizedPath) return null;

  try {
    const buffer = await fs.promises.readFile(authorizedPath);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
  } catch {
    return null;
  }
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

interface ResolvedRange {
  start: number;
  end: number;
}

function parseRangeHeader(
  header: string | null,
  total: number,
): ResolvedRange | null | undefined {
  if (!header) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  if (!match[1] && !match[2]) return null;

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0 || total <= 0) {
      return null;
    }
    return { start: Math.max(total - suffixLength, 0), end: total - 1 };
  }

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : total - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < 0 || start > end || start >= total) return null;
  return { start, end: Math.min(end, total - 1) };
}

function textResponse(status: number, message: string): Response {
  return new Response(message, { status, statusText: message });
}

/** Call after app.whenReady(). Registers the streaming file handler. */
export function registerBlueAudioProtocolHandler(): void {
  protocol.handle(AUDIO_SCHEME, async (request) => {
    const requestedPath = decodeAudioUrl(request.url);
    if (!requestedPath) {
      return textResponse(400, "Bad request");
    }

    const filePath = await resolveAuthorizedAudioFilePath(requestedPath);
    if (!filePath) {
      return textResponse(403, "Forbidden");
    }

    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(filePath);
    } catch {
      return textResponse(404, "Not found");
    }
    if (!stat.isFile()) {
      return textResponse(404, "Not a file");
    }

    const total = stat.size;
    const contentType = contentTypeFor(filePath);
    const range = parseRangeHeader(request.headers.get("range"), total);

    if (range === null) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }

    if (range) {
      const length = range.end - range.start + 1;
      const nodeStream = fs.createReadStream(filePath, {
        start: range.start,
        end: range.end,
      });
      const body = Readable.toWeb(
        nodeStream,
      ) as unknown as ReadableStream<Uint8Array>;
      return new Response(body, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(length),
          "Content-Range": `bytes ${range.start}-${range.end}/${total}`,
          "Accept-Ranges": "bytes",
        },
      });
    }

    const nodeStream = fs.createReadStream(filePath);
    const body = Readable.toWeb(
      nodeStream,
    ) as unknown as ReadableStream<Uint8Array>;
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(total),
        "Accept-Ranges": "bytes",
      },
    });
  });
}
