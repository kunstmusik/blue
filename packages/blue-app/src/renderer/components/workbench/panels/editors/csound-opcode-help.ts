import type { EditorView } from '@codemirror/view';
import {
  csoundRichOpcodeCatalog,
  getCsoundRichOpcodeEntry,
  type RichOpcodeCatalogEntry,
} from '@kunstmusik/codemirror-lang-csound/rich';
import { toast } from 'sonner';
import { cn } from '../../../../lib/cn';
import type { OpenCsoundManualResult } from '../../../../shared/csound-manual';
import type { NormalizedOpcodeMetadata } from './editor-adapter-types';
import { normalizeCatalogOpcode } from './csound-opcode-insertion';

export interface OpcodeHelpModel {
  title: string;
  summary?: string;
  category?: string;
  status?: string;
  modernSyntax?: string[];
  classicSyntax?: string[];
  additionalSyntax?: string[];
  examples?: string[];
  manualId?: string;
}

export interface OpcodeHelpRenderOptions {
  ownerDocument?: Document;
  onOpenManual?: (manualId: string) => void | Promise<void>;
}

export function buildOpcodeHelpModel(metadata: NormalizedOpcodeMetadata): OpcodeHelpModel {
  const summary = metadata.shortDescription?.trim();
  const category = metadata.category?.trim();
  const status = metadata.status?.trim();
  const manualId = metadata.manualId?.trim();

  const modernSyntax = (metadata.modernSyntax ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const classicSyntax = (metadata.classicSyntax ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const examples = (metadata.examples ?? []).map((e) => e.trim()).filter((e) => e.length > 0);
  const classifiedSyntax = new Set([
    ...(metadata.modernSyntax ?? []),
    ...(metadata.classicSyntax ?? []),
  ]);
  const additionalSyntax = (metadata.catalogSyntax ?? [])
    .map((syntax) => syntax.trim())
    .filter((syntax) => syntax.length > 0 && !classifiedSyntax.has(syntax));

  return {
    title: metadata.name,
    summary: summary && summary.length > 0 ? summary : undefined,
    category: category && category.length > 0 ? category : undefined,
    status: status && status.length > 0 ? status : undefined,
    modernSyntax: modernSyntax.length > 0 ? modernSyntax : undefined,
    classicSyntax: classicSyntax.length > 0 ? classicSyntax : undefined,
    additionalSyntax: additionalSyntax.length > 0 ? additionalSyntax : undefined,
    examples: examples.length > 0 ? examples : undefined,
    manualId: manualId && manualId.length > 0 ? manualId : undefined,
  };
}

export async function requestOpenManual(
  manualId: string,
): Promise<OpenCsoundManualResult | undefined> {
  if (!window.blueAPI?.openCsoundManual) {
    return undefined;
  }

  try {
    const result = await window.blueAPI.openCsoundManual({ manualId });
    if (result.disposition === 'fallback') {
      const message =
        result.message ||
        (result.reason === 'missing'
          ? `Csound manual entry "${manualId}" not found`
          : result.reason === 'invalid-setting'
            ? 'Invalid Csound manual URL setting'
            : `Failed to open manual for "${manualId}"`);
      toast.error(message);
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.error(message);
    return {
      disposition: 'fallback',
      availability: 'indeterminate',
      reason: 'open-failed',
      message,
    };
  }
}

export function renderOpcodeHelpHtml(
  metadata: NormalizedOpcodeMetadata,
  options?: OpcodeHelpRenderOptions,
): HTMLElement {
  const doc = options?.ownerDocument ?? document;
  const model = buildOpcodeHelpModel(metadata);

  const container = doc.createElement('div');
  container.className = cn(
    'csound-opcode-help flex flex-col gap-2 p-3 text-role-body max-w-md overflow-y-auto select-text',
  );

  // Header / Title row
  const headerRow = doc.createElement('div');
  headerRow.className = cn('flex items-center flex-wrap gap-2');

  const titleEl = doc.createElement('span');
  titleEl.className = cn('text-role-headline font-bold text-foreground');
  titleEl.textContent = model.title;
  headerRow.appendChild(titleEl);

  if (model.status) {
    const statusEl = doc.createElement('span');
    statusEl.className = cn(
      'text-role-callout px-1.5 py-0.5 rounded text-amber-500 bg-amber-500/10 font-medium',
    );
    statusEl.textContent = model.status;
    headerRow.appendChild(statusEl);
  }

  if (model.category) {
    const categoryEl = doc.createElement('span');
    categoryEl.className = cn('text-role-callout text-muted-foreground');
    categoryEl.textContent = `Category: ${model.category}`;
    headerRow.appendChild(categoryEl);
  }

  container.appendChild(headerRow);

  // Summary
  if (model.summary) {
    const summaryEl = doc.createElement('div');
    summaryEl.className = cn('text-role-body text-foreground');
    summaryEl.textContent = model.summary;
    container.appendChild(summaryEl);
  }

  // Modern Syntax
  if (model.modernSyntax && model.modernSyntax.length > 0) {
    const modernBlock = doc.createElement('div');
    modernBlock.className = cn('flex flex-col gap-1 mt-1');

    const heading = doc.createElement('div');
    heading.className = cn('text-role-callout font-medium text-muted-foreground');
    heading.textContent = 'Modern Syntax';
    modernBlock.appendChild(heading);

    const pre = doc.createElement('pre');
    pre.className = cn(
      'text-role-body font-mono bg-muted/40 p-2 rounded overflow-x-auto whitespace-pre',
    );
    pre.textContent = model.modernSyntax.join('\n');
    modernBlock.appendChild(pre);

    container.appendChild(modernBlock);
  }

  // Classic Syntax
  if (model.classicSyntax && model.classicSyntax.length > 0) {
    const classicBlock = doc.createElement('div');
    classicBlock.className = cn('flex flex-col gap-1 mt-1');

    const heading = doc.createElement('div');
    heading.className = cn('text-role-callout font-medium text-muted-foreground');
    heading.textContent = 'Classic Syntax';
    classicBlock.appendChild(heading);

    const pre = doc.createElement('pre');
    pre.className = cn(
      'text-role-body font-mono bg-muted/40 p-2 rounded overflow-x-auto whitespace-pre',
    );
    pre.textContent = model.classicSyntax.join('\n');
    classicBlock.appendChild(pre);

    container.appendChild(classicBlock);
  }

  if (model.additionalSyntax && model.additionalSyntax.length > 0) {
    const additionalBlock = doc.createElement('div');
    additionalBlock.className = cn('flex flex-col gap-1 mt-1');
    const heading = doc.createElement('div');
    heading.className = cn('text-role-callout font-medium text-muted-foreground');
    heading.textContent = 'Additional Syntax';
    additionalBlock.appendChild(heading);
    const pre = doc.createElement('pre');
    pre.className = cn(
      'text-role-body font-mono bg-muted/40 p-2 rounded overflow-x-auto whitespace-pre',
    );
    pre.textContent = model.additionalSyntax.join('\n');
    additionalBlock.appendChild(pre);
    container.appendChild(additionalBlock);
  }

  // Examples
  if (model.examples && model.examples.length > 0) {
    const examplesBlock = doc.createElement('div');
    examplesBlock.className = cn('flex flex-col gap-1 mt-1');

    const heading = doc.createElement('div');
    heading.className = cn('text-role-callout font-medium text-muted-foreground');
    heading.textContent = 'Examples';
    examplesBlock.appendChild(heading);

    const pre = doc.createElement('pre');
    pre.className = cn(
      'text-role-body font-mono bg-muted/40 p-2 rounded overflow-x-auto whitespace-pre',
    );
    pre.textContent = model.examples.join('\n');
    examplesBlock.appendChild(pre);

    container.appendChild(examplesBlock);
  }

  // Open Manual Button
  if (model.manualId) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = cn(
      'csound-opcode-help__open-manual mt-2 inline-flex cursor-pointer items-center justify-center self-end rounded-md border border-app-accent bg-app-accent px-3 py-1.5 text-role-body font-medium text-app-accent-foreground transition-colors hover:bg-app-accent-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus',
    );
    button.textContent = 'Open Manual';
    button.setAttribute('data-manual-id', model.manualId);

    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (options?.onOpenManual) {
        void options.onOpenManual(model.manualId!);
      } else {
        void requestOpenManual(model.manualId!);
      }
    });

    container.appendChild(button);
  }

  return container;
}

