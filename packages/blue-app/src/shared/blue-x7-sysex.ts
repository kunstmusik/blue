export type BlueX7SysexErrorCode = 'read-failed' | 'unsupported-size' | 'invalid-request';

export type BlueX7SysexReadResult =
  | { status: 'canceled' }
  | { status: 'selected'; fileName: string; bytes: ArrayBuffer }
  | { status: 'error'; code: BlueX7SysexErrorCode; message: string };

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return Object.prototype.toString.call(value) === '[object ArrayBuffer]';
}

export function isBlueX7SysexReadResult(value: unknown): value is BlueX7SysexReadResult {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;

  if (obj.status === 'canceled') return true;

  if (obj.status === 'selected') {
    return (
      typeof obj.fileName === 'string' &&
      obj.fileName.length > 0 &&
      isArrayBuffer(obj.bytes) &&
      (obj.bytes.byteLength === 163 || obj.bytes.byteLength === 4104)
    );
  }

  if (obj.status === 'error') {
    return (
      (obj.code === 'read-failed' ||
        obj.code === 'unsupported-size' ||
        obj.code === 'invalid-request') &&
      typeof obj.message === 'string'
    );
  }

  return false;
}

export function validateBlueX7SysexReadResult(value: unknown): BlueX7SysexReadResult {
  if (!isBlueX7SysexReadResult(value)) {
    throw new Error('Invalid BlueX7 SysEx read result payload');
  }
  return value;
}
