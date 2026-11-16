import type { BlueData } from '../blue-data';
import { TrackLayerGroup } from '../score/track/track-layer-group';
import { Track } from '../score/track/track';
import { AudioClip } from '../score/audio/audio-clip';
import { Mixer, buildSubChannelMeterKeys } from '../mixer/mixer';
import { OpcodeList } from '../opcodes/opcode-list';
import { UDOStyle } from '../opcodes/udo-style';
import type { Parameter } from '../automation/parameter';
import { CompileData } from '../compile-data';
import type {
  CompiledMeterChannelBinding,
  CompiledMixerGateBinding,
  CompiledMixerGateBindings,
  CompiledMixerGateLocator,
  CompiledChannelPannerBinding,
  CompiledPannerBindings,
  MeterBindingMap,
} from '../compile-data';
import {
  buildMixerRouteGraph,
  computeMixerGateState,
  getMixerRouteSignature,
  sortSubChannelsForRendering,
  type MixerGateState,
  type MixerRouteGraph,
} from '../mixer/mute-solo-policy';
import { Effect } from '../mixer/effect';
import { EffectsChain } from '../mixer/effects-chain';
import { Channel } from '../mixer/channel';
import { Send } from '../mixer/send';
import {
  hasEnabledStereoGeneratingEffect,
  resolveEffectiveTrackLayout,
  type AudioLayoutManifest,
  type EffectiveTrackLayout,
} from '../score/audio/audio-layout';
import {
  getDualPanGains,
  getMonoPanGains,
  getStereoBalanceGains,
  getStereoPanGains,
  stereoPanModeToNumber,
  type PanLawDb,
} from '../mixer/channel-pan';
import { formatBlueNumber } from '../utilities/number-format';

const SCORE_PAN_LAW_CHANNEL = 'gk_blue_score_pan_law';
const SCORE_PAN_BOOST_CHANNEL = 'gk_blue_score_pan_boost';
const PAN_MODE_CHANNEL_PREFIX = 'gk_blue_pan_mode_';

export function generateMixerOrchestra(
  blueData: BlueData,
  channelIdAssignments: Map<Channel, number>,
  nchnls: number,
  udos: OpcodeList,
  compileData: CompileData,
  mixer: Mixer = blueData.getMixer(),
  emitMetering = false,
  gateContext: BlueMixerGateContext | null = null,
  prunedTrackIds?: ReadonlySet<string>,
): { effectUDOs: string[]; instrumentsText: string; effectIdMap: Map<Effect, number> } {
  const instrBuffer: string[] = [];
  const sourceChannels = mixer.getAllSourceChannels();
  const subChannels = sortSubChannelsForRendering(Array.from(mixer.getSubChannels()));

  let effectId = 0;
  const effectUDOs: string[] = [];
  const effectIdMap = new Map<Effect, number>();

  const registerEffects = (chain: EffectsChain) => {
    for (const item of chain) {
      if (!(item instanceof Effect) || !item.isEnabled() || effectIdMap.has(item)) {
        continue;
      }
      const udo = item.generateUDO(effectId, item.getParameters(), udos);
      if (!udo) {
        continue;
      }
      effectUDOs.push(udo);
      effectIdMap.set(item, effectId);
      effectId++;
    }
  };

  for (const channel of sourceChannels) {
    registerEffects(channel.getPreEffects());
    registerEffects(channel.getPostEffects());
  }

  for (const subChannel of subChannels) {
    registerEffects(subChannel.getPreEffects());
    registerEffects(subChannel.getPostEffects());
  }

  registerEffects(mixer.getMaster().getPreEffects());
  registerEffects(mixer.getMaster().getPostEffects());

  // Generate BlueMixer instrument
  const blueMixerCode = generateBlueMixer(
    blueData,
    sourceChannels,
    subChannels,
    channelIdAssignments,
    nchnls,
    effectIdMap,
    compileData,
    mixer,
    emitMetering,
    gateContext,
    prunedTrackIds,
  );
  if (compileData.isPanningEnabled() && nchnls === 2) {
    instrBuffer.push(BLUE_MIXER_CALC_PAN_GAINS_MACRO, '');
  }
  instrBuffer.push(blueMixerCode);

  return {
    effectUDOs,
    instrumentsText: instrBuffer.join('\n'),
    effectIdMap,
  };
}

export function emitMeterTaps(
  csdKey: string,
  signalVars: string[],
  lines: string[],
  nextVarId: () => number,
): void {
  for (let ch = 0; ch < signalVars.length; ch++) {
    const vid = nextVarId();
    lines.push(`kMeter_rms_${vid} rms ${signalVars[ch]}`);
    lines.push(`kMeter_peak_${vid} maxk ${signalVars[ch]}, kMeterTrig, 1`);
    lines.push('if kMeterTrig == 1 then');
    lines.push(`  chnset kMeter_rms_${vid}, "bm_meter_rms_${csdKey}_${ch}"`);
    lines.push(`  chnset kMeter_peak_${vid}, "bm_meter_peak_${csdKey}_${ch}"`);
    lines.push('endif');
  }
}

