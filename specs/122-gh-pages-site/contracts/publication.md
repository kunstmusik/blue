# Public Site and Deployment Contract

All paths below are relative to the GitHub Pages project prefix `/blue/`.

| Route | Content |
| --- | --- |
| `/` | Links to the manual, CLI guide, and Blue Data reference, plus a link to the product site. |
| `/manual/` | Blue 3 edition selector and preview/release status. |
| `/manual/<desktop-edition>/` | Quarto manual for the specified edition, with stable chapter paths within it. |
| `/cli/` | CLI versions and recommended guide or a notice that the first versioned guide is pending. |
| `/cli/<npm-version>/` | Version-matched install and compile instructions, command reference, and troubleshooting. |
| `/api/blue-data/` | Blue Data versions and recommended reference or a notice that the first versioned reference is pending. |
| `/api/blue-data/<npm-version>/` | Searchable TypeDoc reference and a link to the Node quickstart for that version. |

The source SHA and version or preview label are discoverable for every edition. All internal navigation, stylesheet, image, and search requests resolve under the public prefix. Relative source-code links in rendered package content resolve to the edition's immutable source revision. Preserve all fixed routes when updating aliases or adding editions.

## Deployment boundary

- Read-only PR validation builds source documentation, checks strict TypeDoc coverage, and verifies candidate output. PR artifacts are for inspection.
- Only the trusted publishing workflow for `develop` can publish. It assembles and validates the complete catalog from trusted source, then hands that artifact to the job protected by the `github-pages` environment.
- Serialize production runs as a unit and read the current trusted catalog for each production build so a delayed dispatch cannot roll back a newer edition. A failed build or deployment retains the last successful live site.
- Verify published tooling by exact scoped package versions and immutable tag. Verify released desktop editions against their own published releases. Explicitly labeled desktop previews can use a pinned trusted commit.
- Desktop offline output and npm archives keep their established delivery paths. The Pages workflow has independent status and retry behavior.

## Legacy cutover

1. Verify the active Blue 3 manual on the public documentation site. Check its edition label and source revision, a representative chapter and image, and the attribution and license links.
2. Update project-controlled links, including the product site's manual link, to the verified Blue 3 manual. Follow the published links and record the results.
3. Retire the legacy public site and repository in a separately authorized operation. Old Java Blue bookmarks and third-party links may stop working.

Retain the active manual's required attribution and access to its matching source. CLI and API publication follows its independent release checks.
