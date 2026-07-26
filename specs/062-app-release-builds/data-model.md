# Data Model: Blue App Builds and Releases

## Distribution Package

| Field                | Description                                | Validation                                                                                                                  |
| -------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `platform`           | Target operating system                    | One of macOS, Windows, or Linux                                                                                             |
| `architecture`       | Processor architecture                     | Hosted artifacts support macOS arm64, Windows x64, and Linux x64; macOS x64 is local-only and not part of the published set |
| `format`             | User-downloadable bundle type              | ZIP in Actions and GitHub Releases; contains a DMG on macOS, NSIS installer on Windows, and AppImage plus Debian package on Linux |
| `version`            | Version information embedded in the name   | Stable uses the application version; pull-request and develop artifacts append their PR number or short source revision     |
| `sourceRevision`     | Immutable commit that produced the package | Required in package/release metadata                                                                                        |
| `checksum`           | Integrity checksum for downloaded asset    | Required before publication                                                                                                 |
| `verificationStatus` | Package completion evidence                | Must be successful before stable publication; includes resource smoke checks, checksums, and future signing evidence only when a signed-release path is enabled |

## Build Run

| Field            | Description                                              | Validation                                                                                                           |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `kind`           | Pull-request validation, develop Actions build, or stable release | Determines trigger, artifact retention, protected publication approval, and publication behavior                 |
| `sourceRevision` | Commit checked out by the runner                         | Immutable and recorded in release metadata                                                                           |
| `targetMatrix`   | Required platform and architecture combinations          | Every required target must report before stable promotion                                                            |
| `state`          | Build lifecycle state                                    | `queued` -> `building` -> `verified` -> `staged` -> `published`, with `failed` terminal at any pre-publication stage |
| `logs`           | Diagnostic output retained by the automation service     | Sensitive values are redacted and never included in public release text                                              |

## Release

| Field              | Description                                     | Validation                                                                                                         |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `channel`          | Stable public release                            | Develop builds remain Actions artifacts and do not create a Release; stable is published only after all required assets pass |
| `tag`              | Repository tag associated with the release      | Stable tag has the `vX.Y.Z` shape and equals the application version                                                |
| `assets`           | Complete package set and checksum manifest      | Exact expected asset set only; no duplicates, missing targets, or unexpected replacement assets                    |
| `notes`            | Human-readable changes and source link          | Must identify the version and source revision                                                                      |
| `publicationState` | Visibility of the release                       | `draft` until artifact verification is complete, then `published`; failure leaves it unpublished or removes it     |

## Release Credential

| Field          | Description                                                               | Validation                                                                                 |
| -------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `name`         | Environment-variable or GitHub Environment secret/variable name           | Listed in the release guide with usage and scope                                           |
| `scope`        | Local-only, protected GitHub Environment, or workflow-provided            | Future production signing credentials are never available to PR, CI, development, or current stable package jobs |
| `purpose`      | Release publication or future macOS signing/notarization and Windows cloud signing | No credential is provided to jobs that do not require it                            |
| `availability` | Whether a build may proceed when absent                                          | Unsigned local/development/stable flows may proceed without signing credentials     |

## Relationships and State Rules

- One **Build Run** produces one ZIP bundle for each hosted target; the Linux x64 ZIP contains both the AppImage and Debian package.
- A stable ZIP uses the exact filename `blue-{os}-{cputype}-{version}.zip` in both GitHub Actions and the GitHub Release.
- A **Release** owns the complete package set from one successful Build Run and one source revision.
- A stable **Release** cannot transition from `draft` to `published` until every package is verified and protected publication approval has passed.
- A **Release Credential** may be read only by the protected stable-release job that needs it. Future signing credentials must remain unavailable to current unsigned package jobs. No credential or credential value enters Blue project data, application settings, artifacts, or release notes.
