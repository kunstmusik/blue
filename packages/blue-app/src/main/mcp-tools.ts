import { McpServer, type CallToolResult, type ServerContext } from '@modelcontextprotocol/server';
import * as z from 'zod';
import type { McpBridge, McpResult } from './mcp-bridge';
import { validateMcpWavFilename } from './mcp-render';
import {
  registerBlueMcpResources,
  resolveMcpAuthContext,
  type McpAuthFactory,
} from './mcp-resources';

const emptyInputSchema = z.object({}).strict();

const boundedNonEmptyStringSchema = (fieldName: string, maxLength = 512) =>
  z
    .string()
    .min(1, `${fieldName} must not be empty.`)
    .max(maxLength, `${fieldName} must not exceed ${maxLength} characters.`)
    .refine((value) => value.trim().length > 0, `${fieldName} must not be blank.`);

const instrumentIdSchema = boundedNonEmptyStringSchema('instrumentId', 200);

const csoundInstrumentIdSchema = boundedNonEmptyStringSchema('instrumentId', 200).refine(
  (value) => /^(?:[1-9]\d*|[A-Za-z_][A-Za-z0-9_]*)$/.test(value),
  'instrumentId must be a positive integer or a valid Csound instrument identifier.',
);

const receiptSchema = z
  .object({
    documentId: boundedNonEmptyStringSchema('documentId', 512),
    revision: z.number().int().min(0),
    stateId: boundedNonEmptyStringSchema('stateId', 512),
  })
  .strict();

const getInstrumentInputSchema = z
  .object({
    instrumentId: instrumentIdSchema,
  })
  .strict();

const layerLocatorSchema = z
  .object({
    layerGroupPath: z
      .array(z.number().int().min(0).max(10000))
      .min(1)
      .max(32)
      .refine((path) => path.length % 2 === 1, 'layerGroupPath must have an odd length.'),
    layerIndex: z.number().int().min(0).max(10000),
  })
  .strict();

const scoreLocatorSchema = z
  .object({
    layerGroupPath: z
      .array(z.number().int().min(0).max(10000))
      .min(1)
      .max(32)
      .refine((path) => path.length % 2 === 1, 'layerGroupPath must have an odd length.'),
    layerIndex: z.number().int().min(0).max(10000),
    objectIndex: z.number().int().min(0).max(100000),
  })
  .strict();

const listScoreObjectsInputSchema = z
  .object({
    layer: layerLocatorSchema,
    start: z.number().finite().min(0).optional(),
    end: z.number().finite().gt(0).optional(),
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasStart = value.start !== undefined;
    const hasEnd = value.end !== undefined;
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: 'custom',
        message: 'start and end must be provided together as a pair.',
      });
    } else if (hasStart && hasEnd && value.end! <= value.start!) {
      ctx.addIssue({
        code: 'custom',
        message: 'end must be strictly greater than start.',
      });
    }
  });

const updateInstrumentCodeInputSchema = z
  .object({
    expected: receiptSchema,
    instrumentId: instrumentIdSchema,
    changes: z
      .object({
        text: z.string().optional(),
        instrumentText: z.string().optional(),
        alwaysOnInstrumentText: z.string().optional(),
        globalOrc: z.string().optional(),
        globalSco: z.string().optional(),
      })
      .strict()
      .refine(
        (changes) =>
          changes.text !== undefined ||
          changes.instrumentText !== undefined ||
          changes.alwaysOnInstrumentText !== undefined ||
          changes.globalOrc !== undefined ||
          changes.globalSco !== undefined,
        'changes must specify at least one code field.',
      ),
  })
  .strict();

const upsertInstrumentInputSchema = z
  .object({
    expected: receiptSchema,
    instrumentId: csoundInstrumentIdSchema,
    changes: z
      .object({
        name: boundedNonEmptyStringSchema('name', 200).optional(),
        enabled: z.boolean().optional(),
      })
      .strict()
      .refine(
        (changes) => changes.name !== undefined || changes.enabled !== undefined,
        'changes must specify name and/or enabled.',
      ),
  })
  .strict();

const updateScoreObjectInputSchema = z
  .object({
    expected: receiptSchema,
    locator: scoreLocatorSchema,
    changes: z
      .object({
        start: z.number().finite().min(0).optional(),
        duration: z.number().finite().gt(0).optional(),
        name: z.string().max(1000).optional(),
        text: z.string().optional(),
      })
      .strict()
      .refine(
        (changes) =>
          changes.start !== undefined ||
          changes.duration !== undefined ||
          changes.name !== undefined ||
          changes.text !== undefined,
        'changes must specify at least one score object field.',
      ),
  })
  .strict();

