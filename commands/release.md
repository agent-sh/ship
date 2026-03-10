---
description: Create a versioned release with automatic ecosystem and tooling detection.
codex-description: 'Use when user asks to "release", "cut a release", "bump version", "create release", "tag release", "publish version", "new version". Discovers how the repo releases and executes it.'
argument-hint: "[patch|minor|major] [--dry-run] [--skip-publish] [--skip-changelog] [--yes]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git:*), Bash(npm:*), Bash(cargo:*), Bash(go:*), Bash(python:*), Bash(pip:*), Bash(twine:*), Bash(mvn:*), Bash(gradle:*), Bash(gh:*), Bash(make:*), Bash(node:*), Bash(npx:*), Bash(sed:*), Bash(just:*), Bash(goreleaser:*), Skill, Task
---

# /release - Versioned Release Workflow

Spawn the release agent to discover how this repo releases and execute it.

```
Task:
  subagent_type: "release-agent"
  prompt: |
    Perform a release in this repository.
    Arguments: $ARGUMENTS
    Follow the release-agent workflow. Report the result.
```

See `agents/release-agent.md` for discovery logic, constraints, and error handling.
