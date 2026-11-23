# Maintainer documentation

Use this index when changing Blue. Start with the repository's [agent guidance](../AGENTS.md),
[constitution](../.specify/memory/constitution.md), and [licensing rules](../LICENSING.md).

| When changing                                                                  | Read                                                                                                             |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Workspace tooling, builds, lint, formatting, or test commands                  | [Build from source](../README.md#build-from-source) and [contributing](../README.md#contributing)                |
| Module boundaries, project ownership, history, IPC, or asynchronous lifecycles | [Modularization and ownership](modularization.md)                                                                |
| Renderer typography, color, or contrast                                        | [Typography](typography.md), [color accessibility](color-accessibility.md), and [design guidance](../DESIGN.md)  |
| Confirmation decisions or workbench popups                                     | [Confirmation dialogs](confirmation-dialogs.md) and [popout popup conventions](popout-popup-conventions.md)      |
| Workbench trees or drag and drop                                               | [Tree drag and drop](tree-drag-and-drop.md)                                                                      |
| Audio previews or BlueX7 generation                                            | [Waveform handling](waveform-data-handling.md) and [BlueX7 rendering](blue-x7-modern-renderer.md)                |
| Performance tests or acceptance evidence                                       | [Performance testing](performance-testing.md)                                                                    |
| Changelog entries and release notes                                            | [Maintaining the changelog](changelog.md)                                                                        |
| Hosted documentation, editions, or Pages deployment                            | [Documentation site](site/README.md)                                                                             |
| Packaging, release, or dependency licensing                                    | [Release guide](release-guide.md) and [production dependency license inventory](dependency-license-inventory.md) |

Keep this directory focused on standing rules, current subsystem contracts, and
repeatable procedures. State who owns the behavior, what contributors must
preserve, and how to verify a change. Update the relevant guide, links, and
machine-readable inventories when their contracts change.

Put feature plans, research, and acceptance evidence in the owning
`specs/<feature>/` directory. Preserve implementation history in Git.
The [bundled user manual](manual/README.md) has its own Quarto build and license
and lives together under `docs/manual/`.
