# Data Model: Mixer Follow-Up

## Overview

Spec 035 builds on the Spec 034 models by adding routing-validation results, richer chain clipboard and movement payloads, and session-workspace state for the effects library. It does not introduce new durable storage or playback/windowing state.

## Routing Validation

```ts
interface MixerRoutingValidationResult {
  issues: MixerRoutingIssue[];
}

interface MixerRoutingIssue {
  severity: 'warning' | 'error';
  code:
    | 'self-output'
    | 'self-send'
    | 'feedback-risk'
    | 'missing-target'
    | 'invalid-paste-target';
  channelId: string;
  entryId?: string;
  targetName?: string;
  message: string;
}
```

This result can be produced from current mixer topology and used by dropdowns, inline warnings, or blocked actions.

## Advanced Chain Editing Payloads

```ts
interface MixerChainClipboardPayload {
  sourceKind: 'project';
  entries: MixerChainEntrySnapshot[];
}

type MixerFollowUpPatch =
  | { type: 'duplicateChainEntry'; channelId: string; chain: 'pre' | 'post'; entryId: string }
  | { type: 'copyChainEntry'; channelId: string; chain: 'pre' | 'post'; entryId: string }
  | { type: 'pasteChainEntries'; channelId: string; chain: 'pre' | 'post'; index?: number; payload: MixerChainClipboardPayload }
  | { type: 'moveChainEntryAcrossChains'; fromChannelId: string; fromChain: 'pre' | 'post'; toChannelId: string; toChain: 'pre' | 'post'; entryId: string; index?: number };
```

These build on Spec 034's chain editing without changing the core mixer entry shapes.

## Effects Library Workspace State

```ts
interface EffectsLibraryWorkspaceSnapshot {
  library: EffectsLibrarySnapshot;
  selectedCategoryId?: string;
  selectedEffectId?: string;
  clipboard?: LibraryClipboardPayload;
  hasSessionMutations: boolean;
}

type LibraryClipboardPayload =
  | { kind: 'category'; categoryId: string }
  | { kind: 'effect'; libraryEffectId: string };
```

This workspace snapshot is still session-local and still derived from the in-memory library session. `hasSessionMutations` supports reload-discard prompts without implying persistence.

## Validation Focus

- Routing validation tests should prove the app distinguishes between hard-invalid destinations and softer warning states.
- Clipboard and paste tests should prove copied chain entries remain serializable and safe to reject when a target strip is incompatible.
- Library workspace tests should prove reload discards session mutations cleanly and explicit import/export flows remain file-scoped.
