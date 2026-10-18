# Feature Specification: BlueShare 3.0 Parity

**Feature Branch**: `codex/117-blueshare-parity`

**Created**: 2026-10-16

**Status**: Closed — 2026-10-18. The owner accepted stay-signed-in behavior in testing and
explicitly waived Windows/Linux acceptance for feature closure. macOS, implemented-service and
regression evidence is recorded in [quickstart.md](quickstart.md); unrun platforms are unverified,
not passing. The scoped validation exception is recorded in [plan.md](plan.md).

**Input**: Examine historical Java BlueShare first, then the current blue-site JSON
service. Deliver general UI/workflow parity for Blue 3.0 and consider interface redesign
later. Use blue3.kunstmusik.com for current production data; blue.kunstmusik.com will
later target that site. Recheck the implemented service endpoints, update this specification,
and proceed with desktop planning/design when the service contract is ready.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover and import resources (Priority: P1)

A composer opens Tools → Blue Share, chooses Instruments, Effects, or SoundObjects,
browses categories or recent submissions, reads details, and imports a resource into the
corresponding local user library without changing the open composition.

**Why this priority**: Reusing community resources is BlueShare's central value and does
not require an account.

**Independent Test**: Browse and import one supported resource of each kind from a
controlled catalog; verify immediate visibility, persistence after restart, preserved
content, and an unchanged active project.

**Acceptance Scenarios**:

1. **Given** a reachable catalog, **When** Blue Share opens, **Then** Instruments, Effects,
   and SoundObjects each offer Import, Export, and Manage tabs. Import presents the familiar
   category tree, resource list, details area, and import action.
2. **Given** a selected kind, **When** a category or Latest is chosen, **Then** its resources
   or up to ten newest available resources of that kind appear. The complete category list
   remains reachable when larger than one page; an empty result is explicitly identified.
3. **Given** a selected resource, **When** its details appear, **Then** the user can read its
   name, submitting author, category, description, and type where applicable, including
   descriptions with significant line breaks.
4. **Given** supported content, **When** import succeeds, **Then** exactly one independent
   copy is durably added to the matching user library, appears without reopening the library,
   and survives restart. Existing items and active project content/dirty/history state are
   unchanged.
5. **Given** invalid, unsupported, incomplete, or unavailable content, **When** import is
   attempted, **Then** a resource-specific diagnostic explains recovery and no partial item
   or change to existing library/project content occurs.

---

### User Story 2 - Publish a library resource (Priority: P2)

A contributor signs in, selects a resource from their local user library, chooses a
remote category, reviews the description, and submits it to the community catalog.

**Why this priority**: Publishing replenishes the catalog and is required for the 3.0
parity release, following Java's working Export flow.

**Independent Test**: In an isolated service environment, publish one resource of each
kind and retrieve it as another user. Compare supported content and unchanged local sources.

**Acceptance Scenarios**:

1. **Given** a local user library, **When** Export opens for a kind, **Then** the user can
   select a resource of that kind, choose a real remote category, and review/edit its public
   description separately from the local resource.
2. **Given** valid sign-in and a complete submission, **When** submission succeeds,
   **Then** the new submission is identified and appears publicly and in Manage after refresh.
3. **Given** missing/invalid fields, expired sign-in, rejected content, or request failure,
   **When** submission is attempted, **Then** actionable feedback appears, the draft is retained,
   and no false success is shown. Repeated clicks while pending do not create duplicates.
4. **Given** connection loss with an uncertain result, **When** the user returns to the
   operation, **Then** uncertainty is explained and they can check My submissions before retrying.

---

### User Story 3 - Manage personal submissions (Priority: P2)

A contributor opens Manage, fetches their submissions for the selected kind, and removes
an obsolete submission after confirming the exact item.

**Why this priority**: Fetch and Remove are the working Java management actions and give
contributors control over their content. Both are required for 3.0 parity.

**Independent Test**: Prepare two accounts' submissions. Fetch/remove as an owner; verify
that another account cannot remove them and previously imported local copies survive.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** Manage results are fetched, **Then** only their
   available submissions of the selected kind appear, with an explicit empty state and
   access to the complete list when it exceeds one page.
