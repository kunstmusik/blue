import { describe, expect, it, vi } from 'vitest';
import type { ProjectDocumentPatch } from '../shared/project-editor/contract';
import type { ProjectRuntimeOutcome } from '../shared/project-history';
import {
  ProjectRuntimeReconciliation,
  classifyPatchesRuntimeCapability,
  classifyPatchRuntimeCapability,
  type AcknowledgedRuntimeClient,
  type RuntimeBinding,
  type RuntimeOperationAck,
  type RuntimeWorkOperation,
} from './project-runtime-reconciliation';
import { MixerGatePublisher } from './mixer-mute-solo-runtime';
import {
  createTestGateCatalog,
  FakeMixerGateEngine,
  TEST_GATE_SIGNATURE,
} from './mixer-mute-solo-test-support';

function makeClient(
  overrides: Partial<AcknowledgedRuntimeClient> = {},
): AcknowledgedRuntimeClient & { applied: RuntimeWorkOperation[] } {
  const applied: RuntimeWorkOperation[] = [];
  return {
    applied,
    async applyOperation(operation) {
      applied.push(operation);
      return { status: 'applied' };
    },
    ...overrides,
  } as AcknowledgedRuntimeClient & { applied: RuntimeWorkOperation[] };
}

function mixerLevelPatch(level: number): ProjectDocumentPatch {
  return { mixer: { type: 'updateChannel', channelId: 'Master', patch: { level } } };
}

function globalOrcPatch(): ProjectDocumentPatch {
  return { globalOrc: '; restored orchestra\n' };
}

function mixerMutePatch(muted: boolean): ProjectDocumentPatch {
  return {
    mixer: { type: 'updateChannel', channelId: 'source', patch: { muted } },
  };
}

describe('Runtime capability classification (T017)', () => {
  it('classifies mixer channel values as live', () => {
    expect(classifyPatchRuntimeCapability(mixerLevelPatch(0.5))).toBe('live');
    expect(
      classifyPatchRuntimeCapability({
        mixer: { type: 'updateChannel', channelId: 'Master', patch: { pan: -0.25 } },
      }),
    ).toBe('live');
  });

  it('classifies cosmetic-only edits as no-work regardless of patch name', () => {
    expect(
      classifyPatchRuntimeCapability({
        mixer: { type: 'updateChannel', channelId: 'Master', patch: { name: 'Renamed' } },
      }),
    ).toBe('none');
    expect(
      classifyPatchRuntimeCapability({
        mixer: { type: 'renameChannelListGroup', association: 'a', name: 'Group' },
      }),
    ).toBe('none');
    expect(classifyPatchRuntimeCapability({ scratchPad: { text: 'note' } })).toBe('none');
    expect(classifyPatchRuntimeCapability({ projectProperties: { title: 'New Title' } })).toBe(
      'none',
    );
    expect(
      classifyPatchRuntimeCapability({
        score: {
          type: 'setLayerHeights',
          scopeGroupId: null,
          updates: [{ groupId: 'g1', layerIndex: 0, layerSelectionId: 'sel1', height: 66 }],
        },
      }),
    ).toBe('none');
    expect(
      classifyPatchRuntimeCapability({
        score: {
          type: 'setLayerGroupDefaultHeight',
          scopeGroupId: null,
          groupId: 'g1',
          defaultHeightIndex: 1,
        },
      }),
    ).toBe('none');
  });

  it('classifies compiled structure and code content as restart-required', () => {
    expect(classifyPatchRuntimeCapability(globalOrcPatch())).toBe('restart-required');
    expect(classifyPatchRuntimeCapability({ tablesText: 'f 1 0 16 2 0' })).toBe('restart-required');
    expect(
      classifyPatchRuntimeCapability({
        orchestra: { type: 'addInstrument', instrumentType: 'generic' },
      }),
    ).toBe('restart-required');
    expect(
      classifyPatchRuntimeCapability({
        mixer: { type: 'updateChannel', channelId: 'Master', patch: { outChannel: 'out2' } },
      }),
    ).toBe('restart-required');
    expect(
      classifyPatchRuntimeCapability({
        projectProperties: { sampleRate: '48000' },
      }),
    ).toBe('restart-required');
  });

  it('classifies BSB value edits as live and BSB structure edits as restart-required', () => {
    expect(
      classifyPatchRuntimeCapability({
        orchestra: {
          type: 'updateInstrument',
          assignmentId: 'a1',
          patch: { bsbWidgetValues: { w1: 0.4 } },
        },
      }),
    ).toBe('live');
    expect(
      classifyPatchRuntimeCapability({
        orchestra: {
          type: 'updateInstrument',
          assignmentId: 'a1',
          patch: {
            bsbInterface: {
              type: 'updateWidgetProperties',
              widgetId: 'xy1',
              properties: { xValue: 0.25, yValue: 0.75, selected: true, selectedIndex: 2 },
            },
          },
        },
      }),
    ).toBe('live');
    expect(
      classifyPatchRuntimeCapability({
        orchestra: {
          type: 'updateInstrument',
          assignmentId: 'a1',
          patch: {
            bsbInterface: { type: 'moveWidget', widgetId: 'w1', x: 4, y: 6 },
          },
        },
      }),
    ).toBe('restart-required');
  });

  it('classifies BlueX7 fixed values as live and post-code as restart-required', () => {
    expect(
      classifyPatchRuntimeCapability({
        orchestra: {
          type: 'updateInstrument',
          assignmentId: 'a1',
          patch: { blueX7: { type: 'setCommonField', field: 'algorithm', value: 7 } },
        },
      }),
    ).toBe('live');
    expect(
      classifyPatchRuntimeCapability({
        orchestra: {
          type: 'updateInstrument',
          assignmentId: 'a1',
          patch: { blueX7: { type: 'setCsoundPostCode', text: 'outs aout' } },
        },
      }),
    ).toBe('restart-required');
  });

  it('classifies track instrument BlueX7 voice edits as live and comments as none', () => {
    const trackRef = {
      rootGroupId: 'g1',
      trackId: 't1',
      projectSessionId: 1,
      projectRevision: 0,
    };
    expect(
      classifyPatchRuntimeCapability({
        score: {
          type: 'updateTrackInstrument',
          track: trackRef,
          patch: {
            blueX7: {
              type: 'replaceVoice',
              voice: {
                common: { algorithm: 1 } as never,
                lfo: {} as never,
                operators: [] as never,
                pitchEnvelope: [] as never,
                csoundPostCode: '',
              },
            },
          },
        },
      }),
    ).toBe('live');

    expect(
      classifyPatchRuntimeCapability({
        score: {
          type: 'updateTrackInstrument',
          track: trackRef,
          patch: { comment: 'test comment' },
        },
      }),
    ).toBe('none');

    expect(
      classifyPatchRuntimeCapability({
        score: {
          type: 'updateTrackInstrument',
          track: trackRef,
          patch: { comments: 'test comments plural' },
        },
      }),
    ).toBe('none');

    expect(
      classifyPatchRuntimeCapability({
        score: {
          type: 'updateTrackInstrument',
          track: trackRef,
          patch: { unknownProperty: 'foo' } as never,
        },
      }),
    ).toBe('restart-required');
  });

  it('classifies automation point edits as live and topology changes as restart-required', () => {
    expect(
      classifyPatchRuntimeCapability({
        score: {
          type: 'insertAutomationPoint',
          parameterId: 'param-1',
          point: { time: 4, value: 0.5 },
        },
      }),
    ).toBe('live');
    expect(
      classifyPatchRuntimeCapability({
        score: {
          type: 'assignAutomationToLayer',
          layer: { layerId: 'layer-1' },
          parameterId: 'param-1',
        },
      } as ProjectDocumentPatch),
    ).toBe('restart-required');
  });

  it('classifies effect numeric parameters as live and effect code as restart-required', () => {
    expect(
      classifyPatchRuntimeCapability({
        mixer: {
          type: 'updateEffect',
          channelId: 'Master',
          chain: 'pre',
          entryId: 'fx-1',
          patch: {
            bsbInterface: {
              type: 'updateSliderBankValue',
              widgetId: 'mix',
              sliderIndex: 0,
              value: 0.7,
            },
          },
        },
      }),
    ).toBe('live');
    expect(
      classifyPatchRuntimeCapability({
        mixer: {
          type: 'updateEffect',
          channelId: 'Master',
          chain: 'pre',
          entryId: 'fx-1',
          patch: { code: 'aout reverb ain' },
        },
      }),
    ).toBe('restart-required');
    expect(
      classifyPatchRuntimeCapability({
        mixer: {
          type: 'updateEffect',
          channelId: 'Master',
          chain: 'pre',
          entryId: 'fx-1',
          patch: { name: 'Renamed FX' },
        },
      }),
    ).toBe('none');
  });

  it('never assumes no engine work for unclassified runtime-relevant patches', () => {
    expect(
      classifyPatchRuntimeCapability({
        blueLive: { type: 'setCell', column: 1, row: 2, cell: null },
      }),
    ).toBe('restart-required');
    expect(
      classifyPatchRuntimeCapability({ midiInput: { type: 'updateKeyMapping', value: 'x' } }),
    ).toBe('restart-required');
  });

  it('aggregates batches with restart-required precedence over live work', () => {
    expect(classifyPatchesRuntimeCapability([mixerLevelPatch(0.5), globalOrcPatch()])).toBe(
      'restart-required',
    );
    expect(
      classifyPatchesRuntimeCapability([{ scratchPad: { text: 'x' } }, mixerLevelPatch(0.4)]),
    ).toBe('live');
  });
});

