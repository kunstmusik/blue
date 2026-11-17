# Maintaining the changelog

[CHANGELOG.md](../CHANGELOG.md) is the source for Blue's user-facing release
notes. It uses [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).
Put `Unreleased` first, followed by dated version entries in reverse release
order. Use `## [version] - YYYY-MM-DD` for releases and the applicable
`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security` headings.
Use the release date on the maintainer's calendar for historical entries.

## During development

Contributors add notable user-facing changes to `Unreleased` as they land.
Describe what users can do or what behavior changed. Include compatibility,
migration steps, or required versions when they affect an upgrade. Group
related changes, and include internal work when it has a visible effect such
as lower memory use or different platform support. Leave routine refactors,
CI maintenance, and test changes in Git history.

`Unreleased` is cumulative for the next **stable** release. Keep changes there
when they first ship in a beta or release candidate. The first Blue 3 stable
entry describes the upgrade from Java Blue 2.10.x, including changes that
predate the first Blue 3 beta.

## When preparing a release

1. For a beta or release candidate, add a short dated entry for the new
   version. Cover changes since the preceding published build in the same
   series, including the last beta when cutting the first RC. For the first
   preview in a series, summarize changes since the previous stable release.
   A few bullets are usually enough. Call out what testers should retest and
   any important known issues or upgrade steps. Keep `Unreleased` intact.
2. For a stable release, review and move the cumulative `Unreleased` draft
   into the dated version section, then reopen an empty `Unreleased` section.
   Include all notable changes since the previous stable release, even those
   already mentioned in prereleases. Consolidate related entries and drop
   regressions that were introduced and fixed within the prerelease cycle.
   Make compatibility changes, runtime requirements, and upgrade steps easy
   to find. Keep the historical beta and RC entries.
3. Link the version heading to the relevant GitHub tag comparison. Use the
   same baseline as the notes. If the two versions lack shared Git history,
   as with Java Blue 2.10.3 and Blue 3, link to the new tag's release page and
   state the upgrade baseline in the entry.
4. Review the changelog section alongside the app version bump and include
   both in the commit to be tagged. Follow the [release guide](release-guide.md)
   to validate, tag, and publish the build.

## Publishing on GitHub

The tagged workflow currently publishes installation and runtime instructions,
asset verification details, and GitHub-generated notes. After it succeeds,
edit the GitHub release body to add the matching `CHANGELOG.md` section above
the installation instructions. Keep the installation, runtime, and checksum
information. Use the comparison link from the version entry if the generated
link uses a different baseline. For stable releases, include the full section
so the release page also serves users upgrading from the previous stable
version.
