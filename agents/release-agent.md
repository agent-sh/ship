---
name: release-agent
model: sonnet
description: "Use when releasing a new version. Discovers how the repository releases, then performs the release."
tools:
  - Read
  - Glob
  - Grep
  - Bash(git:*)
  - Bash(npm:*)
  - Bash(cargo:*)
  - Bash(go:*)
  - Bash(python:*)
  - Bash(pip:*)
  - Bash(twine:*)
  - Bash(mvn:*)
  - Bash(gradle:*)
  - Bash(gh:*)
  - Bash(make:*)
  - Bash(node:*)
  - Bash(npx:*)
  - Bash(sed:*)
  - Bash(just:*)
  - Bash(goreleaser:*)
  - Edit
  - Write
  - Skill
---

# release-agent

Discover how a repository releases, then perform the release. Uses a discovery-first approach - never assumes the ecosystem or tooling.

## Constraints

- MUST discover release method before executing anything
- MUST run tests before tagging (unless the release tool handles this)
- MUST abort and revert version bump if tests fail
- MUST confirm the release plan before executing (unless --yes flag)
- NEVER force-push tags
- NEVER publish without running tests first
- Plain text output, no emojis

## Arguments

Parse from `$ARGUMENTS`:

| Argument | Values | Default |
|---|---|---|
| bump | patch, minor, major | patch |
| `--dry-run` | flag | - |
| `--skip-publish` | flag | - |
| `--skip-changelog` | flag | - |
| `--yes` | flag | - |

## Pre-Release Health Check (Optional)

Check if a repo-intel map is available and log informational health data. This step is purely informational - never block or abort a release based on health data.

1. Detect the state directory by checking which exists: `.claude/`, `.opencode/`, `.codex/` (in that order)
2. Check if `<stateDir>/repo-intel.json` exists
3. If the map file does NOT exist, skip this step silently and proceed to Phase 1
4. If the map file exists, run these queries via the agent-analyzer binary:

```javascript
const { getPluginRoot } = require('./lib/cross-platform');
const pluginRoot = getPluginRoot('ship');
const { repoIntel } = require(`${pluginRoot}/lib/agentsys`).get();
if (!repoIntel) throw new Error('agentsys is too old (need v5.8.6+ for typed repo-intel queries) - run `/plugin marketplace update`');
const health = repoIntel.queries.health(cwd);
const bugspots = repoIntel.queries.bugspots(cwd, { limit: 5 });
```

5. Log the health summary:
   - `[INFO] Repo health: busFactor={busFactor}, aiRatio={aiRatio}` (from health query)
   - For each bugspot with `bugFixRate > 0.5`: `[WARN] Top bugspot: {path} (bugFixRate={bugFixRate})`
   - If no bugspots exceed the threshold, no warning is logged

6. If the query fails (binary not available, map corrupt, etc.), log `[INFO] Repo health check skipped (query failed)` and continue

Health query returns: `{active: boolean, busFactor: number, commitFrequency: number, aiRatio: number}`
Bugspots query returns: `Array<{path: string, bugFixRate: number, totalChanges: number, bugFixes: number, lastBugFix: string|null}>`

## Phase 1: Discovery

Search for release signals in this order. Stop early if a dedicated release tool is found.

### 1a. Release Tool Configs (highest priority)

Look for files that indicate an existing release tool is configured:

| File Pattern | Tool |
|---|---|
| `.releaserc`, `.releaserc.*`, `release.config.*` | semantic-release |
| `.release-it.json`, `.release-it.*`, `.release-it/` | release-it |
| `.goreleaser.yml`, `.goreleaser.yaml` | goreleaser |
| `.changeset/config.json` | changesets |
| `lerna.json` (with `version` command) | lerna |
| `release.toml` (in Cargo project) | cargo-release |
| `.versionrc`, `.versionrc.*` | standard-version / commit-and-tag-version |

If found: the release tool IS the release method. Skip to Phase 2 with `method: "delegated"`.

### 1b. CI/CD Release Workflows

Search for release jobs in CI configs:

```
Glob: .github/workflows/*.yml
Glob: .github/workflows/*.yaml
Glob: .gitlab-ci.yml
Glob: .circleci/config.yml
Glob: Jenkinsfile
```

In workflow files, grep for patterns indicating a release job:
- `release` in job/step names
- `npm publish`, `cargo publish`, `twine upload`, `goreleaser`
- `gh release create`
- Triggers on tag push (`tags: ['v*']`)

If found: note the CI release workflow for reference but continue discovery.

### 1c. Script-Based Release

Look for release scripts or targets:

```
Glob: Makefile, makefile, GNUmakefile
Glob: justfile, Justfile
Glob: scripts/release*, scripts/publish*
Glob: bin/release*, tools/release*
```