export function buildMeterBindingMap(
  mixer: Mixer,
  channelIdAssignments: Map<Channel, number>,
  nchnls: number,
): MeterBindingMap {
  const entries: CompiledMeterChannelBinding[] = [];

  let sourceIndex = 0;
  for (const channel of mixer.getAllSourceChannels()) {
    const id = channelIdAssignments.get(channel);
    if (id === undefined) continue;
    const csdKey = String(id);
    const stripId = channel.getAssociation().trim() || csdKey;
    entries.push({
      kind: 'source',
      csdKey,
      stripId,
      displayName: channel.getName(),
      channel,
      channelIndex: sourceIndex++,
    });
  }

  const subMeterKeys = buildSubChannelMeterKeys(Array.from(mixer.getSubChannels()));
  let subIndex = 0;
  for (const subChannel of mixer.getSubChannels()) {
    const name = subChannel.getName();
    const csdKey = subMeterKeys.get(subChannel) ?? `sub_${name.replace(/\s+/g, '_')}`;
    const stripId = subChannel.getAssociation().trim() || name;
    entries.push({
      kind: 'sub',
      csdKey,
      stripId,
      displayName: name,
      channel: subChannel,
      channelIndex: subIndex++,
    });
  }

  const master = mixer.getMaster();
  entries.push({
    kind: 'master',
    csdKey: 'sub_Master',
    stripId: 'master',
    displayName: 'Master',
    channel: master,
  });

  return {
    entries,
    nchnls,
  };
}

// ─── Mixer mute/solo audio gates (Spec 111) ───

export const MIXER_GATE_SYMBOL_PREFIX = 'gk_blue_mixgate_';
export const MIXER_GATE_COMMIT_CHANNEL = `${MIXER_GATE_SYMBOL_PREFIX}commit`;
export const MIXER_GATE_APPLIED_CHANNEL = `${MIXER_GATE_SYMBOL_PREFIX}applied`;
/** Shared transition ramp duration in seconds; initial values bypass the ramp. */
export const MIXER_GATE_RAMP_SECONDS = 0.005;

const GATE_RAMP_VAR = 'kMixGateStep';
const GATE_COMMIT_VAR = 'kMixGateCommit';
const GATE_BANK_VAR = 'kMixGateBank';

export interface BlueMixerGateContext {
  /** `live` emits engine-addressable two-bank gates; `fixed` bakes constants (disk). */
  readonly mode: 'live' | 'fixed';
  readonly state: MixerGateState;
  readonly graph: MixerRouteGraph;
  readonly signature: string;
  /** Cloned Send object -> gate ordinal, aligned with graph edge walk order. */
  readonly sendGateOrdinals: Map<Send, number>;
  /** Route node ordinal -> final-output gate ordinal. */
  readonly outputGateOrdinals: Map<number, number>;
  /** Cloned channels in graph ordinal order (sources, render-ordered subs, master). */
  readonly orderedChannels: Channel[];
  /** Cloned channel -> graph ordinal. */
  readonly channelOrdinals: ReadonlyMap<Channel, number>;
}

/**
 * Builds the compile-time gate context for a mixer: route graph, gate state,
 * and the send/output ordinal maps the BlueMixer emitter uses. Returns null
 * when the mixer is disabled (no gates exist).
 */
export function buildBlueMixerGateContext(
  mixer: Mixer,
  mode: 'live' | 'fixed',
): BlueMixerGateContext | null {
  if (!mixer.isEnabled()) return null;
  const graph = buildMixerRouteGraph(mixer);
  const state = computeMixerGateState(graph);

  const orderedChannels = [
    ...mixer.getAllSourceChannels(),
    ...sortSubChannelsForRendering(Array.from(mixer.getSubChannels())),
    mixer.getMaster(),
  ];
  const sendGateOrdinals = new Map<Send, number>();
  const outputGateOrdinals = new Map<number, number>();
  for (const edge of graph.edges) {
    const channel = orderedChannels[edge.sourceOrdinal];
    if (!channel) continue;
    if (edge.kind === 'send') {
      const chain = edge.chainKind === 'pre' ? channel.getPreEffects() : channel.getPostEffects();
      const item = chain[edge.chainIndex];
      if (item instanceof Send) sendGateOrdinals.set(item, edge.gateOrdinal);
    } else {
      outputGateOrdinals.set(edge.sourceOrdinal, edge.gateOrdinal);
    }
  }

  return {
    mode,
    state,
    graph,
    signature: getMixerRouteSignature(graph),
    sendGateOrdinals,
    outputGateOrdinals,
    orderedChannels,
    channelOrdinals: new Map(orderedChannels.map((channel, ordinal) => [channel, ordinal])),
  };
}

export function buildCompiledMixerGateBindings(
  context: BlueMixerGateContext,
): CompiledMixerGateBindings {
  const nodes = context.graph.nodes;
  const gates: CompiledMixerGateBinding[] = context.graph.edges.map((edge) => {
    const node = nodes[edge.sourceOrdinal];
    const association = context.orderedChannels[edge.sourceOrdinal]?.getAssociation().trim() ?? '';
    let locator: CompiledMixerGateLocator;
    const channelIdentity = node.identity;
    if (edge.kind === 'send') {
      locator = {
        route: 'send',
        channelOrdinal: edge.sourceOrdinal,
        channelKind: node.kind,
        channelIdentity,
        entryIdentity: edge.entryIdentity,
        chainKind: edge.chainKind,
        chainIndex: edge.chainIndex,
        targetName: edge.targetName,
        association,
      };
    } else {
      locator = {
        route: 'output',
        channelOrdinal: edge.sourceOrdinal,
        channelKind: node.kind,
        channelIdentity,
        entryIdentity: edge.entryIdentity,
        association,
      };
    }
    return {
      ordinal: edge.gateOrdinal,
      bankSymbols: [
        `${MIXER_GATE_SYMBOL_PREFIX}${edge.gateOrdinal}_0`,
        `${MIXER_GATE_SYMBOL_PREFIX}${edge.gateOrdinal}_1`,
      ],
      initial: context.state.gates[edge.gateOrdinal] ?? 1,
      locator,
    };
  });
  return {
    signature: context.signature,
    commitChannel: MIXER_GATE_COMMIT_CHANNEL,
    appliedChannel: MIXER_GATE_APPLIED_CHANNEL,
    gates,
  };
}

