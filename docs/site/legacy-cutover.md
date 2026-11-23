# Blue 3 manual cutover

The project will maintain the Blue 3 manual as its active desktop documentation. The maintainer decision on 2026-11-21 is to retire the legacy Java Blue public site and its `blue-manual` repository. Old bookmarks and third-party links may stop working after retirement.

## Verify the active manual

- Verify the public documentation home and open the recommended edition from the [Blue 3 manual selector](https://kunstmusik.github.io/blue/manual/).
- Confirm that the edition label and source revision match the catalog. Open a representative chapter and its image, then check the attribution, license, and matching Quarto source links.
- Record the deployment revision, edition, URL, and live check results here. Address any attribution or source-access obligations affected by legacy retirement before the separate retirement operation. [Manual provenance](provenance.md)

## Update the links we control

- Replace the existing **View Manual** destination on the product site's Documentation section with the verified Blue 3 manual selector. [Blue product site](https://blue.kunstmusik.com/)
- Check the active README, support, download, and documentation entry points the project controls for links that still direct readers to the old manual. Point any such readers to the verified Blue 3 manual. Keep provenance citations in their historical context.
- Follow each updated link from its published location. Record the source page, final destination, and result here.

## Retire the legacy site and repository

Once the live manual and controlled-link checks pass, obtain separate authorization to retire the legacy public site and repository. Record the authorized action and its outcome here. The [publication contract](../../specs/122-gh-pages-site/contracts/publication.md#legacy-cutover) defines the sequence.
