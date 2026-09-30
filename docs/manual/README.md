# Blue 3 manual

The Quarto source here is versioned with the Blue 3 application. From the
repository root, run:

```sh
quarto render docs/manual --to html
```

Open `docs/manual/_build/html/index.html` to inspect the same HTML book that is
included in application packages. Quarto is needed to build packages, but not
to run an installed application. Generated output is ignored by Git. `offline-fonts.scss` disables theme web-font
imports and uses system fonts so installed pages make no font-network requests.

All 94 Blue 2 source topics have been reviewed, consolidated into the 35 current
Blue 3 chapters, or identified as historical-only. The original is maintained
in the [upstream manual repository](https://github.com/kunstmusik/blue-manual/tree/7a92066a2aa8f0370026ba9527c158643c2935a1), pinned for comparison to commit
`7a92066a2aa8f0370026ba9527c158643c2935a1`. This repository contains the current edition and its license,
without a duplicate of the original source or images.

See the [integration issue ledger](../../specs/114-integrate-blue-manual/manual-issues.md)
and [chapter-by-chapter textual comparison](../../specs/114-integrate-blue-manual/manual-changes.md).

The book groups current pages under Working in Blue, Concepts,
SoundObjects, Instruments, Note Processor reference, Tools, Other features
and tasks, and Reference. SoundObject Library belongs in Working in Blue.
Several older single-topic pages now share a concise reference chapter;
the upstream original keeps the full historical detail.

The manual text is licensed under the GNU Free Documentation License 1.3 as
stated in the original manual. See `COPYING.GFDL`. Keep the attribution and license. Current UI screenshots use disposable
projects; see [screenshot provenance](images/README.md). Recapture affected
images when controls or layout change, and verify captions and offline loading.

The separate repository retains its GitHub Pages publishing workflow for the
older manual. Online publication for Blue 3 needs a destination and versioning
policy before being enabled here.
