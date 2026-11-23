# Research for the Blue Documentation Site

## Hosting and deployment

**Decision**. Assemble one static artifact for the Blue repository's Pages project site. Keep `blue.kunstmusik.com` as the product, download, and community site. Deploy from `develop` with the protected `github-pages` environment and keep PR builds read-only. The maintainer enables GitHub Actions as the Pages source when preparing the initial deployment.

**Rationale**. The existing product site already links out to a manual. A Pages artifact can carry all sections and retained editions together. A separate deploy job limits Pages write and ID-token permissions to the trusted deployment. Serializing the production run and rebuilding from the current catalog prevents queued builds from choosing stale aliases. Check the assembled size before upload against the published-site limit of 1 GB.

**Alternatives considered**. A second application introduces hosting and rendering work. Separate deployment workflows for manual and tooling require cross-workflow coordination to reconstruct a complete artifact. A privileged consumer of PR workflow artifacts introduces an unnecessary trust dependency.

Sources include the [product site](https://blue.kunstmusik.com/), [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), and [Actions concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

## Edition source and retention

**Decision**. Use a Git-tracked, append-only edition catalog. Render every registered version from its pinned revision on each production run. Change a recommendation by updating its section pointer. For a desktop release, verify the published GitHub release and tag. For tooling, verify the `npm-v<version>` commit, both exact public npm versions, and their integrity against release evidence. Accept a recorded maintainer verification when the original release manifest cannot be retrieved.

**Rationale**. The existing release workflows already distinguish desktop and npm tags. The desktop release uses GitHub's workflow token, so a chained release event is an unreliable deployment trigger. The first npm beta points to commit `6bd93b238946c1b54fa7f5e70cb6b7a3ac6202e2`, where the TypeDoc configuration is absent. A registry alias can move independently of its underlying package versions. Catalog changes provide a reviewed, repeatable route for publication and recovery.

**Alternatives considered**. Automatic release-event fanout introduces event and ordering dependencies. Retaining generated snapshots in a dedicated store could reduce rebuild cost but adds an additional write and recovery path. Adopt it later only if catalog rebuilds become impractical and existing fixed URLs can be retained.

Sources include the [desktop release guide](../../docs/release-guide.md), [npm release guide](../../docs/npm-release-guide.md), [workflow event rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow), and [npm package metadata queries](https://docs.npmjs.com/cli/v11/commands/npm-view/).

## Desktop and tooling rendering

**Decision**. Start with the published [Blue 3 beta.6 release](https://github.com/kunstmusik/blue/releases/tag/v3.0.0-beta.6), which contains the book at commit `308bc5c8ae479a44a047a96531edb1d673253069`. At launch, verify the appropriate release against the product site's download selection. Reuse the pinned source's default Quarto render. If the hosted presentation requires different settings, use a web-only profile. Render the tagged CLI README and reuse the library README's Node quickstart beside the existing TypeDoc HTML. Rewrite moving npm selectors in published examples to exact versions, resolve source links to the edition commit, and check the resulting examples. Set TypeDoc's source revision explicitly.

**Rationale**. The desktop build already bundles a local HTML book with relative navigation, local fonts, and search disabled for `file://`. The CLI README covers the requested workflows, and TypeDoc already fails on coverage and link warnings. Reusing these sources gives offline readers, npm users, and website readers the same maintained instructions.

**Alternatives considered**. Duplicating prose per platform creates extra editing work. A new Markdown API generator provides little value for this standalone static reference. Publishing the first beta's API from current source would make its signatures unreliable.

Sources include the [manual build notes](../../docs/manual/README.md), [CLI README](../../packages/blue-cli/README.md), [Blue Data README](../../packages/blue-data/README.md), [Quarto profiles](https://quarto.org/docs/projects/profiles.html), and [TypeDoc input options](https://typedoc.org/documents/Options.Input.html).

## Copyright and attribution

**Decision**. Preserve the manual's GFDL 1.3 text, About credits and screenshot provenance. Link each online manual edition to its complete Quarto source at the matching revision and keep that source available while distributing the edition. Retain package license and applicable notice files next to the corresponding hosted CLI/API documentation. Preserve generated asset notices and review the pinned renderer output for obligations before publication. TypeDoc's Apache-2.0 license and the Lunr MIT notice in its bundled browser assets are initial inventory entries. Record the exact versions and locations of any other redistributed Quarto or TypeDoc assets, and preserve their applicable notices. Publish static documentation outputs and source links. Keep npm archives and their runtime bundles on their existing distribution route.

**Rationale**. The repository default, package prose, manual text, screenshots, and generated theme assets have separate provenance and distribution terms. Keeping notices with their source-derived sections preserves those boundaries.

**Alternatives considered**. A single site-wide license would obscure the scope of the constituent materials. Moving old Java Blue chapters into the active site would add a second manual to maintain and track for provenance.

Sources include [LICENSING.md](../../LICENSING.md), [manual license](../../docs/manual/COPYING.GFDL), [GFDL section 3](https://www.gnu.org/licenses/fdl-1.3.html#section3), [TypeDoc v0.28.20 license](https://github.com/TypeStrong/typedoc/blob/v0.28.20/LICENSE), and [dependency inventory](../../docs/dependency-license-inventory.md).

## Legacy cutover

**Decision (2026-11-21)**. Maintain the Blue 3 manual as the active desktop documentation. Verify it on the public site, then update and verify project-controlled manual links. Retire the legacy Java Blue repository and public site in a separate authorized operation. Old Java Blue bookmarks and third-party links may stop working.

**Rationale**. The project will maintain one desktop manual. The cutover keeps the entry points the project controls useful and gives readers a verified destination before retirement.

**Alternatives considered**. Keeping a public legacy edition or maintaining redirects would require continuing legacy hosting and upkeep. The active manual retains its attribution and matching source independently of the legacy site.
