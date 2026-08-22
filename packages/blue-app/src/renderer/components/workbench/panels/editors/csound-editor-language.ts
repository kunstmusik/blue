import { autocompletion } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import { csound } from '@kunstmusik/codemirror-lang-csound';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { clojure } from '@nextjournal/lang-clojure';

import { createDynamicCsoundCompletionSource } from './csound-completions';
import { createJavaBlueCsoundCompletionSource } from './csound-java-blue-completions';
import type {
  DynamicCsoundCompletionProvider,
  JavaBlueCsoundCompletionOptions,
  SelectedEditorMetadata,
} from './editor-adapter-types';

export const SELECTED_CSOUND_EDITOR: SelectedEditorMetadata = {
  kind: 'codemirror',
  languageId: 'csound-orc',
  mode: 'orc',
};

export type CsoundDocumentMode = 'orc' | 'sco' | 'csd' | 'text' | 'javascript' | 'python' | 'clojure';

export function getSelectedEditorMetadata(
  mode: CsoundDocumentMode,
): SelectedEditorMetadata {
  return {
    kind: 'codemirror',
    languageId:
      mode === 'text'
        ? 'plain-text'
        : mode === 'javascript'
          ? 'javascript'
          : mode === 'python'
            ? 'python'
            : mode === 'clojure'
              ? 'clojure'
              : mode === 'sco'
                ? 'csound-sco'
                : mode === 'csd'
                  ? 'csound-csd'
                  : 'csound-orc',
    mode,
  };
}

/**
 * Whether a mode supports Csound autocompletion. Text/javascript/python/clojure
 * modes use their own language tooling and must not receive Csound completions.
 */
function modeSupportsCsoundCompletion(mode: CsoundDocumentMode): boolean {
  return mode !== 'text' && mode !== 'javascript' && mode !== 'python' && mode !== 'clojure';
}

/**
 * The autocompletion extension, built from the supplied Java Blue options and
 * dynamic providers. Returned as a single Extension so the host can hold it in
 * a Compartment and reconfigure it without rebuilding the EditorView (which
 * would reset the cursor/selection). Returns `none` for non-Csound modes.
 */
export function createCsoundCompletionExtension(
  dynamicCompletionProviders: DynamicCsoundCompletionProvider[] = [],
  javaBlueCompletionOptions: JavaBlueCsoundCompletionOptions = {},
  mode: CsoundDocumentMode = 'orc',
): Extension {
  if (!modeSupportsCsoundCompletion(mode)) {
    return [];
  }

  const completionSources = [createJavaBlueCsoundCompletionSource(javaBlueCompletionOptions)];
  if (dynamicCompletionProviders.length > 0) {
    completionSources.push(createDynamicCsoundCompletionSource(dynamicCompletionProviders));
  }

  return autocompletion({ override: completionSources });
}

export function createCsoundEditorExtensions(
  mode: CsoundDocumentMode = 'orc',
): Extension[] {
  const extensions: Extension[] = [];
  if (mode === 'javascript') {
    extensions.push(javascript());
  } else if (mode === 'python') {
    extensions.push(python());
  } else if (mode === 'clojure') {
    extensions.push(clojure());
  } else if (mode !== 'text') {
    extensions.push(csound({ mode }));
  }
  return extensions;
}
