import type { BsbInterfacePatch, ProjectDocumentPatch } from '../shared/project-editor/contract';
import type { ProjectRuntimeOutcome, ProjectRuntimeOutcomeStatus } from '../shared/project-history';
import { blueX7PatchToRuntimeIntent } from '../shared/blue-x7-patch-intents';

export type PerformanceKind = 'timeline' | 'blueLive';

/**
 * Runtime capability of a committed change. `none` is cosmetic or
 * presentation-only content with no engine relevance; `live` values can be
 * reconciled on an active performance; `restart-required` content needs the
 * next compile. Unclassified runtime-relevant members fail closed to
 * `restart-required` — never assume no engine work.
 */
export type RuntimeCapability = 'none' | 'live' | 'restart-required';

export interface RuntimeChannelValueOperation {
  readonly kind: 'channel-value';
  readonly ownerKey: string;
  readonly parameterId: string;
  /** Compiled channel name resolved from the generation binding registry. */
  readonly channel: string;
  readonly value: number;
}

export interface RuntimeAutomationOperation {
  readonly kind: 'automation';
  readonly ownerKey: string;
  readonly parameterId: string;
  readonly operation: 'create' | 'update' | 'delete';
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface RuntimePresetOperation {
  readonly kind: 'preset';
  readonly ownerKey: string;
  readonly presetUniqueId: string;
}

export type RuntimeWorkOperation =
  | RuntimeChannelValueOperation
  | RuntimeAutomationOperation
  | RuntimePresetOperation;

/**
 * Immutable per-performance unit of runtime work derived from one committed
 * transition. Values are primitives or detached copies — never model
 * references — so delayed engine jobs cannot observe later mutations.
 */
export interface RuntimeWorkPlan {
  readonly planId: string;
  readonly documentId: string;
  readonly revision: number;
  readonly performanceKind: PerformanceKind;
  readonly generation: number;
  readonly operations: readonly RuntimeWorkOperation[];
  readonly restartRequiredOwnerIds: readonly string[];
}

export type RuntimeBinding =
  | { readonly kind: 'channel'; readonly channel: string }
  | {
      readonly kind: 'automation';
      readonly supportsCreate: boolean;
      readonly supportsUpdate: boolean;
      readonly supportsDelete: boolean;
    };

/** Keyed by `${ownerKey}::${parameterId}`; valid only for one generation. */
export type RuntimeBindingRegistry = ReadonlyMap<string, RuntimeBinding>;

export interface RuntimeOperationAck {
  readonly status: 'applied' | 'rejected';
  readonly message?: string;
}

/**
 * Acknowledged runtime route. A resolved Promise alone is not success —
 * implementations must return a structured acknowledgement.
 */
export interface AcknowledgedRuntimeClient {
  applyOperation(operation: RuntimeWorkOperation): Promise<RuntimeOperationAck>;
}

export interface ProjectRuntimeReconciliationOptions {
  onOutcome?: (outcome: ProjectRuntimeOutcome, context?: RuntimeOutcomeContext) => void;
  /**
   * Acknowledgement timeout for a single runtime operation. A timed-out
   * request is failed and recoverable, and fences the performance queue so
   * later work cannot claim authority while the late request may still
   * execute engine-side.
   */
  operationTimeoutMs?: number;
}

/** Immutable document identity carried with delayed runtime notifications. */
export interface RuntimeOutcomeContext {
  readonly documentId: string;
}

interface PatchRuntimeWork {
  capability: RuntimeCapability;
  /** Unresolved operations (binding resolution happens per performance). */
  operations: RuntimeWorkOperation[];
  restartRequiredOwnerIds: string[];
}

const CAPABILITY_PRECEDENCE: Record<RuntimeCapability, number> = {
  none: 0,
  live: 1,
  'restart-required': 2,
};

const OUTCOME_PRECEDENCE: Record<ProjectRuntimeOutcomeStatus, number> = {
  applied: 0,
  pending: 1,
  'restart-required': 2,
  failed: 3,
};

const BSB_VALUE_PROPERTY_KEYS = new Set(['value', 'selected', 'selectedIndex', 'xValue', 'yValue']);

function bsbPropertyParameterId(widgetId: string, propertyKey: string): string {
  return propertyKey === 'value' ? `bsb:${widgetId}` : `bsb:${widgetId}:${propertyKey}`;
}

function mergeCapability(a: RuntimeCapability, b: RuntimeCapability): RuntimeCapability {
  return CAPABILITY_PRECEDENCE[b] > CAPABILITY_PRECEDENCE[a] ? b : a;
}

function emptyPatchWork(): PatchRuntimeWork {
  return { capability: 'none', operations: [], restartRequiredOwnerIds: [] };
}

function restartWork(ownerId: string): PatchRuntimeWork {
  return { capability: 'restart-required', operations: [], restartRequiredOwnerIds: [ownerId] };
}

function combinePatchWork(works: PatchRuntimeWork[]): PatchRuntimeWork {
  const combined = emptyPatchWork();
  for (const work of works) {
    combined.capability = mergeCapability(combined.capability, work.capability);
    combined.operations.push(...work.operations);
    for (const ownerId of work.restartRequiredOwnerIds) {
      if (!combined.restartRequiredOwnerIds.includes(ownerId)) {
        combined.restartRequiredOwnerIds.push(ownerId);
      }
    }
  }
  return combined;
}

function channelValueOperation(
  ownerKey: string,
  parameterId: string,
  value: unknown,
): PatchRuntimeWork {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return restartWork(ownerKey);
  }
  return {
    capability: 'live',
    operations: [{ kind: 'channel-value', ownerKey, parameterId, channel: '', value }],
    restartRequiredOwnerIds: [],
  };
}

