import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from '@codemirror/autocomplete';
import {
  csoundRichOpcodeCatalog,
  type RichOpcodeCatalogEntry,
} from '@kunstmusik/codemirror-lang-csound/rich';
import {
  normalizeUdoCallableSignature,
  parseUDOText,
  UDOStyle,
  type NormalizedUdoCallableSignature,
} from '@blue/data';

import type {
  JavaBlueCsoundCompletionOptions,
  JavaBlueUdoCompletionDefinition,
} from './editor-adapter-types';

const wordCompletionPattern = /[A-Za-z_][A-Za-z0-9_]*(?::[A-Za-z_][A-Za-z0-9_]*)?/;
const wordCompletionValidFor = /^[A-Za-z_][A-Za-z0-9_]*(?::[A-Za-z_][A-Za-z0-9_]*)?$/;
const angleCompletionPattern = /<[A-Za-z0-9_]*$/;
const angleCompletionValidFor = /^<[A-Za-z0-9_]*$/;
const userOpcodeFallbackPattern = /^\s*opcode\s+([A-Za-z_][A-Za-z0-9_]*)/gm;

const csoundVariablePrefixes = [
  'gi',
  'gk',
  'ga',
  'gw',
  'gf',
  'gS',
  'i',
  'k',
  'a',
  'w',
  'f',
  'S',
] as const;

const blueVariableCompletions: Completion[] = [
  '<TOTAL_DUR>',
  '<RENDER_START>',
  '<PROCESSING_START>',
  '<INSTR_ID>',
  '<INSTR_NAME>',
].map((label) => ({
  label,
  type: 'constant',
  detail: 'Blue variable',
  info: `${label}\n\nBlue runtime variable replacement token.`,
  boost: 35,
}));

const blueOpcodeCompletions: Completion[] = [
  {
    label: 'blueMixerOut',
    type: 'function',
    detail: 'Blue opcode',
    apply: 'blueMixerOut asig1 [, asig2...]',
    info: 'blueMixerOut\n\nRoutes audio-rate signals to the Blue mixer.',
    boost: 25,
  },
  {
    label: 'blueMixerOutSubChannel',
    displayLabel: 'blueMixerOut "subchannelName"',
    type: 'function',
    detail: 'Blue opcode',
    apply: 'blueMixerOut "subchannelName", asig1 ,asig2 [, asig3...]',
    info: 'blueMixerOut "subchannelName"\n\nRoutes audio-rate signals to a named Blue mixer subchannel.',
    boost: 24,
  },
  {
    label: 'blueMixerIn',
    type: 'function',
    detail: 'Blue opcode',
    apply: 'asig1 [, asig2...] blueMixerIn',
    info: 'blueMixerIn\n\nReads audio-rate signals from the Blue mixer.',
    boost: 25,
  },
];

const opcodeNameSet = new Set(csoundRichOpcodeCatalog.opcodes.map((entry) => entry.name));
const opcodeCompletions = csoundRichOpcodeCatalog.opcodes
  .map(createOpcodeCompletion)
  .sort((left, right) => left.label.localeCompare(right.label));

function createOpcodeCompletion(entry: RichOpcodeCatalogEntry): Completion {
  return {
    label: entry.name,
    type: 'function',
    detail: 'opcode',
    apply: getOpcodeInsertText(entry),
    info: getOpcodeInfoText(entry),
    boost: 5,
  };
}

function getOpcodeInsertText(entry: RichOpcodeCatalogEntry): string {
  const syntax = entry.syntax?.find((candidate) => !candidate.includes(' = ')) ?? entry.syntax?.[0];
  return syntax?.trim() ?? entry.name;
}

function getOpcodeInfoText(entry: RichOpcodeCatalogEntry): string {
  const parts = [entry.name];

  if (entry.shortDescription) {
    parts.push('', `${entry.name} -- ${entry.shortDescription}`);
  }

  if (entry.syntax && entry.syntax.length > 0) {
    parts.push('', 'Syntax', ...entry.syntax);
  }

  if (entry.category) {
    parts.push('', `Category: ${entry.category}`);
  }

  if (entry.manualPage) {
    parts.push(`Manual: ${entry.manualPage}`);
  }

  return parts.join('\n');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isCsoundVariablePrefix(value: string): boolean {
  return csoundVariablePrefixes.some((prefix) => value.startsWith(prefix));
}

export function findDocumentLocalCsoundVariables(
  documentTextBeforeWord: string,
  filter: string,
): Completion[] {
  if (!filter || !isCsoundVariablePrefix(filter)) {
    return [];
  }

  const variablePattern = new RegExp(`\\b${escapeRegExp(filter)}\\w*`, 'g');
  const variableNames = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = variablePattern.exec(documentTextBeforeWord)) !== null) {
    const variableName = match[0];
    if (!opcodeNameSet.has(variableName)) {
      variableNames.add(variableName);
    }
  }

  return Array.from(variableNames)
    .sort()
    .map((label) => ({
      label,
      type: 'variable',
      detail: 'variable',
      boost: 30,
    }));
}

// ─── Source-aware UDO completion ───

