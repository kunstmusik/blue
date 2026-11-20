# Blue Projects Skill Contract

- Ship `skills/blue-projects/SKILL.md` with valid name and description frontmatter. Keep references and the sample project inside the skill folder so they work after installation. Include the repository-default license for the original skill material.
- The public install command is `npx skills add kunstmusik/blue --skill blue-projects`. For reproducible validation, install from the GitHub tree URL for the matching npm release tag.
- The main instructions help the agent choose between a data workflow for inspection or targeted edits and the CLI for compilation. They state the compatible npm version, tools and prerequisites, where the outputs go, and how to verify them.
- The Node reference uses the documented package-root API. It surfaces loader diagnostics, finds project properties, saves a targeted edit to a sibling file, and reloads it to verify the edit. Include one small original fixture with no external assets so the example can be run independently.
- The compile workflow names disk, realtime, and Blue Live modes, explains when Java is required, and identifies project code and external command execution as part of compilation. The default workflow writes a CSD to a separate output path and checks the resulting CSD.
- Acceptance uses one clean supported-agent workspace. Confirm that the named skill and its local references are available after installation and run both workflows at the corresponding package versions.
