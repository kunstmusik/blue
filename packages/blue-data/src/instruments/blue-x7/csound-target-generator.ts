/**
 * Instance-specialized BlueX7 Csound target generation.
 *
 * The generated target is deliberately small at its boundary: compiled
 * `chnexport` globals are read directly, next-note values are captured into an
 * i-rate voice array once, and the small active-note set is read only when a
 * domain-local `changed`/epoch guard fires. The live inline form uses scalar
 * updates plus eight PEG index/rate snapshots and six output-level baselines,
 * rather than a second 155-slot voice transport. The snapshots are not a
 * transport protocol or per-cycle Parameter copy; they are implementation
 * details of the renderer's note-local state machine.
 *
 * This module is browser-safe. It accepts resolved symbols/literals and does
 * not know about Electron, Csound hosts, or project ownership.
 */
import { BLUE_X7_PARAMETER_DESCRIPTORS, type BlueX7ParameterDescriptor } from './parameter-catalog';
import { BLUE_X7_MODERN_ORCHESTRA } from './modern-orchestra.generated';

export type BlueX7TargetLayout = 'udo' | 'inline';

export interface BlueX7TargetParameter {
  /** Semantic catalog key. */
  key: string;
  /** A valid Csound k-rate global, normally `gk_blue_autoN`. */
  symbol: string;
}

export interface BlueX7TargetOptions {
  /** 155-slot mapping used by static/preview targets and note snapshots. */
  voice: readonly number[];
  operatorMask: number;
  /** When present, all 151 catalog entries must be resolved. */
  parameters?: readonly BlueX7TargetParameter[];
  layout?: BlueX7TargetLayout;
  /** Change detection strategy; epoch avoids scanning active globals per note. */
  changeStrategy?: 'per-note' | 'epoch';
  /** Required when `changeStrategy` is `epoch`. */
  epochSymbol?: string;
  /** Prefix used for local names so multiple generated instruments coexist. */
  variablePrefix?: string;
}

const VOICE_LENGTH = 155;

function assertSymbol(symbol: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(symbol)) {
    throw new Error(`invalid Csound global symbol: ${symbol}`);
  }
}

function numberText(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error('BlueX7 target cannot contain a non-finite value');
  }
  // Csound accepts decimal literals; avoid exponent notation for predictable
  // generated output and make negative zero deterministic.
  if (Object.is(value, -0)) return '0';
  return Number.isInteger(value) ? String(value) : String(value);
}

function descriptorByKey(key: string): BlueX7ParameterDescriptor {
  const descriptor = BLUE_X7_PARAMETER_DESCRIPTORS.find((entry) => entry.key === key);
  if (!descriptor) throw new Error(`unknown BlueX7 parameter key: ${key}`);
  return descriptor;
}

function parameterMap(
  parameters: readonly BlueX7TargetParameter[] | undefined,
): Map<string, string> | null {
  if (!parameters) return null;
  const result = new Map<string, string>();
  for (const parameter of parameters) {
    descriptorByKey(parameter.key);
    assertSymbol(parameter.symbol);
    if (result.has(parameter.key)) {
      throw new Error(`duplicate BlueX7 parameter key: ${parameter.key}`);
    }
    result.set(parameter.key, parameter.symbol);
  }
  if (result.size !== BLUE_X7_PARAMETER_DESCRIPTORS.length) {
    throw new Error(
      `BlueX7 live target requires ${BLUE_X7_PARAMETER_DESCRIPTORS.length} resolved parameters`,
    );
  }
  return result;
}

function transportExpression(
  descriptor: BlueX7ParameterDescriptor,
  symbol: string,
  rate: 'i' | 'k',
): string {
  const value = rate === 'i' ? `i(${symbol})` : symbol;
  if (descriptor.transport.kind !== 'voice') return value;
  if (descriptor.transport.slot === 134) return `${value} - 1`;
  if (descriptor.transport.slot < 126 && descriptor.transport.slot % 21 === 20) {
    return `${value} + 7`;
  }
  return value;
}

function staticOperatorMask(value: number): number {
  if (!Number.isFinite(value)) throw new Error('invalid BlueX7 operator mask');
  return Math.max(0, Math.min(63, Math.trunc(value)));
}