const setProjectPropertiesInputSchema = z
  .object({
    expected: receiptSchema,
    changes: z
      .object({
        title: z.string().max(1000).optional(),
        author: z.string().max(1000).optional(),
        notes: z.string().max(200000).optional(),
        sampleRate: z.number().int().min(1).max(1920000).optional(),
        ksmps: z.number().int().min(1).max(65536).optional(),
        nchnls: z.number().int().min(1).max(256).optional(),
      })
      .strict()
      .refine(
        (changes) =>
          changes.title !== undefined ||
          changes.author !== undefined ||
          changes.notes !== undefined ||
          changes.sampleRate !== undefined ||
          changes.ksmps !== undefined ||
          changes.nchnls !== undefined,
        'changes must specify at least one project property.',
      ),
  })
  .strict();

const transportInputSchema = z
  .object({
    expected: receiptSchema,
  })
  .strict();

const renderToDiskInputSchema = z
  .object({
    expected: receiptSchema,
    filename: z
      .string()
      .min(1)
      .max(255)
      .refine((value) => validateMcpWavFilename(value).ok, {
        message: 'filename must be a valid single-leaf WAV filename.',
      }),
    destination: z.enum(['project', 'choose']).optional(),
  })
  .strict();

const RUNTIME_TOOL_NAMES = new Set(['transport_play', 'transport_stop', 'render_to_disk']);

const WRITE_TOOL_NAMES = new Set([
  'update_instrument_code',
  'upsert_instrument',
  'update_score_object',
  'set_project_properties',
  ...RUNTIME_TOOL_NAMES,
]);

const GATED_SERVERS = new WeakSet<McpServer>();

type InternalRequestHandler = (
  request: { method?: string; params?: Record<string, unknown> },
  extra: ServerContext,
) => Promise<unknown>;

function installWriteAccessGating(server: McpServer, authFactory: McpAuthFactory): void {
  if (GATED_SERVERS.has(server)) return;
  GATED_SERVERS.add(server);

  const lowLevel = server.server as unknown as {
    _requestHandlers?: Map<string, InternalRequestHandler>;
  };
  const handlers = lowLevel._requestHandlers;
  if (!handlers) return;

  const originalListHandler = handlers.get('tools/list');
  if (originalListHandler) {
    handlers.set('tools/list', async (request, extra) => {
      const result = (await originalListHandler(request, extra)) as {
        tools: Array<{ name: string }>;
        nextCursor?: string;
      };
      const auth = resolveMcpAuthContext(authFactory, 'read', extra);
      if (auth.accessMode === 'read-write') {
        return result;
      }
      return {
        ...result,
        tools: result.tools.filter((tool) => !WRITE_TOOL_NAMES.has(tool.name)),
      };
    });
  }

  const originalCallHandler = handlers.get('tools/call');
  if (originalCallHandler) {
    handlers.set('tools/call', async (request, extra) => {
      const toolName = request.params?.name;
      if (typeof toolName === 'string' && WRITE_TOOL_NAMES.has(toolName)) {
        const requiredAction = RUNTIME_TOOL_NAMES.has(toolName) ? 'runtime' : 'write';
        const auth = resolveMcpAuthContext(authFactory, requiredAction, extra);
        if (auth.signal.aborted) {
          return toToolResult({
            ok: false,
            code: 'CANCELLED',
            message: 'The MCP request was cancelled.',
          });
        }
        if (
          !auth.isAuthorized() ||
          auth.accessMode !== 'read-write' ||
          auth.action !== requiredAction
        ) {
          return toToolResult({
            ok: false,
            code: 'ACCESS_DENIED',
            message:
              auth.accessMode !== 'read-write'
                ? 'Read-write MCP access is disabled. Switch MCP access mode to read-write in Program Settings and rediscover tools.'
                : 'MCP authorization is no longer valid. Reconnect with the current credential.',
          });
        }
      }
      return originalCallHandler(request, extra);
    });
  }
}

function toToolResult<T extends object>(result: McpResult<T>): CallToolResult {
  if (!result.ok) {
    const payload = { code: result.code, message: result.message };
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(result.value) }],
    structuredContent: result.value as Record<string, unknown>,
  };
}

