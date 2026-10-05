# Changelog

## [Unreleased]

### Changed

- Second pass over the prompts for current models: "Never" rules read as plain instructions with their reasons, and /ship Phase 1 no longer restates the target-branch defaults from Arguments. The command, agent, skill and AGENTS.md files went from 5,202 to 5,171 words.
- AGENTS.md drops the generic model table and the GPU validation text this CPU-only repo does not need, lists the commands that exist (`npm test` and agnix; there is no `npm run validate` script), and gains an Overview that says `lib/` is synced from agent-core.

### Fixed

- `lib/agentsys.js` is back. The 2026-04-25 lib sync (#25) ran the old mirroring sync (`rm -rf lib && cp`), which deleted it, but `/release` still requires it for the pre-release health check, so that check was always skipped with a `Cannot find module` reason. The file now comes from agent-core, the same copy enhance, deslop and drift-detect carry.
- `npm test` runs `tests/*.test.js`, so CI runs the resolver tests. They failed 7 of 7 without the resolver, and nothing ran them.

## [1.2.0] - 2026-09-24

### Changed

- Rewrote every command, agent and skill prompt for current models: goal, constraints with reasons, definition of done, and output contract instead of step-by-step choreography, all-caps rules, and pseudocode. Total prompt size went from 9,166 to 4,904 words.
- CI waits use `gh pr checks --watch` and bounded background waits instead of fixed `sleep` calls and polling loops. The mandatory 3-minute sleep is gone: ship waits for a review bot only when recent PRs show one posting without a check run.
- Review feedback is triaged instead of treated as all-required: fix what is correct, answer what is wrong or out of scope, and on repos without write access never resolve maintainer threads, reply only where a maintainer asked, and stop before merge.
- Standalone review (Phase 5) is one pass by default, split across at most 3 parallel reviewers only for large diffs. It no longer spawns a nonexistent `review` subagent type.
- Production rollback reverts the promotion merge commit (`git revert -m 1`) and pushes normally instead of `git reset --hard HEAD~1` plus a force push. Promotion uses `--no-ff` so there is always one merge commit to revert.
- `/release` confirms the plan in the command, between a `plan only` and an `execute` pass of the release agent, because a subagent cannot ask the user. It now spawns `ship:release-agent` (prefixed), and the agent reads the release skill file directly since the skill has `disable-model-invocation` set.

### Fixed

- Cleanup no longer force-removes every other git worktree in the repository. It removes only the worktree `/next-task` created for this task, without `--force`, and leaves it in place if it has uncommitted changes.
- Cross-plugin agents (`next-task:ci-fixer`) are optional: without them, or without a `Task` tool, the work is done inline.

## [1.1.2] - 2026-04-26

### Security

- Deployment health check uses platform APIs (Railway, Vercel, Netlify status fields) instead of grep-ing log output for "error"/"exception"/"fatal" word density. Previously attacker-controlled log lines could inflate the error count past the >20 threshold and trigger rollback-to-previous (production DoS).

## [1.1.1] - 2026-03-16

### Added

- feat: add discovery-first `/release` command with release-agent and release skill - supports 12+ ecosystems and 7 release tool configurations (#7)
- feat: add pre-release health check from repo-intel (#13)
- feat: pre-fetch health data in release command (#15)

### Fixed

- fix: handle `gh pr merge` in worktree context - detect worktree and use remote-only merge strategy (#3)

## [1.0.0] - 2026-02-21

Initial release. Extracted from [agentsys](https://github.com/agent-sh/agentsys) monorepo.