function operatorMaskExpression(
  map: Map<string, string> | null,
  staticMask: number,
  rate: 'i' | 'k',
): string {
  if (!map) return numberText(staticMask);
  const terms = BLUE_X7_PARAMETER_DESCRIPTORS.flatMap((descriptor) => {
    if (descriptor.transport.kind !== 'operator-enable') return [];
    const symbol = map.get(descriptor.key)!;
    const bit = 1 << (descriptor.transport.operator - 1);
    return [`(${rate === 'i' ? `i(${symbol})` : symbol} > 0 ? ${bit} : 0)`];
  });
  return terms.join(' + ');
}

function bodyOfBlueX7Voice(orc: string): string {
  const signature = 'opcode bluex7_voice(';
  const start = orc.indexOf(signature);
  if (start < 0) throw new Error('bluex7_voice opcode is missing from modern support');
  const bodyStart = orc.indexOf('\n', start);
  const end = orc.indexOf('\nendop', bodyStart);
  if (bodyStart < 0 || end < 0) throw new Error('bluex7_voice opcode body is malformed');
  const body = orc.slice(bodyStart + 1, end);
  return body.replace(/\bxout\s+aOut\s*$/m, 'aout = aOut');
}

function activeDescriptors(map: Map<string, string>): BlueX7ParameterDescriptor[] {
  return BLUE_X7_PARAMETER_DESCRIPTORS.filter(
    (descriptor) => descriptor.updateClass === 'active-note' && map.has(descriptor.key),
  );
}

function groupedActiveDescriptors(
  descriptors: readonly BlueX7ParameterDescriptor[],
): Map<string, BlueX7ParameterDescriptor[]> {
  const groups = new Map<string, BlueX7ParameterDescriptor[]>();
  for (const descriptor of descriptors) {
    const group = descriptor.group;
    const entries = groups.get(group);
    if (entries) entries.push(descriptor);
    else groups.set(group, [descriptor]);
  }
  return groups;
}

function isInlineScalarLiveDescriptor(descriptor: BlueX7ParameterDescriptor): boolean {
  return (
    descriptor.key === 'common.feedback' ||
    descriptor.key === 'lfo.pitchModulationDepth' ||
    descriptor.key === 'lfo.amplitudeModulationDepth' ||
    /^operator\.[1-6]\.outputLevel$/.test(descriptor.key) ||
    /^operator\.[1-6]\.enabled$/.test(descriptor.key)
  );
}

function replaceInlineLiveAdaptation(body: string, replacement: string): string {
  const startMarker = '  ; live active-note adaptation (kLiveDirty == 1)';
  const endMarker = '  kRel = release:k()';
  const start = body.indexOf(startMarker);
  const end = body.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw new Error('BlueX7 live adaptation block is missing from modern support');
  }
  return `${body.slice(0, start)}${replacement}\n${body.slice(end)}`;
}