export function registerBlueMcpTools(
  server: McpServer,
  bridge: McpBridge,
  authFactory: McpAuthFactory,
): void {
  server.registerTool(
    'get_project_summary',
    {
      title: 'Get Project Summary',
      description:
        'Return the active project receipt, metadata, file path, dirty state, instruments, and sound layers.',
      inputSchema: emptyInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    (_args, ctx: ServerContext) => {
      const auth = resolveMcpAuthContext(authFactory, 'read', ctx);
      return toToolResult(bridge.getProjectSummary(auth));
    },
  );

  server.registerTool(
    'get_instrument',
    {
      title: 'Get Instrument',
      description: 'Return metadata and supported code fields for an arrangement instrument by ID.',
      inputSchema: getInstrumentInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    ({ instrumentId }, ctx: ServerContext) => {
      const auth = resolveMcpAuthContext(authFactory, 'read', ctx);
      return toToolResult(bridge.getInstrument(auth, instrumentId));
    },
  );

  server.registerTool(
    'list_score_objects',
    {
      title: 'List Score Objects',
      description:
        'List ordered score objects on a layer, optionally filtered by a half-open [start, end) beat range and paginated.',
      inputSchema: listScoreObjectsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    (args, ctx: ServerContext) => {
      const auth = resolveMcpAuthContext(authFactory, 'read', ctx);
      return toToolResult(bridge.listScoreObjects(auth, args));
    },
  );

  server.registerTool(
    'generate_csd',
    {
      title: 'Generate Observation-Only CSD',
      description:
        'Generate a disk-profile CSD for the active project when observation-only generation is eligible.',
      inputSchema: emptyInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (_args, ctx: ServerContext) => {
      const auth = resolveMcpAuthContext(authFactory, 'read', ctx);
      return toToolResult(await bridge.generateCsd(auth));
    },
  );

  server.registerTool(
    'update_instrument_code',
    {
      title: 'Update Instrument Code',
      description:
        'Update code fields on an existing GenericInstrument or BlueSynthBuilder instrument in the Arrangement.',
      inputSchema: updateInstrumentCodeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (args, ctx: ServerContext) => {
      const auth = resolveMcpAuthContext(authFactory, 'write', ctx);
      return toToolResult(await bridge.updateInstrumentCode(auth, args));
    },
  );

  server.registerTool(
    'upsert_instrument',
    {
      title: 'Upsert Instrument',
      description:
        'Update metadata/enabled state of an existing Arrangement instrument, or create a new GenericInstrument with the given ID and name.',
      inputSchema: upsertInstrumentInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (args, ctx: ServerContext) => {
      const auth = resolveMcpAuthContext(authFactory, 'write', ctx);
      return toToolResult(await bridge.upsertInstrument(auth, args));
    },
  );

  server.registerTool(
    'update_score_object',
    {
      title: 'Update Score Object',
      description:
        'Update timing and/or GenericScore text on an existing timeline score object identified by its layer locator and objectIndex.',
      inputSchema: updateScoreObjectInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (args, ctx: ServerContext) => {
      const auth = resolveMcpAuthContext(authFactory, 'write', ctx);
      return toToolResult(await bridge.updateScoreObject(auth, args));
    },
  );

  server.registerTool(
    'set_project_properties',
    {
      title: 'Set Project Properties',
      description:
        'Update realtime project metadata or audio properties (title, author, notes, sampleRate, ksmps, nchnls) without modifying disk render settings.',
      inputSchema: setProjectPropertiesInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (args, ctx: ServerContext) => {
      const auth = resolveMcpAuthContext(authFactory, 'write', ctx);
      return toToolResult(await bridge.setProjectProperties(auth, args));
    },
  );

  server.registerTool(
    'transport_play',
    {
      title: 'Transport Play',
      description:
        'Request local confirmation and start timeline playback for the active project receipt.',
      inputSchema: transportInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (args, ctx: ServerContext) => {
      const auth = resolveMcpAuthContext(authFactory, 'runtime', ctx);
      return toToolResult(await bridge.transportPlay(auth, args.expected));
    },
  );

  server.registerTool(
    'transport_stop',
    {
      title: 'Transport Stop',
      description: 'Stop active timeline playback for the matching active project receipt.',
      inputSchema: transportInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (args, ctx: ServerContext) => {
      const auth = resolveMcpAuthContext(authFactory, 'runtime', ctx);
      return toToolResult(await bridge.transportStop(auth, args.expected));
    },
  );

  server.registerTool(
    'render_to_disk',
    {
      title: 'Render to Disk',
      description:
        'Request local confirmation and render the active eligible project to a new single-leaf WAV file in the project directory or a chosen folder.',
      inputSchema: renderToDiskInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async (args, ctx: ServerContext) => {
      const auth = resolveMcpAuthContext(authFactory, 'runtime', ctx);
      return toToolResult(await bridge.renderToDisk(auth, args));
    },
  );

  installWriteAccessGating(server, authFactory);
}

export function createBlueMcpServer(
  bridge: McpBridge,
  authFactory: McpAuthFactory,
  version: string,
): McpServer {
  const server = new McpServer(
    { name: 'Blue', version },
    {
      capabilities: {
        resources: { subscribe: true, listChanged: true },
        tools: { listChanged: true },
      },
    },
  );
  registerBlueMcpResources(server, bridge, authFactory);
  registerBlueMcpTools(server, bridge, authFactory);
  return server;
}
