import {
  McpServer,
  ProtocolError,
  ProtocolErrorCode,
  type ServerContext,
} from '@modelcontextprotocol/server';
import type { McpAction, McpAuthContext, McpBridge, McpDomainErrorCode } from './mcp-bridge';

export const BLUE_PROJECT_SUMMARY_URI = 'blue://project/summary';
export const BLUE_PROJECT_CSD_URI = 'blue://project/csd';
export const BLUE_PROJECT_INSTRUMENTS_URI = 'blue://project/instruments';
export const BLUE_ENGINE_STATUS_URI = 'blue://engine/status';

export const BLUE_PROJECT_RESOURCE_URIS = [
  BLUE_PROJECT_SUMMARY_URI,
  BLUE_PROJECT_CSD_URI,
  BLUE_PROJECT_INSTRUMENTS_URI,
] as const;

export type McpAuthFactory =
  | McpAuthContext
  | ((action: McpAction, signal?: AbortSignal) => McpAuthContext);

export function resolveMcpAuthContext(
  authFactory: McpAuthFactory,
  action: McpAction,
  ctx?: ServerContext,
): McpAuthContext {
  if (typeof authFactory === 'function') {
    return authFactory(action, ctx?.mcpReq?.signal);
  }
  const requestSignal = ctx?.mcpReq?.signal;
  if (!requestSignal || requestSignal === authFactory.signal) {
    return authFactory;
  }
  const combinedSignal = AbortSignal.any([authFactory.signal, requestSignal]);
  return {
    listenerGeneration: authFactory.listenerGeneration,
    credentialEpoch: authFactory.credentialEpoch,
    writeAccessEpoch: authFactory.writeAccessEpoch,
    accessMode: authFactory.accessMode,
    action,
    signal: combinedSignal,
    isAuthorized: () => authFactory.isAuthorized(),
  };
}

function toProtocolError(code: McpDomainErrorCode, message: string): ProtocolError {
  const rpcCode =
    code === 'ACCESS_DENIED' ||
    code === 'ENGINE_UNAVAILABLE' ||
    code === 'CANCELLED' ||
    code === 'BUSY' ||
    code === 'OUTPUT_REJECTED' ||
    code === 'RESPONSE_TOO_LARGE'
      ? ProtocolErrorCode.InternalError
      : ProtocolErrorCode.InvalidParams;
  return new ProtocolError(rpcCode, `${code}: ${message}`, { code, message });
}

export function registerBlueMcpResources(
  server: McpServer,
  bridge: McpBridge,
  authFactory: McpAuthFactory,
): void {
  server.registerResource(
    'project-summary',
    BLUE_PROJECT_SUMMARY_URI,
    {
      title: 'Blue Project Summary',
      description:
        'Live project metadata, receipt, file path, dirty state, instruments, and sound layers.',
      mimeType: 'application/json',
    },
    (uri, ctx) => {
      const auth = resolveMcpAuthContext(authFactory, 'read', ctx);
      const result = bridge.getProjectSummary(auth);
      if (!result.ok) {
        throw toProtocolError(result.code, result.message);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(result.value),
          },
        ],
      };
    },
  );

  server.registerResource(
    'project-csd',
    BLUE_PROJECT_CSD_URI,
    {
      title: 'Blue Project Disk-Profile CSD',
      description:
        'Observation-only disk-profile Csound CSD generated for the current project receipt.',
      mimeType: 'text/plain',
    },
    async (uri, ctx) => {
      const auth = resolveMcpAuthContext(authFactory, 'read', ctx);
      const result = await bridge.generateCsd(auth);
      if (!result.ok) {
        throw toProtocolError(result.code, result.message);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/plain',
            text: result.value.csd,
          },
        ],
      };
    },
  );

  server.registerResource(
    'project-instruments',
    BLUE_PROJECT_INSTRUMENTS_URI,
    {
      title: 'Blue Project Instruments',
      description: 'Assignment IDs, names, instrument types, and enabled state.',
      mimeType: 'application/json',
    },
    (uri, ctx) => {
      const auth = resolveMcpAuthContext(authFactory, 'read', ctx);
      const result = bridge.getInstruments(auth);
      if (!result.ok) {
        throw toProtocolError(result.code, result.message);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(result.value),
          },
        ],
      };
    },
  );

  server.registerResource(
    'engine-status',
    BLUE_ENGINE_STATUS_URI,
    {
      title: 'Blue Engine Status',
      description:
        'Csound engine connection, playback state, active document ID, and bounded console tail.',
      mimeType: 'application/json',
    },
    (uri, ctx) => {
      const auth = resolveMcpAuthContext(authFactory, 'read', ctx);
      const result = bridge.getEngineStatus(auth);
      if (!result.ok) {
        throw toProtocolError(result.code, result.message);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(result.value),
          },
        ],
      };
    },
  );
}