describe('Runtime work plans (T017)', () => {
  it('resolves channel bindings from the generation registry into immutable ops', async () => {
    const reconciliation = new ProjectRuntimeReconciliation();
    const client = makeClient();
    reconciliation.registerPerformance(
      'timeline',
      1,
      client,
      new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
    );

    const plans = reconciliation.planCommit({
      documentId: 'doc-1',
      revision: 4,
      patches: [mixerLevelPatch(0.75)],
    });

    expect(plans).toHaveLength(1);
    const plan = plans[0]!;
    expect(plan.performanceKind).toBe('timeline');
    expect(plan.generation).toBe(1);
    expect(plan.operations).toEqual([
      {
        kind: 'channel-value',
        ownerKey: 'Master',
        parameterId: 'level',
        channel: 'gkMasterLevel',
        value: 0.75,
      },
    ]);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.operations)).toBe(true);
    expect(Object.isFrozen(plan.operations[0])).toBe(true);
    void reconciliation;
  });

  it('falls back to restart-required owners when a live binding is missing', () => {
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance('timeline', 1, makeClient(), new Map());

    const [plan] = reconciliation.planCommit({
      documentId: 'doc-1',
      revision: 4,
      patches: [mixerLevelPatch(0.75)],
    });

    expect(plan!.operations).toHaveLength(0);
    expect(plan!.restartRequiredOwnerIds).toEqual(['Master']);
  });

  it('captures immutable payload copies for automation operations', () => {
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance(
      'timeline',
      1,
      makeClient(),
      new Map([
        [
          'score::param-1',
          { kind: 'automation', supportsCreate: true, supportsUpdate: true, supportsDelete: true },
        ],
      ]),
    );

    const points = [{ time: 4, value: 0.5 }];
    const [plan] = reconciliation.planCommit({
      documentId: 'doc-1',
      revision: 2,
      patches: [
        {
          score: { type: 'setAutomationPoints', parameterId: 'param-1', points },
        },
      ],
    });

    points.splice(0, points.length);
    expect(plan!.operations).toEqual([
      {
        kind: 'automation',
        ownerKey: 'score',
        parameterId: 'param-1',
        operation: 'update',
        payload: { parameterId: 'param-1', points: [{ time: 4, value: 0.5 }] },
      },
    ]);
  });

  it('requires a fresh generation when mixer gate ownership changes after reorder and rename', async () => {
    let resolved = { signature: 'topology-before', values: [0] as readonly number[] };
    const client = makeClient();
    const reconciliation = new ProjectRuntimeReconciliation({
      resolveMixerGates: () => resolved,
    });
    const oldBinding = new Map([
      ['mixer-gates::gates', { kind: 'mixer-gates' as const, signature: resolved.signature }],
    ]);
    reconciliation.registerPerformance('timeline', 1, client, oldBinding);

    const first = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 1,
      patches: [mixerMutePatch(true)],
    });
    expect(first[0]?.status).toBe('applied');
    expect(client.applied).toHaveLength(1);
    expect(client.applied[0]).toEqual(
      expect.objectContaining({ kind: 'mixer-gates', expectedGeneration: 1 }),
    );

    // Reorder plus a route/name edit changes the canonical compiled ownership.
    // The still-running old CSD must not receive the new vector by ordinal.
    resolved = { signature: 'topology-after-reorder-and-rename', values: [1] };
    const stale = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 2,
      patches: [mixerMutePatch(false)],
    });
    expect(stale[0]).toEqual(
      expect.objectContaining({ status: 'restart-required', affectedOwnerIds: ['mixer-gates'] }),
    );
    expect(client.applied).toHaveLength(1);

    // Undo/redo-style continuation is live only after a fresh generation has
    // installed the replacement catalog.
    reconciliation.registerPerformance(
      'timeline',
      2,
      client,
      new Map([
        ['mixer-gates::gates', { kind: 'mixer-gates' as const, signature: resolved.signature }],
      ]),
    );
    const fresh = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 3,
      patches: [mixerMutePatch(true)],
    });
    expect(fresh[0]?.status).toBe('applied');
    expect(client.applied).toHaveLength(2);
    expect(client.applied[1]).toEqual(
      expect.objectContaining({ kind: 'mixer-gates', expectedGeneration: 2 }),
    );
  });

  it('plans BlueX7 operator and envelope edits against compiled semantic keys', () => {
    const ownerKey = 'arrangement:a1';
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance(
      'timeline',
      1,
      makeClient(),
      new Map<string, RuntimeBinding>([
        [`${ownerKey}::bluex7:operator.2.outputLevel`, { kind: 'channel', channel: 'op2-level' }],
        [`${ownerKey}::bluex7:pitchEnvelope.1.rate`, { kind: 'channel', channel: 'pitch-rate' }],
        [`${ownerKey}::bluex7:pitchEnvelope.1.level`, { kind: 'channel', channel: 'pitch-level' }],
      ]),
    );

    const plans = reconciliation.planCommit({
      documentId: 'doc-1',
      revision: 2,
      patches: [
        {
          orchestra: {
            type: 'updateInstrument',
            assignmentId: 'a1',
            patch: {
              blueX7: {
                type: 'setOperatorField',
                operatorIndex: 1,
                field: 'outputLevel',
                value: 80,
              },
            },
          },
        },
        {
          orchestra: {
            type: 'updateInstrument',
            assignmentId: 'a1',
            patch: {
              blueX7: {
                type: 'setPitchEnvelopePoint',
                stageIndex: 0,
                point: { rate: 4, level: 5 },
              },
            },
          },
        },
      ],
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.restartRequiredOwnerIds).toEqual([]);
    expect(plans[0]?.operations).toEqual([
      {
        kind: 'channel-value',
        ownerKey,
        parameterId: 'bluex7:operator.2.outputLevel',
        channel: 'op2-level',
        value: 80,
      },
      {
        kind: 'channel-value',
        ownerKey,
        parameterId: 'bluex7:pitchEnvelope.1.rate',
        channel: 'pitch-rate',
        value: 4,
      },
      {
        kind: 'channel-value',
        ownerKey,
        parameterId: 'bluex7:pitchEnvelope.1.level',
        channel: 'pitch-level',
        value: 5,
      },
    ]);
  });
});

