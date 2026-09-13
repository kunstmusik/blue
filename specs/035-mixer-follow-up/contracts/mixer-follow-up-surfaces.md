# Contract: Mixer Follow-Up Surfaces

## Purpose

Define the follow-up boundaries for routing validation, advanced chain editing, and no-save library workflow polish.

## 1. Routing Validation Contract

Routing validation may be implemented as a pure helper in `@blue/data` or shared app code, but it must accept only serializable mixer inputs and return serializable issues.

```ts
function validateMixerRouting(mixer: MixerSnapshot): MixerRoutingValidationResult;
```

Consumers:

- channel output dropdowns
- send target editors
- paste and move operations

Rules:

- hard-invalid destinations are rejected before patch submission when possible
- warnings can still allow the user to proceed if the design intentionally permits it

## 2. Advanced Chain Editing Contract

Spec 034's mixer patch surface is extended with follow-up chain operations.

```ts
interface ProjectDocumentPatch {
  mixer?: MixerPatch | MixerFollowUpPatch;
}
```

Clipboard and drag payloads remain renderer-owned until converted into an explicit patch.

## 3. Effects Library Workflow Contract

The existing effects-library session gains explicit workspace commands.

```ts
window.blueAPI.reloadEffectsLibrary(): Promise<EffectsLibraryWorkspaceSnapshot>
window.blueAPI.updateEffectsLibrary(patch: EffectsLibraryPatch): Promise<EffectsLibraryWorkspaceSnapshot>
window.blueAPI.importEffectFile(): Promise<EffectsLibraryWorkspaceSnapshot>
window.blueAPI.exportEffectFile(libraryEffectId: string): Promise<void>
```

Rules:

- `importEffectFile()` and `exportEffectFile(...)` are explicit file operations only.
- No command writes session mutations back to `~/.blue`.
- Reload discards session-local changes after an explicit user confirmation path.

## 4. Existing Window Ownership Boundary

Spec 035 adds no playback-aware status, effect-window focus, shortcut, or
missing-owner behavior. Existing one-window-per-owner behavior from Spec 034
remains a compatibility invariant for the retained library workflow. Later
window and editor specifications own any new behavior in that area.