/**
 * Engine-addressable channel declarations for both gate banks and the
 * commit/applied tokens. Both banks start at the desired initial targets so
 * bank selection (commit token modulo two) is audible-safe from the first
 * control cycle.
 */
export function buildMixerGateInitStatements(bindings: CompiledMixerGateBindings): string {
  const lines: string[] = [];
  const declare = (name: string, value: number) => {
    lines.push(`${name} init ${formatBlueNumber(value)}`);
    lines.push(`${name} chnexport "${name}", 3`);
  };
  for (const gate of bindings.gates) {
    declare(gate.bankSymbols[0], gate.initial);
    declare(gate.bankSymbols[1], gate.initial);
  }
  declare(MIXER_GATE_COMMIT_CHANNEL, 0);
  declare(MIXER_GATE_APPLIED_CHANNEL, 0);
  return lines.join('\n');
}

/**
 * Emits the per-cycle gate preamble for the BlueMixer instrument: the shared
 * 5 ms ramp step, one-per-cycle bank selection from the commit token, and
 * per-gate clamped linear transitions. Per-gate states are i-time
 * initialized at their targets, so startup never ramps or leaks muted audio.
 */
function emitGatePreamble(context: BlueMixerGateContext, lines: string[]): void {
  if (context.mode !== 'live') return;
  lines.push(`${GATE_RAMP_VAR} init ksmps / (${MIXER_GATE_RAMP_SECONDS} * sr)`);
  lines.push(`${GATE_COMMIT_VAR} = ${MIXER_GATE_COMMIT_CHANNEL}`);
  lines.push(`${GATE_BANK_VAR} = (${GATE_COMMIT_VAR} % 2)`);
  for (const edge of context.graph.edges) {
    const stateVar = gateStateVar(edge.gateOrdinal);
    const initial = context.state.gates[edge.gateOrdinal] ?? 1;
    lines.push(`${stateVar} init ${initial}`);
    lines.push(
      `${stateVar} += limit((${GATE_BANK_VAR} == 0 ? ` +
        `${MIXER_GATE_SYMBOL_PREFIX}${edge.gateOrdinal}_0 : ` +
        `${MIXER_GATE_SYMBOL_PREFIX}${edge.gateOrdinal}_1) - ${stateVar}, ` +
        `-${GATE_RAMP_VAR}, ${GATE_RAMP_VAR})`,
    );
  }
}

export function buildCompiledPannerBindings(mixer: Mixer): CompiledPannerBindings {
  const orderedChannels = [
    ...mixer.getAllSourceChannels(),
    ...sortSubChannelsForRendering(Array.from(mixer.getSubChannels())),
    mixer.getMaster(),
  ];
  const channels: CompiledChannelPannerBinding[] = orderedChannels.map((channel, ordinal) => {
    const kind: 'source' | 'sub' | 'master' =
      channel === mixer.getMaster()
        ? 'master'
        : mixer.getSubChannels().includes(channel)
          ? 'sub'
          : 'source';
    const channelIdentity = channel.getRuntimeIdentity();
    return {
      channelIdentity,
      channelOrdinal: ordinal,
      channelKind: kind,
      modeChannel: `gk_blue_pan_mode_${ordinal}`,
      widthVar: channel.getPanWidthParameter().getCompilationVarName() || undefined,
      dualLeftVar: channel.getDualPanLeftParameter().getCompilationVarName() || undefined,
      dualRightVar: channel.getDualPanRightParameter().getCompilationVarName() || undefined,
    };
  });

  return {
    signature: 'panner-signature',
    scoreLawChannel: SCORE_PAN_LAW_CHANNEL,
    scoreBoostChannel: SCORE_PAN_BOOST_CHANNEL,
    channels,
  };
}

export function buildPannerInitStatements(
  blueData: BlueData,
  bindings: CompiledPannerBindings,
  mixer: Mixer = blueData.getMixer(),
): string {
  const lines: string[] = [];
  const lawDb = mixer.getPanLawDb();
  const boost = mixer.isPanOffCenterBoost() ? 1 : 0;

  lines.push(`${bindings.scoreLawChannel} init ${formatBlueNumber(lawDb)}`);
  lines.push(`${bindings.scoreLawChannel} chnexport "${bindings.scoreLawChannel}", 3`);
  lines.push(`${bindings.scoreBoostChannel} init ${boost}`);
  lines.push(`${bindings.scoreBoostChannel} chnexport "${bindings.scoreBoostChannel}", 3`);

  const orderedChannels = [
    ...mixer.getAllSourceChannels(),
    ...sortSubChannelsForRendering(Array.from(mixer.getSubChannels())),
    mixer.getMaster(),
  ];

  for (const b of bindings.channels) {
    const ch = orderedChannels[b.channelOrdinal];
    const initialMode = ch ? stereoPanModeToNumber(ch.getStereoPanMode()) : 0;
    lines.push(`${b.modeChannel} init ${initialMode}`);
    lines.push(`${b.modeChannel} chnexport "${b.modeChannel}", 3`);
  }

  return lines.join('\n');
}

function gateStateVar(ordinal: number): string {
  return `kMixGateState_${ordinal}`;
}

/** Signal multiplier expression for a gate; empty string when ungated. */
function gateMultiplierExpr(context: BlueMixerGateContext, gateOrdinal: number): string {
  if (context.mode === 'live') {
    return ` * ${gateStateVar(gateOrdinal)}`;
  }
  // Fixed (disk) gates: bake the constant, and only when it silences the
  // route so ordinary projects keep their exact legacy CSD text.
  return (context.state.gates[gateOrdinal] ?? 1) === 1 ? '' : ' * 0';
}

