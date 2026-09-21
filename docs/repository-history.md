# Blue Repository History

This repository contains the current Blue 3 TypeScript/Electron line and the
preserved history of the original Java/NetBeans application.

## Repository transition

Blue 3 became the active repository line without a merge commit. The two
projects have separate Git histories; this transition does not imply code
integration between them.

Before publication in this repository, the generated
`packages/blue-app/assets/java/blue-java.jar` artifact was removed from Blue 3
history. Commits containing or descending from that artifact therefore have
different hashes here than in the source repository. Their remaining source
history is preserved; the legacy Java history and its hashes are unchanged.

At the cutover, `main` and `develop` intentionally pointed to the same Blue 3
prerelease commit. The `v3.0.0-beta.1` tag marks that cutover in this
repository. Repository-maintenance commits may advance both branch heads
together before future stable releases move `main` independently.

## Cutover refs

| Role at cutover                   | Ref                       | Commit                                     | Description                      |
| --------------------------------- | ------------------------- | ------------------------------------------ | -------------------------------- |
| Blue 3 release/default line       | `main`                    | `e2e7feed67f645f9b1e7ca74e566218b79858273` | Blue 3 `v3.0.0-beta.1`           |
| Blue 3 development line           | `develop`                 | `e2e7feed67f645f9b1e7ca74e566218b79858273` | Blue 3 `v3.0.0-beta.1`           |
| Preserved legacy development line | `legacy/blue-2.x`         | `3ca3f40579c48a023299a68130d8ab6b9e950974` | Final legacy `develop` tip       |
| Preserved legacy release line     | `legacy/blue-2.x-release` | `1c3d664dd4c7f7292596c5292627c8e8b2bcb510` | Legacy `master` tip and `2.10.3` |

The public branch name `master` is not retained. Its legacy release history is
preserved by `legacy/blue-2.x-release` and the existing `2.10.3` tag.

## Tags

Legacy release tags remain unchanged. The Blue 3 tag names are preserved,
including `v0.0.1`, `v0.0.2`, and `v3.0.0-beta.1`; their target commits are
history-filtered and may have different hashes than in the source repository.

The `v0.0.2` tag remains an immutable reference to the pre-cutover Blue 3
`main` tip; the new `main` branch begins at `v3.0.0-beta.1`.

## Working with the legacy line

Java parity work should use the source under
[`legacy/blue-2.x`](https://github.com/kunstmusik/blue/tree/legacy/blue-2.x),
including `blue-core` and `blue-ui-core`. Historical specifications may retain
links to the former `blue-electron-poc` repository when those links document
past pull requests, builds, or release evidence.
