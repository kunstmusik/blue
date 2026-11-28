import { randomUUID } from 'node:crypto';
import {
  AudioClip,
  BlueData,
  BlueSynthBuilder,
  BlueX7,
  GenericInstrument,
  GenericScore,
  Instance,
  JavaScriptInstrument,
  PatternLayer,
  PatternsLayerGroup,
  PolyObject,
  PythonInstrument,
  SoundObject,
  TrackLayerGroup,
  type Instrument,
} from '@blue/data';
import type { McpAccessMode } from '../shared/mcp-server';
import type {
  InstrumentPatch,
  ProjectDocumentPatch,
  ScoreObjectEditorTargetSnapshot,
  ScoreObjectLocationRef,
} from '../shared/project-editor/contract';
import { assignLayerGroupId, assignScoreObjectId } from '../shared/project-editor/identity';
import { reconcileMixerWithArrangement } from '../shared/project-editor/snapshot-mixer-orchestra';
import {
  buildEditorTargetSnapshot,
  createScoreObjectPropertiesTarget,
} from '../shared/project-editor/snapshot-score-editor';
import type { ProjectRuntimeOutcome, ProjectSaveState } from '../shared/project-history';
import {
  generateObservationOnlyDiskCsd,
  preflightObservationOnlyDiskCsd,
  type ObservationCsdBudget,
  type ObservationOnlyDiskCsdResult,
} from './csd-generation';
import type { McpTransportOutcome } from './mcp-playback';
import { validateMcpWavFilename, type ConfinedMcpRenderSuccess } from './mcp-render';
import type {
  ProjectHistory,
  ProjectHistoryGuardedResponse,
  ProjectHistoryStructuralGuardedResponse,
  ProjectHistoryTrustedGuard,
} from './project-history';
import { forkProjectGraph } from './project-history-graph';
import type { ProjectSessionSnapshot } from './project-session';

export interface McpDocumentReceipt {
  readonly documentId: string;
  readonly revision: number;
  readonly stateId: string;
}

export interface McpLayerLocator {
  readonly layerGroupPath: readonly number[];
  readonly layerIndex: number;
}

export interface McpScoreLocator {
  readonly layerGroupPath: readonly number[];
  readonly layerIndex: number;
  readonly objectIndex: number;
}

export type McpAction = 'read' | 'write' | 'runtime';

export interface McpAuthContext {
  readonly listenerGeneration: number;
  readonly credentialEpoch: number;
  readonly writeAccessEpoch?: number;
  readonly accessMode: McpAccessMode;
  readonly action: McpAction;
  readonly signal: AbortSignal;
  isAuthorized(): boolean;
}

export type McpDomainErrorCode =
  | 'NO_ACTIVE_PROJECT'
  | 'CONFLICT'
  | 'ACCESS_DENIED'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_CONTENT'
  | 'EXECUTION_REQUIRED'
  | 'ENGINE_UNAVAILABLE'
  | 'OUTPUT_REJECTED'
  | 'RESPONSE_TOO_LARGE'
  | 'CANCELLED'
  | 'BUSY';

export type McpResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: McpDomainErrorCode; readonly message: string };

export interface McpConsoleTailEntry {
  readonly text: string;
  readonly type: 'stdout' | 'stderr';
}

const DEFAULT_CONSOLE_TAIL_MAX_LINES = 200;
const DEFAULT_CONSOLE_TAIL_MAX_BYTES = 64 * 1024;

/** Bounded ring buffer retaining recent engine stdout/stderr lines. */
export class McpConsoleTailBuffer {
  private readonly maxLines: number;
  private readonly maxBytes: number;
  private readonly entries: Array<{ entry: McpConsoleTailEntry; bytes: number }> = [];
  private totalBytes = 0;

  constructor(
    maxLines = DEFAULT_CONSOLE_TAIL_MAX_LINES,
    maxBytes = DEFAULT_CONSOLE_TAIL_MAX_BYTES,
  ) {
    this.maxLines = Math.max(1, maxLines);
    this.maxBytes = Math.max(1, maxBytes);
  }

  append(text: string, type: 'stdout' | 'stderr' = 'stdout'): void {
    if (!text) return;
    const rawLines = text.split(/\r?\n/);
    if (rawLines.length > 1 && rawLines[rawLines.length - 1] === '') {
      rawLines.pop();
    }
    for (const rawLine of rawLines) {
      let line = rawLine;
      let bytes = Buffer.byteLength(line, 'utf8');
      if (bytes > this.maxBytes) {
        line = Buffer.from(line, 'utf8').subarray(0, this.maxBytes).toString('utf8');
        bytes = Buffer.byteLength(line, 'utf8');
      }
      this.entries.push({ entry: { text: line, type }, bytes });
      this.totalBytes += bytes;
      while (
        this.entries.length > this.maxLines ||
        (this.totalBytes > this.maxBytes && this.entries.length > 0)
      ) {
        const dropped = this.entries.shift()!;
        this.totalBytes -= dropped.bytes;
      }
    }
  }

  read(): McpConsoleTailEntry[] {
    return this.entries.map((item) => ({ ...item.entry }));
  }

  clear(): void {
    this.entries.length = 0;
    this.totalBytes = 0;
  }
}

export interface McpEngineStatusSnapshot {
  readonly connected: boolean;
  readonly available: boolean;
  readonly playbackState: string;
  readonly activeDocumentId: string | null;
  readonly consoleTail: readonly McpConsoleTailEntry[];
}

export interface McpEngineStatusSource {
  readonly isQuitting: boolean;
  readonly hasBridge: boolean;
  readonly hasRuntimeService: boolean;
  readonly isPlaying: boolean;
  readonly activeSessionAcceptingCommands: boolean;
  readonly activePlaybackDocumentId: string | null;
  readonly consoleTail: readonly McpConsoleTailEntry[];
}

/**
 * Derive the public MCP engine status snapshot from actual runtime session and
 * timeline playback ownership state.
 */
export function buildMcpEngineStatusSnapshot(
  source: McpEngineStatusSource,
): McpEngineStatusSnapshot {
  const connected =
    !source.isQuitting &&
    source.hasBridge &&
    (source.activeSessionAcceptingCommands || source.isPlaying);
  const available =
    !source.isQuitting && source.hasBridge && (source.hasRuntimeService || connected);
  const playing = !source.isQuitting && source.hasBridge && source.isPlaying;
  return {
    connected,
    available,
    playbackState: playing ? 'playing' : 'stopped',
    activeDocumentId: playing ? source.activePlaybackDocumentId : null,
    consoleTail: source.consoleTail.map((entry) => ({ ...entry })),
  };
}

export interface McpInstrumentSummary {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly enabled: boolean;
}

export interface McpSoundLayerSummary {
  readonly layerGroupPath: number[];
  readonly layerIndex: number;
  readonly name: string;
  readonly groupName: string;
  readonly groupType: 'polyObject' | 'track' | 'patterns';
  readonly muted: boolean;
  readonly solo: boolean;
}

export interface McpProjectSummary {
  readonly receipt: McpDocumentReceipt;
  readonly title: string;
  readonly author: string;
  readonly notes: string;
  readonly projectPath: string | null;
  readonly isDirty: boolean;
  readonly saveState: ProjectSaveState;
  readonly instruments: McpInstrumentSummary[];
  readonly soundLayers: McpSoundLayerSummary[];
}