function inlineScalarLiveAdaptation(
  map: Map<string, string>,
  active: readonly BlueX7ParameterDescriptor[],
  dirtyName: string,
  outputSeenName: string,
  staticMask: number,
  variablePrefix: string,
): string {
  if (!active.every(isInlineScalarLiveDescriptor)) {
    throw new Error('unsupported BlueX7 inline live descriptor');
  }

  const symbolFor = (key: string): string | null => {
    const descriptor = active.find((entry) => entry.key === key);
    return descriptor ? map.get(key)! : null;
  };
  const outputFor = (operator: number): string | null => {
    const key = `operator.${operator}.outputLevel`;
    return symbolFor(key);
  };
  const hasLiveEnable = active.some((descriptor) => descriptor.key.endsWith('.enabled'));
  const feedback = symbolFor('common.feedback');
  const pmd = symbolFor('lfo.pitchModulationDepth');
  const amd = symbolFor('lfo.amplitudeModulationDepth');
  const statePrefix = `k${variablePrefix}`;
  const liveMaskLocalName = `${statePrefix}LiveMaskLocal`;
  const lines: string[] = [
    '  ; generated scalar live adaptation: only explicitly live controls are read',
    `  if ${dirtyName} == 1 then`,
  ];

  if (feedback) {
    lines.push(`    kFbAmt = (${feedback} == 0 ? 0 : 2 ^ (${feedback} - 8))`);
  }
  if (pmd) {
    lines.push(`    kPmd = ${pmd}`);
  }
  if (amd) {
    lines.push(`    kAmdPeak = 52.75 * (exp(0.0429 * ${amd}) - 1) / (exp(0.0429 * 99) - 1)`);
  }

  for (let operator = 1; operator <= 6; operator += 1) {
    const output = outputFor(operator);
    if (!output) continue;
    const index = operator - 1;
    const base = index * 4;
    const prefix = `${statePrefix}Op${operator}`;
    lines.push(
      `    ${prefix}NewOl = ${output}`,
      `    ${prefix}OldOl = ${outputSeenName}[${index}]`,
      `    if ${prefix}NewOl != ${prefix}OldOl then`,
      `      ${prefix}NewSol = (${prefix}NewOl >= 20 ? 28 + ${prefix}NewOl : kLevLut[${prefix}NewOl])`,
      `      ${prefix}NewCombined = ${prefix}NewSol + iOlmScaleA[${index}]`,
      `      ${prefix}NewCombined = (${prefix}NewCombined > 127 ? 127 : ${prefix}NewCombined)`,
      `      ${prefix}NewOlm = iOlmVelA[${index}] + ${prefix}NewCombined * 32`,
      `      ${prefix}OldOlm = kOlm[${index}]`,
      `      kOlm[${index}] = (${prefix}NewOlm < 0 ? 0 : ${prefix}NewOlm)`,
      `      kEgLevel[${index}] += (kOlm[${index}] - ${prefix}OldOlm) * 65536`,
      `      kEgLevel[${index}] = (kEgLevel[${index}] < 16 * 65536 ? 16 * 65536 : kEgLevel[${index}])`,
      `      kEgLevel[${index}] = (kEgLevel[${index}] > 285212672 ? 285212672 : kEgLevel[${index}])`,
      `      ${outputSeenName}[${index}] = ${prefix}NewOl`,
      `      if kEgIx[${index}] < 4 then`,
      `        ${prefix}Stage = kEgIx[${index}]`,
      `        ${prefix}Level = kEgL[${base} + ${prefix}Stage]`,
      `        ${prefix}Sol = (${prefix}Level >= 20 ? 28 + ${prefix}Level : kLevLut[${prefix}Level])`,
      `        ${prefix}Comp = int(${prefix}Sol / 2) * 64 + kOlm[${index}] - 4256`,
      `        ${prefix}Comp = (${prefix}Comp < 16 ? 16 : ${prefix}Comp)`,
      `        kEgTarget[${index}] = ${prefix}Comp * 65536`,
      `        kEgRis[${index}] = (kEgTarget[${index}] > kEgLevel[${index}] ? 1 : 0)`,
      `        ${prefix}Qr = int(kEgR[${base} + ${prefix}Stage] * 41 / 64) + kQrs[${index}]`,
      `        ${prefix}Qr = (${prefix}Qr > 63 ? 63 : ${prefix}Qr)`,
      `        kEgInc[${index}] = (4 + (${prefix}Qr % 4)) * 2 ^ (8 + int(${prefix}Qr / 4))`,
      '      endif',
      '    endif',
    );
  }

  if (hasLiveEnable) {
    const liveMask = operatorMaskExpression(map, staticMask, 'k');
    lines.push(`    ${liveMaskLocalName} = ${liveMask}`);
    for (let operator = 1; operator <= 6; operator += 1) {
      const index = operator - 1;
      lines.push(`    kEnabled[${index}] = int(${liveMaskLocalName} / (2 ^ ${index})) % 2`);
    }
  }

  lines.push('  endif');
  return lines.join('\n');
}

/**
 * Resolve one active-projection read for an inline target. Active-note fields
 * stay direct `gk_*` reads; next-note fields deliberately remain on the
 * captured i-rate voice so an edit cannot retopologize an already sounding
 * note. Static targets use the captured voice for every field.
 */
function inlineLiveVoiceExpression(
  slot: number,
  map: Map<string, string> | null,
  voiceName: string,
): string {
  const descriptor = BLUE_X7_PARAMETER_DESCRIPTORS.find(
    (entry) => entry.transport.kind === 'voice' && entry.transport.slot === slot,
  );
  if (!map || !descriptor || descriptor.updateClass === 'next-note') {
    return `${voiceName}[${slot}]`;
  }
  return transportExpression(descriptor, map.get(descriptor.key)!, 'k');
}