2. **Given** a selected owned submission, **When** removal is confirmed and succeeds,
   **Then** it disappears from refreshed Manage/public lists and is unavailable for new
   downloads. Existing local library copies remain unchanged.
3. **Given** removal confirmation, **When** cancelled, **Then** no removal occurs.
4. **Given** denied, failed, stale, or uncertain removal, **When** the operation completes,
   **Then** its actual outcome or uncertainty is shown and refresh is available before retry. An already removed
   submission may be reported as successfully absent; local copies remain unchanged.

---

### User Story 4 - Use current accounts and recover from failures (Priority: P1)

A user browses anonymously, signs in when contributing, and recovers from service or account
failures without losing local work. A service-host change preserves the same workflows.

**Why this priority**: The current service differs from Java's retired service; failures
must not compromise compositions or libraries.

**Independent Test**: Exercise unavailability, delayed/stale responses, sign-in failure,
expiry, sign-out, optional remembered sign-in across app restart, and a service-host change
against controlled environments.

**Acceptance Scenarios**:

1. **Given** no account session, **When** browsing/importing, **Then** no sign-in is required;
   publishing and personal management require sign-in.
2. **Given** a current account, **When** email/password sign-in succeeds, **Then** the identity
   is clear. Sign-out/expiry prevents protected actions until sign-in; public browsing remains
   usable. Website registration and password recovery are reachable.
3. **Given** an unavailable service/capability, **When** Blue Share is used, **Then** pending,
   error, unavailable, and empty states are distinct, other Blue controls remain usable, and
   retry does not discard local work.
4. **Given** the eventual final-hostname change, **When** Blue Share connects, **Then** it uses
   the designated service consistently, retains resource identities/local copies, and requests
   sign-in again when needed without forwarding the old host's account session to another host.
5. **Given** pending reads or writes, **When** the user changes kind/category/account or closes
   and reopens Blue Share, **Then** results remain associated with their original context,
   pending controls recover when the operation settles, and a recoverable non-secret publication
   draft is retained for renewed review without applying an old completion to a new draft.

6. **Given** the default unchecked “Stay signed in on this computer” control, **When** sign-in
   succeeds and Blue exits/restarts, **Then** protected actions require a new sign-in; no session
   proof or password was saved to disk.
7. **Given** explicit opt-in and a server supporting `rememberMe`, **When** sign-in succeeds,
   **Then** Blue can restore that session after restart until its server-issued expiry, at most
   seven days from sign-in. Active use does not extend the seven-day period.
8. **Given** saved session proof, **When** Blue Share first opens after restart, **Then** main
   validates it with the service before reporting signed-in identity or permitting protected
   actions. Expired/revoked proof is deleted; temporary service failure offers retry without
   claiming signed-in status or replaying a write.
9. **Given** remembered sign-in, **When** the user signs out (including offline), replaces the
   account, or changes service origin, **Then** local saved proof is cleared immediately and late
   login/restore/save completions cannot restore it. Remote revocation confirmation stays honest.
10. **Given** unavailable OS-protected storage, **When** a user opts in, **Then** ordinary sign-in
    remains usable but Blue explains that it cannot remember this session; it never stores plaintext
    proof or passwords. Older servers are identified as unsupported rather than silently downgrading
    an opted-in request or automatically resubmitting credentials.

### Edge Cases

- Numeric IDs may overlap across kinds; resource and category identities include their kind.
- Categories may be nested, empty, renamed, or removed during browsing or publication.
- Null descriptions and absent effect types display sensibly without invented values.
- Equal/missing historical dates require stable ordering. Changing kind/category clears stale
  details/import targets; late responses must not replace the current selection/account view.
- Resources can disappear between listing, download, and removal; refresh reconciles availability.
  Stored legacy content may be unavailable even when metadata is browsable; report that
  condition without silently repairing it or treating it as an empty category.
- Intentional repeated imports create independent copies; same-name resources never overwrite
  existing items. One pending activation must not add multiple copies.
- A library may be read-only/unavailable; success requires durable persistence.
- A source item can change/disappear during an export draft; submit reviewed content or require
  review again before proceeding.