function classifyBsbInterfacePatch(
  bsbPatch: BsbInterfacePatch | undefined,
  ownerKey: string,
): PatchRuntimeWork {
  if (!bsbPatch) return emptyPatchWork();

  switch (bsbPatch.type) {
    case 'selectWidget':
      return emptyPatchWork();
    case 'updateWidgetProperties': {
      const works: PatchRuntimeWork[] = [];
      for (const [propertyKey, propertyValue] of Object.entries(bsbPatch.properties)) {
        if (BSB_VALUE_PROPERTY_KEYS.has(propertyKey)) {
          works.push(
            channelValueOperation(
              ownerKey,
              bsbPropertyParameterId(bsbPatch.widgetId, propertyKey),
              typeof propertyValue === 'boolean' ? (propertyValue ? 1 : 0) : propertyValue,
            ),
          );
        } else {
          works.push(restartWork(ownerKey));
        }
      }
      return works.length > 0 ? combinePatchWork(works) : emptyPatchWork();
    }
    case 'updateSliderBankValue':
      return channelValueOperation(
        ownerKey,
        `bsb:${bsbPatch.widgetId}[${bsbPatch.sliderIndex}]`,
        bsbPatch.value,
      );
    case 'applyPreset':
      return {
        capability: 'live',
        operations: [{ kind: 'preset', ownerKey, presetUniqueId: bsbPatch.presetUniqueId }],
        restartRequiredOwnerIds: [],
      };
    default:
      return restartWork(ownerKey);
  }
}

type InstrumentUpdatePatch = Extract<
  ProjectDocumentPatch['orchestra'],
  { type: 'updateInstrument' }
>['patch'];

function classifyInstrumentPatch(patch: InstrumentUpdatePatch, ownerKey: string): PatchRuntimeWork {
  const works: PatchRuntimeWork[] = [];
  for (const key of Object.keys(patch) as Array<keyof InstrumentUpdatePatch>) {
    switch (key) {
      case 'name':
      case 'comment':
      case 'comments':
        works.push(emptyPatchWork());
        break;
      case 'bsbWidgetValues': {
        const values = patch.bsbWidgetValues;
        for (const [widgetId, value] of Object.entries(values ?? {})) {
          works.push(channelValueOperation(ownerKey, `bsb:${widgetId}`, value));
        }
        break;
      }
      case 'bsbInterface':
        works.push(classifyBsbInterfacePatch(patch.bsbInterface, ownerKey));
        break;
      case 'blueX7':
        works.push(classifyBlueX7Patch(patch.blueX7, ownerKey));
        break;
      default:
        // Unknown instrument fields may affect compiled output: fail closed.
        works.push(restartWork(ownerKey));
        break;
    }
  }
  return works.length > 0 ? combinePatchWork(works) : emptyPatchWork();
}

