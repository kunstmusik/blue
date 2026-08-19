# Data Model: Deferred Project-Replacement Save Prompts

The feature adds transient main-process coordination state only. It does not add
project XML fields, program settings, or a new durable store.

## Prepared Replacement Candidate

Represents a fully selected and validated target that can be installed if replacement
confirmation succeeds.

Fields:

- kind: project-file, csd, orc-sco, or midi.
- sourcePaths: the native filesystem paths selected by the user, when applicable.
- targetFilePath: the native .blue path for project-file targets; null for imported
  unsaved projects.
- projectData: the prepared BlueData instance not yet installed as currentData.
- importMode: the accepted CSD/ORC/SCO mode, when applicable.
- sourceIdentity: canonical project path identity for same-file checks, when applicable.

Validation:

- project-file candidates must be successfully read and parsed by BlueData.
- CSD and ORC/SCO candidates must be successfully read and converted.
- MIDI candidates must pass pending-token and mapping validation and be built without
  an import error.
- A cancelled chooser or mode dialog produces no candidate.

Ownership: Electron main process, in memory, one request at a time.

## Replacement Flow State

Transient lifecycle for one interactive request:

~~~
preflight
  -> choosing
  -> cancelled
  -> preparation-failed
  -> prepared
  -> no-op
  -> commit-preflight
  -> save-decision
  -> library-decision
  -> committing
  -> committed
  -> blocked
~~~

Invariants:

- No project-save or library-draft decision is reachable from preflight, choosing, or
  preparation-failed.
- No-op targets do not enter commit-preflight or either replacement decision.
- Commit-preflight must pass immediately before replacement decisions.
- Save decision Cancel, Save As cancellation, overwrite decline, or save failure enters
  blocked and leaves the current project session intact.
- Only committing may stop runtimes, close project-owned editors, increment the project
  session, clear pending import state, and publish project-loaded.

## Replacement Decision

The outcome of the current-project confirmation stage:

- save: continue only after a successful existing-path save or Save As write.
- discard: continue without writing the current project.
- cancel: stop without installing the candidate.
- blocked: an attempted save did not complete successfully.

Library-draft resolution is a related decision in the same accepted-target boundary.
Its result must also be successful before committing.

## Current Project Session

Existing canonical main-process state:

- currentData: the active BlueData document.
- currentFilePath: native host path or null for an unsaved project.
- currentProjectSessionId: lifecycle identity used by renderer snapshots and pending
  MIDI imports.
- project-owned editor/runtime state: transient windows and Java/engine sessions tied
  to currentData.
- renderer dirty snapshot: a derived renderer view; the existing coarse main-process
  save-prompt eligibility remains unchanged by this feature.

## Relationships

- A Replacement Flow prepares at most one Prepared Replacement Candidate.
- A Candidate is compared with the Current Project Session only for project-file
  same-file no-op behavior.
- A successful Candidate commit replaces the Current Project Session and invalidates
  pending MIDI state through the existing session lifecycle.
- Library drafts are related state owned by UnifiedLibraryService, not part of .blue.