- Historical/unsupported types, external file references, and unavailable runtimes need explicit
  diagnostics. Import never executes code or downloads referenced files; supported data is
  assessed separately from whether its runtime is installed.
- Migrated accounts may require a website password reset. Closing Blue Share during a request
  must not apply stale results to a later unrelated operation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Tools → Blue Share MUST open Instruments, Effects, and SoundObjects groups,
  each with Import, Export, and Manage tabs. Retain Java's category/list/detail import layout,
  library/category/description export layout, and fetch/list/remove management layout for 3.0.
- **FR-002**: Public browsing/details/import MUST work anonymously. Each kind MUST have a
  category tree and a Latest view of up to ten newest available resources of that kind,
  independently of how many recent resources of other kinds exist.
- **FR-003**: Every category resource and owned submission MUST remain reachable across
  multiple pages. Lists MUST show name/author; details MUST show name, author, category,
  description, and applicable type. Loading, empty, failure, and unavailable states MUST differ.
- **FR-004**: Import MUST retrieve and validate complete content before durable changes,
  then add an independent copy to the matching user library's Imported Instruments, Imported
  Effects, or Imported SoundObjects folder, reusing or creating the folder and immediately
  publishing the library change.
- **FR-005**: Imports MUST survive restart and preserve supported content, relationships,
  and significant code/text whitespace. Invalid/unsupported content MUST leave existing data
  unchanged and identify the source resource, offending element/member/value when applicable,
  severity, and recovery. Silent lossy import is prohibited.
- **FR-006**: Export MUST select an existing local user-library resource of the chosen kind,
  a valid remote category, and a public description. Name/applicable type MUST come from the
  resource; editing the submission description MUST NOT mutate it. Synthetic navigation
  roots/Latest are not publishable categories; real top-level service categories are valid.
- **FR-007**: Publish MUST require sign-in, validate required fields, preserve reviewed
  resource content, and report success only after confirmed acceptance. Accepted submissions
  MUST appear publicly and in Manage after refresh, attributed to the authenticated owner.
- **FR-008**: Manage MUST fetch the signed-in user's submissions by kind and support owner-only
  removal after confirmation naming the item. Removal MUST exclude it from public listing/
  download without affecting local copies. Cancellation MUST leave it unchanged.
- **FR-009**: Protected actions MUST support current email/password accounts, clear identity,
  sign-in/sign-out, expiry handling, and website registration/reset links. Forged ownership
  selections MUST NOT permit removal of another user's resource.
- **FR-010**: Credentials/sessions MUST NOT enter project files, resource exports, library
  records, diagnostics, or logs. Passwords MUST remain transient. Without explicit remembered
  sign-in, account proof MUST last only for the running app session. The only durable-auth
  exception is the main-owned, OS-protected, origin-bound session record in FR-020–024; renderer
  caches, drafts and project/library files MUST never hold durable authentication proof.
- **FR-011**: The initial service MUST be `https://blue3.kunstmusik.com`. Moving to
  `https://blue.kunstmusik.com` MUST require only a service-location change, retain workflow/
  catalog identities, and isolate account state by host. Failed operations MUST NOT silently
  fall back to the retired service.
- **FR-012**: Pending feedback MUST appear within one second; other application controls MUST
  remain usable. Requests without a result MUST exit pending state within 30 seconds. Failed
  or uncertain writes MUST retain recoverable context/drafts, avoid false success, and MUST
  NOT retry automatically where doing so could duplicate a publish/removal.
- **FR-013**: One pending activation MUST admit only one import, publish, or removal. Results
  MUST remain associated with their originating selection/account; changing context, signing
  out, or closing the interface MUST prevent stale results from overwriting the new view.
- **FR-014**: Browsing, library import, submission drafts, publishing, and removal MUST NOT
  alter active project content/dirty/history state. Later project insertion of imported resources
  MUST use existing history-backed insertion with semantic labels and commit→undo→redo
  restoration of content, identities, references, dirty state, and required runtime reconciliation.
- **FR-015**: Import MUST NOT execute code, instantiate arbitrary external plugins, or fetch
  referenced assets. Missing runtime/assets MUST be explained when using resources; runtime
  unavailability alone MUST NOT reject otherwise supported serialized content.
