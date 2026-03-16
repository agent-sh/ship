# Changelog

## [Unreleased]

## [1.1.1] - 2026-03-16

### Added

- feat: add discovery-first `/release` command with release-agent and release skill - supports 12+ ecosystems and 7 release tool configurations (#7)
- feat: add pre-release health check from repo-intel (#13)
- feat: pre-fetch health data in release command (#15)

### Fixed

- fix: handle `gh pr merge` in worktree context - detect worktree and use remote-only merge strategy (#3)

## [1.0.0] - 2026-02-21

Initial release. Extracted from [agentsys](https://github.com/agent-sh/agentsys) monorepo.
