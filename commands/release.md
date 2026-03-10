---
description: Create a versioned release with automatic ecosystem and tooling detection.
codex-description: 'Use when user asks to "release", "cut a release", "bump version", "create release", "tag release", "publish version", "new version". Discovers how the repo releases and executes it.'
argument-hint: "[patch|minor|major] [--dry-run] [--skip-publish] [--skip-changelog] [--yes]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git:*), Bash(npm:*), Bash(cargo:*), Bash(go:*), Bash(python:*), Bash(pip:*), Bash(twine:*), Bash(mvn:*), Bash(gradle:*), Bash(gh:*), Bash(make:*), Bash(node:*), Bash(npx:*), Bash(sed:*), Bash(just:*), Bash(goreleaser:*), Skill, Task
---

# /release - Versioned Release Workflow

Create a versioned release by first discovering how the repository releases, then executing the appropriate method.

## Constraints

- MUST discover release method before executing
- MUST run tests before tagging
- MUST abort and revert version bump if tests fail
- Plain text output, no emojis

## Execution

Spawn the release agent to handle discovery and execution:

```
Task:
  subagent_type: "release-agent"
  prompt: |
    Perform a release in this repository.
    Arguments: $ARGUMENTS

    Follow the release-agent workflow:
    1. Discover how this repo releases (tool configs, CI workflows, scripts, manifests)
    2. Build a release profile
    3. Execute the release using the discovered method
    4. If method is "manual" (no tool/script found), invoke the release skill

    Report the result.
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