export interface McpInstrumentsList {
  readonly receipt: McpDocumentReceipt;
  readonly instruments: McpInstrumentSummary[];
}

export type McpInstrumentCode =
  | {
      readonly text: string;
      readonly globalOrc: string;
      readonly globalSco: string;
    }
  | {
      readonly instrumentText: string;
      readonly alwaysOnInstrumentText: string;
      readonly globalOrc: string;
      readonly globalSco: string;
    }
  | null;

export interface McpInstrumentDetail {
  readonly receipt: McpDocumentReceipt;
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly enabled: boolean;
  readonly code: McpInstrumentCode;
}

export interface ListScoreObjectsInput {
  readonly layer: McpLayerLocator;
  readonly start?: number;
  readonly end?: number;
  readonly offset?: number;
  readonly limit?: number;
}

export interface McpScoreObjectItem {
  readonly locator: McpScoreLocator;
  readonly type: string;
  readonly name: string;
  readonly start: number;
  readonly duration: number;
  readonly text?: string;
}

export interface McpScoreObjectsPage {
  readonly receipt: McpDocumentReceipt;
  readonly objects: McpScoreObjectItem[];
  readonly nextOffset: number | null;
}

export interface McpGeneratedCsd {
  readonly receipt: McpDocumentReceipt;
  readonly csd: string;
  readonly diagnostics: readonly string[];
}

export interface McpWriteOutcome {
  readonly receipt: McpDocumentReceipt;
  readonly changed: boolean;
  readonly runtimeOutcomes: readonly ProjectRuntimeOutcome[];
  readonly warnings: readonly string[];
}

export interface UpdateInstrumentCodeInput {
  readonly expected: McpDocumentReceipt;
  readonly instrumentId: string;
  readonly changes: {
    readonly text?: string;
    readonly instrumentText?: string;
    readonly alwaysOnInstrumentText?: string;
    readonly globalOrc?: string;
    readonly globalSco?: string;
  };
}

export interface UpsertInstrumentInput {
  readonly expected: McpDocumentReceipt;
  readonly instrumentId: string;
  readonly changes: {
    readonly name?: string;
    readonly enabled?: boolean;
  };
}

export interface UpdateScoreObjectInput {
  readonly expected: McpDocumentReceipt;
  readonly locator: McpScoreLocator;
  readonly changes: {
    readonly start?: number;
    readonly duration?: number;
    readonly name?: string;
    readonly text?: string;
  };
}

export interface SetProjectPropertiesInput {
  readonly expected: McpDocumentReceipt;
  readonly changes: {
    readonly title?: string;
    readonly author?: string;
    readonly notes?: string;
    readonly sampleRate?: number;
    readonly ksmps?: number;
    readonly nchnls?: number;
  };
}

export type McpRenderDestination = 'project' | 'choose';

export interface RenderToDiskInput {
  readonly expected: McpDocumentReceipt;
  readonly filename: string;
  readonly destination?: McpRenderDestination;
}

export interface McpRuntimeAdapters {
  readonly transportPlay?: (
    auth: McpAuthContext,
    expected: McpDocumentReceipt,
  ) => Promise<McpResult<McpTransportOutcome>>;
  readonly transportStop?: (
    auth: McpAuthContext,
    expected: McpDocumentReceipt,
  ) => Promise<McpResult<McpTransportOutcome>>;
  readonly renderToDisk?: (
    auth: McpAuthContext,
    input: {
      readonly expected: McpDocumentReceipt;
      readonly filename: string;
      readonly destination: McpRenderDestination;
    },
  ) => Promise<McpResult<ConfinedMcpRenderSuccess>>;
}

export interface McpInspectionLimits {
  readonly maxResponseBytes: number;
  readonly maxInstruments: number;
  readonly maxSoundLayers: number;
  readonly maxPolyNestingDepth: number;
  readonly maxTraversalNodes: number;
  readonly maxScoreLayerScanObjects: number;
}

export const DEFAULT_MCP_INSPECTION_LIMITS: McpInspectionLimits = {
  maxResponseBytes: 1_048_576,
  maxInstruments: 2_000,
  maxSoundLayers: 2_000,
  maxPolyNestingDepth: 32,
  maxTraversalNodes: 50_000,
  maxScoreLayerScanObjects: 50_000,
};

export interface McpBridgeDependencies {
  readonly readSession: () => Readonly<ProjectSessionSnapshot>;
  readonly getSaveState: () => ProjectSaveState;
  readonly isDirty: () => boolean;
  readonly getEngineStatus: () => McpEngineStatusSnapshot;
  readonly generateObservationCsd?: (data: BlueData) => Promise<ObservationOnlyDiskCsdResult>;
  readonly history?: Pick<
    ProjectHistory,
    'commitGuarded' | 'commitPreparedStructuralMutationGuarded'
  >;
  readonly runtime?: McpRuntimeAdapters;
  readonly inspectionLimits?: Partial<McpInspectionLimits>;
}

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;
const MAX_LAYER_GROUP_PATH_LENGTH = 32;
const MAX_INSTRUMENT_ID_LENGTH = 200;
const MAX_SCORE_OBJECT_NAME_LENGTH = 1000;

function err<T>(code: McpDomainErrorCode, message: string): McpResult<T> {
  return { ok: false, code, message };
}

function ok<T>(value: T): McpResult<T> {
  return { ok: true, value };
}

function getSessionReceipt(snapshot: Readonly<ProjectSessionSnapshot>): McpDocumentReceipt | null {
  if (!snapshot.data || !snapshot.documentId || !snapshot.stateId) {
    return null;
  }
  return {
    documentId: snapshot.documentId,
    revision: snapshot.revision,
    stateId: snapshot.stateId,
  };
}

function receiptsMatch(a: McpDocumentReceipt, b: McpDocumentReceipt): boolean {
  return a.documentId === b.documentId && a.revision === b.revision && a.stateId === b.stateId;
}

function isValidReceipt(receipt: unknown): receipt is McpDocumentReceipt {
  if (!receipt || typeof receipt !== 'object') return false;
  const candidate = receipt as Partial<McpDocumentReceipt>;
  return (
    typeof candidate.documentId === 'string' &&
    candidate.documentId.trim().length > 0 &&
    candidate.documentId.length <= 512 &&
    typeof candidate.revision === 'number' &&
    Number.isSafeInteger(candidate.revision) &&
    candidate.revision >= 0 &&
    typeof candidate.stateId === 'string' &&
    candidate.stateId.trim().length > 0 &&
    candidate.stateId.length <= 512
  );
}

function isValidCsoundInstrumentId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= MAX_INSTRUMENT_ID_LENGTH &&
    /^(?:[1-9]\d*|[A-Za-z_][A-Za-z0-9_]*)$/.test(id)
  );
}

function extractRuntimeWarnings(outcomes: readonly ProjectRuntimeOutcome[] | undefined): string[] {
  if (!outcomes || outcomes.length === 0) return [];
  const warnings: string[] = [];
  for (const outcome of outcomes) {
    if (outcome.status === 'restart-required') {
      warnings.push(
        outcome.message ?? 'Engine restart required for runtime changes to take effect.',
      );
    } else if (outcome.status === 'failed') {
      warnings.push(outcome.message ?? 'Runtime reconciliation reported a failure.');
    } else if (outcome.message) {
      warnings.push(outcome.message);
    }
  }
  return warnings;
}

