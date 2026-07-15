# Contract: Project Transfer And Library Item Editor Sessions

## Purpose

Define how Unified Libraries composes current-project definitions with app-owned user items, resolves stable identities, validates insertion targets, performs copies, hosts full editors, handles conflicts, and migrates workbench state. Nothing in this contract moves project ownership into SQLite or changes `.blue` XML.

## Scope Composition

| Type | Project scope | User scope | Target behavior |
|------|---------------|------------|-----------------|
| Instrument | Project Orchestra (`projectOwned`) | Instrument Library | Fixed current-project Orchestra target |
| UDO | Project UDO list (`projectOwned`) | UDO Library | Fixed current-project UDO target |
| SoundObject | Project Shared SoundObjects (`projectShared`) | SoundObject Library | Explicit Score path/layer/time target |
| Effect | none | Effect Library | Explicit channel/chain/position target banner only |

Rules:

- The Libraries panel displays only meaningful scopes for the active type.
- A target never appears as a browsable/persisted project library.
- No project means project scopes are absent and insertion targets/actions are unavailable, while user browse/edit/import/export/recovery remains available.
- User-item edits affect future insertions only. Previously inserted independent copies are untracked and unchanged.

## Project Adapter Contract

The main-owned adapter is the sole bridge from Unified Libraries to canonical `BlueData`.

```ts
interface UnifiedLibraryProjectAdapter {
  listSourceChildren(request: ProjectBrowseRequest): ProjectBrowseResult;
  resolveItem(key: ProjectLibraryItemKey): ResolvedProjectLibraryItem;
  previewInsertion(request: LibraryInsertionRequest): LibraryInsertionPreview;
  applyInsertion(request: ConfirmedLibraryInsertionRequest): ProjectMutationReceipt;
  saveEditorDraft(request: ProjectEditorSaveRequest): ProjectMutationReceipt;
  previewDelete(key: ProjectLibraryItemKey): ProjectDeletePreview;
  deleteItem(request: ConfirmedProjectDeleteRequest): ProjectMutationReceipt;
  getUsage(key: ProjectLibraryItemKey): CurrentProjectUsageSnapshot;
}
```

Every method validates the expected `projectSessionId`. Mutating methods use the same canonical project revision/dirty/broadcast path as normal project-document patches. A successful change increments revision, refreshes the shared project snapshot, and participates in the existing save lifecycle.

## Stable Project Locators

### Instruments

```ts
interface InstrumentProjectLocator {
  kind: 'instrument';
  assignmentId: string;
}
```

The assignment ID is the project identity. Reordering the arrangement does not change it. Removal produces missing state; an index is never stored as identity.

### Project UDOs

```ts
interface ProjectUdoLocator {
  kind: 'udo';
  sessionObjectId: string;
  persistedFingerprint: {
    canonicalHash: string;
    opcodeName: string;
    style: 'CLASSIC' | 'MODERN';
  };
}
```

- Main assigns `sessionObjectId` to the canonical `OpcodeDefinition` object while a project is loaded; moves retain it.
- Saved Dockview parameters also carry the fingerprint, never a bare index.
- After restart, restore searches the loaded project for a unique canonical match. Exactly one match binds and receives a new session ID; zero yields missing; multiple yields ambiguous. Missing/ambiguous is read-only and never selects the occupant of the old index.
- After a successful edit/project save, the editor/layout locator updates its fingerprint.

### Project Shared SoundObjects

```ts
interface SharedSoundObjectLocator {
  kind: 'soundObject';
  libraryId: string;
  persistedFingerprint: {
    canonicalHash: string;
    displayName: string;
    objectType: string;
  };
}
```

The implementation must first make `libraryId` a stable project object-reference identity: `SoundObjectLibrary` retains loaded `objRefId` values, assigns a stable Java-compatible ID to new shared definitions, and seeds those IDs into `ObjRefSaveMap` so save/reorder does not renumber them. This reuses the existing Java field and adds no new project XML schema. Restore accepts an ID only when its fingerprint also matches. If a legacy/mismatched ID has exactly one fingerprint candidate, it may recover that definition; otherwise the editor is missing/ambiguous. All `Instance` nodes linked to the resolved ID contribute to usage and deletion consequences.

## Insertion Target Contract

An insertion request is enabled only when all target invariants are true at preview and apply time.

### Instrument target

- Requires an open project and current project session.
- Destination is Project Orchestra.
- Preview computes dependencies and proposed non-colliding assignment identity.

### UDO target

- Requires an open project and current project session.
- Destination is the project UDO list; optional insertion index must still be in range.
- Same-name project UDOs are preserved.

### Effect target

```ts
interface EffectInsertionTarget {
  projectSessionId: number;
  channelId: string;
  chain: 'pre' | 'post';
  insertIndex: number;
  targetRevision: string;
}
```

The channel, chain, and insertion boundary must still exist at apply. Opening Libraries from a chain sets this target and displays it as a banner. Selecting another type may retain but not apply the incompatible target; project/chain change marks it stale until explicitly reset.

### SoundObject target

