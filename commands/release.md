---
description: Create a versioned release with automatic ecosystem and tooling detection.
codex-description: 'Use when user asks to "release", "cut a release", "bump version", "create release", "tag release", "publish version", "new version". Discovers how the repo releases and executes it.'
argument-hint: "[patch|minor|major] [--dry-run] [--skip-publish] [--skip-changelog] [--yes]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git:*), Bash(npm:*), Bash(cargo:*), Bash(go:*), Bash(python:*), Bash(pip:*), Bash(twine:*), Bash(mvn:*), Bash(gradle:*), Bash(gh:*), Bash(make:*), Bash(node:*), Bash(npx:*), Bash(sed:*), Bash(just:*), Bash(goreleaser:*), Skill, Task
---

# /release

Cut a release the way this repo already releases. The release agent discovers the method, you confirm the plan with the user, then the agent executes it.

1. **Health context (optional).** If `<stateDir>/repo-intel.json` exists (`stateDir` is the first of `.claude`, `.opencode`, `.codex` that exists), load the agentsys runtime (`require("${CLAUDE_PLUGIN_ROOT}/lib/agentsys").get().repoIntel`) and collect `queries.health(cwd)` and `queries.bugspots(cwd, { limit: 5 })`. Pass them to the agent as informational context. If the runtime is older than v5.8.6 or anything fails, print one `[INFO] Pre-release health check skipped: <reason>` line and continue. Health data never blocks a release.

2. **Plan.** Spawn `ship:release-agent` with the arguments, the health context, and the instruction `plan only`. It returns the release profile and the exact commands it would run. If `Task` is unavailable, read `${CLAUDE_PLUGIN_ROOT}/agents/release-agent.md` and do its discovery yourself.

3. **Confirm.** Show the plan to the user and ask to proceed (AskUserQuestion, or plain text if that tool is missing). Skip the question with `--yes`. Stop after this step with `--dry-run`. Publishing and pushing a tag are public and hard to undo, which is why a human confirms first.

4. **Execute.** Spawn `ship:release-agent` again with the confirmed profile and `execute`. Report its summary verbatim.
