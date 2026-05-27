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

export function createCsoundEditorExtensions(
  dynamicCompletionProviders: DynamicCsoundCompletionProvider[] = [],
  javaBlueCompletionOptions: JavaBlueCsoundCompletionOptions = {},
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
  const completionSources = [createJavaBlueCsoundCompletionSource(javaBlueCompletionOptions)];

  if (mode !== 'text' && mode !== 'javascript' && mode !== 'python' && mode !== 'clojure' && dynamicCompletionProviders.length > 0) {
    completionSources.push(createDynamicCsoundCompletionSource(dynamicCompletionProviders));
  }

  if (mode !== 'text' && mode !== 'javascript' && mode !== 'python' && mode !== 'clojure') {
    extensions.push(
      autocompletion({
        override: completionSources,
      }),
    );
  }

  return extensions;
}
