# Blue 3 manual cutover

The Blue 3 manual is the active desktop documentation. On 2026-11-21, the maintainer decided to retire the legacy Java Blue public site and archive its `blue-manual` repository. Old bookmarks and third-party links may stop working after retirement.

## First Pages deployment

On 2026-11-23, GitHub Actions published `b8261fb87e26a8cebfd429fb5b2ecbf5688d9125` from `develop`. The `github-pages` environment permits deployments from `develop`. The live publication catalog and inventory matched the verified production artifact byte for byte. [Production run](https://github.com/kunstmusik/blue/actions/runs/45292127111)

The public homepage, Blue Projects skill page, and manual selector returned HTTP 200. The selector recommended **Blue 3.0.0-beta.6 (prerelease)**, and the fixed edition identified source `308bc5c8ae479a44a047a96531edb1d673253069`. The Score timeline chapter and its screenshot loaded. The About page showed contributor credits, the GFDL and Quarto notices were accessible, and the source and screenshot-credit links pointed to files at the pinned revision. [Public documentation](https://kunstmusik.github.io/blue/) · [Verified manual edition](https://kunstmusik.github.io/blue/manual/v3.0.0-beta.6/)

## Product-site link

On 2026-11-23, the live **View Manual** link in the product site's Documentation section pointed to the Blue 3 manual selector. The selector returned HTTP 200 and recommended Blue 3.0.0-beta.6. The active repository documentation and project-site source had no remaining links to the legacy Pages URL. [Blue product site](https://blue.kunstmusik.com/) · [Manual selector](https://kunstmusik.github.io/blue/manual/)

## Legacy retirement

On 2026-11-23, the maintainer confirmed retirement. GitHub reported `blue-manual` as archived with Pages disabled, and a cache-busted request to the legacy site returned HTTP 404. The archived repository remains available as the pinned historical source for attribution. [Archived repository](https://github.com/kunstmusik/blue-manual) · [Manual provenance](provenance.md)