- **FR-016**: Primary flows MUST be keyboard-operable with visible focus and labelled controls,
  using Blue 3's existing dialog/confirmation/diagnostic conventions. Historical crashes,
  blocking behavior, and silent failures are not parity requirements.
- **FR-017**: Missing service capabilities MUST be reported accurately. Full 3.0 parity MUST
  NOT be declared complete until browse/import, publish, and fetch/remove work for all kinds
  against the implemented service; an overview/latest feed alone does not satisfy parity.
- **FR-018**: Fetched catalog, detail, library-source listing, and personal-submission data MUST
  have one disposable renderer request-state representation per relevant service/dialog/account/
  resource context. Loading, failure, successful empty data, and pagination completion MUST stay
  distinct. Refresh after confirmed writes MUST update affected views; absence from one partial
  page MUST NOT establish successful removal. No credentials, authentication proof, complete
  resource XML, or persistent/offline request queue may enter this renderer cache.
- **FR-019**: Editable submission drafts MUST remain separate from fetched results and request
  lifecycle state. Account expiry/re-authentication MUST invalidate account-bound source tokens
  and private results while preserving non-secret reviewed source identity/category/description
  for explicit renewed review. Account and service identity remain main-owned; renderer request
  handling MUST NOT invent account epochs or infer that cancellation rolled back a sent write.

- **FR-020**: Sign-in MUST offer an accessible, unchecked-by-default “Stay signed in on this
  computer” control. Main/preload MUST validate a `rememberMe` boolean. False/omitted preserves
  app-lifetime-only local authentication and the server's existing 24-hour session behavior;
  true requests a fixed seven-day server session through the existing login endpoint.
- **FR-021**: A remembered session MUST expire at the authoritative server expiry, no later
  than seven days from sign-in, with no sliding renewal or automatic password resubmission.
  The server API extension and required evidence are in [the server handoff](contracts/remember-me-api.md).
  The desktop MUST NOT assume the pinned baseline server implements it or claim seven-day
  persistence before deployment is verified.
- **FR-022**: Only main MAY persist a minimal versioned session-cookie record and non-secret
  origin/expiry metadata, encrypted using available OS-protected storage in the user's app profile.
  No password, catalog data, drafts or pending operations may be persisted with it. Plaintext or
  insecure storage-backend fallback is forbidden. Encryption/storage failure MUST preserve usable
  ordinary sign-in with an explicit inability-to-remember message, not false persistence success.
- **FR-023**: Main MUST restore proof only into a dedicated BlueShare native session for the exact
  saved origin and validate it using `GET /session` before exposing signed-in state. Expired,
  revoked, malformed, undecryptable or wrong-origin proof MUST be cleared. Transient network
  failure MUST leave protected actions disabled and distinguish unavailable from signed-out;
  unexpired encrypted proof may remain for explicit validation retry. Public browsing stays usable.
- **FR-024**: Sign-out, account replacement and origin change MUST immediately invalidate/delete
  saved local proof and advance existing account fences before awaiting network work. Delayed
  sign-in/restore/encryption/file-write completions MUST NOT resurrect it or overwrite a newer
  account. Offline sign-out clears local proof and reports unconfirmed remote revocation. If local
  cleanup cannot complete, report that failure and do not claim successful durable sign-out.
  Remembered sign-in MUST NOT persist/replay pending writes or reuse old publish-source tokens.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue revision `3ca3f40579c48a023299a68130d8ab6b9e950974`
  establishes the three groups/tabs, latest-ten views, standalone resource import/export,
  and owned-item fetch/remove. SoundObject fix `27079e68cb12b6bc6139aa01dfe18d1c8a7ea56f`
  establishes import-folder reuse. See [research.md](research.md) for sources and provenance.
- **Compatibility Requirements**: Use supported standalone Java instrument/effect/SoundObject
  forms shared with disk/library loading, including documented historical conversions/defaults,
  without requiring a project load or an available runtime. Unexpected meaningful content
  rejects import atomically; warnings cannot permit ordinary save after meaningful data loss.