type UdoCompletionSource = 'context' | 'project' | 'document';

interface UdoCompletionCandidate {
  readonly source: UdoCompletionSource;
  readonly signature: NormalizedUdoCallableSignature;
}

const UDO_SOURCE_DETAIL: Record<UdoCompletionSource, string> = {
  context: 'context UDO',
  project: 'project UDO',
  document: 'document UDO',
};

const UDO_SOURCE_BOOST: Record<UdoCompletionSource, number> = {
  context: 23,
  project: 22,
  document: 21,
};

const UDO_SOURCE_ORDER: readonly UdoCompletionSource[] = ['context', 'project', 'document'];

function isValidUdoName(name: string): boolean {
  return name.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

function collectSuppliedCandidates(
  definitions: readonly JavaBlueUdoCompletionDefinition[] | undefined,
  source: UdoCompletionSource,
): UdoCompletionCandidate[] {
  if (!definitions || definitions.length === 0) return [];
  const candidates: UdoCompletionCandidate[] = [];
  for (const definition of definitions) {
    if (!isValidUdoName(definition.name)) continue;
    candidates.push({
      source,
      signature: normalizeUdoCallableSignature(definition),
    });
  }
  return candidates;
}

/**
 * Parse complete document-local UDO declarations through the portable parser,
 * and retain valid in-progress declarations (a name with a not-yet-parseable
 * signature) as incomplete document candidates so they remain discoverable.
 */
function collectDocumentCandidates(documentText: string): UdoCompletionCandidate[] {
  const seen = new Set<string>();
  const parsedDeclarationCount = new Map<string, number>();
  const candidates: UdoCompletionCandidate[] = [];

  const parsed = parseUDOText(documentText).getOpcodes();
  for (const opcode of parsed) {
    const name = opcode.getName();
    if (!isValidUdoName(name)) continue;
    parsedDeclarationCount.set(name, (parsedDeclarationCount.get(name) ?? 0) + 1);
    const style = opcode.getStyle() === UDOStyle.MODERN ? 'MODERN' : 'CLASSIC';
    const signature = normalizeUdoCallableSignature({
      name,
      style,
      outTypes: opcode.getOutTypes(),
      inTypes: opcode.getInTypes(),
      inputArguments: opcode.getInputArguments(),
    });
    if (seen.has(signature.identityKey)) continue;
    seen.add(signature.identityKey);
    candidates.push({ source: 'document', signature });
  }

  // Fallback for in-progress declarations the parser could not yet complete.
  // Match each parsed declaration to one source occurrence. Any additional
  // same-name occurrence is still in progress and must remain discoverable.
  userOpcodeFallbackPattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = userOpcodeFallbackPattern.exec(documentText)) !== null) {
    const name = match[1];
    if (!isValidUdoName(name)) continue;
    const remainingParsedDeclarations = parsedDeclarationCount.get(name) ?? 0;
    if (remainingParsedDeclarations > 0) {
      parsedDeclarationCount.set(name, remainingParsedDeclarations - 1);
      continue;
    }
    const signature = normalizeUdoCallableSignature({
      name,
      style: 'MODERN',
      outTypes: '',
      inTypes: '',
      // Force an incomplete normalized signature without inventing authored
      // callable types for a declaration the parser could not finish.
      inputArguments: '?',
    });
    if (seen.has(signature.identityKey)) continue;
    seen.add(signature.identityKey);
    candidates.push({ source: 'document', signature });
  }

  return candidates;
}

/**
 * Resolve exact UDO identity duplicates by source precedence
 * (context > project > document) and within-source duplicates. Same-name
 * definitions with different normalized signatures remain separate candidates.
 */
function dedupeUdoCandidates(
  candidates: readonly UdoCompletionCandidate[],
): UdoCompletionCandidate[] {
  const byIdentity = new Map<string, UdoCompletionCandidate>();
  for (const candidate of candidates) {
    const existing = byIdentity.get(candidate.signature.identityKey);
    if (!existing) {
      byIdentity.set(candidate.signature.identityKey, candidate);
      continue;
    }
    const existingRank = UDO_SOURCE_ORDER.indexOf(existing.source);
    const candidateRank = UDO_SOURCE_ORDER.indexOf(candidate.source);
    if (candidateRank < existingRank) {
      byIdentity.set(candidate.signature.identityKey, candidate);
    }
  }
  return Array.from(byIdentity.values());
}

function udoCandidateToCompletion(candidate: UdoCompletionCandidate): Completion {
  const { signature, source } = candidate;
  const incompleteMarker = signature.complete ? '' : ' (incomplete)';
  return {
    label: signature.name,
    displayLabel: `${signature.name} (${signature.inputDisplay}) → ${signature.outputDisplay}${incompleteMarker}`,
    type: 'function',
    detail: UDO_SOURCE_DETAIL[source],
    apply: signature.name,
    info: udoCandidateInfo(candidate),
    boost: UDO_SOURCE_BOOST[source],
  };
}