function mapGuardedWriteResponse(
  response: ProjectHistoryGuardedResponse | ProjectHistoryStructuralGuardedResponse,
): McpResult<McpWriteOutcome> {
  switch (response.status) {
    case 'committed':
      return ok({
        receipt: {
          documentId: response.documentId,
          revision: response.revision,
          stateId: response.stateId,
        },
        changed: true,
        runtimeOutcomes: response.runtimeOutcomes ?? [],
        warnings: extractRuntimeWarnings(response.runtimeOutcomes),
      });
    case 'unchanged':
      return ok({
        receipt: {
          documentId: response.documentId,
          revision: response.revision,
          stateId: response.stateId,
        },
        changed: false,
        runtimeOutcomes: [],
        warnings: [],
      });
    case 'stale':
      return err(
        'CONFLICT',
        response.reason ??
          'The expected project receipt is stale. Reread the current project receipt and retry.',
      );
    case 'denied':
      return err(response.code, response.reason);
    case 'oversize':
      return err('OUTPUT_REJECTED', response.explanation);
    case 'busy':
      return err('BUSY', response.reason ?? 'Project history is currently busy.');
    case 'invalid':
      if (response.reason.startsWith('CONFLICT:')) {
        return err('CONFLICT', response.reason.slice('CONFLICT:'.length).trim());
      }
      if (response.reason.toLowerCase().includes('no active project')) {
        return err('NO_ACTIVE_PROJECT', response.reason);
      }
      return err('INVALID_INPUT', response.reason);
    case 'failed':
      return err('INVALID_INPUT', response.error);
  }
}

function getInstrumentTypeName(instrument: Instrument | undefined): string {
  if (instrument instanceof GenericInstrument) return 'GenericInstrument';
  if (instrument instanceof BlueSynthBuilder) return 'BlueSynthBuilder';
  if (instrument instanceof BlueX7) return 'BlueX7';
  if (instrument instanceof JavaScriptInstrument) return 'JavaScriptInstrument';
  if (instrument instanceof PythonInstrument) return 'PythonInstrument';
  return instrument?.constructor?.name || 'Unknown';
}

function listArrangementInstruments(
  data: BlueData,
  limits: McpInspectionLimits,
): McpResult<McpInstrumentSummary[]> {
  const arrangement = data.getArrangement().getArrangement();
  if (arrangement.length > limits.maxInstruments) {
    return err(
      'RESPONSE_TOO_LARGE',
      `Arrangement exceeds the maximum inspection limit of ${limits.maxInstruments} instruments.`,
    );
  }
  const result: McpInstrumentSummary[] = [];
  for (const assignment of arrangement) {
    result.push({
      id: assignment.arrangementId,
      name: assignment.instr?.getName() ?? '',
      type: getInstrumentTypeName(assignment.instr),
      enabled: assignment.enabled,
    });
  }
  return ok(result);
}

function collectSoundLayers(
  data: BlueData,
  limits: McpInspectionLimits,
): McpResult<McpSoundLayerSummary[]> {
  const result: McpSoundLayerSummary[] = [];
  const score = data.getScore();
  const seenPolys = new Set<object>();
  let visitedNodes = 0;

  const touchNode = (): { ok: false; code: McpDomainErrorCode; message: string } | null => {
    visitedNodes += 1;
    if (visitedNodes > limits.maxTraversalNodes) {
      return err(
        'RESPONSE_TOO_LARGE',
        `Score traversal exceeded the inspection node limit (${limits.maxTraversalNodes}). Inspect individual layers with list_score_objects instead.`,
      ) as { ok: false; code: McpDomainErrorCode; message: string };
    }
    return null;
  };

  const pushLayer = (
    entry: McpSoundLayerSummary,
  ): { ok: false; code: McpDomainErrorCode; message: string } | null => {
    if (result.length >= limits.maxSoundLayers) {
      return err(
        'RESPONSE_TOO_LARGE',
        `Project exceeds the maximum inspection limit of ${limits.maxSoundLayers} sound layers.`,
      ) as { ok: false; code: McpDomainErrorCode; message: string };
    }
    result.push(entry);
    return null;
  };

  const walkPolyObject = (poly: PolyObject, path: number[], depth: number): McpResult<true> => {
    if (depth > limits.maxPolyNestingDepth) {
      return err(
        'RESPONSE_TOO_LARGE',
        `Score nesting depth exceeds the inspection limit (${limits.maxPolyNestingDepth}).`,
      );
    }
    if (seenPolys.has(poly)) {
      return err('UNSUPPORTED_CONTENT', 'Cyclic PolyObject structure cannot be inspected.');
    }
    seenPolys.add(poly);

    const groupName = poly.getName();
    for (let layerIndex = 0; layerIndex < poly.length; layerIndex++) {
      const nodeErr = touchNode();
      if (nodeErr) return nodeErr;
      const layer = poly[layerIndex]!;
      const limitErr = pushLayer({
        layerGroupPath: [...path],
        layerIndex,
        name: layer.getName(),
        groupName,
        groupType: 'polyObject',
        muted: layer.isMuted(),
        solo: layer.isSolo(),
      });
      if (limitErr) return limitErr;
      for (let objectIndex = 0; objectIndex < layer.length; objectIndex++) {
        const childErr = touchNode();
        if (childErr) return childErr;
        const child = layer[objectIndex];
        if (child instanceof PolyObject) {
          const nestedRes = walkPolyObject(child, [...path, layerIndex, objectIndex], depth + 1);
          if (!nestedRes.ok) return nestedRes;
        }
      }
    }
    seenPolys.delete(poly);
    return ok(true);
  };

  for (let groupIndex = 0; groupIndex < score.length; groupIndex++) {
    const nodeErr = touchNode();
    if (nodeErr) return nodeErr;
    const group = score[groupIndex];
    if (!group) continue;
    const path = [groupIndex];
    if (group instanceof PolyObject) {
      const walkRes = walkPolyObject(group, path, 0);
      if (!walkRes.ok) return walkRes;
    } else if (group instanceof TrackLayerGroup) {
      const groupName = group.getName();
      for (let layerIndex = 0; layerIndex < group.length; layerIndex++) {
        const trackErr = touchNode();
        if (trackErr) return trackErr;
        const track = group[layerIndex]!;
        const limitErr = pushLayer({
          layerGroupPath: path,
          layerIndex,
          name: track.getName(),
          groupName,
          groupType: 'track',
          muted: track.isMuted(),
          solo: track.isSolo(),
        });
        if (limitErr) return limitErr;
      }
    } else if (group instanceof PatternsLayerGroup) {
      const groupName = group.getName();
      for (let layerIndex = 0; layerIndex < group.length; layerIndex++) {
        const patErr = touchNode();
        if (patErr) return patErr;
        const patternLayer = group[layerIndex]!;
        const limitErr = pushLayer({
          layerGroupPath: path,
          layerIndex,
          name: patternLayer.getName(),
          groupName,
          groupType: 'patterns',
          muted: patternLayer.isMuted(),
          solo: patternLayer.isSolo(),
        });
        if (limitErr) return limitErr;
      }
    }
  }

  return ok(result);
}

function isNonNegativeSafeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validateLayerLocator(locator: unknown): locator is McpLayerLocator {
  if (!locator || typeof locator !== 'object') return false;
  const candidate = locator as Partial<McpLayerLocator>;
  if (
    !Array.isArray(candidate.layerGroupPath) ||
    candidate.layerGroupPath.length === 0 ||
    candidate.layerGroupPath.length > MAX_LAYER_GROUP_PATH_LENGTH ||
    candidate.layerGroupPath.length % 2 !== 1
  ) {
    return false;
  }
  if (!candidate.layerGroupPath.every((entry) => isNonNegativeSafeInt(entry))) {
    return false;
  }
  return isNonNegativeSafeInt(candidate.layerIndex);
}

function resolveScoreLayer(
  data: BlueData,
  locator: McpLayerLocator,
): { group: PolyObject | TrackLayerGroup | PatternsLayerGroup; layer: unknown } | null {
  const score = data.getScore();
  const rootIndex = locator.layerGroupPath[0]!;
  let group: unknown = score[rootIndex];
  if (!group) return null;

  for (let i = 1; i < locator.layerGroupPath.length; i += 2) {
    if (!(group instanceof PolyObject)) return null;
    const subLayerIndex = locator.layerGroupPath[i]!;
    const subObjectIndex = locator.layerGroupPath[i + 1]!;
    const subLayer = group[subLayerIndex];
    if (!subLayer) return null;
    const nested = subLayer[subObjectIndex];
    if (!(nested instanceof PolyObject)) return null;
    group = nested;
  }

  if (
    !(group instanceof PolyObject) &&
    !(group instanceof TrackLayerGroup) &&
    !(group instanceof PatternsLayerGroup)
  ) {
    return null;
  }

  const targetLayer = group[locator.layerIndex];
  if (!targetLayer) return null;
  return { group, layer: targetLayer };
}

function overlapsHalfOpenRange(
  objStart: number,
  objDuration: number,
  rangeStart: number,
  rangeEnd: number,
): boolean {
  if (!Number.isFinite(objStart) || !Number.isFinite(objDuration)) {
    return false;
  }
  if (objDuration <= 0) {
    return objStart >= rangeStart && objStart < rangeEnd;
  }
  const objEnd = objStart + objDuration;
  return objStart < rangeEnd && objEnd > rangeStart;
}

/** Narrow app-side adapter between MCP endpoints and Blue's session, history, and runtime owners. */
export class McpBridge {
  private readonly deps: McpBridgeDependencies;
  private readonly limits: McpInspectionLimits;

  constructor(deps: McpBridgeDependencies) {
    this.deps = deps;
    this.limits = {
      ...DEFAULT_MCP_INSPECTION_LIMITS,
      ...deps.inspectionLimits,
    };
  }

  private checkResponseSize<T>(payload: T, guidance: string): McpResult<T> {
    const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    if (bytes > this.limits.maxResponseBytes) {
      return err(
        'RESPONSE_TOO_LARGE',
        `Inspection response (${bytes} bytes) exceeds the ${this.limits.maxResponseBytes}-byte limit. ${guidance}`,
      );
    }
    return ok(payload);
  }

  private checkGate(auth: McpAuthContext, requiredAction: McpAction): McpResult<true> {
    if (auth.signal.aborted) {
      return err('CANCELLED', 'The MCP request was cancelled.');
    }
    if (!auth.isAuthorized()) {
      return err(
        'ACCESS_DENIED',
        'MCP authorization is no longer valid. Reconnect with the current credential.',
      );
    }
    if (requiredAction !== 'read') {
      if (auth.accessMode !== 'read-write') {
        return err(
          'ACCESS_DENIED',
          'Read-write MCP access is disabled. Switch MCP access mode to read-write in Program Settings and rediscover tools.',
        );
      }
      if (auth.action !== requiredAction) {
        return err('ACCESS_DENIED', 'This request is not authorized for the requested action.');
      }
    }
    return ok(true);
  }

  private requireActiveProject(): McpResult<{
    snapshot: Readonly<ProjectSessionSnapshot>;
    data: BlueData;
    receipt: McpDocumentReceipt;
  }> {
    const snapshot = this.deps.readSession();
    const receipt = getSessionReceipt(snapshot);
    if (!snapshot.data || !receipt) {
      return err(
        'NO_ACTIVE_PROJECT',
        'No project is currently open in Blue. Open or create a project in Blue and retry.',
      );
    }
    return ok({ snapshot, data: snapshot.data, receipt });
  }

  getProjectSummary(auth: McpAuthContext): McpResult<McpProjectSummary> {
    const gate = this.checkGate(auth, 'read');
    if (!gate.ok) return gate;

    const project = this.requireActiveProject();
    if (!project.ok) return project;

    const { snapshot, data, receipt } = project.value;
    const instrumentsRes = listArrangementInstruments(data, this.limits);
    if (!instrumentsRes.ok) return instrumentsRes;

    const soundLayersRes = collectSoundLayers(data, this.limits);
    if (!soundLayersRes.ok) return soundLayersRes;

    const props = data.getProjectProperties();
    const summary: McpProjectSummary = {
      receipt,
      title: props.title,
      author: props.author,
      notes: props.notes,
      projectPath: snapshot.filePath,
      isDirty: this.deps.isDirty(),
      saveState: this.deps.getSaveState(),
      instruments: instrumentsRes.value,
      soundLayers: soundLayersRes.value,
    };

    const recheck = this.checkGate(auth, 'read');
    if (!recheck.ok) return recheck;
    return this.checkResponseSize(
      summary,
      'Reduce project metadata or inspect specific instruments or layers instead.',
    );
  }

  getInstruments(auth: McpAuthContext): McpResult<McpInstrumentsList> {
    const gate = this.checkGate(auth, 'read');
    if (!gate.ok) return gate;

    const project = this.requireActiveProject();
    if (!project.ok) return project;

    const { data, receipt } = project.value;
    const instrumentsRes = listArrangementInstruments(data, this.limits);
    if (!instrumentsRes.ok) return instrumentsRes;

    const list: McpInstrumentsList = {
      receipt,
      instruments: instrumentsRes.value,
    };

    const recheck = this.checkGate(auth, 'read');
    if (!recheck.ok) return recheck;
    return this.checkResponseSize(list, 'Use get_instrument with a specific instrumentId instead.');
  }

  getInstrument(auth: McpAuthContext, instrumentId: string): McpResult<McpInstrumentDetail> {
    const gate = this.checkGate(auth, 'read');
    if (!gate.ok) return gate;

    if (
      typeof instrumentId !== 'string' ||
      instrumentId.trim().length === 0 ||
      instrumentId.length > MAX_INSTRUMENT_ID_LENGTH
    ) {
      return err('INVALID_INPUT', 'instrumentId must be a non-empty string up to 200 characters.');
    }

    const project = this.requireActiveProject();
    if (!project.ok) return project;

    const { data, receipt } = project.value;
    const assignment = data
      .getArrangement()
      .getArrangement()
      .find((entry) => entry.arrangementId === instrumentId);

    if (!assignment || !assignment.instr) {
      return err(
        'NOT_FOUND',
        `Instrument "${instrumentId}" was not found in the active project's arrangement. Read blue://project/instruments to list available IDs.`,
      );
    }

    const instr = assignment.instr;
    let code: McpInstrumentCode = null;
    if (instr instanceof GenericInstrument) {
      code = {
        text: instr.getText(),
        globalOrc: instr.getGlobalOrc(),
        globalSco: instr.getGlobalSco(),
      };
    } else if (instr instanceof BlueSynthBuilder) {
      code = {
        instrumentText: instr.getInstrumentText(),
        alwaysOnInstrumentText: instr.getAlwaysOnInstrumentText(),
        globalOrc: instr.getGlobalOrc(),
        globalSco: instr.getGlobalSco(),
      };
    }

    const detail: McpInstrumentDetail = {
      receipt,
      id: assignment.arrangementId,
      name: instr.getName(),
      type: getInstrumentTypeName(instr),
      enabled: assignment.enabled,
      code,
    };

    const recheck = this.checkGate(auth, 'read');
    if (!recheck.ok) return recheck;
    return this.checkResponseSize(
      detail,
      'Instrument definition exceeds the inspection response size limit.',
    );
  }

