import {
  BSBGroup,
  BSBHSliderBank,
  BSBVSliderBank,
  BSBWidget,
  BSBXYController,
  BlueSynthBuilder,
  Channel,
  Effect,
  Send,
  TrackLayerGroup,
  getArrangementOwnerParameters,
  getMixerOwnerParameters,
  getProjectParameterCatalog,
  getTrackOwnerParameters,
} from '@blue/data';
import type {
  Arrangement,
  BlueData,
  CompiledBlueX7Binding,
  CompiledPannerBindings,
  EffectsChain,
  Mixer,
  Parameter,
  Score,
} from '@blue/data';
import {
  getKnownMixerChannelSnapshotId,
  getKnownMixerEntrySnapshotId,
} from '../shared/project-editor/identity';
import type { RuntimeBinding } from './project-runtime-reconciliation';

export interface RuntimeParameterSyncResult {
  liveCount: number;
  compiledCount: number;
}

export function syncCompiledRuntimeParameterNames(
  arrangement: Arrangement,
  mixer: Mixer,
  compiledParameters?: Parameter[],
  score?: Score,
): RuntimeParameterSyncResult {
  const liveParameters = [
    ...getArrangementOwnerParameters(arrangement).map((entry) => entry.parameter),
    ...(score ? getTrackOwnerParameters(score).map((entry) => entry.parameter) : []),
    // Pan joins the live enumeration only when the compile included it
    // (score panning enabled); otherwise positional name syncing would
    // misalign every mixer parameter after the first channel's volume.
    ...getMixerOwnerParameters(mixer, score?.panningEnabled ?? false),
  ];

  for (const parameter of liveParameters) {
    parameter.setCompilationVarName('');
  }

  const compiledCount = compiledParameters?.length ?? 0;
  if (!compiledParameters || compiledParameters.length === 0) {
    return {
      liveCount: liveParameters.length,
      compiledCount,
    };
  }

  // Attempt stable match by parameter uniqueId first
  const compiledById = new Map<string, string>();
  for (const cp of compiledParameters) {
    const varName = cp.getCompilationVarName();
    if (varName) {
      compiledById.set(cp.getUniqueId(), varName);
    }
  }

  let matchedAny = false;
  for (const lp of liveParameters) {
    const varName = compiledById.get(lp.getUniqueId());
    if (varName) {
      lp.setCompilationVarName(varName);
      matchedAny = true;
    }
  }

  // Fall back to positional copying if unique IDs did not match (e.g. synthetic test fixtures)
  if (!matchedAny) {
    const count = Math.min(liveParameters.length, compiledParameters.length);
    for (let index = 0; index < count; index += 1) {
      liveParameters[index]!.setCompilationVarName(
        compiledParameters[index]!.getCompilationVarName() ?? '',
      );
    }
  }

  return {
    liveCount: liveParameters.length,
    compiledCount,
  };
}

/**
 * Builds a generation-scoped RuntimeBindingRegistry mapping owner/parameter
 * keys (`${ownerKey}::${parameterId}`) to compiled channel names or automation
 * capabilities. Replaces legacy positional copying and global singletons.
 */
