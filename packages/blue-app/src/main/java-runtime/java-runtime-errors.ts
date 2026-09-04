import type { JavaRuntimeErrorEnvelope } from './java-runtime-protocol';

function combineMessage(prefix: string, detail?: string): string {
  const trimmedDetail = detail?.trim();
  if (!trimmedDetail) {
    return prefix;
  }

  if (trimmedDetail.toLowerCase().startsWith(prefix.toLowerCase())) {
    return trimmedDetail;
  }

  return `${prefix}: ${trimmedDetail}`;
}

function formatJavaRuntimeErrorMessage(action: string, error?: JavaRuntimeErrorEnvelope): string {
  if (!error) {
    return `${action} failed`;
  }

  const trimmedMessage = error.message?.trim();
  switch (error.code) {
    case 'JYTHON_LIBRARY_PATH_ERROR':
      return combineMessage('Jython library path is unavailable', trimmedMessage);
    case 'JYTHON_IMPORT_ERROR':
      return combineMessage('Unable to import Jython modules', trimmedMessage);
    case 'JYTHON_SYNTAX_ERROR':
      return combineMessage('Jython syntax error', trimmedMessage);
    case 'JYTHON_EVALUATION_ERROR':
      return combineMessage('Jython evaluation failed', trimmedMessage);
    case 'TRANSPORT_ERROR':
      return combineMessage('Java runtime transport failed', trimmedMessage);
    case 'INVALID_RESPONSE_PAYLOAD':
      return combineMessage('Java runtime returned an invalid response', trimmedMessage);
    case 'RESPONSE_ID_MISMATCH':
      return combineMessage('Java runtime returned a mismatched response', trimmedMessage);
    case 'PROTOCOL_ERROR':
      return combineMessage('Java runtime request was invalid', trimmedMessage);
    case 'INTERNAL_SERVER_ERROR':
      return combineMessage('Java runtime helper failed', trimmedMessage);
    default:
      return trimmedMessage?.length ? trimmedMessage : `${action} failed`;
  }
}

export function formatJavaRuntimeProtocolError(
  action: string,
  error?: JavaRuntimeErrorEnvelope,
): string {
  const message = formatJavaRuntimeErrorMessage(action, error);
  if (!error || error.line == null) {
    return message;
  }

  if (error.column == null) {
    return `${message} (line ${error.line})`;
  }

  return `${message} (line ${error.line}, column ${error.column})`;
}
