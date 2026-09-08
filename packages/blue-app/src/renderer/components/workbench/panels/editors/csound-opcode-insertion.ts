import { snippet } from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import type { RichOpcodeCatalogEntry } from '@kunstmusik/codemirror-lang-csound/rich';

import type {
  NormalizedOpcodeMetadata,
  OpcodeInsertionForm,
  OpcodeInsertionPlan,
  OpcodeKind,
} from './editor-adapter-types';

const DECLARATION_NAMES = new Set(['opcode', 'endop', 'instr', 'endin', '0dbfs', 'init']);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchModernCall(line: string, name: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`);
  return pattern.test(line);
}

function matchStandaloneToken(line: string, name: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`);
  return pattern.test(line);
}

function isSafeSyntaxLine(line: string): boolean {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();
  if (trimmed.endsWith('\\') || trimmed.includes('\\')) return false;
  if (trimmed.includes('{') || trimmed.includes('}')) return false;
  if (trimmed.startsWith('...') || trimmed.startsWith(';') || trimmed.startsWith('//'))
    return false;

  let parens = 0;
  let brackets = 0;
  for (const ch of trimmed) {
    if (ch === '(') parens++;
    else if (ch === ')') parens--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
    if (parens < 0 || brackets < 0) return false;
  }
  if (parens !== 0 || brackets !== 0) return false;
  return true;
}

export function normalizeCatalogOpcode(entry: RichOpcodeCatalogEntry): NormalizedOpcodeMetadata {
  const name = entry.name;
  const lowerName = name.toLowerCase();

  let kind: OpcodeKind = 'call';
  if (DECLARATION_NAMES.has(lowerName)) {
    kind = 'declaration';
  } else {
    // Check if it produces outputs
    const modernLines = entry.syntax?.filter((s) => matchModernCall(s, name)) ?? [];
    const hasOutputsInSyntax = modernLines.some(
      (s) => s.includes(' = ') && s.indexOf(' = ') < s.indexOf(name + '('),
    );
    const allNullSignatures =
      entry.signatures &&
      entry.signatures.length > 0 &&
      entry.signatures.every(
        (sig) => !sig.outTypes || sig.outTypes === '(null)' || sig.outTypes === '0',
      );

    if (!hasOutputsInSyntax && allNullSignatures) {
      kind = 'statement';
    } else if (
      hasOutputsInSyntax ||
      (entry.signatures && entry.signatures.length > 0 && !allNullSignatures)
    ) {
      kind = 'call';
    } else if (modernLines.length > 0 && !hasOutputsInSyntax) {
      kind = 'statement';
    }
  }

  const modernSyntax = entry.syntax?.filter((s) => matchModernCall(s, name));
  const classicSyntax = entry.syntax?.filter(
    (s) => !matchModernCall(s, name) && matchStandaloneToken(s, name),
  );

  return {
    name: entry.name,
    manualId: entry.manualId,
    kind,
    catalogSyntax: entry.syntax,
    modernSyntax,
    classicSyntax,
    signatures: entry.signatures?.map((s) => ({
      outTypes: s.outTypes,
      inTypes: s.inTypes,
    })),
    shortDescription: entry.shortDescription,
    category: entry.category,
    status: entry.status,
    examples: entry.examples,
  };
}

export interface ParsedCallableParts {
  outputs: string[];
  requiredInputs: string[];
  hasModernSyntax: boolean;
  safe: boolean;
}

function parseModernLine(
  line: string,
  name: string,
): { outputs: string[]; requiredInputs: string[] } | null {
  if (!isSafeSyntaxLine(line)) return null;

  const callRegex = new RegExp(`\\b${escapeRegExp(name)}\\s*\\((.*)\\)`);
  const callMatch = line.match(callRegex);
  if (!callMatch || callMatch.index === undefined) return null;

  const beforeCall = line.slice(0, callMatch.index);
  const insideParens = callMatch[1];

  const requiredPart = (value: string): string => {
    for (let index = 0; index < value.length; index++) {
      if (value[index] === '[' && value[index + 1] !== ']') {
        return value.slice(0, index);
      }
    }
    return value;
  };
  const cleanPlaceholder = (value: string): string =>
    value
      .trim()
      .replace(/:[a-zA-Z0-9_]+/g, '')
      .replace(/[^a-zA-Z0-9_\[\]]/g, '');

  let outputs: string[] = [];
  const eqIdx = beforeCall.indexOf('=');
  if (eqIdx !== -1) {
    const outPart = requiredPart(beforeCall.slice(0, eqIdx)).trim();
    if (outPart) {
      outputs = outPart.split(',').map(cleanPlaceholder).filter(Boolean);
    }
  }

  let requiredInputs: string[] = [];
  const reqPart = requiredPart(insideParens).replace(/,+$/, '').trim();
  if (reqPart) {
    requiredInputs = reqPart.split(',').map(cleanPlaceholder).filter(Boolean);
  }

  return { outputs, requiredInputs };
}