  listScoreObjects(
    auth: McpAuthContext,
    input: ListScoreObjectsInput,
  ): McpResult<McpScoreObjectsPage> {
    const gate = this.checkGate(auth, 'read');
    if (!gate.ok) return gate;

    if (!input || typeof input !== 'object' || !validateLayerLocator(input.layer)) {
      return err(
        'INVALID_INPUT',
        'layer must specify a valid odd-length non-negative layerGroupPath and layerIndex.',
      );
    }

    const hasStart = input.start !== undefined;
    const hasEnd = input.end !== undefined;
    if (hasStart !== hasEnd) {
      return err('INVALID_INPUT', 'start and end must both be provided when filtering by range.');
    }
    if (hasStart && hasEnd) {
      if (
        typeof input.start !== 'number' ||
        typeof input.end !== 'number' ||
        !Number.isFinite(input.start) ||
        !Number.isFinite(input.end) ||
        input.start < 0 ||
        input.end <= input.start
      ) {
        return err(
          'INVALID_INPUT',
          'Range bounds must be finite numbers with start >= 0 and end > start.',
        );
      }
    }

    const offset = input.offset ?? 0;
    if (!isNonNegativeSafeInt(offset)) {
      return err('INVALID_INPUT', 'offset must be a non-negative integer.');
    }

    const limit = input.limit ?? DEFAULT_LIST_LIMIT;
    if (
      typeof limit !== 'number' ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > MAX_LIST_LIMIT
    ) {
      return err('INVALID_INPUT', `limit must be an integer between 1 and ${MAX_LIST_LIMIT}.`);
    }

    const project = this.requireActiveProject();
    if (!project.ok) return project;

    const { data, receipt } = project.value;
    const resolved = resolveScoreLayer(data, input.layer);
    if (!resolved) {
      return err(
        'NOT_FOUND',
        'The specified score layer was not found for the current project receipt. Read blue://project/summary to list current soundLayers.',
      );
    }

    const context = data.getScore().getTimeContext();
    type LightweightEntry = {
      objectIndex: number;
      start: number;
      duration: number;
      item: {
        getName: () => string;
        constructor: { name: string };
      };
    };
    const matched: LightweightEntry[] = [];

    if (!(resolved.layer instanceof PatternLayer) && Array.isArray(resolved.layer)) {
      const items = resolved.layer as Array<{
        getStartTime: () => { toBeats: (ctx: typeof context) => number };
        getSubjectiveDuration: () => { toBeats: (ctx: typeof context) => number };
        getName: () => string;
        constructor: { name: string };
      }>;
      if (items.length > this.limits.maxScoreLayerScanObjects) {
        return err(
          'RESPONSE_TOO_LARGE',
          `Score layer contains ${items.length} objects, exceeding the ${this.limits.maxScoreLayerScanObjects}-object inspection scan limit.`,
        );
      }
      for (let objectIndex = 0; objectIndex < items.length; objectIndex++) {
        const item = items[objectIndex]!;
        const objStart = item.getStartTime().toBeats(context);
        const objDuration = item.getSubjectiveDuration().toBeats(context);
        if (
          hasStart &&
          hasEnd &&
          !overlapsHalfOpenRange(objStart, objDuration, input.start!, input.end!)
        ) {
          continue;
        }
        matched.push({
          objectIndex,
          start: objStart,
          duration: objDuration,
          item,
        });
      }
    }

    matched.sort((a, b) => a.start - b.start || a.objectIndex - b.objectIndex);
    const pageSlice = matched.slice(offset, offset + limit);
    const nextOffset =
      offset + pageSlice.length < matched.length ? offset + pageSlice.length : null;
    const page: McpScoreObjectItem[] = pageSlice.map((entry) => ({
      locator: {
        layerGroupPath: [...input.layer.layerGroupPath],
        layerIndex: input.layer.layerIndex,
        objectIndex: entry.objectIndex,
      },
      type: entry.item.constructor.name,
      name: entry.item.getName(),
      start: entry.start,
      duration: entry.duration,
      ...(entry.item instanceof GenericScore ? { text: entry.item.getScoreText() } : {}),
    }));

    const recheck = this.checkGate(auth, 'read');
    if (!recheck.ok) return recheck;
    return this.checkResponseSize(
      {
        receipt,
        objects: page,
        nextOffset,
      },
      'Reduce limit or narrow the beat range.',
    );
  }

  async generateCsd(auth: McpAuthContext): Promise<McpResult<McpGeneratedCsd>> {
    const gate = this.checkGate(auth, 'read');
    if (!gate.ok) return gate;

    const project = this.requireActiveProject();
    if (!project.ok) return project;

    const capturedReceipt = project.value.receipt;
    const budget: ObservationCsdBudget = {
      maxDepth: this.limits.maxPolyNestingDepth,
      maxTraversalNodes: this.limits.maxTraversalNodes,
      maxInstruments: this.limits.maxInstruments,
      maxEstimatedInputBytes: this.limits.maxResponseBytes,
      maxEstimatedScoreEvents: Math.max(100, Math.floor(this.limits.maxResponseBytes / 8)),
      maxOutputBytes: this.limits.maxResponseBytes,
    };

    let generated: ObservationOnlyDiskCsdResult;
    if (this.deps.generateObservationCsd) {
      const preflight = preflightObservationOnlyDiskCsd(project.value.data, budget);
      if (!preflight.ok) {
        return err(preflight.code, preflight.message);
      }
      const detached = project.value.data.historyCopy();
      generated = await this.deps.generateObservationCsd(detached);
    } else {
      generated = await generateObservationOnlyDiskCsd(project.value.data, { budget });
    }

    const recheck = this.checkGate(auth, 'read');
    if (!recheck.ok) return recheck;

    const afterReceipt = getSessionReceipt(this.deps.readSession());
    if (!afterReceipt || !receiptsMatch(capturedReceipt, afterReceipt)) {
      return err(
        'CONFLICT',
        'The active project changed while generating the CSD. Reread the current project receipt and retry.',
      );
    }

    if (!generated.ok) {
      return err(generated.code, generated.message);
    }

    const csdBytes = Buffer.byteLength(generated.csd, 'utf8');
    if (csdBytes > this.limits.maxResponseBytes) {
      return err(
        'RESPONSE_TOO_LARGE',
        `Generated CSD (${csdBytes} bytes) exceeds the ${this.limits.maxResponseBytes}-byte inspection limit.`,
      );
    }

    return this.checkResponseSize(
      {
        receipt: capturedReceipt,
        csd: generated.csd,
        diagnostics: generated.diagnostics,
      },
      'Generated CSD response exceeds the inspection size limit.',
    );
  }

