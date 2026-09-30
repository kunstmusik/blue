# Documentation artifact model

The manual artifacts add no application persistence schema. The accompanying
behavior repairs retain compatible project XML, use the existing document and
history contracts, preserve unknown instrument XML and keep generation/runtime
metadata disposable.

- **Manual source**: Quarto configuration, current .qmd chapters, and current screenshot assets under docs/manual; the original Blue 2 edition is identified by upstream commit. Git revision identifies the source version.
- **Rendered book**: Disposable HTML pages and assets generated under docs/manual/_build/html. It is reproducible from the source and excluded from Git.
- **Installed book**: Copy of the rendered book in application resources/assets/manual. It must include index.html and every local link target.
- **Menu command**: Stateless native action that chooses the development or installed book path and asks the operating system to open it.

The only transition is source → render → package. A render or package-input failure stops packaging; no migration or recovery of user project data is involved.