function parseClassicLine(
  line: string,
  name: string,
): { outputs: string[]; requiredInputs: string[] } | null {
  if (!isSafeSyntaxLine(line)) return null;

  const tokenRegex = new RegExp(`\\b${escapeRegExp(name)}\\b`);
  const match = line.match(tokenRegex);
  if (!match || match.index === undefined) return null;

  const modernRegex = new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`);
  if (modernRegex.test(line)) return null;

  const beforeToken = line.slice(0, match.index).split('[')[0].trim();
  let outputs: string[] = [];
  if (beforeToken) {
    outputs = beforeToken
      .split(',')
      .map((s) =>
        s
          .trim()
          .replace(/:[a-zA-Z0-9_]+/g, '')
          .replace(/[^a-zA-Z0-9_]/g, ''),
      )
      .filter(Boolean);
  }

  const afterToken = line
    .slice(match.index + name.length)
    .split('[')[0]
    .replace(/,+$/, '')
    .trim();
  let requiredInputs: string[] = [];
  if (afterToken) {
    requiredInputs = afterToken
      .split(/[,\s]+/)
      .map((s) =>
        s
          .trim()
          .replace(/:[a-zA-Z0-9_]+/g, '')
          .replace(/[^a-zA-Z0-9_]/g, ''),
      )
      .filter(Boolean);
  }

  return { outputs, requiredInputs };
}

function parseSignatureHints(
  metadata: NormalizedOpcodeMetadata,
): { outputs: string[]; requiredInputs: string[] } | null {
  if (!metadata.signatures || metadata.signatures.length === 0) return null;
  const firstSig = metadata.signatures[0];
  if (!firstSig) return null;

  const outTypes = firstSig.outTypes?.trim();
  const inTypes = firstSig.inTypes?.trim();

  const isSafeTypeStr = (t?: string) =>
    !t || t === '(null)' || t === '0' || (/^[aikSf]+$/i.test(t) && t.length <= 8);

  if (!isSafeTypeStr(outTypes) || !isSafeTypeStr(inTypes)) {
    return null;
  }

  let outputs: string[] = [];
  let requiredInputs: string[] = [];

  if (outTypes && outTypes !== '(null)' && outTypes !== '0') {
    outputs = ['ares'];
  }

  if (inTypes && inTypes !== '(null)' && inTypes !== '0') {
    const reqCount = inTypes.replace(/[opj\[\]]/g, '').length;
    requiredInputs = Array.from({ length: reqCount }, (_, i) => `xarg${i + 1}`);
  }

  return { outputs, requiredInputs };
}

export function parseCallableParts(metadata: NormalizedOpcodeMetadata): ParsedCallableParts {
  const name = metadata?.name;
  if (!name || typeof name !== 'string') {
    return { outputs: [], requiredInputs: [], hasModernSyntax: false, safe: false };
  }

  if (metadata.modernSyntax && metadata.modernSyntax.length > 0) {
    for (const line of metadata.modernSyntax) {
      const parsed = parseModernLine(line, name);
      if (parsed) {
        return {
          outputs: parsed.outputs,
          requiredInputs: parsed.requiredInputs,
          hasModernSyntax: true,
          safe: true,
        };
      }
    }
  }

  if (metadata.classicSyntax && metadata.classicSyntax.length > 0) {
    for (const line of metadata.classicSyntax) {
      const parsed = parseClassicLine(line, name);
      if (parsed) {
        return {
          outputs: parsed.outputs,
          requiredInputs: parsed.requiredInputs,
          hasModernSyntax: false,
          safe: true,
        };
      }
    }
  }

  const sigParsed = parseSignatureHints(metadata);
  if (sigParsed) {
    return {
      outputs: sigParsed.outputs,
      requiredInputs: sigParsed.requiredInputs,
      hasModernSyntax: false,
      safe: true,
    };
  }

  return { outputs: [], requiredInputs: [], hasModernSyntax: false, safe: false };
}

type InsertionContextKind =
  | 'assignment'
  | 'expression'
  | 'classic-output'
  | 'empty-statement'
  | 'comment'
  | 'continued'
  | 'unknown';

function detectInsertionContext(documentText: string, from: number): InsertionContextKind {
  const lineStart = documentText.lastIndexOf('\n', from - 1) + 1;

  // Check if previous line ended with line continuation '\'
  if (lineStart > 0) {
    const prevText = documentText.slice(0, lineStart - 1);
    const prevLineLast = prevText.slice(prevText.lastIndexOf('\n') + 1).trimEnd();
    if (prevLineLast.endsWith('\\')) {
      return 'continued';
    }
  }

  const lineBefore = documentText.slice(lineStart, from);

  if (lineBefore.includes(';') || lineBefore.includes('//')) {
    return 'comment';
  }

  if (/^\s*$/.test(lineBefore)) {
    return 'empty-statement';
  }

  if (/(?<![!=<>])=(?!=)\s*$/.test(lineBefore)) {
    return 'assignment';
  }

  // Count unclosed parentheses on the line before insertion point
  let openParenCount = 0;
  for (const ch of lineBefore) {
    if (ch === '(') openParenCount++;
    else if (ch === ')') openParenCount--;
  }

  if (openParenCount > 0 || /[,+\-*\/%^&|~\[]\s*$/.test(lineBefore)) {
    return 'expression';
  }

  // Check for authored classic output variable(s) followed by space
  if (/^\s*[a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*\s+$/.test(lineBefore)) {
    return 'classic-output';
  }

  return 'unknown';
}

export function resolveOpcodeInsertionPlan(
  documentText: string,
  from: number,
  to: number,
  metadata: NormalizedOpcodeMetadata,
): OpcodeInsertionPlan {
  const name = metadata.name;

  if (metadata.kind === 'declaration') {
    return {
      from,
      to,
      template: name,
      isSnippet: false,
      form: 'name-only',
    };
  }

  const contextKind = detectInsertionContext(documentText, from);
  if (contextKind === 'comment' || contextKind === 'continued' || contextKind === 'unknown') {
    return {
      from,
      to,
      template: name,
      isSnippet: false,
      form: 'name-only',
    };
  }

  const parsed = parseCallableParts(metadata);
  if (!parsed.safe) {
    return {
      from,
      to,
      template: name,
      isSnippet: false,
      form: 'name-only',
    };
  }

  const { outputs, requiredInputs, hasModernSyntax } = parsed;

  if (contextKind === 'assignment' || contextKind === 'expression') {
    if (!hasModernSyntax && outputs.length > 0) {
      return {
        from,
        to,
        template: name,
        isSnippet: false,
        form: 'name-only',
      };
    }
    if (requiredInputs.length === 0) {
      return {
        from,
        to,
        template: `${name}()`,
        isSnippet: false,
        form: 'expression',
      };
    }
    const inputSnippets = requiredInputs.map((input, idx) => `\${${idx + 1}:${input}}`);
    return {
      from,
      to,
      template: `${name}(${inputSnippets.join(', ')})`,
      isSnippet: true,
      form: 'expression',
    };
  }

  if (contextKind === 'classic-output') {
    if (requiredInputs.length === 0) {
      return {
        from,
        to,
        template: name,
        isSnippet: false,
        form: 'classic-statement',
      };
    }
    const inputSnippets = requiredInputs.map((input, idx) => `\${${idx + 1}:${input}}`);
    return {
      from,
      to,
      template: `${name} ${inputSnippets.join(', ')}`,
      isSnippet: true,
      form: 'classic-statement',
    };
  }

  // contextKind === 'empty-statement'
  if (!hasModernSyntax) {
    return {
      from,
      to,
      template: name,
      isSnippet: false,
      form: 'name-only',
    };
  }

  if (metadata.kind === 'statement' || outputs.length === 0) {
    if (requiredInputs.length === 0) {
      return {
        from,
        to,
        template: `${name}()`,
        isSnippet: false,
        form: 'modern-statement',
      };
    }
    const inputSnippets = requiredInputs.map((input, idx) => `\${${idx + 1}:${input}}`);
    return {
      from,
      to,
      template: `${name}(${inputSnippets.join(', ')})`,
      isSnippet: true,
      form: 'modern-statement',
    };
  }

  // Callable with 1 or multiple outputs at statement start
  let tabStop = 1;
  const outputSnippets = outputs.map((out) => `\${${tabStop++}:${out}}`);
  const inputSnippets = requiredInputs.map((input) => `\${${tabStop++}:${input}}`);
  const inputCall = inputSnippets.length > 0 ? `(${inputSnippets.join(', ')})` : '()';

  return {
    from,
    to,
    template: `${outputSnippets.join(', ')} = ${name}${inputCall}`,
    isSnippet: true,
    form: 'modern-statement',
  };
}

export function applyOpcodeInsertion(view: EditorView, plan: OpcodeInsertionPlan): void {
  if (plan.isSnippet) {
    snippet(plan.template)(view, { label: '' }, plan.from, plan.to);
  } else {
    view.dispatch({
      changes: { from: plan.from, to: plan.to, insert: plan.template },
      selection: { anchor: plan.from + plan.template.length },
    });
  }
}