  getEngineStatus(auth: McpAuthContext): McpResult<McpEngineStatusSnapshot> {
    const gate = this.checkGate(auth, 'read');
    if (!gate.ok) return gate;

    const status = this.deps.getEngineStatus();

    const recheck = this.checkGate(auth, 'read');
    if (!recheck.ok) return recheck;

    return ok({
      connected: status.connected,
      available: status.available,
      playbackState: status.playbackState,
      activeDocumentId: status.activeDocumentId,
      consoleTail: status.consoleTail.map((entry) => ({ ...entry })),
    });
  }

  private createHistoryGuard(
    auth: McpAuthContext,
    expected: McpDocumentReceipt,
  ): ProjectHistoryTrustedGuard {
    return {
      expectedDocumentId: expected.documentId,
      expectedRevision: expected.revision,
      expectedStateId: expected.stateId,
      rejectOversize: true,
      authorizeBeforeCommit: () => {
        const recheck = this.checkGate(auth, 'write');
        if (!recheck.ok) {
          return {
            ok: false,
            code: recheck.code as 'ACCESS_DENIED' | 'CANCELLED' | 'CONFLICT',
            reason: recheck.message,
          };
        }
        return { ok: true };
      },
    };
  }

  private prepareWriteContext(
    auth: McpAuthContext,
    expected: McpDocumentReceipt,
  ): McpResult<{
    snapshot: Readonly<ProjectSessionSnapshot>;
    data: BlueData;
    receipt: McpDocumentReceipt;
    history: NonNullable<McpBridgeDependencies['history']>;
  }> {
    const gate = this.checkGate(auth, 'write');
    if (!gate.ok) return gate;

    if (!isValidReceipt(expected)) {
      return err(
        'INVALID_INPUT',
        'expected must be a valid receipt containing documentId, revision, and stateId.',
      );
    }

    const project = this.requireActiveProject();
    if (!project.ok) return project;

    if (!receiptsMatch(expected, project.value.receipt)) {
      return err(
        'CONFLICT',
        'The expected project receipt is stale. Reread the current project receipt and retry.',
      );
    }

    if (!this.deps.history) {
      return err('UNSUPPORTED_CONTENT', 'Project history coordinator is not configured.');
    }

    return ok({
      ...project.value,
      history: this.deps.history,
    });
  }

  async updateInstrumentCode(
    auth: McpAuthContext,
    input: UpdateInstrumentCodeInput,
  ): Promise<McpResult<McpWriteOutcome>> {
    const gate = this.checkGate(auth, 'write');
    if (!gate.ok) return gate;

    if (
      typeof input.instrumentId !== 'string' ||
      input.instrumentId.trim().length === 0 ||
      input.instrumentId.length > MAX_INSTRUMENT_ID_LENGTH
    ) {
      return err('INVALID_INPUT', 'instrumentId must be a non-empty bounded string.');
    }
    if (!input.changes || typeof input.changes !== 'object') {
      return err('INVALID_INPUT', 'changes must be provided.');
    }

    const { text, instrumentText, alwaysOnInstrumentText, globalOrc, globalSco } = input.changes;
    if (
      text === undefined &&
      instrumentText === undefined &&
      alwaysOnInstrumentText === undefined &&
      globalOrc === undefined &&
      globalSco === undefined
    ) {
      return err('INVALID_INPUT', 'changes must specify at least one code field.');
    }

    const contextResult = this.prepareWriteContext(auth, input.expected);
    if (!contextResult.ok) return contextResult;
    const { data, history } = contextResult.value;

    const instrument = data.getArrangement().getInstrumentById(input.instrumentId);
    if (!instrument) {
      return err(
        'NOT_FOUND',
        `Instrument "${input.instrumentId}" was not found in the Arrangement.`,
      );
    }

    const patch: InstrumentPatch = {};
    if (instrument instanceof GenericInstrument) {
      if (instrumentText !== undefined || alwaysOnInstrumentText !== undefined) {
        return err(
          'INVALID_INPUT',
          'GenericInstrument supports text, globalOrc, and globalSco, not BlueSynthBuilder fields.',
        );
      }
      if (text !== undefined && text !== instrument.getText()) {
        patch.text = text;
      }
      if (globalOrc !== undefined && globalOrc !== instrument.getGlobalOrc()) {
        patch.globalOrc = globalOrc;
      }
      if (globalSco !== undefined && globalSco !== instrument.getGlobalSco()) {
        patch.globalSco = globalSco;
      }
    } else if (instrument instanceof BlueSynthBuilder) {
      if (text !== undefined) {
        return err(
          'INVALID_INPUT',
          'BlueSynthBuilder supports instrumentText, alwaysOnInstrumentText, globalOrc, and globalSco, not text.',
        );
      }
      if (instrumentText !== undefined && instrumentText !== instrument.getInstrumentText()) {
        patch.instrumentText = instrumentText;
      }
      if (
        alwaysOnInstrumentText !== undefined &&
        alwaysOnInstrumentText !== instrument.getAlwaysOnInstrumentText()
      ) {
        patch.alwaysOnInstrumentText = alwaysOnInstrumentText;
      }
      if (globalOrc !== undefined && globalOrc !== instrument.getGlobalOrc()) {
        patch.globalOrc = globalOrc;
      }
      if (globalSco !== undefined && globalSco !== instrument.getGlobalSco()) {
        patch.globalSco = globalSco;
      }
    } else {
      return err(
        'UNSUPPORTED_CONTENT',
        `Instrument "${input.instrumentId}" of type ${getInstrumentTypeName(instrument)} does not support MCP code editing.`,
      );
    }

    const patches: ProjectDocumentPatch[] =
      Object.keys(patch).length > 0
        ? [
            {
              orchestra: {
                type: 'updateInstrument',
                assignmentId: input.instrumentId,
                patch,
              },
            },
          ]
        : [];

    const response = await history.commitGuarded(
      {
        operationId: `mcp-${randomUUID()}`,
        documentId: input.expected.documentId,
        expectedRevision: input.expected.revision,
        contextSequence: 0,
        label: `MCP: Update Instrument ${input.instrumentId}`,
        origin: { contextId: 'mcp' },
        phase: 'single',
        patches,
      },
      this.createHistoryGuard(auth, input.expected),
    );
    return mapGuardedWriteResponse(response);
  }