const catalogByNameLower = new Map<string, RichOpcodeCatalogEntry>();
for (const entry of csoundRichOpcodeCatalog.opcodes) {
  catalogByNameLower.set(entry.name.toLowerCase(), entry);
}

export function findCatalogOpcode(name: string): RichOpcodeCatalogEntry | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const direct = getCsoundRichOpcodeEntry(trimmed);
  if (direct) return direct;
  return catalogByNameLower.get(trimmed.toLowerCase());
}

export function getOpcodeAtCaret(view: EditorView): RichOpcodeCatalogEntry | undefined {
  const state = view.state;
  const selection = state.selection.main;
  const docText = state.doc.toString();

  let targetWord: string | undefined;

  if (!selection.empty) {
    const selected = docText.slice(selection.from, selection.to).trim();
    if (selected && /^[A-Za-z0-9_]+$/.test(selected)) {
      targetWord = selected;
    }
  }

  if (!targetWord) {
    const pos = selection.head;
    let start = pos;
    while (start > 0 && /[A-Za-z0-9_]/.test(docText[start - 1])) {
      start--;
    }
    let end = pos;
    while (end < docText.length && /[A-Za-z0-9_]/.test(docText[end])) {
      end++;
    }
    if (start < end) {
      targetWord = docText.slice(start, end);
    }
  }

  if (!targetWord) {
    return undefined;
  }

  return findCatalogOpcode(targetWord);
}