- **Migration Boundaries**: Historical normalization belongs to shared resource/class loaders,
  with deterministic conflict rules and stable canonical output when reapplied. No separate
  BlueShare-only compatibility policy or project migration is introduced. Existing serialization
  contracts in [feature 116](../116-xml-compatibility-contracts/spec.md) govern accepted forms;
  newly encountered forms require evidence before expanding acceptance.
- **Intentional Divergences**: Use the current service instead of retired XML-RPC, email sign-in
  instead of Java's username form, existing Blue 3 user libraries/dialogs, responsive requests,
  explicit diagnostics, and safe persistence. Retain functional UI organization rather than
  exact Swing pixels. Java's unfinished Update action is excluded; redesign follows 3.0 parity.
- **State Ownership**: The service owns categories, submissions, author ownership, and removal.
  Imported copies belong to the existing user library in per-user `blue_libraries.sqlite` for
  their normal library lifetime; existing migration/recovery rules apply. No new durable library
  store/migration is added. Selections, fetched results, drafts and active account snapshots are
  disposable app session state: main owns authentication/epochs and renderer memory owns
  disposable fetched views and editable drafts. Fetched views are cleared on dialog close/unmount; private views
  are also invalidated on account/origin changes. Those views/drafts are cleared on restart and
  never saved in `.blue`. FR-022 permits only encrypted main-owned session proof across restart
  after explicit opt-in. No persistent remote cache, offline queue, saved-password store, or new
  resource-provenance store is added.
  The canonical document bridge continues to own the active project.
- **Undo/Redo Impact**: BlueShare itself writes the user library or service and creates no
  project-history entries. Later project insertion remains undoable under FR-014. No deliberately
  non-undoable project mutation is authorized; public removal is a confirmed service operation.

### Key Entities *(include if feature involves data)*

- **Resource kind**: Instrument, Effect, or SoundObject; part of category/resource identity.
- **Remote category**: Kind, stable identifier, name, optional description, and tree relationships.
- **Remote submission**: Kind/ID, name, author attribution, category, description, applicable
  type, creation information, availability, and complete standalone content. Listing metadata
  alone is not importable resource content.
- **Local library copy**: Independent local identity/content, unaffected by remote removal.
- **Submission draft**: Reviewed library source, category, and public description; disposable,
  but retained during recoverable failures within the session.
- **Account session**: Current service identity/authentication, isolated by host; the service
  remains authoritative for ownership/permissions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All nine kind/workflow combinations are reachable through the familiar three-group,
  three-tab organization; browse/import, publish, and fetch/remove scenarios pass for all kinds.
- **SC-002**: In a controlled catalog with at least 25 resources per kind and nested categories,
  every category resource/owned submission is reachable and each Latest view returns the correct
  ten newest available resources of its kind without cross-kind leakage.
- **SC-003**: All supported current/documented historical cases in the acceptance matrix import
  without meaningful loss, appear immediately, and survive restart. All invalid/unsupported
  cases leave existing library/project content unchanged.
- **SC-004**: Each confirmed publish creates one retrievable submission and each confirmed
  removal prevents new imports of that submission. Duplicate pending clicks, denied requests,
  and interrupted operations never produce false success.
- **SC-005**: All delayed-operation cases show feedback within one second and reach a result
  or recoverable timeout within 30 seconds while users can continue working in Blue.
- **SC-006**: All BlueShare cases preserve project content/dirty/history state. Later insertion
  of each kind passes commit→undo→redo checks for identity/reference restoration, dirty state,
  and runtime reconciliation where applicable.
- **SC-007**: All primary flows can be completed using only a keyboard with visible focus and
  readable errors. Service-host migration checks preserve local resources and prevent reuse
  of another host's account session.
- **SC-008**: The delayed-response, account-change, pagination, and close/reopen acceptance
  matrix passes with no stale results applied to a new context, stuck pending controls, lost
  recoverable drafts, duplicate pending writes, or false success inferred from partial results.