/** In-place output gate lines; empty when the output route stays open. */
function emitOutputGate(
  context: BlueMixerGateContext,
  channelOrdinal: number,
  signalVars: string[],
  lines: string[],
): void {
  const gateOrdinal = context.outputGateOrdinals.get(channelOrdinal);
  if (gateOrdinal === undefined) return;
  const multiplier = gateMultiplierExpr(context, gateOrdinal);
  if (multiplier === '') return;
  if (context.mode === 'live') {
    const stateVar = gateStateVar(gateOrdinal);
    for (const signalVar of signalVars) {
      lines.push(`${signalVar} = ${signalVar} * ${stateVar}`);
    }
    return;
  }
  for (const signalVar of signalVars) {
    lines.push(`${signalVar} = ${signalVar} * 0`);
  }
}

/**
 * Generate the BlueMixer instrument.
 * Routes audio through volumes, sends, effect UDOs, and outputs via outc.
 * With a gate context (Spec 111), every send tap and every channel output is
 * gated after local processing, and output meters read the gated signal.
 */
export function generateBlueMixer(
  blueData: BlueData,
  sourceChannels: Channel[],
  subChannels: Channel[],
  channelIdAssignments: Map<Channel, number>,
  nchnls: number,
  effectIdMap: Map<Effect, number>,
  compileData: CompileData,
  mixer: Mixer = blueData.getMixer(),
  emitMetering = false,
  gateContext: BlueMixerGateContext | null = null,
  prunedTrackIds?: ReadonlySet<string>,
): string {
  const lines: string[] = [];
  const panningEnabled = compileData.isPanningEnabled();
  const layoutManifest = compileData.getAudioLayoutManifest();

  lines.push('\tinstr BlueMixer\t;Blue Mixer Instrument');

  let meterVarCounter = 0;
  const nextMeterVarId = () => meterVarCounter++;

  if (emitMetering) {
    lines.push('kMeterSamples init 0');
    lines.push('kMeterWindow = sr / 30');
    lines.push('kMeterSamples += ksmps');
    lines.push('if kMeterSamples >= kMeterWindow then');
    lines.push('  kMeterTrig = 1');
    lines.push('  kMeterSamples = 0');
    lines.push('else');
    lines.push('  kMeterTrig = 0');
    lines.push('endif');
  }

  if (gateContext) {
    emitGatePreamble(gateContext, lines);
  }

  // Process each source channel
  for (const channel of sourceChannels) {
    const channelId = channelIdAssignments.get(channel);
    if (channelId === undefined) continue;
    if (gateContext?.mode === 'fixed' && prunedTrackIds?.has(channel.getAssociation())) continue;
    const signalVars = getSourceSignalVars(blueData, channelId, nchnls);

    applyEffectsChain(
      blueData,
      channel.getPreEffects(),
      signalVars,
      effectIdMap,
      lines,
      gateContext,
    );
    applyChannelLevel(blueData, signalVars, channel.getLevelParameter(), channel.getLevel(), lines);
    applyEffectsChain(
      blueData,
      channel.getPostEffects(),
      signalVars,
      effectIdMap,
      lines,
      gateContext,
    );
    if (panningEnabled && nchnls === 2) {
      const layout = resolveChannelLayout(blueData, channel, layoutManifest);
      applyChannelPan(
        blueData,
        signalVars,
        channel,
        layout,
        lines,
        gateContext?.mode === 'live',
        gateContext ? `${PAN_MODE_CHANNEL_PREFIX}${channelOrdinalOf(gateContext, channel)}` : null,
      );
    }
    if (gateContext) {
      emitOutputGate(gateContext, channelOrdinalOf(gateContext, channel), signalVars, lines);
    }
    if (emitMetering) {
      emitMeterTaps(String(channelId), signalVars, lines, nextMeterVarId);
    }
    routeChannelOutput(blueData, signalVars, channel.getOutChannel(), channel.getName(), lines);
  }

  // Process sub-channels
  const subMeterKeys = emitMetering ? buildSubChannelMeterKeys(subChannels) : null;
  for (const subChannel of subChannels) {
    const signalVars = getSubChannelSignalVars(blueData, subChannel.getName(), nchnls);

    applyEffectsChain(
      blueData,
      subChannel.getPreEffects(),
      signalVars,
      effectIdMap,
      lines,
      gateContext,
    );
    applyChannelLevel(
      blueData,
      signalVars,
      subChannel.getLevelParameter(),
      subChannel.getLevel(),
      lines,
    );
    applyEffectsChain(
      blueData,
      subChannel.getPostEffects(),
      signalVars,
      effectIdMap,
      lines,
      gateContext,
    );
    if (panningEnabled && nchnls === 2) {
      applyChannelPan(
        blueData,
        signalVars,
        subChannel,
        'stereo-or-unknown',
        lines,
        gateContext?.mode === 'live',
        gateContext
          ? `${PAN_MODE_CHANNEL_PREFIX}${channelOrdinalOf(gateContext, subChannel)}`
          : null,
      );
    }
    if (gateContext) {
      emitOutputGate(gateContext, channelOrdinalOf(gateContext, subChannel), signalVars, lines);
    }
    if (emitMetering) {
      const subKey =
        subMeterKeys?.get(subChannel) ?? `sub_${subChannel.getName().replace(/\s+/g, '_')}`;
      emitMeterTaps(subKey, signalVars, lines, nextMeterVarId);
    }
    routeChannelOutput(
      blueData,
      signalVars,
      subChannel.getOutChannel(),
      subChannel.getName(),
      lines,
    );
  }

  const masterChannel = mixer.getMaster();
  const masterVars = getSubChannelSignalVars(blueData, 'Master', nchnls);
  applyEffectsChain(
    blueData,
    masterChannel.getPreEffects(),
    masterVars,
    effectIdMap,
    lines,
    gateContext,
  );
  applyChannelLevel(
    blueData,
    masterVars,
    masterChannel.getLevelParameter(),
    masterChannel.getLevel(),
    lines,
  );
  applyEffectsChain(
    blueData,
    masterChannel.getPostEffects(),
    masterVars,
    effectIdMap,
    lines,
    gateContext,
  );
  if (panningEnabled && nchnls === 2) {
    applyChannelPan(
      blueData,
      masterVars,
      masterChannel,
      'stereo-or-unknown',
      lines,
      gateContext?.mode === 'live',
      gateContext
        ? `${PAN_MODE_CHANNEL_PREFIX}${channelOrdinalOf(gateContext, masterChannel)}`
        : null,
    );
  }
  if (gateContext) {
    emitOutputGate(gateContext, channelOrdinalOf(gateContext, masterChannel), masterVars, lines);
  }
  if (emitMetering) {
    emitMeterTaps('sub_Master', masterVars, lines, nextMeterVarId);
  }
  lines.push(`outc ${masterVars.join(', ')}`);

  if (gateContext && gateContext.mode === 'live') {
    // Echo the sampled commit token after bank selection so the engine can
    // observe which values this control cycle actually used.
    lines.push(`${MIXER_GATE_APPLIED_CHANNEL} = ${GATE_COMMIT_VAR}`);
  }

  // Clear all audio variables: one batched clear over the exact ordered set
  // the per-variable loops previously reset (Spec 118). Includes sources
  // skipped by disk pruning; an empty collection emits no statement; lists
  // beyond the supported-runtime argument limit split into deterministic
  // bounded groups preserving order.
  const clearVars: string[] = [];
  for (const channel of sourceChannels) {
    const channelId = channelIdAssignments.get(channel);
    if (channelId === undefined) continue;
    clearVars.push(...getSourceSignalVars(blueData, channelId, nchnls));
  }
  for (const subChannel of subChannels) {
    clearVars.push(...getSubChannelSignalVars(blueData, subChannel.getName(), nchnls));
  }
  clearVars.push(...masterVars);
  const CLEAR_MAX_ARGS = 1999;
  for (let start = 0; start < clearVars.length; start += CLEAR_MAX_ARGS) {
    lines.push(`clear ${clearVars.slice(start, start + CLEAR_MAX_ARGS).join(', ')}`);
  }

  if (lines.some((line) => line.includes('$BLUE_MIXER_CALC_PAN_GAINS('))) {
    const lawExpr =
      gateContext?.mode === 'live' ? SCORE_PAN_LAW_CHANNEL : String(mixer.getPanLawDb());
    const boostExpr =
      gateContext?.mode === 'live'
        ? SCORE_PAN_BOOST_CHANNEL
        : mixer.isPanOffCenterBoost()
          ? '1'
          : '0';
    lines.splice(
      1,
      0,
      `if ${boostExpr} != 0 && ${lawExpr} != 0 then`,
      `  k_pan_boost_amount = pow(10, abs(${lawExpr}) / 20) - 1`,
      'else',
      '  k_pan_boost_amount = 0',
      'endif',
    );
  }

  lines.push('');
  lines.push('\tendin');
  lines.push('');

  return lines.join('\n');
}