```ts
interface SoundObjectInsertionTarget {
  projectSessionId: number;
  rootGroupId: string;
  containerPath: Array<{ layerId: string; objectIdentity: string }>;
  layerId: string;
  startTime: number;
  targetRevision: string;
}
```

The full Score destination is explicit. Main resolves the same group/container/layer and current time context before mutation. There is no fallback to the selected layer, root layer, zero time, or neighboring object after a stale target.

## Transfer Matrix

### User Instrument → Project Orchestra

1. Ensure whole payload is supported and valid.
2. Resolve/disclose dependencies.
3. Deep-copy the Instrument including owned interface/local UDO data.
4. Clear project automation bindings as required by the copied type.
5. Allocate a non-colliding assignment identity.
6. Add without overwriting any assignment and commit once.

### User UDO → Project UDO list

1. Ensure whole payload is supported and valid.
2. Create an independent `OpcodeDefinition` copy.
3. Insert at the requested/default position.
4. Keep every existing same-name UDO unchanged.
5. Commit once.

### User Effect → Mixer chain

1. Revalidate channel/chain/index and project session.
2. Ensure whole payload and dependencies are supported.
3. Deep-copy, detach/reset automation/library binding, and force the new chain entry enabled according to native behavior.
4. Allocate a new project chain-entry identity.
5. Insert at the exact position and commit once.

### User SoundObject → Score

1. Revalidate explicit Score path/layer/time and destination time context.
2. Ensure whole object graph is supported; disclose external assets/dependencies.
3. Deep-copy into an independent project object.
4. Convert portable beat duration/time behavior to the destination project context without changing intended musical duration.
5. Allocate project-appropriate identity, insert once, and commit once.

### Project Shared SoundObject → Score

- `Copy Instance`: create an `Instance` referencing the same `libraryId`; editor preview discloses shared behavior.
- `Copy Independent`: deep-copy the resolved definition into the Score with no shared link.
- Neither choice is implicit; UI presents consequences before apply.

### Project object → User library

- Explicit Save as User Library Copy creates a new UUID and a complete independent payload.
- Project ownership and original identity remain unchanged.
- Instrument/UDO/SoundObject only; Effect instances are not a project source scope.
- Project Shared `Instance` wrappers are not portable as general user items; resolve/copy the definition only through an explicit supported action.

### Dependency failure

Unresolved external project-level dependencies or conflicts block insertion before mutation. The receipt is failure with a report; no hidden dependency, unrelated collection, or partial destination is added.

## Project Shared SoundObject Usage And Delete

Usage is calculated by traversing the current project's score graph for `Instance` references to the shared `libraryId`.

Editor consequence text includes the current linked-instance count. Saving the definition updates every linked instance by shared reference and marks the project dirty.

Delete protocol:

1. Re-resolve the shared definition and linked instances.
2. Return affected counts/locations and a revision-bound confirmation token.
3. If the editor session is dirty, resolve Save/Discard/Cancel first.
4. On confirmation, remove the shared definition and every linked project instance according to the native rule in one canonical project mutation.
5. Notify/finalize the editor as closed. If another surface deletes first, retain a read-only missing editor with any unsaved draft; never rebind it.

## Editor Session Identity

```ts
type LogicalEditorItemKey =
  | `user:${LibraryType}:${nodeId}`
  | `project:${projectSessionId}:${LibraryType}:${stableLocatorKey}`;
```

Main maintains one active `sessionId` per logical key. Any entry point—tree double-click, Edit command, menu, existing type-specific surface—gets/focuses that session. Concurrent windows do not get independent drafts for the same item.

## Dockview Panel Contract

### Static panel

- ID: `LibrariesTopComponent`
- Title: `Libraries`
- Mode/group: `properties` / `properties-main`
- Default edge: right
- Default reset location: right auxiliary group
- Normal startup: follows saved layout; not forced open after intentional close

### Dynamic editor panels

- Dockview component key: `libraryItemEditor`
- Runtime panel ID: derived from editor `sessionId`, not item name/index
- Persisted parameters: item scope/type plus stable user/project locator and pin state; never payload or draft XML
- Title: current display name with type/scope cue and dirty marker
- Unknown/missing restore: render controlled missing/ambiguous state rather than an arbitrary neighbor

### Preview/pin behavior

- At most one clean unpinned Library Item preview panel is the reusable preview slot.
- Opening a different item may replace only that slot.
- Editing sends a main patch, makes the session dirty, and automatically pins the panel.
- Explicit pinning prevents replacement while clean.
- Dirty or pinned panels are never replaced by selection.
- Opening an already represented logical item focuses its existing panel.
- Closing/collapsing/floating Libraries does not close or alter editor sessions.

## Editor Shell Contract

Every Library Item editor shell displays:

- name, object type, scope, breadcrumb, stable missing/conflict status, and dirty/pin state;
- Save and Revert;
- applicable Duplicate/Move/Delete and insertion/copy actions;
- dependency summary;
- current-project usage, with independent historical copies labeled untracked;
- save consequence text:
  - user: affects future insertions only and persists independently;
  - project-owned: mutates current project and requires project Save;
  - project-shared: mutates every linked instance and shows count.

