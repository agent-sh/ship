---
name: release
description: "Generic release workflow for repositories without a dedicated release tool. Handles version bump, changelog, test, tag, push, GitHub release, and optional publish."
version: 0.3.0
argument-hint: "[patch|minor|major] [--dry-run] [--skip-publish] [--skip-changelog] [--profile=JSON]"
disable-model-invocation: true
---

# release

The manual release path, used by `ship:release-agent` when discovery found a package manifest but no release tool or script. Input (`$ARGUMENTS`) is the bump level, flags, and the discovery profile (`--profile=JSON`: ecosystem, manifests, `currentVersion`, `tagPrefix`, `changelogFile`, `testCommand`, `publishCommand`, `ciRelease`).

Done means: the version is bumped in every manifest, the changelog has a section for it (unless `--skip-changelog`), tests passed, the release commit and an annotated tag are pushed, a GitHub release exists, and the package is published unless `--skip-publish`, the ecosystem is tag-only, or a CI workflow publishes on tag push.

## Constraints

- Start on the default branch, clean tree, up to date (`git pull --ff-only`). A release cut from a stale or dirty tree ships code nobody reviewed.
- Tests run after the bump and before the commit. On failure, `git checkout -- .` to revert the bump and stop.
- Never force-push and never move a tag.
- Push the release commit before creating the tag. If branch protection rejects the push, push a `release/<tag>` branch and open a PR instead, and create the tag on the merged commit after it lands. A tag made before the push would point at a commit that never reaches the default branch.
- With `--dry-run`, print the plan below and change nothing.

## Version

New version is plain semver arithmetic on `currentVersion` (`patch` 1.2.3 -> 1.2.4, `minor` -> 1.3.0, `major` -> 2.0.0). Tag is `<tagPrefix><newVersion>`, prefix `v` by default.

| Ecosystem | Read | Bump |
|---|---|---|
| npm | `node -p "require('./package.json').version"` | `npm version <new> --no-git-tag-version` |
| cargo | `version =` in `Cargo.toml` (workspace root for workspaces) | Edit the field in each crate on the old version, then `cargo check` to refresh `Cargo.lock` |
| python | `[project]` or `[tool.poetry]` `version` in `pyproject.toml` | Edit the field |
| maven | `mvn help:evaluate -Dexpression=project.version -q -DforceStdout` | `mvn versions:set -DnewVersion=<new> -DgenerateBackupPoms=false` |
| go, swift | latest tag | tag only |
| other | the manifest's version field | edit it |

## Changelog

Take commits since the last tag (`git log <last-tag>..HEAD --oneline --no-merges`) and add a `## <tag> - <YYYY-MM-DD>` section at the top of the changelog, following the file's existing format (Keep a Changelog headings, or whatever it already uses). Group by conventional-commit type when the history uses it: `feat` under Added, `fix` under Fixed, `refactor`/`perf` under Changed, `docs` under Documentation. Write entries for users, not commit subjects copied verbatim.

## Test, commit, tag, push

```bash
<testCommand>                                   # npm test, cargo test, pytest, go test ./..., mvn test, gradle test
git add <manifests> <lockfiles> <changelog>
git commit -m "release: <tag>"
git push origin <default-branch>          # rejected: open a release PR instead, see Constraints
git tag -a "<tag>" -m "Release <tag>"
git push origin "<tag>"
gh release create "<tag>" --title "<tag>" --generate-notes --latest
```

## Publish

Skip for tag-only ecosystems, `--skip-publish`, or when `ciRelease` publishes on the tag push.

| Ecosystem | Command |
|---|---|
| npm | `npm publish --access public` |
| cargo | `cargo publish` (workspace: in dependency order) |
| python | `python -m build && twine upload dist/*` |
| maven | `mvn deploy` |
| gradle | `gradle publish` |
| rubygems | `gem build && gem push *.gem` |
| nuget | `dotnet pack && dotnet nuget push` |
| dart | `dart pub publish` |
| hex | `mix hex.publish` |

A failed publish after a pushed tag is a `[WARN]`, not a rollback: report it so the user can retry the publish alone.

## Plan (for `--dry-run`) and report

```
Release Plan
  Ecosystem: <ecosystem>
  Version: <current> -> <new> (<bump>)
  Tag: <tag>
  Commits since last tag: <n>
  Changelog: <will update|skip>
  Publish: <command|by CI|skip>
  [DRY RUN] No changes made
```

```
[OK] Released <tag>
  Version bumped: <current> -> <new>
  Changelog: <updated|skipped>
  Tag: <tag> pushed
  GitHub release: https://github.com/<owner>/<repo>/releases/tag/<tag>
  Published: <registry|by CI|skipped|tag-only>
```
