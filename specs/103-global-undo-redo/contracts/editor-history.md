# Editor, Menu and Visual Update Contract

## History scope

Every editable surface declares `project`, `draft`, or `none` and a stable field/view identity. Project scope routes committed text and canvas actions to the same chronological project history. Draft/search scope keeps local undo and consumes an unavailable local Undo without falling through. Read-only generated content has no committed history.

For project CodeMirror fields, replace history-bearing basic setup with equivalent editing extensions excluding local history/keymap ownership; preserve completion, syntax, IME, selection and popout tooltips. Draft editors retain existing local history. Canonical updates are explicitly non-user/non-history transactions with echo suppression and mapped/clamped selection. A draft Apply sends one transaction; Cancel sends none.

Text areas and inputs participating in project history (e.g. instrument comments, project properties) MUST declare `data-history-scope="project"` so keyboard shortcuts and application menus route to global history rather than uncoordinated native undo. Such inputs MUST maintain local synchronous state to ensure rapid keystrokes are never lost during asynchronous IPC rounds or snapshot refreshes. Text edits MUST be batched by operation kind: consecutive character insertions are grouped together; switching to deletion closes the insertion batch and starts a deletion batch; mutations (paste/replacement) form atomic batches; whitespace/newlines and pauses over 500 ms close the active batch. Editor blur, save, or boundary settlement flushes pending text with `phase: 'end'` so undo reverses text word-by-word or by logical editing gesture rather than character-by-character.

## Command routing

Replace native undo/redo roles with application command items. Native menu accelerators own physical shortcuts; remove competing project/history keybindings. Dispatch to focused registered webContents, then resolve scope against actual host document and focused editable. Dockview's shared realm requires host-aware focus registration, not main `document.activeElement`. Draft CodeMirror invokes local commands; native input invokes focused webContents native undo/redo without recursively dispatching the application command. Menu and context-menu use the same router.

macOS: Cmd+Z / Cmd+Shift+Z. Windows/Linux: Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z. Any fallback key handler is enabled only where menu accelerator ownership is disabled and tested; do not install both owners for one physical gesture. Focus and available labels update main menus. Project history empty does not disable a draft's local history.

## Canonical projection

Split load/reset from refresh in the project store. Refresh receives documentId, revision and authoritative dirty/history state. Accept only current-document newer revisions; acknowledge own operation replies without replaying their optimistic patch twice. Pending local intent remains an explicit overlay/draft until acknowledgement; when an older canonical snapshot arrives, reconcile against its acknowledged sequence rather than overwriting newer local input.

Dedicated effect windows must resolve and refresh the edited effect, not just UDO context. Track editor stale requests become bounded precondition-aware resolution, not indefinite retry. Deleted targets become unavailable; restoration can refresh an existing surviving view but never forces reopening. Closed-origin view hints are ignored.

Selection hints identify stable objects or text ranges and are excluded from XML. Restore/reveal in an existing origin view without focus theft; reconcile invalid selections elsewhere. Draft conflict UI offers retaining/discarding the draft or explicitly applying against current content; nothing auto-submits over a changed target.

## Presentation

Do not mount persistent history-usage or runtime-status strips, or show routine restart-required toasts (manual-testing feedback, 2026-09-09). Retain history/runtime metadata and genuine error toasts; recovery uses existing playback and Blue Live controls. Use approved `text-role-*`/`--text-role-*`, Tailwind utilities and `cn()` caller-last composition. No new raw sizes or global BEM blocks. Panel dialogs and menus use host portals and realm-safe containment per `docs/popout-popup-conventions.md`. History-reset confirmations use destructive intent and initial Cancel focus; native host decisions continue through the native confirmation wrapper.

## Acceptance mapping

US2: two open views, pending edits, restored selection, dirty checkpoint, draft conflict.
US4: committed typing+score chronology, composition grouping, local draft isolation, all shortcuts, no replay echo.
US5: editor closure, retention limits and oversize confirmation, session replacement isolation.

Extend existing store/IPC/editor-window tests and two-document popup harnesses, add a cross-domain browser scenario, then validate native accelerators and IME in actual Electron windows on all platforms. Browser-only tests cannot prove Electron menu ownership.