describe('Per-performance ordered queues and outcomes (T017)', () => {
  it('applies live work per active performance and publishes applied outcomes', async () => {
    const outcomes: ProjectRuntimeOutcome[] = [];
    const reconciliation = new ProjectRuntimeReconciliation({
      onOutcome: (outcome) => outcomes.push(outcome),
    });
    const timeline = makeClient();
    const blueLive = makeClient();
    const bindings = new Map<string, RuntimeBinding>([
      ['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }],
    ]);
    reconciliation.registerPerformance('timeline', 1, timeline, new Map(bindings));
    reconciliation.registerPerformance('blueLive', 3, blueLive, new Map(bindings));

    const result = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 5,
      patches: [mixerLevelPatch(0.6)],
    });

    expect(result).toHaveLength(2);
    expect(result.every((o) => o.status === 'applied' && o.appliedRevision === 5)).toBe(true);
    expect(timeline.applied).toHaveLength(1);
    expect(blueLive.applied).toHaveLength(1);
    expect(outcomes.filter((o) => o.status === 'pending')).toHaveLength(2);
    expect(outcomes.filter((o) => o.status === 'applied')).toHaveLength(2);
  });

  it('executes each performance queue strictly in order', async () => {
    const reconciliation = new ProjectRuntimeReconciliation();
    const applied: string[] = [];
    const client = makeClient({
      async applyOperation(operation) {
        applied.push('parameterId' in operation ? operation.parameterId : operation.kind);
        return { status: 'applied' };
      },
    });
    reconciliation.registerPerformance(
      'timeline',
      1,
      client,
      new Map([
        ['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }],
        ['Master::volume', { kind: 'channel', channel: 'gkMasterVolume' }],
      ]),
    );

    const first = reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 1,
      patches: [mixerLevelPatch(0.2)],
    });
    const second = reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 2,
      patches: [{ mixer: { type: 'updateChannel', channelId: 'Master', patch: { volume: 0.8 } } }],
    });

    await Promise.all([first, second]);
    expect(applied).toEqual(['level', 'volume']);
  });

  it('reports failed outcomes for negative acknowledgements and transport exceptions', async () => {
    const reconciliation = new ProjectRuntimeReconciliation();
    const rejecting = makeClient({
      async applyOperation() {
        return { status: 'rejected', message: 'Engine rejected parameter assignment' };
      },
    });
    const throwing = makeClient({
      async applyOperation() {
        throw new Error('transport closed');
      },
    });
    reconciliation.registerPerformance(
      'timeline',
      1,
      rejecting,
      new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
    );
    reconciliation.registerPerformance(
      'blueLive',
      1,
      throwing,
      new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
    );

    const result = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 6,
      patches: [mixerLevelPatch(0.9)],
    });

    const statuses = result.map((o) => o.status);
    expect(statuses).toContain('failed');
    expect(result.filter((o) => o.status === 'failed').map((o) => o.message)).toEqual(
      expect.arrayContaining(['Engine rejected parameter assignment', 'transport closed']),
    );
  });

  it('produces restart-required outcomes without engine writes for compiled content', async () => {
    const reconciliation = new ProjectRuntimeReconciliation();
    const client = makeClient();
    reconciliation.registerPerformance('timeline', 1, client);

    const result = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 7,
      patches: [globalOrcPatch()],
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe('restart-required');
    expect(client.applied).toHaveLength(0);
  });

  it('emits no outcomes for stopped performances and never writes to them', async () => {
    const reconciliation = new ProjectRuntimeReconciliation();
    const client = makeClient();

    const result = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 8,
      patches: [mixerLevelPatch(0.4)],
    });

    expect(result).toHaveLength(0);
    expect(client.applied).toHaveLength(0);
    void reconciliation;
  });

  it('applies preset plan operations without routing nested writes through the queue', async () => {
    const reconciliation = new ProjectRuntimeReconciliation({ operationTimeoutMs: 300 });
    const client = makeClient();
    reconciliation.registerPerformance('timeline', 1, client);

    const result = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 3,
      patches: [
        {
          orchestra: {
            type: 'updateInstrument',
            assignmentId: '1',
            patch: { bsbInterface: { type: 'applyPreset', presetUniqueId: 'preset-1' } },
          },
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe('applied');
    expect(client.applied).toEqual([
      { kind: 'preset', ownerKey: 'arrangement:1', presetUniqueId: 'preset-1' },
    ]);
  });

  it.each(['timeline', 'blueLive'] as const)(
    'serializes concurrent %s previews behind a plan and before replay',
    async (performanceKind) => {
      const applied: RuntimeWorkOperation[] = [];
      let planStarted = false;
      let previewStarted = false;
      let releasePlan!: (ack: RuntimeOperationAck) => void;
      let releasePreview!: (ack: RuntimeOperationAck) => void;
      const client = makeClient({
        async applyOperation(operation) {
          applied.push(operation);
          if (operation.kind !== 'channel-value') return { status: 'applied' };
          if (operation.value === 0.1) {
            planStarted = true;
            return new Promise<RuntimeOperationAck>((resolve) => {
              releasePlan = resolve;
            });
          }
          if (operation.value === 0.2) {
            previewStarted = true;
            return new Promise<RuntimeOperationAck>((resolve) => {
              releasePreview = resolve;
            });
          }
          return { status: 'applied' };
        },
      });
      const reconciliation = new ProjectRuntimeReconciliation({ operationTimeoutMs: 0 });
      reconciliation.registerPerformance(
        performanceKind,
        1,
        client,
        new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
      );

      const planPromise = reconciliation.reconcileCommit({
        documentId: 'doc-1',
        revision: 1,
        patches: [mixerLevelPatch(0.1)],
      });
      await vi.waitFor(() => expect(planStarted).toBe(true));

      const previewPromise = reconciliation.previewChannelValue({
        ownerKey: 'Master',
        parameterId: 'level',
        value: 0.2,
      });
      let drained = false;
      const drainPromise = reconciliation.drainPreviews().then(() => {
        drained = true;
      });

      await Promise.resolve();
      expect(previewStarted).toBe(false);
      expect(drained).toBe(false);

      releasePlan({ status: 'applied' });
      await planPromise;
      await vi.waitFor(() => expect(previewStarted).toBe(true));

      // Replay is submitted while the preview is still in flight. It must
      // remain behind that preview, and drain must not resolve early.
      const replayPromise = reconciliation.reconcileCommit({
        documentId: 'doc-1',
        revision: 2,
        patches: [mixerLevelPatch(0.3)],
      });
      await Promise.resolve();
      expect(drained).toBe(false);
      expect(applied.filter((operation) => operation.kind === 'channel-value')).toHaveLength(2);

      releasePreview({ status: 'applied' });
      await previewPromise;
      await drainPromise;
      await replayPromise;

      expect(
        applied
          .filter(
            (operation): operation is Extract<RuntimeWorkOperation, { kind: 'channel-value' }> =>
              operation.kind === 'channel-value',
          )
          .map((operation) => operation.value),
      ).toEqual([0.1, 0.2, 0.3]);
    },
  );

  it('publishes restart-required outcomes for plans skipped while fenced', async () => {
    const outcomes: ProjectRuntimeOutcome[] = [];
    const reconciliation = new ProjectRuntimeReconciliation({
      operationTimeoutMs: 30,
      onOutcome: (outcome) => outcomes.push(outcome),
    });
    let first = true;
    const client = makeClient({
      applyOperation() {
        if (first) {
          first = false;
          // Never settles: the watchdog times this operation out and fences
          // the performance.
          return new Promise<RuntimeOperationAck>(() => undefined);
        }
        return Promise.resolve({ status: 'applied' as const });
      },
    });
    reconciliation.registerPerformance(
      'timeline',
      1,
      client,
      new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
    );

    const timedOut = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 1,
      patches: [mixerLevelPatch(0.5)],
    });
    expect(timedOut.map((o) => o.status)).toEqual(['failed']);

    const skipped = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 2,
      patches: [mixerLevelPatch(0.7)],
    });
    expect(skipped).toHaveLength(0);
    expect(outcomes.some((o) => o.status === 'restart-required')).toBe(true);
    expect(reconciliation.getOutcome('timeline')).toEqual(
      expect.objectContaining({ status: 'restart-required' }),
    );
  });

  it('keeps no-work commits from clearing existing outcome state', async () => {
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance('timeline', 1, makeClient());

    await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 1,
      patches: [globalOrcPatch()],
    });
    expect(reconciliation.getAggregateStatus()).toBe('restart-required');

    await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 2,
      patches: [{ scratchPad: { text: 'note' } }],
    });
    expect(reconciliation.getAggregateStatus()).toBe('restart-required');
    expect(reconciliation.getOutcome('timeline')).toEqual(
      expect.objectContaining({
        status: 'restart-required',
        desiredRevision: 1,
      }),
    );
  });

  it('keeps failed live work unresolved across a later no-work commit', async () => {
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance(
      'timeline',
      1,
      makeClient({
        async applyOperation() {
          return { status: 'rejected', message: 'live update rejected' };
        },
      }),
      new Map([['Master::level', { kind: 'channel', channel: 'master-level' }]]),
    );

    await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 1,
      patches: [mixerLevelPatch(0.4)],
    });
    expect(reconciliation.getOutcome('timeline')).toEqual(
      expect.objectContaining({ status: 'failed', desiredRevision: 1 }),
    );

    await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 2,
      patches: [{ projectProperties: { title: 'Cosmetic title' } }],
    });
    expect(reconciliation.getOutcome('timeline')).toEqual(
      expect.objectContaining({ status: 'failed', desiredRevision: 1 }),
    );
  });

  it('aggregates statuses with failed > restart-required > pending > applied precedence', async () => {
    const deferredAcks: Array<(ack: RuntimeOperationAck) => void> = [];
    const gated = (): AcknowledgedRuntimeClient =>
      makeClient({
        applyOperation(operation) {
          void operation;
          return new Promise<RuntimeOperationAck>((resolve) => {
            deferredAcks.push(resolve);
          });
        },
      });
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance(
      'timeline',
      1,
      gated(),
      new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
    );
    reconciliation.registerPerformance(
      'blueLive',
      1,
      gated(),
      new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
    );

    const commit = reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 9,
      patches: [mixerLevelPatch(0.5)],
    });
    await vi.waitFor(() => expect(deferredAcks).toHaveLength(2));

    // Both plans in flight: pending outranks applied-baseline absence.
    expect(reconciliation.getAggregateStatus()).toBe('pending');

    // Timeline rejects while Blue Live is still pending: failed wins.
    deferredAcks[0]!({ status: 'rejected', message: 'rejected' });
    await vi.waitFor(() => expect(reconciliation.getAggregateStatus()).toBe('failed'));

    // Blue Live applies afterwards: the failure still dominates the aggregate.
    deferredAcks[1]!({ status: 'applied' });
    await commit;
    expect(reconciliation.getAggregateStatus()).toBe('failed');

    // A later fully applied commit replaces the per-performance outcomes.
    reconciliation.registerPerformance(
      'timeline',
      2,
      makeClient(),
      new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
    );
    reconciliation.registerPerformance(
      'blueLive',
      2,
      makeClient(),
      new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
    );
    await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 10,
      patches: [mixerLevelPatch(0.7)],
    });
    expect(reconciliation.getAggregateStatus()).toBe('applied');
  });
});

