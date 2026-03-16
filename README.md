# ship

End-to-end PR workflow - commit, push, create PR, monitor CI, address every review comment, merge, deploy, validate - plus discovery-first release automation.

## Why

Shipping code involves a long tail of manual steps after the code is written: staging, committing, pushing, writing PR descriptions, waiting for CI, reading reviewer comments, pushing fixes, re-waiting, merging, cleaning up branches. ship handles all of it. It also enforces a discipline most developers skip: addressing every single review comment before merge.

**Use cases:**
- Ship a feature branch to production with zero manual steps after invocation
- Let auto-reviewers (Copilot, Gemini, CodeRabbit) run and address all their feedback automatically
- Cut a versioned release without knowing how the repo's release tooling works
- Dry-run a ship or release to see what would happen

## Installation

```bash
agentsys install ship
```

Requires [agentsys](https://github.com/agent-sh/agentsys) runtime.

## Quick Start

```
/ship                         # Full workflow: commit, PR, CI, review, merge
/ship --dry-run               # Show what would happen without executing
/ship --strategy rebase       # Use rebase merge instead of squash
/ship --base develop          # Target a non-default branch

/release                      # Patch release (auto-discovers release method)
/release minor                # Minor version bump
/release major --dry-run      # Preview major release
/release --skip-publish       # Tag and changelog only, no registry publish
/release --yes                # Skip confirmation prompt
```

## How /ship Works

| Phase | Description |
|-------|-------------|
| 1 | **Pre-flight** - detect CI platform, deploy platform, branch strategy, verify tools |
| 2 | **Commit** - stage changes (excluding secrets), generate semantic commit message |
| 3 | **Create PR** - push branch, open PR with summary and test plan |
| 4 | **CI & Review Loop** - wait for CI, wait 3 min for auto-reviewers, address all comments, iterate until zero unresolved threads (max 10 iterations) |
| 5 | **Internal Review** - 4 parallel review passes (standalone only; skipped when called from /next-task) |
| 6 | **Merge** - verify mergeable status, confirm zero unresolved threads, merge with chosen strategy |
| 7-10 | **Deploy & Validate** - platform-specific deployment, health checks, auto-rollback on failure |
| 11 | **Cleanup** - remove worktrees, close linked issues, delete branches |
| 12 | **Report** - final status summary |

### The review loop is mandatory

Phase 4 always runs - even when invoked from `/next-task`. After PR creation, ship waits 3 minutes for auto-reviewers to post, then enters a loop:

1. Check CI status (fix failures via ci-fixer agent if needed)
2. Fetch all unresolved comment threads
3. Classify each comment (code fix, style suggestion, question, false positive)
4. Apply fixes or post replies
5. Push, wait 30 seconds, repeat

The loop exits only when unresolved threads reach zero.

### Platform detection

ship auto-detects your project's CI and deployment setup:

- **CI**: GitHub Actions, GitLab CI, CircleCI, Jenkins
- **Deploy**: Railway, Vercel, Netlify, or branch-based strategies
- **Branch strategy**: single-branch (main) or multi-branch (dev/prod)

## How /release Works

The release agent uses a discovery-first approach - it inspects your repo before executing anything.

**Discovery order:**
1. Release tool configs (semantic-release, release-it, goreleaser, changesets, cargo-release, lerna, standard-version)
2. CI release workflows (tag-triggered publish jobs)
3. Release scripts (Makefile targets, npm scripts, shell scripts)
4. Package manifests for ecosystem detection

**Supported ecosystems:** npm, Cargo, Python (pyproject.toml, setup.py), Go, Maven, Gradle, RubyGems, NuGet, Dart, Composer, Hex, Swift.

**Constraints:** Tests must pass before tagging. Version bump is reverted if tests fail. Tags are never force-pushed.

## Agents

| Agent | Model | Role |
|-------|-------|------|
| release-agent | Sonnet | Discover release method and execute versioned releases |

## Integration with /next-task

When called from the next-task workflow (via `--state-file`), ship skips its internal review (Phase 5) and deslop/docs steps since next-task already ran those. Phase 4 (CI & review loop) still runs because external auto-reviewers comment after PR creation.

## Requirements

- [agentsys](https://github.com/agent-sh/agentsys) runtime
- GitHub CLI (`gh`) - required for PR operations
- Git 2.20+
- Node.js 18+

## Related Plugins

- [next-task](https://github.com/agent-sh/next-task) - full task-to-production orchestrator (calls ship as Phase 12)
- [deslop](https://github.com/agent-sh/deslop) - AI slop cleanup (used in standalone review)
- [sync-docs](https://github.com/agent-sh/sync-docs) - documentation sync (used in standalone mode)

## License

MIT
