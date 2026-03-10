---
name: release
description: "Generic release workflow for repositories without a dedicated release tool. Handles version bump, changelog, test, tag, push, GitHub release, and optional publish."
version: 0.2.0
argument-hint: "[patch|minor|major] [--dry-run] [--skip-publish] [--skip-changelog] [--profile=JSON]"
disable-model-invocation: true
---

# release

Generic release workflow used as a fallback when no dedicated release tool (semantic-release, release-it, goreleaser, etc.) is configured. Called by the release-agent after discovery.

## When to Use

This skill is invoked by `release-agent` with `method: "manual"` - meaning no release tool config or release script was found. The agent passes a `--profile=` argument with the discovery results.

For repos that already use a release tool, the agent delegates to that tool directly and does NOT invoke this skill.

## Arguments

Parse from `$ARGUMENTS`:

| Argument | Values | Default | Description |
|---|---|---|---|
| bump | patch, minor, major | patch | Semver bump level |
| `--dry-run` | flag | - | Show plan without executing |
| `--skip-publish` | flag | - | Tag and release but don't publish |
| `--skip-changelog` | flag | - | Skip changelog update |
| `--profile=JSON` | string | - | Discovery profile from release-agent |

## Workflow

### Phase 1: Validate Prerequisites

```bash
# Must be on main/master branch
CURRENT_BRANCH=$(git branch --show-current)
MAIN_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
if [ "$CURRENT_BRANCH" != "$MAIN_BRANCH" ]; then
  echo "[ERROR] Must be on $MAIN_BRANCH to release (currently on $CURRENT_BRANCH)"
  exit 1
fi

# Must be clean working tree
if [ -n "$(git status --porcelain)" ]; then
  echo "[ERROR] Working tree is dirty. Commit or stash changes first."
  exit 1
fi

# Pull latest
git pull origin "$MAIN_BRANCH"
```

### Phase 2: Read Version

Use the profile to determine where the version lives.

**npm** (package.json):
```bash
CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)")
```

**cargo** (Cargo.toml):
```bash
CURRENT_VERSION=$(grep '^version' Cargo.toml | head -1 | sed 's/.*"\(.*\)"/\1/')
```

**python** (pyproject.toml):
```bash
CURRENT_VERSION=$(grep -m1 'version' pyproject.toml | sed 's/.*"\(.*\)"/\1/')
```

**go** (tags only):
```bash
CURRENT_VERSION=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo "0.0.0")
```

**maven** (pom.xml):
```bash
CURRENT_VERSION=$(grep -m1 '<version>' pom.xml | sed 's/.*<version>\(.*\)<\/version>.*/\1/' | sed 's/-SNAPSHOT//')
```

**Other ecosystems**: Read version from the manifest file identified in the profile.

### Phase 3: Calculate New Version

```javascript
const [major, minor, patch] = currentVersion.split('.').map(Number);
const newVersion = bump === 'major' ? `${major + 1}.0.0`
  : bump === 'minor' ? `${major}.${minor + 1}.0`
  : `${major}.${minor}.${patch + 1}`;
```

Use the tag prefix from the profile (default `v`).

### Phase 4: Dry Run Check

If `--dry-run`, display the plan and stop:

```
Release Plan
  Ecosystem: {ecosystem}
  Current version: {currentVersion}
  New version: {newVersion} ({bump} bump)
  Tag: {tagPrefix}{newVersion}
  Commits since last tag: {count}
  Changelog: {will update | skip}
  Publish: {command | skip}
  [DRY RUN] No changes made
```

### Phase 5: Bump Version

**npm**:
```bash
npm version $NEW_VERSION --no-git-tag-version
```

**cargo** (single crate):

Use the Edit tool to replace `version = "{CURRENT}"` with `version = "{NEW}"` in Cargo.toml, then run `cargo check` to update Cargo.lock.

**cargo workspace**: Bump workspace version in root Cargo.toml. Individual crates matching the old version should also be bumped.

**python** (pyproject.toml):

Use the Edit tool to replace `version = "{CURRENT}"` with `version = "{NEW}"` in pyproject.toml.

**go**: No manifest to bump (version is tag-only).

**maven**:
```bash
mvn versions:set -DnewVersion=$NEW_VERSION -DgenerateBackupPoms=false
```

**Other**: Use sed or the appropriate ecosystem tool to update the version field.

### Phase 6: Update Changelog

Skip if `--skip-changelog`.

1. Generate commit log since last tag:
   ```bash
   LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
   if [ -n "$LAST_TAG" ]; then
     COMMITS=$(git log $LAST_TAG..HEAD --oneline --no-merges)
   else
     COMMITS=$(git log --oneline --no-merges -20)
   fi
   ```

2. If a changelog file exists (from profile), prepend a new version section:
   ```markdown
   ## {tagPrefix}{newVersion} - {YYYY-MM-DD}

   {Categorized commit summaries}
   ```

3. Categorize by conventional commit prefix:
   - `feat:` -> Added
   - `fix:` -> Fixed
   - `refactor:` / `perf:` -> Changed
   - `docs:` -> Documentation
   - Other -> Other

### Phase 7: Run Tests

Detect or use the test command from the profile:

| Ecosystem | Test Command |
|---|---|
| npm | `npm test` |
| cargo | `cargo test` |
| python | `pytest` or `python -m pytest` |
| go | `go test ./...` |
| maven | `mvn test` |
| gradle | `gradle test` |

If tests fail: revert version bump and abort.

```bash
# Revert on failure
git checkout -- .
echo "[ERROR] Tests failed - aborting release. Version bump reverted."
```

### Phase 8: Commit, Tag, Push

```bash
git add -A
git commit -m "release: {tagPrefix}{newVersion}"
git tag -a "{tagPrefix}{newVersion}" -m "Release {tagPrefix}{newVersion}"
git push origin $MAIN_BRANCH
git push origin "{tagPrefix}{newVersion}"
```

### Phase 9: Create GitHub Release

```bash
gh release create "{tagPrefix}{newVersion}" \
  --title "{tagPrefix}{newVersion}" \
  --generate-notes \
  --latest
```

### Phase 10: Publish (Optional)

Skip if `--skip-publish` or if ecosystem is tag-only (go, packagist, swift).

| Ecosystem | Publish Command |
|---|---|
| npm | `npm publish --access public` |
| cargo | `cargo publish` |
| python | `python -m build && twine upload dist/*` |
| maven | `mvn deploy` |
| gradle | `gradle publish` |
| rubygems | `gem build && gem push *.gem` |
| nuget | `dotnet pack && dotnet nuget push` |
| dart | `dart pub publish --force` |
| hex | `mix hex.publish` |

For cargo workspace: publish crates in dependency order.

## Output

```
[OK] Released {tagPrefix}{newVersion}
  Version bumped: {currentVersion} -> {newVersion}
  Changelog: {updated | skipped}
  Tag: {tagPrefix}{newVersion} pushed
  GitHub release: https://github.com/{owner}/{repo}/releases/tag/{tagPrefix}{newVersion}
  Published: {registry | skipped | tag-only}
```

## Constraints

- MUST be on main/master branch
- MUST have clean working tree
- MUST run tests before tagging
- MUST abort and revert if tests fail
- MUST use tag prefix from profile (default `v`)
- MUST generate release notes via `gh release create --generate-notes`
- NEVER publish without running tests first
- NEVER force-push tags
