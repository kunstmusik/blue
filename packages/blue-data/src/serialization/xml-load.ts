import { Element } from './xml-reader';
import { XmlError } from '@rgrove/parse-xml';

export type XmlSource = Readonly<{
  kind:
    | 'project'
    | 'instrument'
    | 'effect'
    | 'soundObject'
    | 'udo'
    | 'preset'
    | 'library'
    | 'primitive';
  label: string;
  nativePath?: string;
  libraryItemId?: string;
}>;

export type XmlDiagnostic = Readonly<{
  code: string;
  severity: 'warning' | 'error';
  source: XmlSource;
  path: string;
  member?: string;
  value?: string;
  message: string;
  recovery: string;
  line?: number;
  column?: number;
}>;

export type XmlLoadResult<T> =
  | Readonly<{ ok: true; value: T; diagnostics: readonly XmlDiagnostic[] }>
  | Readonly<{ ok: false; diagnostics: readonly XmlDiagnostic[] }>;

export type XmlDiagnosticSink = (diagnostics: readonly XmlDiagnostic[]) => void;
type DiagnosticInput = Omit<XmlDiagnostic, 'source' | 'path'>;
type Operation = {
  source: XmlSource;
  paths: WeakMap<Element, string>;
  diagnostics: XmlDiagnostic[];
};

export class XmlLoadError extends Error {
  readonly diagnostics: readonly XmlDiagnostic[];

  constructor(diagnostics: readonly XmlDiagnostic[]) {
    super(
      diagnostics.map((d) => `${d.source.label}: ${d.path}: ${d.message} ${d.recovery}`).join('\n'),
    );
    this.name = 'XmlLoadError';
    this.diagnostics = [...diagnostics];
  }
}

/** One ephemeral operation owns source anchors and diagnostics through nested loads. */
export class XmlLoadContext {
  private readonly operation: Operation;

  constructor(
    private readonly element: Element,
    source?: XmlSource,
    operation?: Operation,
  ) {
    this.operation = operation ?? {
      source: { ...(source ?? { kind: 'primitive', label: 'in-memory XML' }) },
      paths: new WeakMap(),
      diagnostics: [],
    };
    if (!operation) {
      if (source) {
        let root = element;
        while (root.getParent()) root = root.getParent()!;
        this.index(root, `/${root.getName()}`);
      } else {
        // Direct primitive reads need only their own path, not a project-wide walk.
        this.operation.paths.set(element, this.pathOf(element));
      }
    }
  }

  private pathOf(element: Element): string {
    const anchored = this.operation.paths.get(element);
    if (anchored) return anchored;
    const parent = element.getParent();
    if (!parent) return `/${element.getName()}`;
    const siblings = parent.getElements(element.getName()).toArray();
    return `${this.pathOf(parent)}/${element.getName()}[${siblings.indexOf(element) + 1}]`;
  }

  private index(element: Element, path: string): void {
    this.operation.paths.set(element, path);
    const counts = new Map<string, number>();
    for (const child of element.getElements()) {
      const name = child.getName();
      const index = (counts.get(name) ?? 0) + 1;
      counts.set(name, index);
      this.index(child, `${path}/${name}[${index}]`);
    }
  }

  get path(): string {
    return this.pathOf(this.element);
  }

  at(element: Element): XmlLoadContext {
    return new XmlLoadContext(element, this.operation.source, this.operation);
  }

  /** Anchor a generated migration subtree to the legacy source it represents. */
  anchor(generated: Element, original: Element): void {
    this.index(generated, this.at(original).path);
  }

  diagnostic(input: DiagnosticInput): XmlDiagnostic {
    const diagnostic: XmlDiagnostic = {
      ...input,
      source: this.operation.source,
      path: input.member?.startsWith('@') ? `${this.path}/${input.member}` : this.path,
    };
    this.operation.diagnostics.push(diagnostic);
    return diagnostic;
  }

  error(input: Omit<DiagnosticInput, 'severity'>): XmlLoadError {
    return new XmlLoadError([this.diagnostic({ ...input, severity: 'error' })]);
  }

  result<T>(value: T): XmlLoadResult<T> {
    const diagnostics = [...this.operation.diagnostics];
    return diagnostics.some((d) => d.severity === 'error')
      ? { ok: false, diagnostics }
      : { ok: true, value, diagnostics };
  }

  reject(error: unknown): XmlLoadResult<never> {
    if (error instanceof XmlLoadError) {
      for (const diagnostic of error.diagnostics) {
        if (!this.operation.diagnostics.includes(diagnostic))
          this.operation.diagnostics.push({ ...diagnostic, source: this.operation.source });
      }
    } else {
      this.diagnostic({
        code: 'value',
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
        recovery: 'Correct the source in a compatible editor and retry.',
      });
    }
    return { ok: false, diagnostics: [...this.operation.diagnostics] };
  }
}

export function loadXml<T>(
  xml: string,
  source: XmlSource,
  loader: (root: Element, context: XmlLoadContext) => T,
): XmlLoadResult<T> {
  let root: Element;
  try {
    root = Element.parse(xml);
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'syntax',
          severity: 'error',
          source: { ...source },
          path: '/',
          ...(error instanceof XmlError ? { line: error.line, column: error.column } : {}),
          message: error instanceof Error ? error.message : String(error),
          recovery: 'Repair the XML syntax and retry; no candidate was loaded.',
        },
      ],
    };
  }
  const context = new XmlLoadContext(root, source);
  try {
    return context.result(loader(root, context));
  } catch (error) {
    return context.reject(error);
  }
}

/** Strict convenience loaders cannot silently swallow accepted warnings. */
export function requireXmlValue<T>(result: XmlLoadResult<T>, sink?: XmlDiagnosticSink): T {
  if (!result.ok) throw new XmlLoadError(result.diagnostics);
  if (result.diagnostics.length > 0) {
    if (!sink)
      throw new XmlLoadError([
        ...result.diagnostics,
        {
          code: 'report-handler-required',
          severity: 'error',
          source: result.diagnostics[0].source,
          path: result.diagnostics[0].path,
          message: 'Accepted XML has warnings that require a report handler.',
          recovery:
            'Use the report API or provide a diagnostic sink before activating or saving this candidate.',
        },
      ]);
    sink(result.diagnostics);
  }
  return result.value;
}