function udoCandidateInfo(candidate: UdoCompletionCandidate): string {
  const { signature, source } = candidate;
  const parts = [
    `${signature.name} (${signature.inputDisplay}) → ${signature.outputDisplay}`,
    '',
    `Source: ${UDO_SOURCE_DETAIL[source]}`,
  ];
  if (!signature.complete) {
    parts.push('', 'Signature is incomplete; finish the declaration to normalize this overload.');
  }
  return parts.join('\n');
}

function createUdoCompletions(
  contextUdos: readonly JavaBlueUdoCompletionDefinition[] | undefined,
  projectUdos: readonly JavaBlueUdoCompletionDefinition[] | undefined,
  documentText: string,
): Completion[] {
  const candidates = dedupeUdoCandidates([
    ...collectSuppliedCandidates(contextUdos, 'context'),
    ...collectSuppliedCandidates(projectUdos, 'project'),
    ...collectDocumentCandidates(documentText),
  ]);
  candidates.sort(compareUdoCandidates);
  return candidates.map(udoCandidateToCompletion);
}

function compareUdoCandidates(left: UdoCompletionCandidate, right: UdoCompletionCandidate): number {
  const nameCompare = left.signature.name.localeCompare(right.signature.name);
  if (nameCompare !== 0) return nameCompare;
  const sourceCompare =
    UDO_SOURCE_ORDER.indexOf(left.source) - UDO_SOURCE_ORDER.indexOf(right.source);
  if (sourceCompare !== 0) return sourceCompare;
  return left.signature.key.localeCompare(right.signature.key);
}

function createBsbReplacementKeyCompletions(
  options: JavaBlueCsoundCompletionOptions,
): Completion[] {
  return (options.bsbReplacementKeys ?? [])
    .filter((item) => item.key.trim().length > 0 && !/\s/.test(item.key))
    .map((item) => ({
      label: `<${item.key}>`,
      displayLabel: item.key,
      type: 'variable',
      detail: item.objectType ?? 'BSB object',
      apply: `<${item.key}>`,
      boost: 40,
    }));
}

/**
 * Deduplicate completion rows. UDO overloads are pre-resolved by exact
 * signature identity with source precedence; this pass keeps every distinct
 * UDO overload (same label, different displayLabel) while collapsing exact
 * duplicate rows and same-name non-UDO categories (variables, native opcodes).
 * A same-name native opcode remains as a separate row alongside UDO overloads
 * because it carries different detail/displayLabel.
 */
function dedupeCompletions(completions: Completion[]): Completion[] {
  const seen = new Set<string>();
  const deduped: Completion[] = [];

  for (const completion of completions) {
    const key = completionKey(completion);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(completion);
  }

  return deduped;
}

function completionKey(completion: Completion): string {
  // UDO overloads share a label but differ by displayLabel/detail; use both so
  // polymorphic UDO overloads survive while identical rows collapse.
  if (
    completion.detail === 'context UDO' ||
    completion.detail === 'project UDO' ||
    completion.detail === 'document UDO'
  ) {
    return `${completion.label}\u0000${completion.displayLabel ?? ''}`;
  }
  return completion.label;
}

function filterWordCompletions(completions: Completion[], filter: string): Completion[] {
  if (!filter) {
    return completions;
  }

  return completions.filter((completion) => completion.label.startsWith(filter));
}

function createWordCompletionResult(
  context: CompletionContext,
  options: JavaBlueCsoundCompletionOptions,
): CompletionResult | null {
  const word = context.matchBefore(wordCompletionPattern);
  if (!word && !context.explicit) {
    return null;
  }

  const filter = word?.text ?? '';
  const from = word?.from ?? context.pos;
  const documentText = context.state.doc.toString();
  const documentTextBeforeWord = context.state.doc.sliceString(0, from);
  const completions = dedupeCompletions([
    ...findDocumentLocalCsoundVariables(documentTextBeforeWord, filter),
    ...createUdoCompletions(options.contextUdos, options.projectUdos, documentText),
    ...blueOpcodeCompletions,
    ...opcodeCompletions,
  ]);
  const filteredCompletions = filterWordCompletions(completions, filter);

  if (filteredCompletions.length === 0) {
    return null;
  }

  return {
    from,
    options: filteredCompletions,
    validFor: wordCompletionValidFor,
  };
}

function createAngleCompletionResult(
  context: CompletionContext,
  options: JavaBlueCsoundCompletionOptions,
): CompletionResult | null {
  const angledWord = context.matchBefore(angleCompletionPattern);
  if (!angledWord && !context.explicit) {
    return null;
  }

  if (!angledWord) {
    return null;
  }

  const filter = angledWord.text.slice(1);
  const completions = dedupeCompletions([
    ...blueVariableCompletions,
    ...createBsbReplacementKeyCompletions(options),
  ]).filter((completion) => completion.label.slice(1).startsWith(filter));

  if (completions.length === 0) {
    return null;
  }

  return {
    from: angledWord.from,
    options: completions,
    validFor: angleCompletionValidFor,
  };
}

export function createJavaBlueCsoundCompletionSource(
  options: JavaBlueCsoundCompletionOptions = {},
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null =>
    createAngleCompletionResult(context, options) ?? createWordCompletionResult(context, options);
}