/** Graph ordinal of a cloned channel within the gate context. */
function channelOrdinalOf(context: BlueMixerGateContext, channel: Channel): number {
  return context.channelOrdinals.get(channel) ?? -1;
}

function applyEffectsChain(
  blueData: BlueData,
  chain: EffectsChain,
  signalVars: string[],
  effectIdMap: Map<Effect, number>,
  lines: string[],
  gateContext: BlueMixerGateContext | null = null,
): void {
  for (const item of chain) {
    if (item instanceof Effect) {
      if (!item.isEnabled()) {
        continue;
      }

      const effectId = effectIdMap.get(item);
      if (effectId === undefined) {
        continue;
      }

      if (item.getStyle() === UDOStyle.MODERN) {
        lines.push(`${signalVars.join(', ')} = blueEffect${effectId}(${signalVars.join(', ')})`);
      } else {
        lines.push(`${signalVars.join(', ')}\tblueEffect${effectId}\t${signalVars.join(', ')}`);
      }
      continue;
    }

    if (!item.isEnabled()) {
      continue;
    }

    const targetName = item.getSendChannel() || 'Master';
    const amountExpr = getSendAmountExpression(blueData, item);
    const gateExpr = gateContext
      ? gateMultiplierExpr(gateContext, gateContext.sendGateOrdinals.get(item) ?? -1)
      : '';

    if (
      gateContext?.mode === 'live' &&
      gateExpr !== '' &&
      amountExpr !== '1' &&
      amountExpr !== '1.0'
    ) {
      // Spec 118: compute the amount × live-gate product once at k-rate at the
      // send tap and share it across the send's channels. The product is
      // emitted immediately before its accumulations, so it expires before any
      // later authored execution or the next send's reuse of the symbol.
      // Fixed (disk) gates keep their original baked text.
      lines.push(`kMixSendGain = ${amountExpr}${gateExpr}`);
      for (let i = 0; i < signalVars.length; i++) {
        const targetVar = getSubChannelVar(blueData, targetName, i);
        lines.push(`${targetVar}\t+=\t${signalVars[i]} * kMixSendGain`);
      }
      continue;
    }

    for (let i = 0; i < signalVars.length; i++) {
      const targetVar = getSubChannelVar(blueData, targetName, i);
      lines.push(
        `${targetVar}\t+=\t${scaleSignal(blueData, signalVars[i], amountExpr)}${gateExpr}`,
      );
    }
  }
}

