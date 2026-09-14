# Project Save State Contracts

## Query

ProjectHistory.getSaveState() returns none | unsaved | saved | modified from existing session/history facts without side effects. needsSaving is true only for unsaved/modified. isDirty retains existing history semantics.

## Main-window title

| State | Exact title |
| --- | --- |
| none | Blue |
| unsaved | Blue - New Project - [UNSAVED PROJECT] |
| saved | Blue - {file basename} |
| modified | Blue - {file basename} - [modified] |

Preserve extension, Unicode and punctuation. Recognize both slash forms for display only. Refresh on window creation, lifecycle changes, history updates and successful checkpoint publication. Specialized floating editor titles are unchanged.

## Confirmation and shutdown

After render/library guards and editor settlement, none/saved bypass project save confirmation; unsaved/modified use existing Save / Don't Save / Cancel choices.

- Save continues only after durable success.
- Don't Save authorizes discard.
- Cancel, write failure or settlement failure retains the project and aborts exit.
- Clean quit invokes shutdown once.
- Save/write helpers report outcomes and never invoke shutdown.
- Close/quit hold one boundary through state check, decision, settled save and terminal action. Never nest barrier-owning saves.
- Shared replacement callers preserve accepted-target sequencing and document-specific consent; audit existing barriers before integration.

No new IPC channel is required. Existing typed document and checkpoint events retain their semantics. Renderer-local draft flags cannot authorize or suppress native save prompts.
