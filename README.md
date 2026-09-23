# ship

End-to-end PR workflow: commit, push, create PR, monitor CI, handle review feedback, merge, deploy, validate. Plus discovery-first release automation.

## Why

Shipping code has a long tail of manual steps after the code is written: staging, committing, pushing, writing the PR description, waiting for CI, reading reviewer comments, pushing fixes, merging, cleaning up branches. ship handles all of it, and it does not call a PR done while review feedback is still unanswered.

**Use cases:**
- Ship a feature branch to production with no manual steps after invocation
- Let auto-reviewers (Copilot, Gemini, CodeRabbit, a Claude or Codex review workflow) run, then fix or answer their feedback
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
| 1 | **Pre-flight** - detect CI platform, deploy platform, branch strategy, write access |
| 2 | **Commit** - run tests, stage changes by path (never secrets), write a conventional commit |
| 3 | **Create PR** - push the branch, open or reuse the PR |
| 4 | **CI & Review Loop** - wait on checks with `gh pr checks --watch`, fix failures, fix or answer every review thread, repeat (max 5 rounds) |
| 5 | **Internal Review** - one review pass, split across up to 3 parallel reviewers only for large diffs (standalone only; skipped when called from /next-task) |
| 6 | **Merge** - verify mergeable, zero unresolved threads, green checks, then merge with the chosen strategy |
| 7-10 | **Deploy & Validate** - platform-specific deploy waits, health checks, revert-based rollback on failure |
| 11 | **Cleanup** - remove only the worktree and branch this run (or its /next-task run) created, close the linked issue |
| 12 | **Report** - final status summary |

### The review loop always runs

Phase 4 runs even when invoked from `/next-task`, because CI and external reviewers only see the code once the PR exists. Each round waits for checks without fixed sleeps, fixes CI failures, then triages every comment: fix what is correct, answer what is wrong or out of scope, answer questions. On your own repo it resolves the threads it handled. On a repo you do not have write access to, it never resolves threads, replies only where a maintainer asked, and stops at "ready for review" instead of merging.

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

The agent first returns a plan, `/release` confirms it with you (skip with `--yes`), then the agent executes it.

**Constraints:** Tests must pass before tagging. Version bump is reverted if tests fail. Tags are never force-pushed.

## Agents

| Agent | Model | Role |
|-------|-------|------|
| release-agent | Sonnet | Discover release method and execute versioned releases |

## Integration with /next-task

When called from the next-task workflow (via `--state-file`), ship skips its internal review (Phase 5) since next-task already ran one. Phase 4 (CI & review loop) still runs because external reviewers comment after PR creation. After the merge, ship removes the worktree next-task created for the task and releases the task from the registry.

## Requirements

- [agentsys](https://github.com/agent-sh/agentsys) runtime
- GitHub CLI (`gh`) - required for PR operations
- Git 2.20+
- Node.js 18+

## Related Plugins

- [next-task](https://github.com/agent-sh/next-task) - full task-to-production orchestrator (calls ship as Phase 12)
- [deslop](https://github.com/agent-sh/deslop) - AI slop cleanup, useful before shipping
- [sync-docs](https://github.com/agent-sh/sync-docs) - documentation sync, useful before shipping

## License

MIT