type BlueX7UpdatePatch = NonNullable<InstrumentUpdatePatch['blueX7']>;

function classifyBlueX7Patch(
  patch: BlueX7UpdatePatch | undefined,
  ownerKey: string,
): PatchRuntimeWork {
  if (!patch) return emptyPatchWork();

  if (patch.type === 'setCsoundPostCode') return restartWork(ownerKey);

  const intent = blueX7PatchToRuntimeIntent(patch);
  if (intent.kind === 'fixed-delta') {
    return combinePatchWork(
      intent.changes.map((change) =>
        channelValueOperation(ownerKey, `bluex7:${change.semanticKey}`, change.value),
      ),
    );
  }
  if (intent.kind === 'complete-voice' && patch.type === 'replaceVoice') {
    return {
      capability: 'live',
      operations: [
        {
          kind: 'automation',
          ownerKey,
          parameterId: 'bluex7:voice',
          operation: 'update',
          payload: { voice: structuredClone(patch.voice) },
        },
      ],
      restartRequiredOwnerIds: [],
    };
  }
  return restartWork(ownerKey);
}

type MixerChannelUpdatePatch = Extract<
  ProjectDocumentPatch['mixer'],
  { type: 'updateChannel' }
>['patch'];

const MIXER_CHANNEL_LIVE_KEYS = new Set<keyof MixerChannelUpdatePatch>(['level', 'volume', 'pan']);

function classifyMixerPatch(patch: NonNullable<ProjectDocumentPatch['mixer']>): PatchRuntimeWork {
  switch (patch.type) {
    case 'renameChannelListGroup':
      return emptyPatchWork();
    case 'updateChannel': {
      const works: PatchRuntimeWork[] = [];
      for (const key of Object.keys(patch.patch) as Array<keyof MixerChannelUpdatePatch>) {
        if (MIXER_CHANNEL_LIVE_KEYS.has(key)) {
          works.push(channelValueOperation(patch.channelId, key, patch.patch[key]));
        } else if (key === 'name') {
          works.push(emptyPatchWork());
        } else {
          works.push(restartWork(patch.channelId));
        }
      }
      return works.length > 0 ? combinePatchWork(works) : emptyPatchWork();
    }
    case 'updateEffect': {
      const works: PatchRuntimeWork[] = [];
      const ownerKey = `${patch.channelId}:${patch.entryId}`;
      for (const key of Object.keys(patch.patch) as Array<keyof typeof patch.patch>) {
        if (key === 'bsbInterface') {
          works.push(classifyBsbInterfacePatch(patch.patch.bsbInterface, ownerKey));
        } else if (key === 'name' || key === 'comments') {
          works.push(emptyPatchWork());
        } else {
          works.push(restartWork(patch.entryId));
        }
      }
      return works.length > 0 ? combinePatchWork(works) : emptyPatchWork();
    }
    case 'updateSend': {
      const works: PatchRuntimeWork[] = [];
      const ownerKey = `${patch.channelId}:${patch.entryId}`;
      for (const key of Object.keys(patch.patch)) {
        if (key === 'level') {
          works.push(channelValueOperation(ownerKey, 'sendLevel', patch.patch.level));
        } else {
          works.push(restartWork(patch.entryId));
        }
      }
      return works.length > 0 ? combinePatchWork(works) : emptyPatchWork();
    }
    default:
      return restartWork('mixer');
  }
}

type OrchestraUpdatePatch = NonNullable<ProjectDocumentPatch['orchestra']>;

function classifyOrchestraPatch(patch: OrchestraUpdatePatch): PatchRuntimeWork {
  switch (patch.type) {
    case 'updateInstrumentComment':
      return emptyPatchWork();
    case 'updateInstrument':
      return classifyInstrumentPatch(patch.patch, `arrangement:${patch.assignmentId}`);
    default:
      return restartWork('orchestra');
  }
}

