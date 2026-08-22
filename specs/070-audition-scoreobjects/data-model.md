# Data Model: Audition Selected ScoreObjects

## AuditionSelectionRequest

Transient renderer-to-main request for one audition command.

| Field | Meaning | Validation |
|---|---|---|
| `objectIds` | Stable score-item IDs currently selected in the renderer | Non-empty array of distinct, non-blank strings; every ID must resolve exactly once in the canonical open project. |

The request is not persisted. IDs identify timeline score objects and Track audio clips only; library and Blue Live selections are not eligible.

## AuditionMenuState

Transient renderer-to-main menu availability state.

| Field | Meaning | Validation |
|---|---|---|
| `canAudition` | Whether the renderer has one or more eligible selected score items | `true` only for a non-empty eligible timeline selection. Main additionally applies loaded-project and render-operation constraints. |

This state never becomes project XML or program settings and is cleared when the project closes.

## AuditionProjectCopy

Disposable `BlueData` deep copy generated from canonical project data for a single audition.

| Property | Required audition behavior |
|---|---|
| Score content | Retain selected score items only; remove empty layers, Tracks, and root groups; remove non-score content. |
| Conventional layers and Tracks | Clear mute and solo on retained containers so selected content can generate. |
| Track contents | Preserve selected sound objects and audio clips plus their owning Track’s instrument, automation, and routing context. |
| Render window | Minimum selected start to maximum selected end, with enabled mixer extra render time added to the end. |
| Loop setting | Always disabled. |
| Ownership | Main-process disposable data only; never assigned to canonical current project state. |

## AuditionResult

Transient IPC result of an audition request.

| Outcome | Meaning |
|---|---|
| Started | A valid selected-only CSD was submitted to the existing realtime playback lifecycle. |
| Rejected | There was no project, selection, valid selected score item, or realtime availability; no engine session was started. |
| Failed | Score generation or engine startup failed; existing playback error/status reporting is used and canonical data remains unchanged. |

## Relationships

```text
Renderer selection IDs
        │
        ▼
AuditionSelectionRequest ──validate──► canonical BlueData
                                             │
                                             ▼
                                      AuditionProjectCopy
                                             │
                                             ▼
                                    existing realtime lifecycle
```