export function buildRuntimeBindingRegistry(
  data: BlueData,
  compiledParameters?: readonly Parameter[],
  blueX7Bindings?: readonly CompiledBlueX7Binding[],
  pannerBindings?: CompiledPannerBindings,
): Map<string, RuntimeBinding> {
  const registry = new Map<string, RuntimeBinding>();

  const compiledById = new Map<string, string>();
  const compiledByName = new Map<string, string>();
  for (const cp of compiledParameters ?? []) {
    const varName = cp.getCompilationVarName();
    if (varName) {
      compiledById.set(cp.getUniqueId(), varName);
      if (cp.getName()) {
        compiledByName.set(cp.getName(), varName);
      }
    }
  }

  const resolveVarName = (param: Parameter): string | undefined => {
    return (
      compiledById.get(param.getUniqueId()) ||
      param.getCompilationVarName() ||
      compiledByName.get(param.getName()) ||
      undefined
    );
  };

  const registerBsbWidgetAliases = (
    ownerKeys: readonly string[],
    owner: BlueSynthBuilder | Effect,
  ): void => {
    const visit = (widget: BSBWidget): void => {
      if (widget instanceof BSBGroup) {
        for (const child of widget.getChildren()) visit(child);
        return;
      }
      if (!widget.objectName || !widget.id) return;

      const aliases: Array<[string, string]> = [[`bsb:${widget.id}`, widget.objectName]];
      if (widget instanceof BSBXYController) {
        aliases.push(
          [`bsb:${widget.id}:xValue`, `${widget.objectName}X`],
          [`bsb:${widget.id}:yValue`, `${widget.objectName}Y`],
        );
      } else if (widget instanceof BSBHSliderBank || widget instanceof BSBVSliderBank) {
        for (let index = 0; index < widget.sliders.length; index += 1) {
          aliases.push([`bsb:${widget.id}[${index}]`, `${widget.objectName}_${index}`]);
        }
      } else {
        aliases.push(
          [`bsb:${widget.id}:selected`, widget.objectName],
          [`bsb:${widget.id}:selectedIndex`, widget.objectName],
        );
      }

      for (const ownerKey of ownerKeys) {
        for (const [alias, parameterName] of aliases) {
          const binding = registry.get(`${ownerKey}::bsb:${parameterName}`);
          if (binding) registry.set(`${ownerKey}::${alias}`, binding);
        }
      }
    };

    visit(owner.getGraphicInterface().getRootGroup());
  };

  // 1. Mixer Channels, Sends, Effects
  const mixer = data.getMixer();
  if (mixer.isEnabled()) {
    const registerChannel = (channel: Channel, channelId: string) => {
      const levelParam = channel.getLevelParameter();
      const levelVar = resolveVarName(levelParam);
      if (levelVar) {
        registry.set(`${channelId}::level`, { kind: 'channel', channel: levelVar });
        registry.set(`${channelId}::volume`, { kind: 'channel', channel: levelVar });
      }
      const panParam = (
        channel as unknown as { getPanParameter?: () => Parameter | undefined }
      ).getPanParameter?.();
      if (panParam) {
        const panVar = resolveVarName(panParam);
        if (panVar) {
          registry.set(`${channelId}::pan`, { kind: 'channel', channel: panVar });
        }
      }
      const panWidthParam = channel.getPanWidthParameter?.();
      if (panWidthParam) {
        const panWidthVar = resolveVarName(panWidthParam);
        if (panWidthVar) {
          registry.set(`${channelId}::panWidth`, { kind: 'channel', channel: panWidthVar });
        }
      }
      const dualPanLeftParam = channel.getDualPanLeftParameter?.();
      if (dualPanLeftParam) {
        const dualPanLeftVar = resolveVarName(dualPanLeftParam);
        if (dualPanLeftVar) {
          registry.set(`${channelId}::dualPanLeft`, { kind: 'channel', channel: dualPanLeftVar });
        }
      }
      const dualPanRightParam = channel.getDualPanRightParameter?.();
      if (dualPanRightParam) {
        const dualPanRightVar = resolveVarName(dualPanRightParam);
        if (dualPanRightVar) {
          registry.set(`${channelId}::dualPanRight`, { kind: 'channel', channel: dualPanRightVar });
        }
      }
      if (pannerBindings) {
        const pb = pannerBindings.channels.find(
          (c) =>
            c.channelIdentity === channelId ||
            c.channelIdentity === channel.getAssociation().trim() ||
            c.channelIdentity === channel.getName().trim(),
        );
        if (pb?.modeChannel) {
          registry.set(`${channelId}::stereoPanMode`, { kind: 'channel', channel: pb.modeChannel });
        }
      }

      const registerChain = (chain: EffectsChain) => {
        for (const entry of chain) {
          const entrySnapshotId = getKnownMixerEntrySnapshotId(entry);
          const entryUniqueId =
            typeof (entry as unknown as { getUniqueId?: unknown }).getUniqueId === 'function'
              ? (entry as unknown as { getUniqueId: () => string }).getUniqueId()
              : undefined;

          if (entry instanceof Send) {
            const sendLevelParam = entry.getLevelParameter();
            const sendVar = resolveVarName(sendLevelParam);
            if (sendVar) {
              if (entrySnapshotId) {
                registry.set(`${channelId}:${entrySnapshotId}::sendLevel`, {
                  kind: 'channel',
                  channel: sendVar,
                });
              }
              if (entryUniqueId && entryUniqueId !== entrySnapshotId) {
                registry.set(`${channelId}:${entryUniqueId}::sendLevel`, {
                  kind: 'channel',
                  channel: sendVar,
                });
              }
            }
          } else if (entry instanceof Effect) {
            for (const param of entry.getParameters()) {
              const pVar = resolveVarName(param);
              if (pVar) {
                if (entrySnapshotId) {
                  registry.set(`${channelId}:${entrySnapshotId}::bsb:${param.getName()}`, {
                    kind: 'channel',
                    channel: pVar,
                  });
                }
                if (entryUniqueId && entryUniqueId !== entrySnapshotId) {
                  registry.set(`${channelId}:${entryUniqueId}::bsb:${param.getName()}`, {
                    kind: 'channel',
                    channel: pVar,
                  });
                }
              }
            }
            const ownerKeys = entrySnapshotId ? [`${channelId}:${entrySnapshotId}`] : [];
            if (entryUniqueId && entryUniqueId !== entrySnapshotId) {
              ownerKeys.push(`${channelId}:${entryUniqueId}`);
            }
            registerBsbWidgetAliases(ownerKeys, entry);
          }
        }
      };

      registerChain(channel.getPreEffects());
      registerChain(channel.getPostEffects());
    };

    // Master channel
    registerChannel(mixer.getMaster(), 'Master');
    registerChannel(mixer.getMaster(), 'master');
    const masterSnapshotId = getKnownMixerChannelSnapshotId(mixer.getMaster());
    if (masterSnapshotId && masterSnapshotId !== 'Master' && masterSnapshotId !== 'master') {
      registerChannel(mixer.getMaster(), masterSnapshotId);
    }

    // All source channels and subchannels
    for (const ch of mixer.getAllSourceChannels()) {
      const chSnapshotId = getKnownMixerChannelSnapshotId(ch);
      if (chSnapshotId) registerChannel(ch, chSnapshotId);
      if (ch.getName()) registerChannel(ch, ch.getName());
      if (ch.getAssociation()) registerChannel(ch, ch.getAssociation());
    }
    for (const ch of mixer.getSubChannels()) {
      const chSnapshotId = getKnownMixerChannelSnapshotId(ch);
      if (chSnapshotId) registerChannel(ch, chSnapshotId);
      if (ch.getName()) registerChannel(ch, ch.getName());
    }
  }

  // 2. Arrangement Instruments (BSB)
  const arrangement = data.getArrangement();
  for (const ia of arrangement.getArrangement()) {
    if (!ia.enabled || !ia.instr) continue;
    const assignmentId = ia.arrangementId;
    if (ia.instr instanceof BlueSynthBuilder) {
      const ownerKeys = [assignmentId, `arrangement:${assignmentId}`];
      for (const param of ia.instr.getParameters()) {
        const pVar = resolveVarName(param);
        if (pVar) {
          for (const ownerKey of ownerKeys) {
            registry.set(`${ownerKey}::bsb:${param.getName()}`, {
              kind: 'channel',
              channel: pVar,
            });
          }
        }
      }
      registerBsbWidgetAliases(ownerKeys, ia.instr);
    }
  }

  // 3. Track Instruments (BSB)
  const score = data.getScore();
  for (const group of score) {
    if (!(group instanceof TrackLayerGroup)) continue;
    for (const track of group) {
      const instr = track.getInstrument();
      if (!instr || !instr.isEnabled()) continue;
      const ownerKey = `track:${group.getUniqueId()}:${track.getUniqueId()}`;
      if (instr instanceof BlueSynthBuilder) {
        for (const param of instr.getParameters()) {
          const pVar = resolveVarName(param);
          if (pVar) {
            registry.set(`${ownerKey}::bsb:${param.getName()}`, {
              kind: 'channel',
              channel: pVar,
            });
          }
        }
        registerBsbWidgetAliases([ownerKey], instr);
      }
    }
  }

  // 4. BlueX7 Bindings
  for (const b of blueX7Bindings ?? []) {
    const ownerIdentity = b.ownerIdentity;
    for (const [semanticKey, chName] of b.parameterChannels) {
      registry.set(`${ownerIdentity}::bluex7:${semanticKey}`, {
        kind: 'channel',
        channel: chName,
      });
      if (ownerIdentity.startsWith('arrangement:')) {
        const rawId = ownerIdentity.slice('arrangement:'.length);
        registry.set(`${rawId}::bluex7:${semanticKey}`, {
          kind: 'channel',
          channel: chName,
        });
      }
    }
    registry.set(`${ownerIdentity}::bluex7:voice`, {
      kind: 'automation',
      supportsCreate: true,
      supportsUpdate: true,
      supportsDelete: true,
    });
    if (ownerIdentity.startsWith('arrangement:')) {
      const rawId = ownerIdentity.slice('arrangement:'.length);
      registry.set(`${rawId}::bluex7:voice`, {
        kind: 'automation',
        supportsCreate: true,
        supportsUpdate: true,
        supportsDelete: true,
      });
    }
  }

  // 5. Score Automation
  for (const entry of getProjectParameterCatalog(data)) {
    registry.set(`score::${entry.parameter.getUniqueId()}`, {
      kind: 'automation',
      supportsCreate: true,
      supportsUpdate: true,
      supportsDelete: true,
    });
  }

  // 6. Generation-scoped Panner Bindings
  if (pannerBindings?.scoreLawChannel) {
    registry.set('score::panLawDb', { kind: 'channel', channel: pannerBindings.scoreLawChannel });
  }
  if (pannerBindings?.scoreBoostChannel) {
    registry.set('score::panOffCenterBoost', {
      kind: 'channel',
      channel: pannerBindings.scoreBoostChannel,
    });
  }
  if (pannerBindings?.channels) {
    for (const b of pannerBindings.channels) {
      if (b.modeChannel && b.channelIdentity) {
        registry.set(`${b.channelIdentity}::stereoPanMode`, {
          kind: 'channel',
          channel: b.modeChannel,
        });
      }
    }
  }

  return registry;
}
