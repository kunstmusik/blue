import type { Completion } from '@codemirror/autocomplete';
import type { CodeRepositoryNode } from '@blue/data';
import type { ProjectDocumentCommitMetadata } from '../../../../shared/project-history';

export type SelectedEditorKind = 'codemirror';

export type CsoundDocumentMode =
  'orc' | 'sco' | 'csd' | 'text' | 'javascript' | 'python' | 'clojure';

export interface CsoundCompletionContext {
  text: string;
  position: number;
  explicit: boolean;
}

export type DynamicCsoundCompletionProvider = (
  context: CsoundCompletionContext,
) => Completion[] | Promise<Completion[]>;

export type CsoundEditorCommand =
  | 'cut'
  | 'copy'
  | 'paste'
  | 'undo'
  | 'redo'
  | 'evaluate-code'
  | 'add-to-code-repository'
  | 'open-manual';

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
  opcodeMetadata?: NormalizedOpcodeMetadata;
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
  mode?: CsoundDocumentMode;
  ownerDocument?: Document;
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
  /** Repository root for the Custom submenu; null disables it. */
  codeRepositoryRoot?: CodeRepositoryNode | null;
  /** Callback invoked when the user adds the current selection to the repository. */
  /** History scope for undo/redo routing. Defaults to 'project'. */
  historyScope?: 'project' | 'draft' | 'none';
  /** Typing grouping interval in milliseconds (e.g. 500ms). Defaults to 0 (immediate). */
  typingGroupingMs?: number;
  /** Stable project-history identity carried with text submissions. */
  historyMetadata?: Pick<
    ProjectDocumentCommitMetadata,
    'label' | 'gestureId' | 'fieldId' | 'phase' | 'origin'
  >;
  onChange: (value: string, metadata?: ProjectDocumentCommitMetadata) => void | Promise<void>;
}

export interface SelectedEditorMetadata {
  kind: SelectedEditorKind;
  languageId: string;
  mode: CsoundDocumentMode;
}

export type OpcodeKind = 'call' | 'statement' | 'declaration';

export interface OpcodeSignatureInfo {
  outTypes: string;
  inTypes: string;
}

export interface NormalizedOpcodeMetadata {
  name: string;
  manualId?: string;
  kind: OpcodeKind;
  catalogSyntax?: string[];
  modernSyntax?: string[];
  classicSyntax?: string[];
  signatures?: OpcodeSignatureInfo[];
  shortDescription?: string;
  category?: string;
  status?: string;
  examples?: string[];
}

export type OpcodeInsertionForm =
  'expression' | 'classic-statement' | 'modern-statement' | 'name-only';

export interface OpcodeInsertionPlan {
  from: number;
  to: number;
  template: string;
  isSnippet: boolean;
  form: OpcodeInsertionForm;
}