The shell hosts controlled existing type bodies:

- Instrument: interface/code/local UDOs/properties;
- UDO: signature/code/style/documentation/validation;
- Effect: interface/code/I/O configuration and current testing capability;
- SoundObject: existing type-specific editor plus copy/reference controls.

The renderer body receives a session snapshot and emits guarded type-specific patch commands. It does not directly own a mutable `@blue/data` instance or persist XML.

## Save, Revert, Conflict, And Missing Rules

### Save

1. Resolve logical item and expected project/store session.
2. Compare current revision/hash with base.
3. If unchanged, validate the complete draft and commit atomically.
4. If changed, return conflict and latest summary. Choices:
   - Reload Latest: discard draft only after explicit selection and reset base;
   - Cancel: retain draft unchanged;
   - Reviewed Overwrite: require current conflict token and explicit confirmation.
5. On success update title/breadcrumb/revision/metadata, clear dirty, and leave explicit pin state unchanged.

Validation failure leaves both last valid saved content and the user's draft intact.

### Revert

- Clean: reload current saved version directly.
- Dirty: prepare confirmation; Cancel keeps draft, Confirm discards it and reloads the current saved version.
- A newer source may make confirmed Revert load latest; this consequence is included in preview.

### Rename/move

Stable identity remains unchanged. All panels/breadcrumbs update from a change event. Invalid names preserve prior saved/draft name, keep inline edit active, and identify the field.

### Delete

- Dirty session: Save/Discard/Cancel first.
- Confirmed delete from its own session: commit, close that session/panel.
- Delete from another surface: session becomes read-only missing; an unsaved draft remains available for review/copy but cannot Save over a missing identity without an explicit new-copy action.

### Close/quit/project lifecycle

- Closing a clean editor closes immediately.
- Closing a dirty editor requires Save, Discard, or Cancel.
- Quit and project close/switch aggregate affected dirty sessions. Save validates/commits each; Discard is explicit; Cancel stops the outer operation.
- User-library dirty sessions may remain open across project close only when they have no project-bound dependency/usage context that makes continuation unsafe; otherwise they participate in the guard.

## Contextual Entry Point Contract

- Orchestra Browse: reveal Libraries, select Instruments, set fixed Project Orchestra target.
- Project UDO Browse: reveal Libraries, select UDOs, set fixed project UDO target.
- Mixer chain Browse/Add from Library: reveal Libraries, select Effects, set exact channel/chain/index target. Remove embedded category submenus after migration.
- Score Browse/Add from Library: reveal Libraries, select SoundObjects, set explicit current Score path/layer/time target.
- Tools/legacy Effects Library action: reveal Libraries filtered to Effects with no fabricated target.
- Window menu Libraries action: reveal/focus existing panel wherever docked/minimized/slide-out/maximized/floating; never duplicate it.

## Workbench/Layout Migration

The stored workbench envelope version is incremented. Migration rewrites `SoundObjectLibraryTopComponent` to `LibrariesTopComponent` in:

- Dockview panel IDs, active panel IDs, and panel parameters;
- auxiliary seeded/docked/minimized/slide-out lists;
- active auxiliary IDs;
- floating-origin metadata;
- closed-panel origin metadata.

If both legacy and new IDs exist, keep one logical new panel at the most recently active/explicit placement and discard the duplicate descriptor without losing unrelated layout state.

Legacy `open-effects-library` commands route to the new panel. Legacy split keys `effects-library.main` and `orchestra.library` remain parseable for settings downgrade/migration safety but no longer create separate permanent library UI. Dynamic editor restoration uses stable parameters and safe missing states.

## No-Project Workbench Contract

- `WorkbenchShell` remains mounted for the app lifetime.
- The standalone Welcome screen covers the full main surface when there is no project; it is not a Dockview panel.
- Explicitly opening Libraries or another workbench panel dismisses Welcome and reveals the no-project workbench.
- Project-only panels render their existing disabled/empty state or are hidden according to existing rules; they do not block Libraries.
- User browse/search/edit/import/export/history/recovery works normally.
- Project scopes, usage claims, and insertion actions are absent/disabled.
- Opening or closing a project changes composition and target state without remounting/losing user editor sessions.

## Verification Matrix

Tests must prove:

- each locator survives reordering and never falls back to a stale index;
- Project Shared SoundObject IDs survive save/reopen/reorder, legacy ID fallback binds only a unique fingerprint, and ambiguity is safe;
- stale project sessions/Effect chains/Score paths reject with zero mutation;
- all four insertion outcomes match independent/shared semantics and remain valid without the user database after project save/reopen;
- shared usage/edit/delete counts and effects are correct;
- duplicate entry points focus one session;
- 100 preview/pin/close/open changes never replace dirty or pinned drafts;
- validation/conflict/revert/quit/project-switch decisions never silently discard or overwrite;
- external rename/move/delete updates breadcrumb or enters missing state by identity;
- no-project user operations work;
- every saved legacy layout shape converges on one Libraries panel and preserves unrelated panels/groups/windows.
