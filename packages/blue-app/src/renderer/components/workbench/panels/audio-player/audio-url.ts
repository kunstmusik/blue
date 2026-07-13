/**
 * Renderer-side helpers for the blue-audio:// protocol.
 *
 * Builds and parses blue-audio:// URLs, which the main process streams from
 * disk. Paths are base64url-encoded in the pathname so Chromium's lowercase
 * hostname canonicalization cannot corrupt them.
 */

function encodeBase64Url(input: string): string {
  const utf8 = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of utf8) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeAudioPath(absolutePath: string): string {
  return `blue-audio://file/${encodeBase64Url(absolutePath)}`;
}

export function decodeAudioUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "blue-audio:" || parsed.hostname !== "file") {
      return null;
    }
    const encoded = parsed.pathname.slice(1);
    if (!encoded) return null;
    const decoded = decodeBase64Url(encoded);
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}