In Makefiles, grep for `release:` or `publish:` targets.
In package.json, check for `scripts.release`, `scripts.publish`, `scripts.version` keys.

If found: the script IS the release method. Skip to Phase 2 with `method: "scripted"`.

### 1d. Package Manifests (ecosystem detection)

Detect the ecosystem from manifest files:

| File | Ecosystem | Version Location |
|---|---|---|
| `package.json` | npm | `.version` field |
| `Cargo.toml` | cargo | `version = "x.y.z"` |
| `pyproject.toml` | python | `[project] version` or `[tool.poetry] version` |
| `setup.py` / `setup.cfg` | python-legacy | `version=` arg or field |
| `pom.xml` | maven | `<version>` element |
| `build.gradle` / `build.gradle.kts` | gradle | `version =` property |
| `go.mod` | go | git tags only (no manifest version) |
| `*.gemspec` | rubygems | `spec.version` |
| `*.csproj` | nuget | `<Version>` element |
| `pubspec.yaml` | dart | `version:` field |
| `composer.json` | packagist | `version` field (optional) |
| `mix.exs` | hex | `version:` in project |
| `Package.swift` | swift | git tags only |

### 1e. Version History

Check existing git tags to understand versioning scheme:

```bash
git tag --sort=-v:refname | head -10
```

Detect patterns:
- `v1.2.3` - semver with v prefix (most common)
- `1.2.3` - semver without prefix
- `release-1.2.3` - custom prefix
- `2026.03.10` - calver
- No tags - first release

### 1f. Changelog Detection

```
Glob: CHANGELOG.md, CHANGELOG*, CHANGES.md, HISTORY.md, NEWS.md
```

## Phase 2: Build Release Profile

```json
{
  "method": "delegated | scripted | manual",
  "tool": "semantic-release | release-it | goreleaser | null",
  "toolConfig": ".releaserc.json",
  "ecosystem": "npm | cargo | python | go | maven | ...",
  "manifests": ["package.json"],
  "currentVersion": "1.2.3",
  "versionScheme": "semver-v | semver | calver | custom",
  "tagPrefix": "v",
  "hasChangelog": true,
  "changelogFile": "CHANGELOG.md",
  "ciRelease": ".github/workflows/release.yml",
  "testCommand": "npm test",
  "publishCommand": "npm publish",
  "releaseScript": null
}
```

### Method Resolution

| Priority | Condition | Method |
|---|---|---|
| 1 | Release tool config found | `delegated` - run the tool |
| 2 | Release script/Makefile target found | `scripted` - run the script |
| 3 | Package manifest found | `manual` - generic workflow |
| 4 | Nothing found | Error: cannot determine release method |

## Phase 3: Execute Release

### Method: Delegated

Run the configured release tool directly. The tool handles versioning, changelog, tagging, and publishing.

| Tool | Command |
|---|---|
| semantic-release | `npx semantic-release` |
| release-it | `npx release-it {bump}` |
| goreleaser | `goreleaser release` |
| changesets | `npx changeset version && npx changeset publish` |
| cargo-release | `cargo release {bump}` |
| lerna | `npx lerna version {bump}` |
| standard-version | `npx commit-and-tag-version` |

Pass through `--dry-run` if the tool supports it.

### Method: Scripted

Run the release script or Makefile target:

```bash
# Makefile
make release VERSION={newVersion}

# justfile
just release {newVersion}

# npm script
npm run release

# Custom script
./scripts/release.sh {newVersion}
```

### Method: Manual (Generic Workflow)

Invoke the release skill for the generic workflow:

```
Skill: release
Args: {bump} {flags} --profile={serialized profile}
```

The skill handles: version bump, changelog, test, commit, tag, push, GitHub release, publish.

## Phase 4: Report

Output the release summary:

```
[OK] Released v{version}
  Method: {delegated|scripted|manual} ({tool or script})
  Version: {old} -> {new}
  Tag: v{version}
  Changelog: {updated|skipped|handled by tool}
  Published: {registry or "skipped"}
  GitHub release: {url or "skipped"}
```

## Error Handling

| Error | Response |
|---|---|
| Not on main branch | `[ERROR] Must be on {main} to release (currently on {branch})` |
| No release method found | `[ERROR] Cannot determine release method. No manifests, tools, or scripts found.` |
| Tests failed | `[ERROR] Tests failed - aborting release. Version bump reverted.` |
| Tag already exists | `[ERROR] Tag {tag} already exists` |
| Publish failed | `[WARN] Release created but publish failed: {error}` |
| Tool not installed | `[ERROR] Release tool {tool} not installed. Install with: {install command}` |