type BlueLiveUpdatePatch = NonNullable<ProjectDocumentPatch['blueLive']>;

function classifyBlueLivePatch(patch: BlueLiveUpdatePatch): PatchRuntimeWork {
  if (patch.type === 'renameSet') return emptyPatchWork();
  return restartWork('blueLive');
}

type ScoreUpdatePatch = NonNullable<ProjectDocumentPatch['score']>;

function automationOperation(
  operation: 'create' | 'update' | 'delete',
  parameterId: string,
  payload: Record<string, unknown>,
): PatchRuntimeWork {
  return {
    capability: 'live',
    operations: [
      {
        kind: 'automation',
        ownerKey: 'score',
        parameterId,
        operation,
        payload: structuredClone(payload),
      },
    ],
    restartRequiredOwnerIds: [],
  };
}

const SCORE_COSMETIC_TYPES = new Set([
  'renameLayer',
  'renameLayerGroup',
  'setScoreObjectBackgroundColors',
  'selectLayerAutomation',
  'setAutomationLineColor',
]);

function classifyScorePatch(patch: ScoreUpdatePatch): PatchRuntimeWork {
  switch (patch.type) {
    case 'renameLayer':
    case 'renameLayerGroup':
    case 'selectLayerAutomation':
    case 'setAutomationLineColor':
    case 'setScoreObjectBackgroundColors':
      return emptyPatchWork();
    case 'updateLayerState': {
      const works: PatchRuntimeWork[] = [];
      const keys = Object.keys(patch.patch);
      for (const key of keys) {
        if (key === 'backgroundColor' || key === 'heightIndex') {
          works.push(emptyPatchWork());
        } else {
          works.push(restartWork(patch.groupId));
        }
      }
      return works.length > 0 ? combinePatchWork(works) : emptyPatchWork();
    }
    case 'updateSharedProperties': {
      const works: PatchRuntimeWork[] = [];
      for (const key of Object.keys(patch.patch)) {
        if (key === 'name' || key === 'backgroundColor') {
          works.push(emptyPatchWork());
        } else {
          works.push(restartWork(patch.target.selectionId));
        }
      }
      return works.length > 0 ? combinePatchWork(works) : emptyPatchWork();
    }
    case 'setAutomationPoints':
      return automationOperation('update', patch.parameterId, {
        parameterId: patch.parameterId,
        points: patch.points,
      });
    case 'insertAutomationPoint':
      return automationOperation('create', patch.parameterId, {
        parameterId: patch.parameterId,
        point: patch.point,
      });
    case 'deleteAutomationPoint':
      return automationOperation('delete', patch.parameterId, {
        parameterId: patch.parameterId,
        pointIndex: patch.pointIndex,
      });
    case 'moveAutomationPoint':
      return automationOperation('update', patch.parameterId, {
        parameterId: patch.parameterId,
        pointIndex: patch.pointIndex,
        point: patch.point,
      });
    case 'setAutomationResolution':
      return automationOperation('update', patch.parameterId, {
        parameterId: patch.parameterId,
        resolutionDecimal: patch.resolutionDecimal,
      });
    case 'updateTrackInstrument':
      return classifyInstrumentPatch(
        patch.patch,
        `track:${patch.track.rootGroupId}:${patch.track.trackId}`,
      );
    default:
      return restartWork('score');
  }
}

function classifyProjectPropertiesPatch(
  patch: NonNullable<ProjectDocumentPatch['projectProperties']>,
): PatchRuntimeWork {
  const works: PatchRuntimeWork[] = [];
  for (const key of Object.keys(patch)) {
    if (key === 'title' || key === 'author') {
      works.push(emptyPatchWork());
    } else {
      works.push(restartWork('projectProperties'));
    }
  }
  return works.length > 0 ? combinePatchWork(works) : emptyPatchWork();
}

