# Blue documentation site

The GitHub Pages project site at <https://kunstmusik.github.io/blue/> hosts the Blue 3 desktop manual, Blue CLI guide, and Blue Data API reference. The [product site](https://blue.kunstmusik.com/) owns downloads, tutorials, and community links. Blue 3 is the active desktop manual.

| Section       | Source owner                                                                                                             | Renderer                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| Blue 3 manual | [Quarto book](../manual/README.md)                                                                                       | Quarto and its bundled Pandoc       |
| Blue CLI      | [Package README](../../packages/blue-cli/README.md)                                                                      | Quarto's bundled Pandoc             |
| Blue Data     | [TypeDoc configuration](../../packages/blue-data/typedoc.json) and [Node quickstart](../../packages/blue-data/README.md) | TypeDoc and Quarto's bundled Pandoc |

Use the workspace's Node.js and pnpm versions and the Quarto version documented for the manual. Node scripts assemble the registered editions into `build/docs-site/`, which the repository ignores. Each edition uses the sources at its pinned Git revision. See the [publication contract](../../specs/122-gh-pages-site/contracts/publication.md) and [asset inventory](provenance.md).

## Edition catalog

`editions.json` holds two independent release series. Every desktop row has a
`key`, `channel`, `label`, and full `sourceSha`. Released rows also have a
`tag` equal to their key. Use `preview-<first 12 SHA characters>` for a source
preview and include “Preview” in its label. A tooling row has a `version`,
`channel`, full `sourceSha`, and `tag` equal to `npm-v<version>`. If the
release manifest is unavailable, include an `integrity` object with verified
`cli` and `data` registry integrity values and a `verification` link to the
maintainer's record.

Set `recommended.desktop` to a registered desktop key. Set
`recommended.tooling` to a registered tooling version when a pair is available.
The tooling recommendation supplies both section links. Omit it while the first
pair is pending. Published edition rows are append-only. Move recommendations
independently of those rows.

### Add a desktop edition

1. Fetch `origin/develop` and tags. Confirm the desktop release is published
   and its tag resolves to the full source SHA. For a preview, use a commit
   reachable from `origin/develop`.
2. Append the row. Include the version and channel in its display label.
3. To recommend it, set `recommended.desktop` to the new key. Link the release
   notes to `https://kunstmusik.github.io/blue/manual/<key>/`.

### Add a tooling edition

1. Check the `npm-v<version>` tag and both exact public npm versions. The pinned
   sources must include the CLI README, the Blue Data Node example, and strict
   TypeDoc configuration.
2. Add the retained CI release manifest as
   `docs/site/npm-release-manifests/npm-v<version>.json`. If it expired,
   record the maintainer's verification with both exact SHA-512 integrity values
   in the catalog. The build compares the evidence to the public registry.
3. Append one tooling row and set `recommended.tooling` when appropriate.
   Link the release notes to `https://kunstmusik.github.io/blue/cli/<version>/`
   and `https://kunstmusik.github.io/blue/api/blue-data/<version>/`.

## Build and verify locally

Install Node.js 22 or newer, the workspace pnpm version, and Quarto.
Run these commands from the repository root.

```sh
git fetch origin develop --tags
pnpm install --frozen-lockfile
pnpm --filter @blue/data docs:api
pnpm site:package
pnpm docs:site:verify
pnpm --filter @blue/app exec playwright install chromium
pnpm docs:site:smoke
```

Run `pnpm site:preview` and open <http://127.0.0.1:8000/blue/>. The preview
serves the current package output under the public path prefix. Run
`pnpm site:package` again to refresh that output. Stop the server with Ctrl+C.

`site:package` uses the Quarto on your `PATH` for local preview. For a
publication build, use `pnpm docs:site:build` with Quarto 1.10.18. That version
matches the reviewed asset notices and the GitHub Pages workflow.

The build checks out each exact revision into a disposable clone, assembles
the whole site, and verifies it before replacing `build/docs-site/`. A
running build owns `build/docs-site.lock/`. After an interruption, confirm the
process has ended. If the output is missing and the staging directory contains
`previous/`, restore it to `build/docs-site/` before clearing the lock and stage.

A tag mismatch usually means the local tag or commit is missing or stale.
Fetch the public tags and compare the pinned SHA to the peeled tag commit.
A tooling integrity failure requires checking the exact registry versions
against the release manifest. Fix source warnings in the relevant package and
rerun strict TypeDoc. Breakage in an already published edition requires
preserving the original source pin and resolving the rendering or packaging issue.

## Publish on GitHub Pages

Pull requests run the read-only documentation checks and attach a complete
candidate for review. Production runs share a concurrency group and load
the current `develop` catalog when they start. The protected `github-pages`
job deploys the verified artifact. The production build compares its edition
inventory and catalog to the live snapshots before it uploads the artifact.

For the first deployment, configure the Pages source as **GitHub Actions** and
restrict the `github-pages` environment to `develop`. Set the workflow's
`first_deploy` input on `develop` when the site and both baseline files return HTTP 404.
For a retry, fix the problem on `develop` and dispatch a fresh run there. Check
the live site and its catalog against the deployment record before updating
external links. Follow the [manual cutover plan](legacy-cutover.md) and the
[acceptance guide](../../specs/122-gh-pages-site/quickstart.md).