  async upsertInstrument(
    auth: McpAuthContext,
    input: UpsertInstrumentInput,
  ): Promise<McpResult<McpWriteOutcome>> {
    const gate = this.checkGate(auth, 'write');
    if (!gate.ok) return gate;

    if (!isValidCsoundInstrumentId(input.instrumentId)) {
      return err(
        'INVALID_INPUT',
        'instrumentId must be a positive integer or a valid Csound instrument identifier.',
      );
    }
    if (!input.changes || typeof input.changes !== 'object') {
      return err('INVALID_INPUT', 'changes must be provided.');
    }

    const { name, enabled } = input.changes;
    if (name === undefined && enabled === undefined) {
      return err('INVALID_INPUT', 'changes must specify name and/or enabled.');
    }
    if (name !== undefined && name.trim().length === 0) {
      return err('INVALID_INPUT', 'Instrument name must not be empty.');
    }

    const contextResult = this.prepareWriteContext(auth, input.expected);
    if (!contextResult.ok) return contextResult;
    const { snapshot, data, receipt, history } = contextResult.value;
    const guard = this.createHistoryGuard(auth, input.expected);

    const existing = data
      .getArrangement()
      .getArrangement()
      .find((assignment) => assignment.arrangementId === input.instrumentId);

    if (existing) {
      const patches: ProjectDocumentPatch[] = [];
      if (name !== undefined && existing.instr && name !== existing.instr.getName()) {
        patches.push({
          orchestra: {
            type: 'updateInstrument',
            assignmentId: input.instrumentId,
            patch: { name },
          },
        });
      }
      if (enabled !== undefined && enabled !== existing.enabled) {
        patches.push({
          orchestra: {
            type: 'updateAssignment',
            assignmentId: input.instrumentId,
            enabled,
          },
        });
      }

      const response = await history.commitGuarded(
        {
          operationId: `mcp-${randomUUID()}`,
          documentId: receipt.documentId,
          expectedRevision: receipt.revision,
          contextSequence: 0,
          label: `MCP: Update Instrument ${input.instrumentId}`,
          origin: { contextId: 'mcp' },
          phase: 'single',
          patches,
        },
        guard,
      );
      return mapGuardedWriteResponse(response);
    }

    if (name === undefined) {
      return err('INVALID_INPUT', 'Creating a new instrument requires a non-empty name.');
    }

    const candidate = forkProjectGraph(data, new Set(['arrangement', 'mixer']));
    const created = new GenericInstrument();
    created.setName(name);
    candidate.getArrangement().addInstrumentWithId(created, input.instrumentId, true);
    if (enabled === false) {
      candidate.getArrangement().updateAssignment(input.instrumentId, { enabled: false });
    }
    reconcileMixerWithArrangement(candidate);

    const response = await history.commitPreparedStructuralMutationGuarded(
      {
        label: `MCP: Add Instrument ${input.instrumentId}`,
        candidate,
        rootFields: ['arrangement', 'mixer'],
        expectedDocumentId: receipt.documentId,
        expectedSessionId: snapshot.sessionId,
        expectedRevision: receipt.revision,
        origin: { contextId: 'mcp' },
        validateBeforeCommit: (current) => {
          if (current.data?.getArrangement().getInstrumentById(input.instrumentId)) {
            return `CONFLICT: Instrument "${input.instrumentId}" already exists.`;
          }
          return undefined;
        },
      },
      guard,
    );
    return mapGuardedWriteResponse(response);
  }

  async updateScoreObject(
    auth: McpAuthContext,
    input: UpdateScoreObjectInput,
  ): Promise<McpResult<McpWriteOutcome>> {
    const gate = this.checkGate(auth, 'write');
    if (!gate.ok) return gate;

    if (!validateLayerLocator(input.locator) || !isNonNegativeSafeInt(input.locator.objectIndex)) {
      return err(
        'INVALID_INPUT',
        'locator must contain an odd non-empty layerGroupPath and non-negative integer layerIndex and objectIndex.',
      );
    }
    if (!input.changes || typeof input.changes !== 'object') {
      return err('INVALID_INPUT', 'changes must be provided.');
    }

    const { start, duration, name, text } = input.changes;
    if (start === undefined && duration === undefined && name === undefined && text === undefined) {
      return err('INVALID_INPUT', 'changes must specify at least one score object field.');
    }
    if (
      name !== undefined &&
      (typeof name !== 'string' || name.length > MAX_SCORE_OBJECT_NAME_LENGTH)
    ) {
      return err(
        'INVALID_INPUT',
        `name must be a string up to ${MAX_SCORE_OBJECT_NAME_LENGTH} characters.`,
      );
    }
    if (
      start !== undefined &&
      (typeof start !== 'number' || !Number.isFinite(start) || start < 0)
    ) {
      return err('INVALID_INPUT', 'start must be a finite number >= 0.');
    }
    if (
      duration !== undefined &&
      (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0)
    ) {
      return err('INVALID_INPUT', 'duration must be a finite number > 0.');
    }

    const contextResult = this.prepareWriteContext(auth, input.expected);
    if (!contextResult.ok) return contextResult;
    const { data, receipt, history } = contextResult.value;

    const resolved = resolveScoreLayer(data, input.locator);
    if (!resolved || resolved.layer instanceof PatternLayer || !Array.isArray(resolved.layer)) {
      return err(
        'NOT_FOUND',
        'The specified score layer or object was not found for the current project receipt.',
      );
    }

    const item = resolved.layer[input.locator.objectIndex] as SoundObject | AudioClip | undefined;
    if (!item) {
      return err(
        'NOT_FOUND',
        `Score object at index ${input.locator.objectIndex} was not found on the specified layer.`,
      );
    }

    if (text !== undefined) {
      if (
        item instanceof AudioClip ||
        item instanceof Instance ||
        !(item instanceof GenericScore)
      ) {
        return err(
          'UNSUPPORTED_CONTENT',
          `Score object of type ${item.constructor.name} does not support MCP text updates.`,
        );
      }
    }

    const rootGroup = data.getScore()[input.locator.layerGroupPath[0]!];
    const containerPath: Array<{ layerIndex: number; objectIndex: number }> = [];
    for (let i = 1; i < input.locator.layerGroupPath.length; i += 2) {
      containerPath.push({
        layerIndex: input.locator.layerGroupPath[i]!,
        objectIndex: input.locator.layerGroupPath[i + 1]!,
      });
    }
    const location: ScoreObjectLocationRef = {
      rootGroupIndex: input.locator.layerGroupPath[0]!,
      containerPath,
      layerIndex: input.locator.layerIndex,
      objectIndex: input.locator.objectIndex,
      ...(rootGroup ? { rootGroupId: assignLayerGroupId(rootGroup) } : {}),
      layerKind: resolved.group instanceof TrackLayerGroup ? 'track' : 'soundObject',
    };

    const selectionId = assignScoreObjectId(item, item instanceof AudioClip ? 'aclp' : 'sobj');
    const target: ScoreObjectEditorTargetSnapshot =
      item instanceof AudioClip
        ? {
            selectionId,
            selectedObjectType: 'AudioClip',
            editorObjectType: 'AudioClip',
            ownerKind: 'timeline',
            displayContext: 'timeline',
            location,
            supportsTimeBehavior: false,
            supportsRepeatPoint: false,
            supportsNoteProcessorChain: false,
          }
        : createScoreObjectPropertiesTarget(buildEditorTargetSnapshot(item, selectionId, location));

    const context = data.getScore().getTimeContext();
    const sharedPatch: {
      startTime?: { value: number; timeBase: string };
      subjectiveDuration?: { value: number; timeBase: string };
      name?: string;
    } = {};

    if (start !== undefined && start !== item.getStartTime().toBeats(context)) {
      sharedPatch.startTime = {
        value: start,
        timeBase: String(item.getStartTime().getTimeBase()),
      };
    }
    if (duration !== undefined && duration !== item.getSubjectiveDuration().toBeats(context)) {
      sharedPatch.subjectiveDuration = {
        value: duration,
        timeBase: String(item.getSubjectiveDuration().getTimeBase()),
      };
    }
    if (name !== undefined && name !== item.getName()) {
      sharedPatch.name = name;
    }

    const patches: ProjectDocumentPatch[] = [];
    if (
      sharedPatch.startTime !== undefined ||
      sharedPatch.subjectiveDuration !== undefined ||
      sharedPatch.name !== undefined
    ) {
      patches.push({
        score: {
          type: 'updateSharedProperties',
          target,
          patch: sharedPatch,
        },
      });
    }
    if (text !== undefined && item instanceof GenericScore && text !== item.getScoreText()) {
      patches.push({
        score: {
          type: 'updateTypeSpecificEditor',
          target,
          patch: { text },
        },
      });
    }

    const response = await history.commitGuarded(
      {
        operationId: `mcp-${randomUUID()}`,
        documentId: receipt.documentId,
        expectedRevision: receipt.revision,
        contextSequence: 0,
        label: 'MCP: Update Score Object',
        origin: { contextId: 'mcp' },
        phase: 'single',
        patches,
      },
      this.createHistoryGuard(auth, input.expected),
    );
    return mapGuardedWriteResponse(response);
  }