describe('Generation-scoped fencing (T017)', () => {
  it('discards obsolete pending work when a new generation registers', async () => {
    const reconciliation = new ProjectRuntimeReconciliation();
    let releaseAck: ((ack: RuntimeOperationAck) => void) | null = null;
    const oldClient = makeClient({
      applyOperation(operation) {
        void operation;
        return new Promise<RuntimeOperationAck>((resolve) => {
          releaseAck = resolve;
        });
      },
    });
    reconciliation.registerPerformance(
      'timeline',
      1,
      oldClient,
      new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
    );

    const commit = reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 10,
      patches: [mixerLevelPatch(0.5)],
    });
    await vi.waitFor(() => expect(releaseAck).not.toBeNull());

    // New performance generation replaces the old one; the in-flight plan is obsolete.
    const newClient = makeClient();
    reconciliation.registerPerformance(
      'timeline',
      2,
      newClient,
      new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
    );
    releaseAck!({ status: 'applied' });

    const result = await commit;
    expect(result).toHaveLength(0);
    expect(reconciliation.getOutcome('timeline')).toBeNull();
  });

  it.each(['timeline', 'blueLive'] as const)(
    'does not let delayed mixer gate work write a replacement or report applied for %s',
    async (performanceKind) => {
      const oldEngine = new FakeMixerGateEngine();
      const newEngine = new FakeMixerGateEngine();
      let releaseStage!: () => void;
      let stageStarted!: () => void;
      const stageReady = new Promise<void>((resolve) => {
        stageStarted = resolve;
      });
      const stageRelease = new Promise<void>((resolve) => {
        releaseStage = resolve;
      });
      const oldIO = {
        setChannels: async (entries: readonly { name: string; value: number }[]) => {
          stageStarted();
          await stageRelease;
          return oldEngine.setChannels(entries);
        },
        getChannels: (names: readonly string[]) => oldEngine.getChannels(names),
      };
      const oldPublisher = new MixerGatePublisher(oldIO, { observeAttempts: 1 });
      const newPublisher = new MixerGatePublisher(newEngine, { observeAttempts: 1 });
      const catalog = createTestGateCatalog(1);
      oldPublisher.setBindings(performanceKind, catalog, { generation: 1, io: oldIO });

      let gateValues: readonly number[] = [0];
      const reconciliation = new ProjectRuntimeReconciliation({
        resolveMixerGates: () => ({ signature: TEST_GATE_SIGNATURE, values: gateValues }),
      });
      const oldClient = makeClient({
        async applyOperation(operation) {
          if (operation.kind !== 'mixer-gates') return { status: 'applied' };
          const result = await oldPublisher.publish(
            performanceKind,
            operation.signature,
            operation.values,
            operation.expectedGeneration,
          );
          return result.ok
            ? { status: 'applied' as const }
            : { status: 'rejected' as const, message: result.message };
        },
      });
      reconciliation.registerPerformance(
        performanceKind,
        1,
        oldClient,
        new Map([['mixer-gates::gates', { kind: 'mixer-gates', signature: TEST_GATE_SIGNATURE }]]),
      );

      const oldCommit = reconciliation.reconcileCommit({
        documentId: 'doc-1',
        revision: 1,
        patches: [mixerMutePatch(true)],
      });
      await stageReady;

      oldPublisher.reset(performanceKind);
      const newClient = makeClient({
        async applyOperation(operation) {
          if (operation.kind !== 'mixer-gates') return { status: 'applied' };
          const result = await newPublisher.publish(
            performanceKind,
            operation.signature,
            operation.values,
            operation.expectedGeneration,
          );
          return result.ok
            ? { status: 'applied' as const }
            : { status: 'rejected' as const, message: result.message };
        },
      });
      newPublisher.setBindings(performanceKind, catalog, { generation: 2, io: newEngine });
      reconciliation.registerPerformance(
        performanceKind,
        2,
        newClient,
        new Map([['mixer-gates::gates', { kind: 'mixer-gates', signature: TEST_GATE_SIGNATURE }]]),
      );
      releaseStage();

      expect(await oldCommit).toHaveLength(0);
      expect(newEngine.writes).toHaveLength(0);

      gateValues = [1];
      const replacementCommit = await reconciliation.reconcileCommit({
        documentId: 'doc-1',
        revision: 2,
        patches: [mixerMutePatch(false)],
      });
      expect(replacementCommit[0]).toEqual(expect.objectContaining({ status: 'applied' }));
      expect(newEngine.writes.length).toBeGreaterThan(0);
    },
  );

  it.each(['timeline', 'blueLive'] as const)(
    'stops a queued mixer gate retry after %s replacement',
    async (performanceKind) => {
      const oldEngine = new FakeMixerGateEngine();
      const replacementEngine = new FakeMixerGateEngine();
      let firstAttempt!: () => void;
      const firstAttemptReady = new Promise<void>((resolve) => {
        firstAttempt = resolve;
      });
      let first = true;
      const oldIO = {
        setChannels: async (entries: readonly { name: string; value: number }[]) => {
          if (first) {
            first = false;
            firstAttempt();
            oldEngine.writes.push([...entries]);
            return { ok: false, message: 'engine-batch-queue-full' };
          }
          return oldEngine.setChannels(entries);
        },
        getChannels: (names: readonly string[]) => oldEngine.getChannels(names),
      };
      const publisher = new MixerGatePublisher(oldIO, {
        stageRetryDelayMs: 20,
        observeAttempts: 1,
      });
      const catalog = createTestGateCatalog(1);
      publisher.setBindings(performanceKind, catalog, { generation: 1, io: oldIO });
      const reconciliation = new ProjectRuntimeReconciliation({
        resolveMixerGates: () => ({ signature: TEST_GATE_SIGNATURE, values: [0] }),
      });
      const oldClient = makeClient({
        async applyOperation(operation) {
          if (operation.kind !== 'mixer-gates') return { status: 'applied' };
          const result = await publisher.publish(
            performanceKind,
            operation.signature,
            operation.values,
            operation.expectedGeneration,
          );
          return result.ok
            ? { status: 'applied' as const }
            : { status: 'rejected' as const, message: result.message };
        },
      });
      reconciliation.registerPerformance(
        performanceKind,
        1,
        oldClient,
        new Map([['mixer-gates::gates', { kind: 'mixer-gates', signature: TEST_GATE_SIGNATURE }]]),
      );

      const oldCommit = reconciliation.reconcileCommit({
        documentId: 'doc-1',
        revision: 1,
        patches: [mixerMutePatch(true)],
      });
      await firstAttemptReady;
      publisher.reset(performanceKind);
      reconciliation.registerPerformance(
        performanceKind,
        2,
        makeClient(),
        new Map([['mixer-gates::gates', { kind: 'mixer-gates', signature: TEST_GATE_SIGNATURE }]]),
      );

      expect(await oldCommit).toHaveLength(0);
      expect(oldEngine.writes).toHaveLength(1);
      expect(replacementEngine.writes).toHaveLength(0);
    },
  );

  it('rejects binding rebuilds for stale generations', () => {
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance('blueLive', 4, makeClient());

    expect(
      reconciliation.rebuildBindings(
        'blueLive',
        3,
        new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
      ),
    ).toBe(false);
    expect(
      reconciliation.rebuildBindings(
        'blueLive',
        4,
        new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
      ),
    ).toBe(true);
  });

  describe('acknowledgement failure modes (T039, US3)', () => {
    it('fails a timed-out operation and ignores its late completion', async () => {
      vi.useFakeTimers();
      try {
        const outcomes: ProjectRuntimeOutcome[] = [];
        let lateAck: ((ack: RuntimeOperationAck) => void) | null = null;
        const client = makeClient({
          applyOperation(operation) {
            void operation;
            return new Promise<RuntimeOperationAck>((resolve) => {
              lateAck = resolve;
            });
          },
        });
        const reconciliation = new ProjectRuntimeReconciliation({
          onOutcome: (o) => outcomes.push(o),
          operationTimeoutMs: 20,
        });
        reconciliation.registerPerformance(
          'timeline',
          1,
          client,
          new Map([['Master::level', { kind: 'channel' as const, channel: 'gkMasterLevel' }]]),
        );

        const commit = reconciliation.reconcileCommit({
          documentId: 'doc-1',
          revision: 1,
          patches: [mixerLevelPatch(0.5)],
        });
        await vi.advanceTimersByTimeAsync(25);

        const result = await commit;
        expect(result).toHaveLength(1);
        expect(result[0]!.status).toBe('failed');
        expect(result[0]!.message).toContain('timed out');

        // The late engine completion must not flip the reported outcome.
        lateAck!({ status: 'applied' });
        await vi.advanceTimersByTimeAsync(10);
        expect(result[0]!.status).toBe('failed');
        expect(outcomes.filter((o) => o.status === 'applied')).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('fences the performance queue after a timeout until a new generation registers', async () => {
      vi.useFakeTimers();
      try {
        let releaseAck: ((ack: RuntimeOperationAck) => void) | null = null;
        const client = makeClient({
          applyOperation(operation) {
            void operation;
            return new Promise<RuntimeOperationAck>((resolve) => {
              releaseAck = resolve;
            });
          },
        });
        const bindings = new Map([
          ['Master::level', { kind: 'channel' as const, channel: 'gkMasterLevel' }],
        ]);
        const reconciliation = new ProjectRuntimeReconciliation({ operationTimeoutMs: 20 });
        reconciliation.registerPerformance('timeline', 1, client, new Map(bindings));

        const first = reconciliation.reconcileCommit({
          documentId: 'doc-1',
          revision: 1,
          patches: [mixerLevelPatch(0.4)],
        });
        await vi.advanceTimersByTimeAsync(25);
        expect((await first)[0]!.status).toBe('failed');

        // While the timed-out request may still execute, later plans for the
        // same generation are discarded without writes or fake outcomes.
        const second = reconciliation.reconcileCommit({
          documentId: 'doc-1',
          revision: 2,
          patches: [mixerLevelPatch(0.6)],
        });
        await vi.advanceTimersByTimeAsync(50);
        expect(await second).toHaveLength(0);

        // A fresh generation clears the fence and accepts work again.
        const replacement = makeClient();
        reconciliation.registerPerformance('timeline', 2, replacement, new Map(bindings));
        const third = reconciliation.reconcileCommit({
          documentId: 'doc-1',
          revision: 3,
          patches: [mixerLevelPatch(0.8)],
        });
        const thirdResult = await third;
        expect(thirdResult).toHaveLength(1);
        expect(thirdResult[0]!.status).toBe('applied');
        expect(replacement.applied).toHaveLength(1);
        void releaseAck;
      } finally {
        vi.useRealTimers();
      }
    });

    it('reports partial success explicitly when a later operation in a plan fails', async () => {
      const reconciliation = new ProjectRuntimeReconciliation();
      let calls = 0;
      const client = makeClient({
        async applyOperation() {
          calls += 1;
          if (calls === 2) {
            return { status: 'rejected', message: 'Engine rejected second assignment' };
          }
          return { status: 'applied' };
        },
      });
      reconciliation.registerPerformance(
        'timeline',
        1,
        client,
        new Map([
          ['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }],
          ['Master::volume', { kind: 'channel', channel: 'gkMasterVolume' }],
          ['Master::pan', { kind: 'channel', channel: 'gkMasterPan' }],
        ]),
      );

      const result = await reconciliation.reconcileCommit({
        documentId: 'doc-1',
        revision: 4,
        patches: [
          {
            mixer: {
              type: 'updateChannel',
              channelId: 'Master',
              patch: { level: 0.1, volume: 0.5, pan: 0.25 },
            },
          },
        ],
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.status).toBe('failed');
      expect(result[0]!.message).toBe('Engine rejected second assignment');
      // Partial success: the first write landed; later writes never ran.
      expect(calls).toBe(2);
    });

    it('keeps owners awaiting restart restart-required for later scalar changes', async () => {
      const reconciliation = new ProjectRuntimeReconciliation();
      const client = makeClient();
      const bindings = new Map<string, RuntimeBinding>([
        ['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }],
        ['Other::level', { kind: 'channel', channel: 'gkOtherLevel' }],
      ]);
      reconciliation.registerPerformance('timeline', 1, client, new Map(bindings));

      // Structural edit to Master: restart-required.
      await reconciliation.reconcileCommit({
        documentId: 'doc-1',
        revision: 1,
        patches: [
          { mixer: { type: 'updateChannel', channelId: 'Master', patch: { outChannel: 'out2' } } },
        ],
      });
      expect(reconciliation.getOutcome('timeline')!.status).toBe('restart-required');

      // Later scalar change to the SAME owner also awaits restart...
      await reconciliation.reconcileCommit({
        documentId: 'doc-1',
        revision: 2,
        patches: [mixerLevelPatch(0.5)],
      });
      expect(reconciliation.getOutcome('timeline')!.status).toBe('restart-required');
      expect(client.applied).toHaveLength(0);

      // ...while an unaffected owner still reconciles live.
      await reconciliation.reconcileCommit({
        documentId: 'doc-1',
        revision: 3,
        patches: [{ mixer: { type: 'updateChannel', channelId: 'Other', patch: { level: 0.7 } } }],
      });
      expect(reconciliation.getOutcome('timeline')).toEqual(
        expect.objectContaining({
          status: 'restart-required',
          desiredRevision: 3,
          affectedOwnerIds: expect.arrayContaining(['Master', 'Other']),
        }),
      );
      expect(client.applied).toHaveLength(1);
      expect(client.applied[0]!.ownerKey).toBe('Other');
    });

    it('keeps timeline and Blue Live obligations independent while unrelated work still applies', async () => {
      const timeline = makeClient();
      let failBlueLiveOnce = true;
      const blueLive = makeClient({
        async applyOperation() {
          if (failBlueLiveOnce) {
            failBlueLiveOnce = false;
            return { status: 'rejected', message: 'Blue Live gate transport failed' };
          }
          return { status: 'applied' };
        },
      });
      const bindings = new Map<string, RuntimeBinding>([
        ['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }],
        ['Other::level', { kind: 'channel', channel: 'gkOtherLevel' }],
      ]);
      const reconciliation = new ProjectRuntimeReconciliation();
      reconciliation.registerPerformance('timeline', 1, timeline, new Map(bindings));
      reconciliation.registerPerformance('blueLive', 1, blueLive, new Map(bindings));

      const results = await reconciliation.reconcileCommit({
        documentId: 'doc-1',
        revision: 1,
        patches: [mixerLevelPatch(0.4)],
      });
      expect(results.map((outcome) => [outcome.performanceKind, outcome.status])).toEqual([
        ['timeline', 'applied'],
        ['blueLive', 'failed'],
      ]);

      const followUp = await reconciliation.reconcileCommit({
        documentId: 'doc-1',
        revision: 2,
        patches: [{ mixer: { type: 'updateChannel', channelId: 'Other', patch: { level: 0.7 } } }],
      });
      expect(followUp.find((outcome) => outcome.performanceKind === 'timeline')).toEqual(
        expect.objectContaining({ status: 'applied', desiredRevision: 2 }),
      );
      expect(followUp.find((outcome) => outcome.performanceKind === 'blueLive')).toEqual(
        expect.objectContaining({
          status: 'failed',
          desiredRevision: 2,
          affectedOwnerIds: expect.arrayContaining(['Master', 'Other']),
        }),
      );
      expect(timeline.applied).toHaveLength(2);
      expect(blueLive.applied).toHaveLength(0);
    });

    it('clears a failed owner only after a later acknowledged operation for that owner', async () => {
      let rejectMaster = true;
      const client = makeClient({
        async applyOperation(operation) {
          if (operation.ownerKey === 'Master' && rejectMaster) {
            return { status: 'rejected', message: 'Master update failed' };
          }
          return { status: 'applied' };
        },
      });
      const reconciliation = new ProjectRuntimeReconciliation();
      reconciliation.registerPerformance(
        'timeline',
        1,
        client,
        new Map([
          ['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }],
          ['Other::level', { kind: 'channel', channel: 'gkOtherLevel' }],
        ]),
      );

      await reconciliation.reconcileCommit({
        documentId: 'doc-1',
        revision: 1,
        patches: [mixerLevelPatch(0.4)],
      });
      rejectMaster = false;
      const unrelated = await reconciliation.reconcileCommit({
        documentId: 'doc-1',
        revision: 2,
        patches: [{ mixer: { type: 'updateChannel', channelId: 'Other', patch: { level: 0.7 } } }],
      });
      expect(unrelated[0]).toEqual(expect.objectContaining({ status: 'failed' }));

      const recovered = await reconciliation.reconcileCommit({
        documentId: 'doc-1',
        revision: 3,
        patches: [mixerLevelPatch(0.6)],
      });
      expect(recovered[0]).toEqual(expect.objectContaining({ status: 'applied' }));
    });
  });

  it('aborts queued plans that have not started when the generation changes', async () => {
    const reconciliation = new ProjectRuntimeReconciliation();
    let releaseFirst: ((ack: RuntimeOperationAck) => void) | null = null;
    const client = makeClient({
      applyOperation(operation) {
        void operation;
        return new Promise<RuntimeOperationAck>((resolve) => {
          releaseFirst = resolve;
        });
      },
    });
    reconciliation.registerPerformance(
      'timeline',
      1,
      client,
      new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
    );

    const first = reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 1,
      patches: [mixerLevelPatch(0.1)],
    });
    const second = reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 2,
      patches: [mixerLevelPatch(0.2)],
    });
    await vi.waitFor(() => expect(releaseFirst).not.toBeNull());

    const replacement = makeClient();
    reconciliation.registerPerformance(
      'timeline',
      2,
      replacement,
      new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
    );
    releaseFirst!({ status: 'applied' });

    expect(await first).toHaveLength(0);
    expect(await second).toHaveLength(0);
    expect(replacement.applied).toHaveLength(0);
  });

  it('routes preview channel values to bound channels on active performances (T043)', async () => {
    const client = makeClient();
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance(
      'timeline',
      1,
      client,
      new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
    );

    const ack = await reconciliation.previewChannelValue({
      ownerKey: 'Master',
      parameterId: 'level',
      value: 0.75,
      gestureId: 'gesture-1',
    });

    expect(ack.status).toBe('applied');
    expect(client.applied).toHaveLength(1);
    expect(client.applied[0]).toEqual({
      kind: 'channel-value',
      ownerKey: 'Master',
      parameterId: 'level',
      channel: 'gkMasterLevel',
      value: 0.75,
    });
  });

  it('rejects late previews for closed gestures and drains in-flight previews (T043)', async () => {
    let releasePreview: ((ack: RuntimeOperationAck) => void) | null = null;
    const client = makeClient({
      applyOperation: async (op) => {
        client.applied.push(op);
        return new Promise<RuntimeOperationAck>((resolve) => {
          releasePreview = resolve;
        });
      },
    });

    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance(
      'timeline',
      1,
      client,
      new Map([['Master::level', { kind: 'channel', channel: 'gkMasterLevel' }]]),
    );

    // In-flight preview during gesture
    const previewPromise = reconciliation.previewChannelValue({
      ownerKey: 'Master',
      parameterId: 'level',
      value: 0.4,
      gestureId: 'gesture-1',
    });

    await vi.waitFor(() => expect(releasePreview).not.toBeNull());

    // Gesture ends / drains before undo
    let drained = false;
    const drainPromise = reconciliation.drainPreviews('gesture-1').then(() => {
      drained = true;
    });

    expect(drained).toBe(false);
    expect(reconciliation.isGestureClosed('gesture-1')).toBe(true);

    // Late preview for the closed gesture is rejected immediately
    const latePreview = await reconciliation.previewChannelValue({
      ownerKey: 'Master',
      parameterId: 'level',
      value: 0.5,
      gestureId: 'gesture-1',
    });
    expect(latePreview.status).toBe('rejected');
    expect(latePreview.message).toContain('closed');

    // Releasing in-flight preview completes drain
    releasePreview!({ status: 'applied' });
    await previewPromise;
    await drainPromise;
    expect(drained).toBe(true);
  });

  it.each(['timeline', 'blueLive'] as const)(
    'does not send a delayed preview to a replacement %s generation',
    async (performanceKind) => {
      let releaseOldPreview: ((ack: RuntimeOperationAck) => void) | null = null;
      let oldPreviewStarted = false;
      const oldClient = makeClient({
        applyOperation: async (operation) => {
          oldClient.applied.push(operation);
          oldPreviewStarted = true;
          return new Promise<RuntimeOperationAck>((resolve) => {
            releaseOldPreview = resolve;
          });
        },
      });
      const bindings = new Map([
        ['Master::level', { kind: 'channel' as const, channel: 'gkMasterLevel' }],
      ]);
      const reconciliation = new ProjectRuntimeReconciliation({ operationTimeoutMs: 0 });
      reconciliation.registerPerformance(performanceKind, 1, oldClient, new Map(bindings));

      const delayedPreview = reconciliation.previewChannelValue({
        ownerKey: 'Master',
        parameterId: 'level',
        value: 0.4,
      });
      await vi.waitFor(() => expect(oldPreviewStarted).toBe(true));

      const replacement = makeClient();
      reconciliation.registerPerformance(performanceKind, 2, replacement, new Map(bindings));
      releaseOldPreview!({ status: 'applied' });

      expect(await delayedPreview).toEqual({
        status: 'rejected',
        message: 'No active performance accepted the preview',
      });
      expect(replacement.applied).toHaveLength(0);

      const freshPreview = await reconciliation.previewChannelValue({
        ownerKey: 'Master',
        parameterId: 'level',
        value: 0.6,
      });
      expect(freshPreview.status).toBe('applied');
      expect(replacement.applied).toHaveLength(1);
      expect((replacement.applied[0] as { value?: number }).value).toBe(0.6);
    },
  );

  it('does not leak a preview across project-replacement disposal and re-registration', async () => {
    let releaseTimelinePreview: ((ack: RuntimeOperationAck) => void) | null = null;
    const oldTimeline = makeClient({
      applyOperation: async (operation) => {
        oldTimeline.applied.push(operation);
        return new Promise<RuntimeOperationAck>((resolve) => {
          releaseTimelinePreview = resolve;
        });
      },
    });
    const oldBlueLive = makeClient();
    const bindings = new Map([
      ['Master::level', { kind: 'channel' as const, channel: 'gkMasterLevel' }],
    ]);
    const reconciliation = new ProjectRuntimeReconciliation({ operationTimeoutMs: 0 });
    reconciliation.registerPerformance('timeline', 1, oldTimeline, new Map(bindings));
    reconciliation.registerPerformance('blueLive', 1, oldBlueLive, new Map(bindings));

    const delayedPreview = reconciliation.previewChannelValue({
      ownerKey: 'Master',
      parameterId: 'level',
      value: 0.2,
    });
    await vi.waitFor(() => expect(releaseTimelinePreview).not.toBeNull());

    // A project replacement disposes every old performance before the new
    // project starts its replacement generations.
    reconciliation.stopPerformance('timeline');
    reconciliation.stopPerformance('blueLive');
    const newTimeline = makeClient();
    const newBlueLive = makeClient();
    reconciliation.registerPerformance('timeline', 2, newTimeline, new Map(bindings));
    reconciliation.registerPerformance('blueLive', 2, newBlueLive, new Map(bindings));
    releaseTimelinePreview!({ status: 'applied' });

    expect(await delayedPreview).toEqual({
      status: 'rejected',
      message: 'No active performance accepted the preview',
    });
    expect(oldBlueLive.applied).toHaveLength(0);
    expect(newTimeline.applied).toHaveLength(0);
    expect(newBlueLive.applied).toHaveLength(0);

    const freshPreview = await reconciliation.previewChannelValue({
      ownerKey: 'Master',
      parameterId: 'level',
      value: 0.8,
    });
    expect(freshPreview.status).toBe('applied');
    expect(newTimeline.applied).toHaveLength(1);
    expect(newBlueLive.applied).toHaveLength(1);
    expect((newTimeline.applied[0] as { value?: number }).value).toBe(0.8);
    expect((newBlueLive.applied[0] as { value?: number }).value).toBe(0.8);
  });
});