/** Classifies one committed patch into runtime capability and unresolved work. */
export function extractPatchRuntimeWork(patch: ProjectDocumentPatch): PatchRuntimeWork {
  if (patch.scratchPad !== undefined) return emptyPatchWork();
  if (patch.globalOrc !== undefined) return restartWork('globalOrc');
  if (patch.globalSco !== undefined) return restartWork('globalSco');
  if (patch.tablesText !== undefined) return restartWork('tablesText');
  if (patch.clojureProject !== undefined) return restartWork('clojureProject');
  if (patch.projectUdo !== undefined) return restartWork('udo');
  if (patch.midiInput !== undefined) return restartWork('midiInput');
  if (patch.transport !== undefined) return restartWork('transport');
  if (patch.projectProperties !== undefined) {
    return classifyProjectPropertiesPatch(patch.projectProperties);
  }
  if (patch.orchestra !== undefined) return classifyOrchestraPatch(patch.orchestra);
  if (patch.mixer !== undefined) return classifyMixerPatch(patch.mixer);
  if (patch.blueLive !== undefined) return classifyBlueLivePatch(patch.blueLive);
  if (patch.score !== undefined) return classifyScorePatch(patch.score);
  return restartWork('unclassified');
}

export function classifyPatchRuntimeCapability(patch: ProjectDocumentPatch): RuntimeCapability {
  return extractPatchRuntimeWork(patch).capability;
}

export function classifyPatchesRuntimeCapability(
  patches: readonly ProjectDocumentPatch[],
): RuntimeCapability {
  let capability: RuntimeCapability = 'none';
  for (const patch of patches) {
    capability = mergeCapability(capability, classifyPatchRuntimeCapability(patch));
  }
  return capability;
}

function bindingKey(ownerKey: string, parameterId: string): string {
  return `${ownerKey}::${parameterId}`;
}