function applyChannelLevel(
  blueData: BlueData,
  signalVars: string[],
  levelParam: Parameter,
  fallbackLevel: number,
  lines: string[],
): void {
  const compilationVarName = levelParam.getCompilationVarName();
  if (compilationVarName) {
    lines.push(`ktempdb = ampdb(${compilationVarName})`);
    for (const signalVar of signalVars) {
      lines.push(`${signalVar} *= ktempdb`);
    }
    return;
  }

  const multiplier = Math.pow(10, fallbackLevel / 20);
  if (Math.abs(multiplier - 1.0) <= 0.0001) {
    return;
  }

  for (const signalVar of signalVars) {
    lines.push(`${signalVar} *= ${multiplier}`);
  }
}

function resolveChannelLayout(
  blueData: BlueData,
  channel: Channel,
  manifest?: AudioLayoutManifest | null,
): EffectiveTrackLayout {
  const hasEffects =
    hasEnabledStereoGeneratingEffect(channel.getPreEffects()) ||
    hasEnabledStereoGeneratingEffect(channel.getPostEffects());
  if (hasEffects) {
    return 'stereo-or-unknown';
  }

  const trackId = channel.getAssociation().trim();
  if (!trackId) {
    return 'stereo-or-unknown';
  }

  let matchedTrack: Track | undefined;
  let hasOtherItems = false;
  const score = blueData.getScore();
  for (const layerGroup of score) {
    if (layerGroup instanceof TrackLayerGroup) {
      for (const track of layerGroup) {
        if (track.getUniqueId() === trackId) {
          matchedTrack = track;
          break;
        }
      }
    }
    if (matchedTrack) break;
  }

  if (!matchedTrack) {
    return 'stereo-or-unknown';
  }

  if (matchedTrack.getInstrument() && matchedTrack.getInstrument()!.isEnabled()) {
    return 'stereo-or-unknown';
  }

  const clipPaths: string[] = [];
  for (const item of matchedTrack) {
    if (item instanceof AudioClip) {
      clipPaths.push(item.getAudioFile());
    } else {
      hasOtherItems = true;
    }
  }

  return resolveEffectiveTrackLayout(clipPaths, manifest, {
    hasStereoOrUnclassifiedSource: hasOtherItems,
    hasUpstreamEffects: hasEffects,
  });
}

function generateCsoundSourceLegGainExprs(
  posExpr: string,
  lawDb: PanLawDb,
  boost: boolean,
): [leftGainExpr: string, rightGainExpr: string] {
  let leftExpr: string;
  let rightExpr: string;
  switch (lawDb) {
    case 0:
      leftExpr = `min(1, 2 * (1 - ${posExpr}))`;
      rightExpr = `min(1, 2 * ${posExpr})`;
      break;
    case -3:
      leftExpr = `cos(1.5707963267948966 * ${posExpr})`;
      rightExpr = `sin(1.5707963267948966 * ${posExpr})`;
      break;
    case -4.5:
      leftExpr = `(0.46189768862683755 * cos(1.5707963267948966 * ${posExpr}) + 0.5381023113731624 * (1 - ${posExpr}))`;
      rightExpr = `(0.46189768862683755 * sin(1.5707963267948966 * ${posExpr}) + 0.5381023113731624 * ${posExpr})`;
      break;
    case -6:
      leftExpr = `(1 - ${posExpr})`;
      rightExpr = `${posExpr}`;
      break;
  }
  if (boost && lawDb !== 0) {
    const boostMult = Math.pow(10, Math.abs(lawDb) / 20) - 1.0;
    const boostExpr = `(1 + ${boostMult * 2} * abs(${posExpr} - 0.5))`;
    leftExpr = `(${leftExpr} * ${boostExpr})`;
    rightExpr = `(${rightExpr} * ${boostExpr})`;
  }
  return [leftExpr, rightExpr];
}

function emitStereoPanMatrixLines(
  signalVars: string[],
  aL: number,
  bL: number,
  aR: number,
  bR: number,
  lines: string[],
): void {
  if (
    Math.abs(aL - 1.0) < 0.0001 &&
    Math.abs(bL) < 0.0001 &&
    Math.abs(aR) < 0.0001 &&
    Math.abs(bR - 1.0) < 0.0001
  ) {
    return;
  }
  const inL = signalVars[0];
  const inR = signalVars[1];
  lines.push(`a_pan_in_l = ${inL}`);
  lines.push(`a_pan_in_r = ${inR}`);
  lines.push(`${inL} = ${aL} * a_pan_in_l + ${aR} * a_pan_in_r`);
  lines.push(`${inR} = ${bL} * a_pan_in_l + ${bR} * a_pan_in_r`);
}

function emitDynamicSourceLegGainLines(
  posExpr: string,
  leftVar: string,
  rightVar: string,
  lines: string[],
  lawExpr = SCORE_PAN_LAW_CHANNEL,
  boostExpr = SCORE_PAN_BOOST_CHANNEL,
): void {
  lines.push(
    `$BLUE_MIXER_CALC_PAN_GAINS(${posExpr}'${leftVar}'${rightVar}'${lawExpr}'${boostExpr})`,
  );
}

