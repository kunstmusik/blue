# Feature Specification for the Blue Documentation Site

**Feature Branch** `codex/gh-pages-site`

**Created** 2026-11-20

**Status** Draft

**Input** Publish the Blue 3 desktop manual, Blue CLI guide, and Blue Data API reference from the Blue repository on GitHub Pages. Keep the existing Blue product site as the starting point for product information and downloads. Maintain the Blue 3 manual as the active desktop documentation. Retire the legacy Java Blue repository and public site after verifying the Blue 3 manual and updating links maintained by the project.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find the right desktop manual (Priority P1)

A musician follows the Documentation link from the Blue product site to the active Blue 3 manual. Blue 3 users can also read the copy installed with the desktop app when offline.

**Why this priority**. The desktop manual is the primary help destination, and the product site is its public entry point.

**Independent Test**. Follow the product site's manual link to Blue 3, open a chapter, and open the equivalent chapter from the installed app with networking disabled.

**Acceptance Scenarios**

1. **Given** the product site links to the active Blue 3 manual, **when** a reader follows the link, **then** the manual identifies its edition and provides working chapter navigation.
2. **Given** the published Blue 3 manual describes a prerelease, **when** a reader opens it, **then** its edition and preview status are visible.
3. **Given** Blue 3 is installed and networking is disabled, **when** a reader opens its manual, **then** chapter navigation and bundled images work.

---

### User Story 2 - Use the CLI and library for the installed version (Priority P2)

A tooling user finds the CLI quickstart to compile a project or uses the Blue Data quickstart and searchable reference to work with a project in Node.js. A release-note link opens documentation for the version it names.

**Why this priority**. CLI and library users need instructions and signatures that match the packages they installed.

**Independent Test**. From the documentation home, complete the CLI compile quickstart and find a documented Blue Data symbol. Repeat both by following version-specific links.

**Acceptance Scenarios**

1. **Given** a tooling version with published docs, **when** a reader opens its CLI guide, **then** the guide identifies the version, covers prerequisites and flags, and provides a command that produces a Csound document from a sample Blue project.
2. **Given** a reader opens the API reference for a documented tooling version, **when** they search for `BlueData`, **then** they can reach the matching API entry and find a Node.js quickstart.
3. **Given** a later tooling version is documented, **when** a reader reopens an earlier version-specific URL, **then** it still describes the earlier version.

---

### User Story 3 - Publish updates and retire the legacy manual (Priority P3)

A maintainer validates the site before deploying updates, updates project-controlled links after verifying the active Blue 3 manual, and separately retires the legacy repository and public site.

**Why this priority**. A broken preview, failed update, or premature retirement can strand readers or publish instructions for the wrong edition.

**Independent Test**. Introduce a broken documentation link in a proposed update, confirm validation reports it without replacing the live site, then verify the live Blue 3 manual and the project-controlled links that will send readers there.

**Acceptance Scenarios**

1. **Given** a proposed update contains a broken local link or an undocumented public API member, **when** it is validated, **then** the check identifies the issue and the current public site remains available.
2. **Given** the active Blue 3 manual is live, **when** project-controlled manual links are updated, **then** they lead to the verified Blue 3 manual.
3. **Given** the active manual and updated links have passed their live checks, **when** the maintainer separately authorizes retirement, **then** the legacy public site and repository can be retired.

### Edge Cases

- The desktop release and the tooling release can advance independently. Updating either preserves the published links for the other.
- A source tag can exist before its packages are public. The public tooling edition requires both matching packages to be published.
- The first npm beta predates the API reference. Readers see an explicit availability boundary, and the first versioned reference is attached to a release that contains it.
- During a failed or overlapping update, readers continue to see a complete site and previously published version links.
- Old Java Blue bookmarks and third-party links may stop working after retirement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** — Provide a public documentation home at `kunstmusik.github.io/blue/` with entry points for the Blue 3 desktop manual, Blue CLI guide, and searchable Blue Data reference. Link back to the Blue product site.
- **FR-002** — Keep product information, download links, tutorials, and community support on `blue.kunstmusik.com`. Its manual links must lead to the active Blue 3 manual after live verification.
- **FR-003** — Produce the online and installed Blue 3 manuals from the same maintained chapter sources. Preserve offline use, chapter links, images, attribution, and license information.
- **FR-004** — The CLI guide must cover installation, runtime prerequisites, project compilation, commands and flags, exit behavior, and troubleshooting. Its published command examples must match the documented package version.
- **FR-005** — Provide a Node.js project-loading and Csound-generation quickstart alongside a searchable version-matched Blue Data API reference. Publish the reference on the docs site while keeping package downloads free of generated site files.
- **FR-006** — Provide stable section links that identify the recommended edition and fixed version links tied to source revisions. Track Blue 3 desktop editions independently from the paired CLI and API tooling editions. Clearly label previews and betas.
- **FR-007** — Validate proposed documentation changes for build failures, broken local links and assets, version mismatches, and missing API documentation. A failed update must preserve the current public site. Desktop and npm releases must be able to complete independently of site deployment.
- **FR-008** — Preserve earlier published version links when later editions go live. A site update must publish a complete set of sections and retained editions.
- **FR-009** — Verify the active Blue 3 manual live, update and verify project-controlled manual links, then retire the legacy public site and repository in a separately authorized operation.

### Key Entities

- **Documentation section** identifies the reader's task and links to its recommended edition.
- **Documentation edition** identifies a section, desktop or tooling version, source revision, channel, and fixed public URL.
- **Manual cutover record** captures the live Blue 3 edition and the project-controlled links updated to reach it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** — A reader can reach each of the three documentation sections in one navigation step from the docs home. The product site's manual links open the active Blue 3 manual.
- **SC-002** — The published CLI quickstart generates a Csound document from the sample project with the documented package. Searching the corresponding API reference for `BlueData` opens its version-matched entry.
- **SC-003** — All local links and required assets resolve in the deployed site, and the offline smoke test opens a representative manual chapter and image with networking disabled.
- **SC-004** — After independent desktop and tooling updates, every previously published version link in the acceptance inventory resolves to its original edition. A failed update leaves the previous site online.
- **SC-005** — The cutover record shows that the active Blue 3 manual and the updated project-controlled links passed live checks before retirement.

## Assumptions

- The existing product site and Java Blue manual are public. Their maintainers control link updates and repository settings.
- The first online Blue 3 manual may be an explicitly labeled preview tied to a verified source revision until a suitable desktop release is available.
- The first versioned CLI/API pair is the next public tooling release that contains the reference sources. No backfill of the first npm beta is required.
- GitHub Pages is the requested public destination. Product-site source and legacy repository changes are coordinated separately with their maintainers.