function outcomeFor(
  plan: RuntimeWorkPlan,
  status: ProjectRuntimeOutcomeStatus,
  ownerIds: string[],
  message?: string,
): ProjectRuntimeOutcome {
  return {
    performanceKind: plan.performanceKind,
    generation: plan.generation,
    desiredRevision: plan.revision,
    ...(status === 'applied' ? { appliedRevision: plan.revision } : {}),
    status,
    ...(message === undefined ? {} : { message }),
    affectedOwnerIds: ownerIds,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface ActivePerformance {
  kind: PerformanceKind;
  generation: number;
  client: AcknowledgedRuntimeClient;
  bindings: RuntimeBindingRegistry;
  /** Serializes plan execution in submission order. */
  chain: Promise<void>;
  lastOutcome: ProjectRuntimeOutcome | null;
  /**
   * True while a timed-out request may still execute engine-side: newer
   * plans for this generation are discarded until a new generation registers.
   */
  fenced: boolean;
}

/**
 * Contract: while restart-required remains for an owner, later scalar changes
 * to that owner also await restart; the owner is not live-authorized merely
 * because a later commit restored its value. Memory is per performance kind
 * and cleared when a new generation registers (restart rebuilds bindings).
 */
function createOwnerRestartMemory(): Map<PerformanceKind, Set<string>> {
  return new Map([
    ['timeline', new Set<string>()],
    ['blueLive', new Set<string>()],
  ]);
}

export class ProjectRuntimeReconciliation {
  private readonly performances = new Map<PerformanceKind, ActivePerformance>();
  private readonly onOutcome: (
    outcome: ProjectRuntimeOutcome,
    context?: RuntimeOutcomeContext,
  ) => void;
  private readonly operationTimeoutMs: number;
  private readonly restartRequiredOwners = createOwnerRestartMemory();
  private readonly closedGestures = new Set<string>();
  private planCounter = 0;

  constructor(options: ProjectRuntimeReconciliationOptions = {}) {
    this.onOutcome = options.onOutcome ?? (() => undefined);
    this.operationTimeoutMs = options.operationTimeoutMs ?? 1000;
  }

  /** Registers (or replaces) a performance; newer generations clear obsolete work. */
  registerPerformance(
    kind: PerformanceKind,
    generation: number,
    client: AcknowledgedRuntimeClient,
    bindings: RuntimeBindingRegistry = new Map(),
  ): void {
    this.performances.set(kind, {
      kind,
      generation,
      client,
      bindings,
      chain: Promise.resolve(),
      lastOutcome: null,
      fenced: false,
    });
    this.restartRequiredOwners.get(kind)?.clear();
  }

  stopPerformance(kind: PerformanceKind): void {
    this.performances.delete(kind);
  }

  /** Replaces generation-scoped bindings at compile time; rejects stale generations. */
  rebuildBindings(
    kind: PerformanceKind,
    generation: number,
    bindings: RuntimeBindingRegistry,
  ): boolean {
    const performance = this.performances.get(kind);
    if (!performance || performance.generation !== generation) return false;
    performance.bindings = bindings;
    return true;
  }

  closeGesture(gestureId?: string): void {
    if (gestureId) {
      this.closedGestures.add(gestureId);
      if (this.closedGestures.size > 200) {
        const oldest = this.closedGestures.values().next().value;
        if (oldest) this.closedGestures.delete(oldest);
      }
    }
  }

  isGestureClosed(gestureId?: string): boolean {
    return gestureId ? this.closedGestures.has(gestureId) : false;
  }

  /**
   * Drains all pending work across active performances and marks the gesture closed.
   * Ensures in-flight previews finish before a restored or committed value is applied.
   */
  async drainPreviews(gestureId?: string): Promise<void> {
    if (gestureId) {
      this.closeGesture(gestureId);
    }

    // A preview can be appended after the first snapshot while a plan is
    // settling. Observe each active chain until no chain changed during the
    // wait, so replay cannot overtake a preview that was already submitted.
    while (true) {
      const performances = Array.from(this.performances.values());
      const chains = performances.map((performance) => performance.chain);
      await Promise.all(chains);
      if (
        performances.length === this.performances.size &&
        performances.every(
          (performance, index) =>
            this.performances.get(performance.kind) === performance &&
            performance.chain === chains[index],
        )
      ) {
        return;
      }
    }
  }

  /**
   * Routes a real-time preview channel value through active performances.
   * Late preview submissions for closed gestures are rejected.
   */
  async previewChannelValue(request: {
    ownerKey?: string;
    parameterId?: string;
    channel?: string;
    value: number;
    gestureId?: string;
  }): Promise<RuntimeOperationAck> {
    if (request.gestureId && this.closedGestures.has(request.gestureId)) {
      return { status: 'rejected', message: 'Gesture is closed' };
    }

    let anyApplied = false;
    const submittedPerformances = Array.from(this.performances.values()).map((performance) => ({
      performance,
      generation: performance.generation,
    }));
    for (const submitted of submittedPerformances) {
      const { performance, generation } = submitted;
      if (performance.fenced) continue;
      let channel = request.channel;
      const ownerKey = request.ownerKey ?? '';
      const parameterId = request.parameterId ?? '';

      if (!channel) {
        if (!request.ownerKey || !request.parameterId) continue;
        const binding = performance.bindings.get(bindingKey(request.ownerKey, request.parameterId));
        if (binding?.kind !== 'channel') continue;
        channel = binding.channel;
      }

      const operation: RuntimeChannelValueOperation = {
        kind: 'channel-value',
        ownerKey,
        parameterId,
        channel,
        value: request.value,
      };

      const execution = performance.chain.then(async () => {
        if (request.gestureId && this.closedGestures.has(request.gestureId)) {
          return { status: 'rejected' as const, message: 'Gesture is closed' };
        }
        if (
          this.performances.get(performance.kind) !== performance ||
          performance.generation !== generation ||
          performance.fenced
        ) {
          return { status: 'rejected' as const, message: 'Performance is no longer active' };
        }
        return this.applyWithTimeout(performance, operation);
      });

      performance.chain = execution.then(
        () => undefined,
        () => undefined,
      );

      const ack = await execution;
      if (
        ack.status === 'applied' &&
        this.performances.get(performance.kind) === performance &&
        performance.generation === generation &&
        !performance.fenced
      ) {
        anyApplied = true;
      }
    }

    return anyApplied || submittedPerformances.length === 0
      ? { status: 'applied' }
      : { status: 'rejected', message: 'No active performance accepted the preview' };
  }

  getOutcome(kind: PerformanceKind): ProjectRuntimeOutcome | null {
    return this.performances.get(kind)?.lastOutcome ?? null;
  }

  /** Aggregate precedence: failed > restart-required > pending > applied. */
  getAggregateStatus(): ProjectRuntimeOutcomeStatus | null {
    let aggregate: ProjectRuntimeOutcomeStatus | null = null;
    for (const performance of this.performances.values()) {
      const status = performance.lastOutcome?.status;
      if (!status) continue;
      if (aggregate === null || OUTCOME_PRECEDENCE[status] > OUTCOME_PRECEDENCE[aggregate]) {
        aggregate = status;
      }
    }
    return aggregate;
  }

  /** Builds frozen, immutable plans for every active performance. */
  planCommit(request: {
    documentId: string;
    revision: number;
    patches: readonly ProjectDocumentPatch[];
  }): RuntimeWorkPlan[] {
    const capability = classifyPatchesRuntimeCapability(request.patches);
    if (capability === 'none') return [];

    const batchWork = combinePatchWork(request.patches.map(extractPatchRuntimeWork));
    const plans: RuntimeWorkPlan[] = [];
    for (const performance of this.performances.values()) {
      plans.push(this.buildPlan(performance, request.documentId, request.revision, batchWork));
    }
    return plans;
  }

  private buildPlan(
    performance: ActivePerformance,
    documentId: string,
    revision: number,
    batchWork: PatchRuntimeWork,
  ): RuntimeWorkPlan {
    const operations: RuntimeWorkOperation[] = [];
    const restartRequiredOwnerIds: string[] = [];
    const ownersAwaitingRestart = this.restartRequiredOwners.get(performance.kind);

    for (const operation of batchWork.operations) {
      if (ownersAwaitingRestart?.has(operation.ownerKey)) {
        // Topology invalidation memory: the owner is not live-authorized
        // until its performance restarts with fresh compiled bindings.
        if (!restartRequiredOwnerIds.includes(operation.ownerKey)) {
          restartRequiredOwnerIds.push(operation.ownerKey);
        }
        continue;
      }
      const resolved = this.resolveOperation(performance, operation);
      if (resolved) {
        operations.push(Object.freeze(resolved));
      } else if (!restartRequiredOwnerIds.includes(operation.ownerKey)) {
        restartRequiredOwnerIds.push(operation.ownerKey);
      }
    }
    for (const ownerId of batchWork.restartRequiredOwnerIds) {
      if (!restartRequiredOwnerIds.includes(ownerId)) {
        restartRequiredOwnerIds.push(ownerId);
      }
    }

    this.planCounter += 1;
    return Object.freeze({
      planId: `plan-${this.planCounter}`,
      documentId,
      revision,
      performanceKind: performance.kind,
      generation: performance.generation,
      operations: Object.freeze(operations),
      restartRequiredOwnerIds: Object.freeze(restartRequiredOwnerIds),
    });
  }

  private resolveOperation(
    performance: ActivePerformance,
    operation: RuntimeWorkOperation,
  ): RuntimeWorkOperation | null {
    if (operation.kind === 'preset') return operation;

    const binding = performance.bindings.get(bindingKey(operation.ownerKey, operation.parameterId));
    if (operation.kind === 'channel-value') {
      return binding?.kind === 'channel' ? { ...operation, channel: binding.channel } : null;
    }

    const supported =
      binding?.kind === 'automation' &&
      ((operation.operation === 'create' && binding.supportsCreate) ||
        (operation.operation === 'update' && binding.supportsUpdate) ||
        (operation.operation === 'delete' && binding.supportsDelete));
    return supported ? operation : null;
  }

  /**
   * Classifies a committed transition, queues immutable plans per active
   * performance, and resolves with the final outcome per performance.
   * Stopped performances receive no outcomes and no writes; cosmetic-only
   * transitions leave existing outcome state untouched.
   */
  async reconcileCommit(request: {
    documentId: string;
    revision: number;
    patches: readonly ProjectDocumentPatch[];
  }): Promise<ProjectRuntimeOutcome[]> {
    const plans = this.planCommit(request);
    if (plans.length === 0) return [];

    const outcomes = await Promise.all(plans.map((plan) => this.enqueuePlan(plan)));
    return outcomes.filter((outcome): outcome is ProjectRuntimeOutcome => outcome !== null);
  }

  private enqueuePlan(plan: RuntimeWorkPlan): Promise<ProjectRuntimeOutcome | null> {
    const performance = this.performances.get(plan.performanceKind);
    if (!performance) return Promise.resolve(null);

    const pendingOutcome = outcomeFor(plan, 'pending', [...plan.restartRequiredOwnerIds]);
    performance.lastOutcome = pendingOutcome;
    this.onOutcome(pendingOutcome, { documentId: plan.documentId });

    const execution = performance.chain.then(async () => {
      if (this.isObsolete(performance, plan)) return null;
      if (performance.fenced) {
        // A prior watchdog timeout left engine state ambiguous. Skip the
        // work, but say so: silently dropping plans made every later live
        // edit look applied while the performance never received it.
        const skippedOutcome = outcomeFor(
          plan,
          'restart-required',
          [],
          'Live synchronization is paused for this performance; restart playback to apply changes',
        );
        performance.lastOutcome = skippedOutcome;
        this.onOutcome(skippedOutcome, { documentId: plan.documentId });
        return null as ProjectRuntimeOutcome | null;
      }
      return this.processPlan(performance, plan);
    });
    performance.chain = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  private async processPlan(
    performance: ActivePerformance,
    plan: RuntimeWorkPlan,
  ): Promise<ProjectRuntimeOutcome | null> {
    const touchedOwnerIds = [...new Set(plan.operations.map((operation) => operation.ownerKey))];

    for (const operation of plan.operations) {
      if (this.isObsolete(performance, plan)) {
        // Obsolete generation: discard silently so stale work never reports
        // applied against a newer performance.
        return null;
      }
      let ack: RuntimeOperationAck;
      try {
        ack = await this.applyWithTimeout(performance, operation);
      } catch (error) {
        if (this.isObsolete(performance, plan)) return null;
        return this.settle(performance, plan, 'failed', touchedOwnerIds, errorMessage(error));
      }
      if (ack.status === 'rejected') {
        if (this.isObsolete(performance, plan)) return null;
        return this.settle(
          performance,
          plan,
          'failed',
          touchedOwnerIds,
          ack.message ?? 'Engine rejected the runtime operation',
        );
      }
    }

    if (this.isObsolete(performance, plan)) return null;
    if (plan.restartRequiredOwnerIds.length > 0) {
      return this.settle(
        performance,
        plan,
        'restart-required',
        [...plan.restartRequiredOwnerIds],
        'Compiled content requires a performance restart',
      );
    }
    return this.settle(performance, plan, 'applied', touchedOwnerIds);
  }

  private isObsolete(performance: ActivePerformance, plan: RuntimeWorkPlan): boolean {
    return (
      this.performances.get(performance.kind) !== performance ||
      performance.generation !== plan.generation
    );
  }

  private applyWithTimeout(
    performance: ActivePerformance,
    operation: RuntimeWorkOperation,
  ): Promise<RuntimeOperationAck> {
    const client = performance.client;
    const apply = client.applyOperation(operation);
    if (this.operationTimeoutMs <= 0) return apply;
    return new Promise<RuntimeOperationAck>((resolve, reject) => {
      const timer = setTimeout(() => {
        performance.fenced = true;
        reject(new Error(`Runtime operation timed out after ${this.operationTimeoutMs}ms`));
      }, this.operationTimeoutMs);
      apply.then(
        (ack) => {
          clearTimeout(timer);
          resolve(ack);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private settle(
    performance: ActivePerformance,
    plan: RuntimeWorkPlan,
    status: ProjectRuntimeOutcomeStatus,
    ownerIds: string[],
    message?: string,
  ): ProjectRuntimeOutcome {
    const outcome = outcomeFor(plan, status, ownerIds, message);
    performance.lastOutcome = outcome;
    if (status === 'restart-required') {
      // Remember the owners so later scalar changes to them also await
      // restart; memory clears when a new generation registers.
      const owners = this.restartRequiredOwners.get(performance.kind);
      for (const ownerId of plan.restartRequiredOwnerIds) {
        owners?.add(ownerId);
      }
    }
    this.onOutcome(outcome, { documentId: plan.documentId });
    return outcome;
  }
}