const BLUE_MIXER_CALC_PAN_GAINS_MACRO = `#define BLUE_MIXER_CALC_PAN_GAINS(POS'LEFT'RIGHT'LAW'BOOST) #
$LEFT = ($LAW == 0 ? min(1, 2 * (1 - ($POS))) : $LAW == -3 ? cos(1.5707963267948966 * ($POS)) : $LAW == -4.5 ? (0.46189768862683755 * cos(1.5707963267948966 * ($POS)) + 0.5381023113731624 * (1 - ($POS))) : (1 - ($POS)))
$RIGHT = ($LAW == 0 ? min(1, 2 * ($POS)) : $LAW == -3 ? sin(1.5707963267948966 * ($POS)) : $LAW == -4.5 ? (0.46189768862683755 * sin(1.5707963267948966 * ($POS)) + 0.5381023113731624 * ($POS)) : ($POS))
if $BOOST != 0 && $LAW != 0 then
  k_pan_boost = 1 + k_pan_boost_amount * 2 * abs(($POS) - 0.5)
  $LEFT *= k_pan_boost
  $RIGHT *= k_pan_boost
endif
#`;

function emitDynamicPanGains(
  leftExpr: string,
  rightExpr: string,
  lines: string[],
  lawExpr = SCORE_PAN_LAW_CHANNEL,
  boostExpr = SCORE_PAN_BOOST_CHANNEL,
): void {
  lines.push(`k_pan_pl = ${leftExpr}`);
  lines.push(`k_pan_pr = ${rightExpr}`);
  emitDynamicSourceLegGainLines('k_pan_pl', 'k_pan_al', 'k_pan_bl', lines, lawExpr, boostExpr);
  emitDynamicSourceLegGainLines('k_pan_pr', 'k_pan_ar', 'k_pan_br', lines, lawExpr, boostExpr);
}

function emitDynamicPanMatrixLines(
  signalVars: string[],
  leftExpr: string,
  rightExpr: string,
  lines: string[],
  lawExpr: string,
  boostExpr: string,
): void {
  emitDynamicPanGains(leftExpr, rightExpr, lines, lawExpr, boostExpr);
  lines.push(`a_pan_in_l = ${signalVars[0]}`);
  lines.push(`a_pan_in_r = ${signalVars[1]}`);
  lines.push(`${signalVars[0]} = k_pan_al * a_pan_in_l + k_pan_ar * a_pan_in_r`);
  lines.push(`${signalVars[1]} = k_pan_bl * a_pan_in_l + k_pan_br * a_pan_in_r`);
}

function emitDynamicStereoModePanLines(
  signalVars: string[],
  modeExpr: string,
  panExpr: string,
  widthExpr: string,
  dualLeftExpr: string,
  dualRightExpr: string,
  lines: string[],
): void {
  lines.push(`a_pan_in_l = ${signalVars[0]}`);
  lines.push(`a_pan_in_r = ${signalVars[1]}`);
  lines.push(`if ${modeExpr} < 0.5 then`);
  lines.push(`  k_pan_al = min(1, 2 * (1 - ${panExpr}))`);
  lines.push(`  k_pan_br = min(1, 2 * ${panExpr})`);
  lines.push('  k_pan_ar = 0');
  lines.push('  k_pan_bl = 0');
  lines.push(`elseif ${modeExpr} < 1.5 then`);
  lines.push(`  k_pan_c = ${panExpr}`);
  lines.push(`  k_pan_w = ${widthExpr}`);
  lines.push(`  k_pan_d = k_pan_w * min(k_pan_c, 1 - k_pan_c)`);
  lines.push('  k_pan_pl = k_pan_c - k_pan_d');
  lines.push('  k_pan_pr = k_pan_c + k_pan_d');
  emitDynamicSourceLegGainLines('k_pan_pl', 'k_pan_al', 'k_pan_bl', lines);
  emitDynamicSourceLegGainLines('k_pan_pr', 'k_pan_ar', 'k_pan_br', lines);
  lines.push('else');
  emitDynamicPanGains(dualLeftExpr, dualRightExpr, lines);
  lines.push('endif');
  lines.push(`${signalVars[0]} = k_pan_al * a_pan_in_l + k_pan_ar * a_pan_in_r`);
  lines.push(`${signalVars[1]} = k_pan_bl * a_pan_in_l + k_pan_br * a_pan_in_r`);
}

