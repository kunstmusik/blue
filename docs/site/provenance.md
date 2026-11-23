# Documentation site provenance

The Pages artifact is an aggregate of separately licensed documentation and
generated assets. A site-wide license label would hide those boundaries. Keep
each edition's source revision and applicable notices inside that edition, and
link to them from its section landing page.

## Edition source pins

| Section                | Source pin                                                                                                                                                                         | Admission status                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Blue 3 manual          | Desktop release `v3.0.0-beta.6`, commit [`308bc5c8ae479a44a047a96531edb1d673253069`](https://github.com/kunstmusik/blue/tree/308bc5c8ae479a44a047a96531edb1d673253069/docs/manual) | Confirmed published tag and release. Render the complete Quarto source from this revision.                                                                                                                                                                                                                                                                                                                                                                                                 |
| CLI and Blue Data docs | One future `npm-v<version>` tag and its commit, with matching public package versions and tarballs                                                                                 | No eligible tooling edition is pinned yet. The published `0.1.0-beta.1` source at [`6bd93b238946c1b54fa7f5e70cb6b7a3ac6202e2`](https://github.com/kunstmusik/blue/tree/6bd93b238946c1b54fa7f5e70cb6b7a3ac6202e2) has no TypeDoc configuration, so it cannot supply the first versioned API reference. Admit the next tooling edition only after the paired package and integrity checks in the [edition research](../../specs/122-gh-pages-site/research.md#edition-source-and-retention). |

The historical Blue 2 manual commit `7a92066a2aa8f0370026ba9527c158643c2935a1`
is attribution and comparison context, not an input to the Blue 3 manual
render. Retain the required Blue 3 attribution and corresponding-source access through legacy retirement.

## Section inventory

| Hosted section and material                                         | Provenance and terms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Notice and attribution to publish with it                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/manual/<desktop-edition>/` — manual text                          | Quarto source at the desktop edition SHA above. The manual states that its text is under GNU Free Documentation License 1.3 (GFDL 1.3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Include the unaltered `COPYING.GFDL` from that same source revision at the edition route. Keep the manual's title, source/contributor credits, copyright and license notices, and the source link in its About page. Verify the modified-version notice against GFDL section 4 before publication.                                                                         |
| `/manual/<desktop-edition>/` — Blue 3 screenshots                   | The pinned source contains the eight current UI captures and `docs/manual/images/README.md`. That provenance file records the capture date and setup, the Blue source baseline `7985f4e072aaacc4ff4d7e0450a9b302e6dc4213` plus integration worktree changes, and the shown sample views. It says these are actual Blue 3 captures, not Java-era images. The screenshots have no separate per-image license notice. Apply the repository default, GPL-3.0-or-later, where no more specific grant is present.                                                                                                                                                                                           | Retain the screenshot provenance with the manual source and link it from the hosted About/credits page. Keep captions and alt text. Recheck that every emitted image is from the pinned tree.                                                                                                                                                                              |
| `/manual/<desktop-edition>/` — Quarto 1.10.18 generated assets      | The pinned renderer is Quarto 1.10.18. Its macOS release archive SHA-256 is `ddd6a71a9e0448ab15fb655bc589e11cb6589a248ec35ccd7f7f44137531688e`. The emitted 16 site_libs files are inventoried with SHA-256 hashes in [the full asset notice](quarto-1.10.18-NOTICES.md). The output includes Bootstrap 5.3.1, Bootstrap Icons 1.13.1, clipboard.js 2.0.11, AnchorJS 5.0.0, Popper 2.11.7, Tippy.js 6.3.7, Headroom.js 0.12.0, Quarto runtime assets, and built-in Cosmo/Darkly theme CSS. Quarto’s theme files are pinned to its v1.10.18 source. Their Bootswatch-derived origin and MIT terms are recorded in that notice. The offline font override is active and no Google font file is emitted. | Copy [quarto-1.10.18-NOTICES.md](quarto-1.10.18-NOTICES.md) into the manual edition and link it visibly beside the manual license/about information. Keep `COPYING.GFDL`, the Blue manual credits, and screenshot provenance alongside the generated assets. Re-run the inventory if the Quarto version, theme, or renderer settings change.                               |
| `/cli/<npm-version>/` — CLI guide                                   | Render `packages/blue-cli/README.md` from the admitted `npm-v<version>` commit. The package's Blue-authored CLI scope is MIT. Its published bundle has additional Apache-2.0 and ISC material, described in the package notice. The hosted guide does not by itself redistribute the separately installed npm runtime dependencies or Java helper.                                                                                                                                                                                                                                                                                                                                                    | Publish the matching revision's `LICENSE`, `THIRD_PARTY_NOTICES.md`, `LICENSES/Apache-2.0.txt`, and `LICENSES/ISC.txt` next to the guide. Preserve any attribution files linked by the notice, or make the notice links resolve to the same immutable source revision. Include only additional helper notices if the hosted output actually redistributes helper material. |
| `/api/blue-data/<npm-version>/` — Blue Data API and Node quickstart | Generate TypeDoc and render the Node quickstart from the same admitted tooling commit as the CLI guide. The `@blue/data` package declares `MIT AND Apache-2.0`. Its Apache-licensed Google msfa tables and their provenance are described in the package notices.                                                                                                                                                                                                                                                                                                                                                                                                                                     | Publish the matching revision's `LICENSE`, `LICENSES/Apache-2.0.txt`, `THIRD_PARTY_NOTICES.md`, `resources/blue-x7-modern/ATTRIBUTION.md`, and `resources/blue-x7-modern/provenance.json` with the API/quickstart section. Keep the source links pinned to that commit. Generated API files remain site output and must stay out of the npm archive.                       |
| `/api/blue-data/<npm-version>/` — TypeDoc assets                    | The locked generator is TypeDoc `0.28.20` (Apache-2.0); its license is available from [the pinned upstream source](https://github.com/TypeStrong/typedoc/blob/v0.28.20/LICENSE).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Include the full TypeDoc license in `LICENSES/typedoc/LICENSE`. The fixture emitted hierarchy.js, highlight.css, icons.js, icons.svg, main.js, navigation.js, search.js, and style.css.                                                                                                                                                                                    |
| `/api/blue-data/<npm-version>/` — TypeDoc search                    | The lockfile resolves Lunr `2.3.9` (MIT), which TypeDoc uses for browser search. Its license notice is available from [the pinned upstream source](https://github.com/olivernn/lunr.js/blob/v2.3.9/LICENSE).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Include the full Lunr notice in `LICENSES/lunr/LICENSE`. The fixture's `assets/main.js` identifies Lunr 2.3.9 and the browser smoke exercises the generated search index.                                                                                                                                                                                                  |
| Site home, section selectors, and build scripts                     | Blue-authored files under `docs/site/` and `scripts/` use the repository default GPL-3.0-or-later unless a file says otherwise. They do not change the licenses of the source-derived sections above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Keep the repository [GPL-3.0-or-later license](../../LICENSE) available. Do not apply one license label to the complete multi-section artifact.                                                                                                                                                                                                                            |

## Publication checks

- Each versioned section must display its version/preview label, source SHA,
  pinned source link, and a visible link to the notices that apply to its
  generated files. Never resolve a versioned source link through a moving
  branch or tag alias.
- Keep the complete manual source and GFDL text available while publishing its
  rendered edition. Preserve the About credits and screenshot provenance with
  the manual and use the pinned Blue 3 screenshots.
- Copy package notices from the same source revision as the CLI/API content.
  Verify notice links after staging. A notice for an npm package does not mean
  the Pages artifact also ships that package's runtime dependencies.
- The Quarto 1.10.18 manual output is compared against the pinned renderer's
  bundled assets in [quarto-1.10.18-NOTICES.md](quarto-1.10.18-NOTICES.md),
  including each emitted file hash and its license text. Re-run that check if
  the renderer or theme settings change. TypeDoc output belongs to the separate
  API edition and must retain its own version-specific notices. Update
  [`docs/dependency-license-inventory.md`](../dependency-license-inventory.md)
  only when the tracked workspace dependency scope changes.
- The manual source names the GFDL, credits its source and contributors, and
  links the complete source tree. Before publication, verify all required
  GFDL modified-version details, including the title, publisher/modification
  notice, preserved credits/copyright, History section, and license copy. Do
  not treat a public source link as a substitute for the license text.

The Blue-authored site stylesheet follows the product site's desktop-derived
palette. It styles the hosted manual and is bundled as TypeDoc's custom CSS.
It uses locally available fonts and adds no font files.

The beta.6 candidate matches all 16 Quarto asset hashes, the pinned GFDL
text, and all eight source screenshots. The synthetic tooling candidate
matches the package notices, BlueX7 attribution, and full renderer license
files from its pinned checkout. Quarto's bundled Pandoc 3.10 renders the CLI
guide and Node quickstart as static HTML sharing the site stylesheet.
[Validation evidence](../../specs/122-gh-pages-site/verification.md)

## Manual publication attribution

The original Quarto book names **Blue Manual** and credits **Steven Yi** in
its book metadata. The retained source revision has a 2026-04-28 commit date.
Its title page gives the GFDL 1.3 grant. That page and the book metadata leave
the original publisher and publication year unstated. The original preface
and credits document additional contributors. [Original source](https://github.com/kunstmusik/blue-manual/tree/7a92066a2aa8f0370026ba9527c158643c2935a1)

The pinned adaptation supplies the distinct **Blue 3 Manual** title,
credits Blue contributors, names contributors from the original manual,
and preserves both the original source link and the full license text.
The hosted renderer adds the link to the complete beta.6 Quarto source.
[Blue 3 beta.6 manual source](https://github.com/kunstmusik/blue/tree/308bc5c8ae479a44a047a96531edb1d673253069/docs/manual)

Before the first public build, confirm the name to give as publisher, the
principal-author and copyright lines for the adapted title page, and the
original edition facts for the **History** entry. Preserve the pinned
Quarto source link and publish any added front matter alongside its source.
[GNU FDL 1.3, section 4](https://www.gnu.org/licenses/fdl-1.3.en.html#section4)

## Inventory references

- [Repository license scopes and release checks](../../LICENSING.md)
- [Blue 3 manual source notes](../manual/README.md)
- [GFDL 1.3 text](../manual/COPYING.GFDL)
- [Screenshot capture provenance](../manual/images/README.md)
- [CLI package notices](../../packages/blue-cli/THIRD_PARTY_NOTICES.md)
- [Blue Data package notices](../../packages/blue-data/THIRD_PARTY_NOTICES.md)
- [Current dependency inventory](../dependency-license-inventory.md)
- [Copyright and attribution research](../../specs/122-gh-pages-site/research.md#copyright-and-attribution)