const imperativeHelpCleanup = new WeakMap<Document, () => void>();

export function presentOpcodeHelp(view: EditorView, entry: RichOpcodeCatalogEntry): HTMLElement {
  const doc = view.dom?.ownerDocument ?? document;
  imperativeHelpCleanup.get(doc)?.();

  const metadata = normalizeCatalogOpcode(entry);
  const overlay = doc.createElement('div');
  overlay.className = cn(
    'csound-opcode-help-overlay fixed z-50 p-4 rounded-lg shadow-xl border border-border bg-popover text-popover-foreground max-w-lg',
  );
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', `${metadata.name} help`);

  const closeButton = doc.createElement('button');
  closeButton.type = 'button';
  closeButton.className = cn(
    'csound-opcode-help-close absolute top-2 right-2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer',
  );
  closeButton.setAttribute('aria-label', 'Close help');
  closeButton.textContent = '✕';

  const dismiss = () => {
    doc.removeEventListener('keydown', handleKeyDown);
    doc.defaultView?.removeEventListener('resize', position);
    observer.disconnect();
    overlay.remove();
    imperativeHelpCleanup.delete(doc);
  };

  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    dismiss();
  });
  overlay.appendChild(closeButton);

  const helpContent = renderOpcodeHelpHtml(metadata, {
    ownerDocument: doc,
    onOpenManual: (manualId) => {
      void requestOpenManual(manualId);
    },
  });
  overlay.appendChild(helpContent);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      dismiss();
    }
  };
  const position = () => {
    const hostWindow = doc.defaultView;
    const anchorRect = view.dom?.getBoundingClientRect();
    if (!hostWindow || !anchorRect) return;
    const margin = 8;
    const gap = 8;
    const maxHeight = Math.max(0, hostWindow.innerHeight - margin * 2);
    overlay.style.maxHeight = `${maxHeight}px`;
    overlay.style.overflowY = 'auto';
    const overlayRect = overlay.getBoundingClientRect();
    overlay.style.top = `${Math.max(
      margin,
      Math.min(anchorRect.top, hostWindow.innerHeight - overlayRect.height - margin),
    )}px`;
    overlay.style.left = `${Math.max(
      margin,
      Math.min(anchorRect.right + gap, hostWindow.innerWidth - overlayRect.width - margin),
    )}px`;
  };
  const HostMutationObserver = doc.defaultView?.MutationObserver ?? MutationObserver;
  const observer = new HostMutationObserver(() => {
    if (!view.dom?.isConnected || view.dom.ownerDocument !== doc) dismiss();
  });
  doc.addEventListener('keydown', handleKeyDown);
  doc.defaultView?.addEventListener('resize', position);

  const mountTarget = doc.body ?? doc.documentElement;
  mountTarget.appendChild(overlay);
  position();
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  imperativeHelpCleanup.set(doc, dismiss);
  return overlay;
}

export async function handleOpenManualAtCaret(
  view: EditorView,
  options: { presentHelp?: boolean } = {},
): Promise<OpenCsoundManualResult | undefined> {
  const entry = getOpcodeAtCaret(view);
  if (!entry) {
    toast.error('No Csound manual entry available at caret');
    return undefined;
  }

  if (options.presentHelp !== false) {
    presentOpcodeHelp(view, entry);
  }

  if (!entry.manualId) {
    toast.error(`No Csound manual entry available for "${entry.name}"`);
    return undefined;
  }
  return await requestOpenManual(entry.manualId);
}
