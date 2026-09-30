# Manual navigation and packaging contract

## Native menu

- All platforms: Help → Blue Manual. Help is the final menu, after Window.
- Open the installed local index in the default browser using a native host path.
- Report missing-index or OS-open errors to the user.

## Build and package

- Render the current Blue 3 book before validating package inputs.
- Fail the input gate and packaged smoke check if the manual index is absent.
- Copy the rendered HTML book to `resources/assets/manual`, including the license and current screenshots.
- Use system fonts and omit remote font imports so pages make no background network requests.
- Ignore generated output in Git. Chapter and screenshot links resolve locally without network access.
- Keep the 35 current chapter filenames explicitly listed in Quarto render and navigation.
- Include no duplicate original source, Java images, or unreviewed draft routes.

## Source and attribution

- Identify the upstream Blue 2 source by repository and immutable commit in the README and About chapter.
- Preserve author/contributor attribution and `COPYING.GFDL` locally.
- Map all 94 upstream source topics to current chapters in `manual-issues.md`.
- Summarize textual changes for each current chapter in `manual-changes.md`.

## Screenshots

- Capture actual Blue 3 controls in an isolated app using disposable projects.
- Include descriptive alternative text, captions, and provenance for each image.
- Bundle current screenshots and verify that they load in the local and installed book.
- Recapture affected views when layout or controls change.