/**
 * Generate one complete BlueX7 host target.  The returned text is placed
 * inside an `instr` by Arrangement and may be emitted for either a static
 * preview or a compiled live instance.
 */
export function generateBlueX7Target(options: BlueX7TargetOptions): string {
  if (options.voice.length < VOICE_LENGTH) {
    throw new Error(`BlueX7 voice transport must contain ${VOICE_LENGTH} slots`);
  }
  const map = parameterMap(options.parameters);
  // Live targets inline the shared body so active fields can be direct global
  // reads. Static/preview targets retain the compact UDO form.
  const layout = options.layout ?? (map ? 'inline' : 'udo');
  const changeStrategy = options.changeStrategy ?? 'per-note';
  if (changeStrategy === 'epoch') {
    if (!options.epochSymbol) throw new Error('epoch target requires epochSymbol');
    assertSymbol(options.epochSymbol);
  }
  const prefix = options.variablePrefix ?? 'BlueX7';
  const voiceName = `i${prefix}Voice`;
  const maskName = `i${prefix}OperatorMask`;
  const dirtyName = `k${prefix}Dirty`;
  const midiName = `i${prefix}MidiNote`;
  const gateName = `i${prefix}GateSeconds`;

  const staticMask = staticOperatorMask(options.operatorMask);
  const active = map ? activeDescriptors(map) : [];
  const lines: string[] = [
    '; BlueX7 modern renderer host target (generated direct-global form)',
    '; Live values are resolved chnexport globals; no ftable/table publication is used.',
    `${midiName} = (p4 < 15 ? ftom:i(cpspch:i(p4)) : ftom:i(p4))`,
    `${gateName} = abs(p3)`,
    `${voiceName}[] init ${VOICE_LENGTH}`,
  ];

  for (let slot = 0; slot < VOICE_LENGTH; slot += 1) {
    const descriptor = BLUE_X7_PARAMETER_DESCRIPTORS.find(
      (entry) => entry.transport.kind === 'voice' && entry.transport.slot === slot,
    );
    if (map && descriptor) {
      lines.push(
        `${voiceName}[${slot}] = ${transportExpression(descriptor, map.get(descriptor.key)!, 'i')}`,
      );
    } else {
      lines.push(`${voiceName}[${slot}] = ${numberText(options.voice[slot] ?? 0)}`);
    }
  }

  lines.push(`${maskName} = ${operatorMaskExpression(map, staticMask, 'i')}`);

  // UDO targets retain the maintained public k-rate array argument. Inline
  // live targets use the smallest state needed by the maintained body:
  // scalar live controls are read directly on the dirty block, while PEG
  // indices/rates and output-level snapshots remain local k-rate state.
  // The compact operator projection below is retained as a compatibility
  // fallback for any future active descriptor that is not scalar-specialized.
  const needsUdoState = layout === 'udo';
  const inlineScalarState =
    layout === 'inline' && map !== null && active.every(isInlineScalarLiveDescriptor);
  const needsInlineLiveState = layout === 'inline' && map !== null && !inlineScalarState;
  const liveVoiceName = `k${prefix}LiveVoice`;
  const liveMaskName = `k${prefix}LiveMask`;
  const liveOperatorStateName = `k${prefix}LiveOperatorState`;
  const livePegRateName = `k${prefix}LivePegRate`;
  const livePegLevelName = `k${prefix}LivePegLevel`;
  const liveOutputSeenName = `k${prefix}LiveOutputLevelSeen`;
  const liveStateInitName = `k${prefix}LiveStateInitialized`;
  if (needsUdoState) {
    lines.push(
      `${liveVoiceName}[] init ${VOICE_LENGTH}`,
      `${liveVoiceName} = ${voiceName}`,
      `${liveMaskName} init ${maskName}`,
    );
  } else if (inlineScalarState) {
    lines.push(
      `${livePegRateName}[] init 4`,
      `${livePegLevelName}[] init 4`,
      `${liveOutputSeenName}[] init 6`,
      `${liveStateInitName} init 0`,
      `if ${liveStateInitName} == 0 then`,
    );
    // PEG stage indexes are next-note snapshots, but the maintained body
    // needs k-indexable arrays while it advances through the note.
    for (let slot = 126; slot < 130; slot += 1) {
      lines.push(`  ${livePegRateName}[${slot - 126}] = ${voiceName}[${slot}]`);
    }
    for (let slot = 130; slot < 134; slot += 1) {
      lines.push(`  ${livePegLevelName}[${slot - 130}] = ${voiceName}[${slot}]`);
    }
    // Output level is the one operator value that remains live. Remember the
    // note-start value so the dirty block can update only when it changes.
    for (let operator = 1; operator <= 6; operator += 1) {
      const descriptor = BLUE_X7_PARAMETER_DESCRIPTORS.find(
        (entry) => entry.key === `operator.${operator}.outputLevel`,
      );
      if (!descriptor || descriptor.transport.kind !== 'voice') {
        throw new Error(`BlueX7 output-level transport is missing for operator ${operator}`);
      }
      lines.push(
        `  ${liveOutputSeenName}[${operator - 1}] = ${voiceName}[${descriptor.transport.slot}]`,
      );
    }
    lines.push(`  ${liveStateInitName} = 1`, 'endif');
  } else if (needsInlineLiveState) {
    lines.push(
      `${liveOperatorStateName}[] init 126`,
      `${livePegRateName}[] init 4`,
      `${livePegLevelName}[] init 4`,
      `${liveMaskName} init ${maskName}`,
      `${liveStateInitName} init 0`,
      `if ${liveStateInitName} == 0 then`,
    );
    // Dynamic operator/PEG indexing remains inside the maintained renderer,
    // but its initial values are note snapshots. Only active descriptors are
    // overwritten by the dirty branch below; next-note values must therefore
    // be seeded once from the i-rate voice rather than left at zero.
    for (let slot = 0; slot < 126; slot += 1) {
      lines.push(`  ${liveOperatorStateName}[${slot}] = ${voiceName}[${slot}]`);
    }
    for (let slot = 126; slot < 130; slot += 1) {
      lines.push(`  ${livePegRateName}[${slot - 126}] = ${voiceName}[${slot}]`);
    }
    for (let slot = 130; slot < 134; slot += 1) {
      lines.push(`  ${livePegLevelName}[${slot - 130}] = ${voiceName}[${slot}]`);
    }
    lines.push(`  ${liveStateInitName} = 1`, 'endif');
  }

  if (!map) {
    lines.push(`${dirtyName} init 0`);
  } else {
    if (changeStrategy === 'epoch') {
      const seenName = `k${prefix}EpochSeen`;
      lines.push(`${seenName} init -1`);
      lines.push(`${dirtyName} = (${options.epochSymbol} != ${seenName} ? 1 : 0)`);
    } else {
      const groups = groupedActiveDescriptors(active);
      const guardNames: string[] = [];
      for (const [group, descriptors] of groups) {
        const suffix = group.replace(/[^A-Za-z0-9]/g, '');
        const guard = `k${prefix}Dirty${suffix}`;
        guardNames.push(guard);
        const symbols = descriptors.map((descriptor) => map.get(descriptor.key)!);
        lines.push(`${guard} changed ${symbols.join(', ')}`);
      }
      lines.push(`${dirtyName} = ${guardNames.length ? guardNames.join(' + ') : '0'}`);
    }
    if (needsUdoState) {
      lines.push(`if ${dirtyName} > 0 then`);
      for (const descriptor of active) {
        if (descriptor.transport.kind === 'voice') {
          lines.push(
            `  ${liveVoiceName}[${descriptor.transport.slot}] = ${transportExpression(descriptor, map.get(descriptor.key)!, 'k')}`,
          );
        }
      }
      lines.push(`  ${liveMaskName} = ${operatorMaskExpression(map, staticMask, 'k')}`);
      lines.push('endif');
    } else if (needsInlineLiveState) {
      lines.push(`if ${dirtyName} > 0 then`);
      for (const descriptor of active) {
        if (descriptor.transport.kind !== 'voice') continue;
        const slot = descriptor.transport.slot;
        const expression = transportExpression(descriptor, map.get(descriptor.key)!, 'k');
        if (slot >= 126 && slot <= 129) {
          lines.push(`  ${livePegRateName}[${slot - 126}] = ${expression}`);
        } else if (slot >= 130 && slot <= 133) {
          lines.push(`  ${livePegLevelName}[${slot - 130}] = ${expression}`);
        } else if (slot < 126) {
          lines.push(`  ${liveOperatorStateName}[${slot}] = ${expression}`);
        }
      }
      lines.push(`  ${liveMaskName} = ${operatorMaskExpression(map, staticMask, 'k')}`);
      lines.push('endif');
    }
    if (changeStrategy === 'epoch') {
      lines.push(`${`k${prefix}EpochSeen`} = ${options.epochSymbol}`);
    }
  }

  if (layout === 'inline') {
    const liveMaskExpression = map && needsInlineLiveState ? liveMaskName : maskName;
    let inline = bodyOfBlueX7Voice(BLUE_X7_MODERN_ORCHESTRA);
    // The algorithm is fixed per generated instance, so call the selected
    // algorithm UDO directly and skip the 32-way dispatcher UDO and its
    // extra call boundary on every k-cycle. The dispatcher call is kept as
    // a fallback branch: `common.algorithm` is a next-note parameter, so a
    // runtime channel edit must re-topologize notes that start after the
    // edit even though they run inside this generated instance.
    const algorithmIndex = Number.isInteger(options.voice[134]) ? options.voice[134] : Number.NaN;
    if (algorithmIndex >= 0 && algorithmIndex <= 31) {
      const algorithmOpcode = `dx7_algo_${String(algorithmIndex + 1).padStart(2, '0')}`;
      inline = inline.replace(
        'aOut = dx7_render_algorithm(iAlgo, kGain, kDph, iPh0A, kFbAmt)',
        `if iAlgo == ${algorithmIndex} then\n` +
          `      aOut = ${algorithmOpcode}(kGain, kDph, iPh0A, kFbAmt)\n` +
          '    else\n' +
          '      aOut = dx7_render_algorithm(iAlgo, kGain, kDph, iPh0A, kFbAmt)\n' +
          '    endif',
      );
      if (!inline.includes('dx7_render_algorithm(iAlgo')) {
        throw new Error('BlueX7 inline body lost the algorithm dispatcher fallback');
      }
    }
    if (inlineScalarState && map) {
      inline = replaceInlineLiveAdaptation(
        inline,
        inlineScalarLiveAdaptation(map, active, dirtyName, liveOutputSeenName, staticMask, prefix),
      );
    }
    inline = inline
      .replace(/\bkLiveVoice\[(\d+)\]/g, (_match, slotText: string) =>
        inlineLiveVoiceExpression(Number(slotText), map, voiceName),
      )
      .replace(/\bkLiveVoice\[kio \+ (\d+)\]/g, (_match, offsetText: string) =>
        map ? `${liveOperatorStateName}[kio + ${offsetText}]` : `${voiceName}[kio + ${offsetText}]`,
      )
      .replace(
        /\bkLiveVoice\[130 \+ kPegIx\]/g,
        map ? `${livePegLevelName}[kPegIx]` : `${voiceName}[130 + kPegIx]`,
      )
      .replace(
        /\bkLiveVoice\[126 \+ kPegIx\]/g,
        map ? `${livePegRateName}[kPegIx]` : `${voiceName}[126 + kPegIx]`,
      )
      .replace(/\bkLiveMask\b/g, liveMaskExpression)
      .replace(
        /\bkLiveVoice\b/g,
        map ? (needsInlineLiveState ? liveOperatorStateName : voiceName) : voiceName,
      )
      .replace(/\biMidiNote\b/g, midiName)
      .replace(/\biVelocity\b/g, 'i(p5)')
      .replace(/\biVoice\b/g, voiceName)
      .replace(/\biOperatorMask\b/g, maskName)
      .replace(/\biGateSeconds\b/g, gateName)
      .replace(/\bkLiveDirty\b/g, dirtyName);
    lines.push(inline);
  } else {
    lines.push(
      `aout = bluex7_voice(${midiName}, i(p5), ${voiceName}, ${maskName}, ${gateName}, ${liveVoiceName}, ${liveMaskName}, ${dirtyName})`,
    );
  }
  return `${lines.join('\n')}\n`;
}

/** Alias retained for callers that describe the result as a note instrument. */
export const generateBlueX7Instrument = generateBlueX7Target;

/** Exposed for benchmark/tests to compare the generated inline layout. */
export function extractBlueX7VoiceBody(): string {
  return bodyOfBlueX7Voice(BLUE_X7_MODERN_ORCHESTRA);
}
