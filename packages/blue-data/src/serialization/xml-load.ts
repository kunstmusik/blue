import { Element } from './xml-reader';
import { XmlError } from '@rgrove/parse-xml';

/** Caller-supplied XML provenance used in diagnostics. A native path is a label for the host, not a file to open. */
export type XmlSource = Readonly<{
  /** Identifies which kind of Blue resource produced the diagnostic. */
  kind:
    | 'project'
    | 'instrument'
    | 'effect'
    | 'soundObject'
    | 'udo'
    | 'preset'
    | 'library'
    | 'primitive';
  /** Human-readable identifier shown in diagnostic messages. */
  label: string;
  /** Optional host-native source path for callers that can open the associated file. */
  nativePath?: string;
  /** Optional identifier for the originating item in a resource library. */
  libraryItemId?: string;
}>;

/** One XML validation issue with a source, element or member location, and a suggested recovery action. */
export type XmlDiagnostic = Readonly<{
  /** Machine-readable diagnostic category, such as `shape` or `value`. */
  code: string;
  /** An error rejects the load. A warning can accompany a usable value. */
  severity: 'warning' | 'error';
  /** Identifies the input responsible for this diagnostic. */
  source: XmlSource;
  /** Slash-delimited XML location with one-based indices for sibling elements of the same name. */
  path: string;
  /** Attribute or member associated with the issue when available. */
  member?: string;
  /** Original text associated with the issue when available. */
  value?: string;
  /** Description of what the loader found. */
  message: string;
  /** Suggested action for correcting the source or proceeding. */
  recovery: string;
  /** Source line when supplied by the XML parser. */
  line?: number;
  /** Source column when supplied by the XML parser. */
  column?: number;
}>;

/** Result of a load operation. Narrow on `ok` before reading `value`. Successful results can include warnings. */
export type XmlLoadResult<T> =
  | Readonly<{
      /** The XML was accepted. */
      ok: true;
      /** The validated and migrated value. */
      value: T;
      /** Warnings recorded while accepting the input. */
      diagnostics: readonly XmlDiagnostic[];
    }>
  | Readonly<{
      /** The XML was rejected. */
      ok: false;
      /** Errors and any earlier warnings encountered during the load. */
      diagnostics: readonly XmlDiagnostic[];
    }>;

/** Receives diagnostics from throwing convenience loaders when XML is accepted with warnings. */
export type XmlDiagnosticSink = (diagnostics: readonly XmlDiagnostic[]) => void;
/** Diagnostic fields supplied by a loader before a context attaches source metadata and an XML path. */
export type DiagnosticInput = Omit<XmlDiagnostic, 'source' | 'path'>;
/** Shared state behind the element-specific views of one XML load. */
export type Operation = {
  /** Source metadata shared by all diagnostics from this load. */
  source: XmlSource;
  /** Original element locations indexed before structural migration changes the tree. */
  paths: WeakMap<Element, string>;
  /** Diagnostics collected while processing the input. */
  diagnostics: XmlDiagnostic[];
  /** Whether the operation has already recorded source paths. */
  indexed: boolean;
  /** Callback that stops the source-path mutation observer, when active. */
  disposeObserver?: () => void;
};

/** XML load failure carrying the structured diagnostics used to build its error message. */
export class XmlLoadError extends Error {
  /** A snapshot of the diagnostics supplied when this error was constructed. */
  readonly diagnostics: readonly XmlDiagnostic[];

  /** Creates an error whose message includes each diagnostic’s source, path, and recovery. */
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

  /** Starts a diagnostic context for an XML element. Use {@link XmlLoadContext.at} to share the operation with child elements. */
  constructor(
    private readonly element: Element,
    source?: XmlSource,
    operation?: Operation,
  ) {
    this.operation = operation ?? {
      source: { ...(source ?? { kind: 'primitive', label: 'in-memory XML' }) },
      paths: new WeakMap(),
      diagnostics: [],
      indexed: false,
    };
    if (!operation) {
      if (source) {
        let root = element;
        while (root.getParent()) root = root.getParent()!;
        this.operation.disposeObserver = Element.registerRootMutationObserver(root, () => {
          this.ensureIndexed(root);
        });
      } else {
        // Direct primitive reads need only their own path, not a project-wide walk.
        this.operation.paths.set(element, this.pathOf(element));
      }
    }
  }

  private ensureIndexed(root: Element): void {
    if (this.operation.indexed) return;
    this.operation.indexed = true;
    this.operation.disposeObserver = undefined;
    this.index(root, `/${root.getName()}`);
  }

  /** Stops observing XML mutations for this load operation. Nested contexts share the observer. */
  disposeObserver(): void {
    this.operation.disposeObserver?.();
    this.operation.disposeObserver = undefined;
  }

  private pathOf(element: Element): string {
    const anchored = this.operation.paths.get(element);
    if (anchored) return anchored;
    const parent = element.getParent();
    const path = parent
      ? `${this.pathOf(parent)}/${element.getName()}[${parent.getChildIndexByName(element)}]`
      : `/${element.getName()}`;
    this.operation.paths.set(element, path);
    return path;
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

  /** Returns the current XML location, using the original source path when migration anchored the element. */
  get path(): string {
    return this.pathOf(this.element);
  }

  /** Creates an element-specific context that shares diagnostics and source anchors with this operation. */
  at(element: Element): XmlLoadContext {
    return new XmlLoadContext(element, this.operation.source, this.operation);
  }

  /** Anchor a generated migration subtree to the legacy source it represents. */
  anchor(generated: Element, original: Element): void {
    this.index(generated, this.at(original).path);
  }

  /** Records and returns a diagnostic attributed to the current element or its named attribute. */
  diagnostic(input: DiagnosticInput): XmlDiagnostic {
    const diagnostic: XmlDiagnostic = {
      ...input,
      source: this.operation.source,
      path: input.member?.startsWith('@') ? `${this.path}/${input.member}` : this.path,
    };
    this.operation.diagnostics.push(diagnostic);
    return diagnostic;
  }

  /** Records an error diagnostic and returns an {@link XmlLoadError} for the caller to throw. */
  error(input: Omit<DiagnosticInput, 'severity'>): XmlLoadError {
    return new XmlLoadError([this.diagnostic({ ...input, severity: 'error' })]);
  }

  /** Completes a load, returning the supplied value only if no error diagnostics were recorded. */
  result<T>(value: T): XmlLoadResult<T> {
    const diagnostics = [...this.operation.diagnostics];
    return diagnostics.some((d) => d.severity === 'error')
      ? { ok: false, diagnostics }
      : { ok: true, value, diagnostics };
  }

  /** Returns a failed result, merging structured load errors or converting an unexpected exception into a diagnostic. */
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
  } finally {
    context.disposeObserver();
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
