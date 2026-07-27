import type { Completion } from '@codemirror/autocomplete';

export type SelectedEditorKind = 'codemirror';

export type CsoundDocumentMode = 'orc' | 'sco' | 'csd' | 'text' | 'javascript' | 'python' | 'clojure';

export interface CsoundCompletionContext {
  text: string;
  position: number;
  explicit: boolean;
}

export type DynamicCsoundCompletionProvider = (
  context: CsoundCompletionContext,
) => Completion[] | Promise<Completion[]>;

export type CsoundEditorCommand = 'cut' | 'copy' | 'paste' | 'evaluate-code';

export interface CsoundEditorSeparatorItem {
  kind: 'separator';
  id: string;
}

export interface CsoundEditorCommandItem {
  kind: 'command';
  id: string;
  label: string;
  shortcutLabel?: string;
  command: CsoundEditorCommand;
  disabled?: boolean;
  disabledReason?: string;
}

export interface CsoundEditorInsertionItem {
  kind: 'insertion';
  id: string;
  label: string;
  insertText: string;
  detail?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export interface CsoundEditorSubmenuItem {
  kind: 'submenu';
  id: string;
  label: string;
  items: CsoundEditorMenuItem[];
  disabled?: boolean;
  disabledReason?: string;
}

export interface CsoundEditorDisabledItem {
  kind: 'disabled';
  id: string;
  label: string;
  disabledReason: string;
}

export type CsoundEditorMenuItem =
  | CsoundEditorCommandItem
  | CsoundEditorInsertionItem
  | CsoundEditorSubmenuItem
  | CsoundEditorDisabledItem
  | CsoundEditorSeparatorItem;

export interface JavaBlueBsbReplacementKey {
  key: string;
  objectType?: string;
}

/**
 * Lightweight, signature-bearing UDO definition accepted by the reusable
 * Csound completion adapter. Code and comments are deliberately excluded;
 * completion consumes only the authored name and callable-signature fields.
 */
export interface JavaBlueUdoCompletionDefinition {
  name: string;
  style: 'CLASSIC' | 'MODERN';
  outTypes: string;
  /** Classic-style input declaration; empty for modern style. */
  inTypes: string;
  /** Modern-style input declaration; empty for classic style. */
  inputArguments: string;
}

export interface JavaBlueCsoundCompletionOptions {
  bsbReplacementKeys?: JavaBlueBsbReplacementKey[];
  /** UDO definitions owned by the active instrument, Sound, or effect context. */
  contextUdos?: readonly JavaBlueUdoCompletionDefinition[];
  /** Project-global UDO definitions shown in the Global UDO panel. */
  projectUdos?: readonly JavaBlueUdoCompletionDefinition[];
}

export interface SelectedCodeEditorProps {
  value: string;
  placeholder?: string;
  ariaLabel: string;
  active?: boolean;
  readOnly?: boolean;
  mode?: CsoundDocumentMode;
  dynamicCompletionProviders?: DynamicCsoundCompletionProvider[];
  javaBlueCompletionOptions?: JavaBlueCsoundCompletionOptions;
  contextMenuItems?: CsoundEditorMenuItem[];
  evaluateCodeEnabled?: boolean;
  onEvaluateCode?: (text: string) => void;
  onChange: (value: string) => void | Promise<void>;
}

export interface SelectedEditorMetadata {
  kind: SelectedEditorKind;
  languageId: string;
  mode: CsoundDocumentMode;
}
