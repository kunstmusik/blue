# Contract: Example Library State and Paths

**Feature**: [Factory Example Content](../spec.md)

## Ownership

Electron main owns this contract. The durable root is derived from
`app.getPath('userData')` and is not configurable in this feature:

```text
<userData>/examples/current/content/
<userData>/examples/current/state.json
<userData>/examples/operation.json              # transient
<userData>/examples/staging-<operation-id>/      # transient, Blue-owned
<userData>/examples/backup-<operation-id>/       # transient, Blue-owned
```

The renderer, preload, `.blue` XML, program settings, recent-project identity, and engine protocol
do not own or persist any field in this contract.

## `state.json` Version 1

Illustrative shape (hashes abbreviated only in this document):

```json
{
  "schemaVersion": 1,
  "acceptedFactoryRevision": "sha256:abc123...",
  "declinedFactoryRevision": null,
  "baselines": [
    {
      "relativePath": "techniques/pvoc2.blue",
      "factorySha256": "def456...",
      "factorySize": 12345,
      "factoryPresent": true
    },
    {
      "relativePath": "legacy/removed-example.blue",
      "factorySha256": "987fed...",
      "factorySize": 4321,
      "factoryPresent": false
    }
  ],
  "lastCompletedAt": "2026-08-26T00:00:00.000Z"
}
```

Required validation:

1. Reject unknown schema versions, malformed hashes, duplicate paths, unsorted paths, invalid
   sizes, absolute paths, empty segments, `.`/`..`, backslashes, and NUL characters.
2. Recompute `acceptedFactoryRevision` from `factoryPresent: true` baselines and require equality.
3. Treat an unreadable/malformed state beside an existing `content/` directory as
   `invalid-user-library`; do not seed defaults or overwrite the directory.
4. Normalize `declinedFactoryRevision` to `null` when it equals the accepted revision on the next
   successful state write.
5. Bound persisted diagnostics and conflict lists; state contains provenance, not an unbounded log.

## Portable Path Boundary

- Native absolute paths are used unchanged for `fs`, `path`, picker, and project-loading calls.
- Manifest/state identity uses a validated relative path with `/` separators.
- Conversion to portable text occurs only after traversal below a known native root.
- Conversion back to native form splits the validated portable path into segments and joins those
  segments below the known root.
- Existing files selected by the picker are realpath-checked to remain within the candidate/current
  content root. Lexical containment alone is insufficient for symlink escapes.
- Windows identity folds case and accepts equivalent slash forms only for host identity/collision
  checks; serialized factory path spelling remains the packaged spelling.

## Write Contract

JSON sidecars use this sequence:

1. Create the parent directory if and only if it is below the resolved example-library root.
2. Write to a uniquely named sibling temporary file with user-only permissions where supported.
3. Flush the file, close it, and rename it over the target.
4. Best-effort flush the parent directory; platforms/filesystems that reject directory fsync remain
   supported.

Any failure returns a typed error and leaves the previous valid target in place. Temporary sidecars
are Blue-owned derived state and may be cleaned on the next `Open Example` after exact validation.

## Compatibility

- No migration of `.blue` files occurs.
- Version-1 code encountering an unknown future state version preserves the content and blocks
  mutation with an actionable diagnostic.
- A pre-feature or manually-created `content/` tree without valid provenance is preserved but is
  not silently adopted or overwritten.
