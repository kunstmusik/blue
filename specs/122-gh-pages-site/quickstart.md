# Validation Guide for the Blue Documentation Site

This guide describes acceptance after implementation. The site build and verification commands are introduced by this feature.

## Prerequisites

- Install the workspace's supported Node.js and pnpm, and the Quarto version used for the Blue 3 manual. Run `pnpm install --frozen-lockfile`.
- Fetch the cataloged source revisions and tags. For tooling acceptance, confirm that both exact package versions are public. For a source-only desktop preview, use its recorded revision and preview label.
- Use a disposable directory for generated Csound files. The plain project fixture needs Node.js, and the published guide describes Java and Csound requirements for the workflows that use them.

## Verify source documentation

1. Run `pnpm --filter @blue/data docs:api` from the repository root. Expect zero warnings. On a throwaway branch remove one public-member comment and confirm the command fails. Restore the comment.
2. Run `pnpm build:manual`. Open `docs/manual/_build/html/index.html` via `file://`, disable networking, navigate to a representative chapter and screenshot, and check the attribution and license.
3. Run `pnpm site:package` and `pnpm docs:site:verify` using the same catalog that CI uses. Verify every route and license listed in the [publication contract](contracts/publication.md). Serve the assembled artifact under `/blue/`, open a manual chapter, and search the TypeDoc reference for `BlueData`. Click the result and verify its source link points to the recorded SHA.

For publication checks, put Quarto 1.10.18 on your PATH and run
`pnpm docs:site:build` to include the reviewed asset notices.

Run `pnpm --filter @blue/app exec playwright install chromium` followed by
`pnpm docs:site:smoke` for the automated hosted-path checks.

Run `pnpm site:preview` and open <http://127.0.0.1:8000/blue/>. If the first
tooling edition is pending, check the two availability notices and repeat
the tooling smoke after a published edition is added.

## Verify a tooling edition

In a clean temporary directory, copy the edition's `skills/blue-projects/assets/example.blue` fixture and run the command shown on the fixed CLI guide. It should be equivalent to the following once `VERSION` is set to the recorded release.

```sh
npx --yes "@kunstmusik/blue-cli@${VERSION}" compile -p example.blue -o example.csd
```

Expect a zero exit code and an output file containing `<CsoundSynthesizer>`. Run the hosted Node quickstart against the exact `@kunstmusik/blue-data` version from the same edition. Confirm the resulting CSD and version labels, and verify that the npm data archive excludes the generated API site. Capture the exact versions and the release evidence used to match them to source.

## Verify deployment and retention

1. Open the read-only PR artifact. Introduce a broken local link in a throwaway candidate and verify that it fails validation. Verify that no PR job can deploy. Restore the link.
2. Enable GitHub Actions as the Pages source and allow the `github-pages` environment to deploy from the trusted branch. Publish a complete validated artifact. Record the public URL and deployment revision.
3. Add one desktop edition and one tooling edition in successive test catalogs. Check that previous fixed URLs, unrelated section pointers, and contents remain available at their original revisions. Reject a test catalog that removes or rewrites a published edition. Check that a delayed repair dispatch cannot select an older catalog.
4. Confirm the previous site still responds after a failed update, and verify the desktop and npm release workflows can independently reach their normal outcomes.

## Verify the manual cutover

Follow the [publication contract](contracts/publication.md#legacy-cutover).
Open the active Blue 3 manual on the public site and verify its edition label,
source revision, a representative chapter and image, and the attribution
and license links. After updating the links the project controls, follow them
to the verified manual and record the results in the
[cutover plan](../../docs/site/legacy-cutover.md). Retirement of the legacy
site and repository requires separate authorization.