  async setProjectProperties(
    auth: McpAuthContext,
    input: SetProjectPropertiesInput,
  ): Promise<McpResult<McpWriteOutcome>> {
    const gate = this.checkGate(auth, 'write');
    if (!gate.ok) return gate;

    if (!input.changes || typeof input.changes !== 'object') {
      return err('INVALID_INPUT', 'changes must be provided.');
    }

    const { title, author, notes, sampleRate, ksmps, nchnls } = input.changes;
    if (
      title === undefined &&
      author === undefined &&
      notes === undefined &&
      sampleRate === undefined &&
      ksmps === undefined &&
      nchnls === undefined
    ) {
      return err('INVALID_INPUT', 'changes must specify at least one project property.');
    }
    if (sampleRate !== undefined && (!Number.isSafeInteger(sampleRate) || sampleRate < 1)) {
      return err('INVALID_INPUT', 'sampleRate must be a positive integer.');
    }
    if (ksmps !== undefined && (!Number.isSafeInteger(ksmps) || ksmps < 1)) {
      return err('INVALID_INPUT', 'ksmps must be a positive integer.');
    }
    if (nchnls !== undefined && (!Number.isSafeInteger(nchnls) || nchnls < 1)) {
      return err('INVALID_INPUT', 'nchnls must be a positive integer.');
    }

    const contextResult = this.prepareWriteContext(auth, input.expected);
    if (!contextResult.ok) return contextResult;
    const { data, receipt, history } = contextResult.value;

    const props = data.getProjectProperties();
    const patch: NonNullable<ProjectDocumentPatch['projectProperties']> = {};
    if (title !== undefined && title !== props.title) {
      patch.title = title;
    }
    if (author !== undefined && author !== props.author) {
      patch.author = author;
    }
    if (notes !== undefined && notes !== props.notes) {
      patch.notes = notes;
    }
    if (sampleRate !== undefined && String(sampleRate) !== props.sampleRate) {
      patch.sampleRate = String(sampleRate);
    }
    if (ksmps !== undefined && String(ksmps) !== props.ksmps) {
      patch.ksmps = String(ksmps);
    }
    if (nchnls !== undefined && String(nchnls) !== props.nchnls) {
      patch.nchnls = String(nchnls);
    }

    const patches: ProjectDocumentPatch[] =
      Object.keys(patch).length > 0 ? [{ projectProperties: patch }] : [];

    const response = await history.commitGuarded(
      {
        operationId: `mcp-${randomUUID()}`,
        documentId: receipt.documentId,
        expectedRevision: receipt.revision,
        contextSequence: 0,
        label: 'MCP: Set Project Properties',
        origin: { contextId: 'mcp' },
        phase: 'single',
        patches,
      },
      this.createHistoryGuard(auth, input.expected),
    );
    return mapGuardedWriteResponse(response);
  }

  private prepareRuntimeContext(
    auth: McpAuthContext,
    expected: McpDocumentReceipt,
  ): McpResult<{ receipt: McpDocumentReceipt; runtime: McpRuntimeAdapters }> {
    const gate = this.checkGate(auth, 'runtime');
    if (!gate.ok) return gate;

    if (!isValidReceipt(expected)) {
      return err(
        'INVALID_INPUT',
        'expected must be a valid receipt containing documentId, revision, and stateId.',
      );
    }

    const project = this.requireActiveProject();
    if (!project.ok) return project;

    if (!receiptsMatch(expected, project.value.receipt)) {
      return err(
        'CONFLICT',
        'The expected project receipt is stale. Reread the current project receipt and retry.',
      );
    }

    if (!this.deps.runtime) {
      return err('ENGINE_UNAVAILABLE', 'MCP runtime controls are unavailable.');
    }

    return ok({ receipt: project.value.receipt, runtime: this.deps.runtime });
  }

  async transportPlay(
    auth: McpAuthContext,
    expected: McpDocumentReceipt,
  ): Promise<McpResult<McpTransportOutcome>> {
    const ctx = this.prepareRuntimeContext(auth, expected);
    if (!ctx.ok) return ctx;
    if (!ctx.value.runtime.transportPlay) {
      return err('ENGINE_UNAVAILABLE', 'Timeline playback control is unavailable.');
    }
    // Pre-effect fences live inside transportPlay; once playback starts, return the terminal result.
    return ctx.value.runtime.transportPlay(auth, expected);
  }

  async transportStop(
    auth: McpAuthContext,
    expected: McpDocumentReceipt,
  ): Promise<McpResult<McpTransportOutcome>> {
    const ctx = this.prepareRuntimeContext(auth, expected);
    if (!ctx.ok) return ctx;
    if (!ctx.value.runtime.transportStop) {
      return err('ENGINE_UNAVAILABLE', 'Timeline playback control is unavailable.');
    }
    return ctx.value.runtime.transportStop(auth, expected);
  }

  async renderToDisk(
    auth: McpAuthContext,
    input: RenderToDiskInput,
  ): Promise<McpResult<ConfinedMcpRenderSuccess>> {
    const gate = this.checkGate(auth, 'runtime');
    if (!gate.ok) return gate;

    if (!input || typeof input !== 'object') {
      return err('INVALID_INPUT', 'render_to_disk input must be an object.');
    }
    const filenameValidation = validateMcpWavFilename(input.filename);
    if (!filenameValidation.ok) {
      return err('INVALID_INPUT', filenameValidation.message);
    }
    const destination = input.destination ?? 'project';
    if (destination !== 'project' && destination !== 'choose') {
      return err('INVALID_INPUT', 'destination must be "project" or "choose".');
    }

    const ctx = this.prepareRuntimeContext(auth, input.expected);
    if (!ctx.ok) return ctx;
    if (!ctx.value.runtime.renderToDisk) {
      return err('ENGINE_UNAVAILABLE', 'Disk render control is unavailable.');
    }

    // Pre-publication fences live inside renderToDisk/executeConfinedMcpRender;
    // once audio is published, preserve the terminal success outcome.
    return ctx.value.runtime.renderToDisk(auth, {
      expected: input.expected,
      filename: filenameValidation.filename,
      destination,
    });
  }
}
