# Contract: Factory Example Update Merge

**Feature**: [Factory Example Content](../spec.md)

## Inputs

The pure merge planner receives:

1. The validated accepted baselines from `state.json`.
2. A non-following snapshot of current user entries under `current/content/`.
3. The validated installed `FactoryManifest`.

All keys are `PortableExamplePath` values. The planner performs no filesystem writes.

## Required Merge Matrix

| Accepted baseline | Current user entry | Installed factory entry | Action | Next baseline |
|---|---|---|---|---|
| absent | absent | file | Add factory file | Installed file, present |
| absent | any entry | file | Preserve collision; report | Installed file, present |
| file A | regular file A | file A | Keep unchanged | File A, present |
| file A | regular file A | file B | Replace untouched user file with B | File B, present |
| file A | regular file X | file A/B | Preserve user-modified file; report if factory changed | Installed file, present |
| file A | missing | file A/B | Preserve user deletion; report while factory is present | Installed file, present |
| file A | directory/symlink/other | file A/B | Preserve path-type collision; report | Installed file, present |
| file A | any/missing | absent | Preserve user entry/deletion; never remove | File A, absent tombstone |
| tombstone A | regular file A | file B | Replace with B (user retained old factory bytes unchanged) | File B, present |
| tombstone A | regular file X | file B | Preserve user-modified retained file; report | File B, present |
| tombstone A | missing | file B | Preserve prior user deletion; report | File B, present |
| absent | user-only entry | absent | Preserve user-only entry/tree | No baseline |

`X` means content or entry type that does not match the accepted baseline. A missing baseline file is
always treated as a user deletion, even if the installed factory still contains identical bytes.

## Directory and Ancestor Collisions

- Factory manifests contain regular files; directories are implied by paths.
- If a user file/symlink/other entry occupies a factory directory ancestor, preserve that user entry
  and classify every blocked factory descendant as a collision.
- If a user directory occupies a factory file path, preserve the directory and classify the path as
  a collision.
- Never follow a user symlink to classify or overwrite its target.
- Conflict reporting is path-sorted and deterministic; UI may show a bounded prefix plus total count.

## Candidate Construction

1. Snapshot current user content and calculate `sourceUserRevision`.
2. Copy the complete current user tree to the candidate with symlinks preserved, not dereferenced.
3. Apply only `add-factory` and `replace-untouched` actions to the candidate.
4. Write the next `state.json` into the candidate.
5. Verify every candidate path expected to match installed factory bytes and validate the next state.
6. Immediately before activation, resnapshot current user content and require the same
   `sourceUserRevision`; mismatch aborts without swapping generations.

If copying a user-created entry is unsupported on the host (for example a symlink privilege error),
candidate preparation fails safely and the current generation remains canonical.

## Output and Prompt Suppression

After successful activation:

- `acceptedFactoryRevision = installedFactoryRevision`.
- `declinedFactoryRevision = null`.
- Present baselines exactly describe the installed manifest.
- Removed baselines remain as `factoryPresent: false` tombstones.
- Preserved modified/deleted/collision paths remain distinguishable by comparing live user entries
  with the new baseline.

Keep Current does not invoke the merge planner. It atomically stores
`declinedFactoryRevision = installedFactoryRevision`; the same installed revision is then opened
without another update prompt.

## Failure Contract

- Planning errors perform no writes.
- Candidate preparation errors remove only the validated owned staging generation.
- Source snapshot mismatch aborts activation and asks the user to retry.
- Activation/recovery follows [the lifecycle contract](example-library-lifecycle.md); a partial copy
  or ambiguous state is never returned as a ready library.