function applyChannelPan(
  blueData: BlueData,
  signalVars: string[],
  channel: Channel,
  layout: EffectiveTrackLayout,
  lines: string[],
  livePanner = false,
  modeChannel: string | null = null,
): void {
  if (signalVars.length < 2) {
    return;
  }
  const mixer = blueData.getMixer();
  const lawDb = mixer.getPanLawDb();
  const boost = mixer.isPanOffCenterBoost();

  const panParam = channel.getPanParameter();
  const panVar = panParam.getCompilationVarName();

  if (layout === 'mono') {
    if (livePanner) {
      emitDynamicSourceLegGainLines(
        panVar ?? String(channel.getPan()),
        'k_pan_l',
        'k_pan_r',
        lines,
      );
      lines.push(`${signalVars[0]} *= 1.4142135623730951 * k_pan_l`);
      lines.push(`${signalVars[1]} *= 1.4142135623730951 * k_pan_r`);
    } else if (panVar) {
      if (lawDb === -3 && !boost) {
        lines.push(`k_pan_l = 1.4142135623730951 * cos(1.5707963267948966 * ${panVar})`);
        lines.push(`k_pan_r = 1.4142135623730951 * sin(1.5707963267948966 * ${panVar})`);
      } else {
        const [kLeft, kRight] = generateCsoundSourceLegGainExprs(panVar, lawDb, boost);
        lines.push(`k_pan_l = 1.4142135623730951 * (${kLeft})`);
        lines.push(`k_pan_r = 1.4142135623730951 * (${kRight})`);
      }
      lines.push(`${signalVars[0]} *= k_pan_l`);
      lines.push(`${signalVars[1]} *= k_pan_r`);
    } else {
      const p = channel.getPan();
      const [gainL, gainR] = getMonoPanGains(p, lawDb, boost);
      if (Math.abs(gainL - 1.0) > 0.0001) {
        lines.push(`${signalVars[0]} *= ${gainL}`);
      }
      if (Math.abs(gainR - 1.0) > 0.0001) {
        lines.push(`${signalVars[1]} *= ${gainR}`);
      }
    }
  } else {
    const mode = channel.getStereoPanMode();
    if (livePanner && modeChannel) {
      emitDynamicStereoModePanLines(
        signalVars,
        modeChannel,
        panVar ?? String(channel.getPan()),
        channel.getPanWidthParameter().getCompilationVarName() ?? String(channel.getPanWidth()),
        channel.getDualPanLeftParameter().getCompilationVarName() ??
          String(channel.getDualPanLeft()),
        channel.getDualPanRightParameter().getCompilationVarName() ??
          String(channel.getDualPanRight()),
        lines,
      );
      return;
    }
    if (mode === 'balance') {
      if (panVar) {
        lines.push(`k_bal_l = min(1, 2 * (1 - ${panVar}))`);
        lines.push(`k_bal_r = min(1, 2 * ${panVar})`);
        lines.push(`${signalVars[0]} *= k_bal_l`);
        lines.push(`${signalVars[1]} *= k_bal_r`);
      } else {
        const p = channel.getPan();
        const [balL, balR] = getStereoBalanceGains(p);
        if (Math.abs(balL - 1.0) > 0.0001) {
          lines.push(`${signalVars[0]} *= ${balL}`);
        }
        if (Math.abs(balR - 1.0) > 0.0001) {
          lines.push(`${signalVars[1]} *= ${balR}`);
        }
      }
    } else if (mode === 'stereoPan') {
      const widthParam = channel.getPanWidthParameter();
      const widthVar = widthParam.getCompilationVarName();
      if (!panVar && !widthVar) {
        const [aL, bL, aR, bR] = getStereoPanGains(
          channel.getPan(),
          channel.getPanWidth(),
          lawDb,
          boost,
        );
        emitStereoPanMatrixLines(signalVars, aL, bL, aR, bR, lines);
      } else {
        lines.push(`k_pan_c = ${panVar ?? String(channel.getPan())}`);
        lines.push(`k_pan_w = ${widthVar ?? String(channel.getPanWidth())}`);
        lines.push(`k_pan_d = k_pan_w * min(k_pan_c, 1 - k_pan_c)`);
        emitDynamicPanMatrixLines(
          signalVars,
          'k_pan_c - k_pan_d',
          'k_pan_c + k_pan_d',
          lines,
          String(lawDb),
          boost ? '1' : '0',
        );
      }
    } else if (mode === 'dualPan') {
      const leftParam = channel.getDualPanLeftParameter();
      const rightParam = channel.getDualPanRightParameter();
      const leftVar = leftParam.getCompilationVarName();
      const rightVar = rightParam.getCompilationVarName();
      if (!leftVar && !rightVar) {
        const [aL, bL, aR, bR] = getDualPanGains(
          channel.getDualPanLeft(),
          channel.getDualPanRight(),
          lawDb,
          boost,
        );
        emitStereoPanMatrixLines(signalVars, aL, bL, aR, bR, lines);
      } else {
        emitDynamicPanMatrixLines(
          signalVars,
          leftVar ?? String(channel.getDualPanLeft()),
          rightVar ?? String(channel.getDualPanRight()),
          lines,
          String(lawDb),
          boost ? '1' : '0',
        );
      }
    }
  }
}

function routeChannelOutput(
  blueData: BlueData,
  signalVars: string[],
  outChannel: string,
  channelName: string,
  lines: string[],
): void {
  const resolvedOutChannel = outChannel || 'Master';
  if (resolvedOutChannel === channelName) {
    return;
  }

  for (let i = 0; i < signalVars.length; i++) {
    lines.push(`${getSubChannelVar(blueData, resolvedOutChannel, i)}\t+=\t${signalVars[i]}`);
  }
}

function getSendAmountExpression(blueData: BlueData, send: Send): string {
  const levelParam = send.getLevelParameter();
  const compilationVarName = levelParam.getCompilationVarName();
  if (compilationVarName) {
    return compilationVarName;
  }

  return send.getLevel().toString();
}

function scaleSignal(blueData: BlueData, signalVar: string, amountExpr: string): string {
  if (amountExpr === '1' || amountExpr === '1.0') {
    return signalVar;
  }

  return `(${signalVar} * ${amountExpr})`;
}

function getSourceSignalVars(blueData: BlueData, channelId: number, nchnls: number): string[] {
  const signalVars: string[] = [];
  for (let i = 0; i < nchnls; i++) {
    signalVars.push(`ga_bluemix_${channelId}_${i}`);
  }
  return signalVars;
}

function getSubChannelSignalVars(
  blueData: BlueData,
  channelName: string,
  nchnls: number,
): string[] {
  const signalVars: string[] = [];
  for (let i = 0; i < nchnls; i++) {
    signalVars.push(getSubChannelVar(blueData, channelName, i));
  }
  return signalVars;
}

function getSubChannelVar(blueData: BlueData, channelName: string, outputIndex: number): string {
  const safeName = channelName === 'Master' ? 'Master' : channelName.replace(/\s+/g, '_');
  return `ga_bluesub_${safeName}_${outputIndex}`;
}