- **SC-009**: In a disposable service/native test environment, opted-in sign-in survives a
  separate-process restart only after successful GET/session validation; unchecked sign-in does
  not. Controlled-time tests prove fixed seven-day expiry, server revocation and local sign-out,
  including offline/failure/race cases, with no proof/password in renderer/project/log state.
  Tests distinguish unavailable OS protection from successful remembering; unsupported native
  platform cases stay explicitly pending.

### Closure acceptance exception — owner-approved 2026-10-18

The owner reported successful stay-signed-in testing and requested skipping Windows and Linux
tests. For feature 117 closure, their native/UI/OS-storage acceptance matrix is waived, including
the platform portions of SC-007–SC-009. These cases were not run and remain unverified; they are
not open implementation tasks under this approved closure scope. Functional, serialization,
security, storage and history requirements remain unchanged. Existing macOS/native/service and
regression evidence supplies the remaining acceptance basis. This exception supersedes earlier
statements requiring platform evidence before closure; see the final records in
[plan.md](plan.md), [quickstart.md](quickstart.md) and [tasks.md](tasks.md).

## Assumptions

- **Owner-approved constraint (2026-10-18)**: Adopt TanStack Query for BlueShare renderer
  request state over the typed preload API, replacing the manual fetched-data/loading/error/
  pagination machinery. Main retains transport, authentication, validation, write guards, and
  persistence. The bounded dependency, cache lifecycle, draft separation, and migration are
  specified in [plan.md](plan.md), [research.md](research.md), and [tasks.md](tasks.md).
- P2 sequences delivery; Export and Manage remain mandatory for 3.0 parity.
- Blue-site revision `20df3f93185b60a6677999a4820405215c9e4f3a` implements the required
  catalog, contribution, and desktop account capabilities. The completed dependency review is
  recorded in [service-prerequisites.md](service-prerequisites.md) and [research.md](research.md).
  Public production reads were rechecked on 2026-10-17; authenticated writes are verified in
  isolated service tests rather than by altering production data.
- Current production is blue3.kunstmusik.com; eventual final-domain cutover/deployment/data
  migration belong to blue-site and are outside this desktop feature.
- Registration/reset remain on the website. The implemented service supports desktop account
  sessions for the running app lifetime in the pinned baseline. Optional seven-day remembered
  sign-in now consumes the extension delivered at fe19eca and uses the main-owned encrypted
  session record. Local/native results and remaining platform checks are tracked in tasks.md.
  Proof never crosses service hosts.
- Export starts from local user libraries, matching Java's implemented sources. Project resources
  use existing copy-to-library workflows first.
- Full-text search, tags, ratings, thumbnails, audition, attachments/dependency packages, bulk/
  offline downloads, UDO/module sharing, editing remote submissions, background synchronization,
  and interface redesign are outside 3.0 parity.
- This specification copies no service code or community payloads into Blue 3. Planning must
  evaluate provenance/licenses before source adaptation, new dependencies, or fixture/asset
  redistribution.

### UI review follow-up (2026-10-18)

Blue Share local-library sources MUST retain their folder hierarchy and use expandable tree
controls consistent with the rest of Blue 3. Import and export destination categories MUST
use the same tree interaction and row styling. Export MUST keep the selected source's original
comments visible separately from the editable public description. Manage MUST show the selected
submission's description and identifying metadata. These previews expose the existing sanitized
summary/source-seed fields; complete resource XML remains outside renderer request caches.
Trees, tables, previews and input controls MUST use the app's near-black content backgrounds,
standard selection/focus tokens and semantic typography, while retaining surface-colored chrome.


### Remembered sign-in amendment (2026-10-18)

The owner requested the server API handoff and implementation requirements/tasks after accepting
this round's general UI testing. FR-010's original restart-only sign-in constraint is superseded
only by explicit opt-in under FR-020–024. Existing completed tasks/acceptance evidence describe
the earlier implementation; they do not establish remembered-session support. All new implementation
and deployment checks remain unchecked. Existing Windows/Linux/release gates remain open.


Implementation checkpoint: the subsequent owner request (“server is updated; run
speckit-implement”) authorized T100–T108. The earlier planning-only amendment above remains
historical; current main/preload/renderer behavior implements FR-020–024, with native macOS
restart/revocation/storage evidence. Cross-platform/release evidence is not inferred from it.
