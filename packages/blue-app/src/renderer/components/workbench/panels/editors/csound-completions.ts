import type {
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from '@codemirror/autocomplete';

import type { DynamicCsoundCompletionProvider } from './editor-adapter-types';

const completionWord = /[A-Za-z_][A-Za-z0-9_]*(?::[A-Za-z_][A-Za-z0-9_]*)?/;
const completionValidFor = /^[A-Za-z_][A-Za-z0-9_]*(?::[A-Za-z_][A-Za-z0-9_]*)?$/;

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as Promise<T>).then === 'function';
}

export function createDynamicCsoundCompletionSource(
  providers: DynamicCsoundCompletionProvider[],
): CompletionSource {
  return (
    context: CompletionContext,
  ): CompletionResult | Promise<CompletionResult | null> | null => {
    if (providers.length === 0) {
      return null;
    }

    const word = context.matchBefore(completionWord);
    if (!word && !context.explicit) {
      return null;
    }

    const providerContext = {
      text: context.state.doc.toString(),
      position: context.pos,
      explicit: context.explicit,
    };
    const completions = providers.map((provider) => provider(providerContext));

    const buildResult = (
      resolvedCompletions: Awaited<ReturnType<DynamicCsoundCompletionProvider>>[],
    ): CompletionResult | null => {
      const options = resolvedCompletions.flat();
      if (options.length === 0) {
        return null;
      }

      return {
        from: word?.from ?? context.pos,
        options,
        validFor: completionValidFor,
      };
    };

    if (completions.some(isPromiseLike)) {
      return Promise.all(completions).then(buildResult);
    }

    return buildResult(completions);
  };
}
