# ship

> Complete PR workflow from commit to production with validation

## Overview

An agentsys plugin: Markdown prompts in `commands/`, `agents/` and `skills/`, and Node.js helpers in `lib/` (platform detection, tool checks, workflow state). Plain CommonJS, no build step. `lib/` is synced from [agent-core](https://github.com/agent-sh/agent-core), so change shared code there: a local edit is overwritten by the next sync PR.

## Agents

- release-agent

## Skills

- release

## Commands

- ship-ci-review-loop
- ship-deployment
- ship-error-handling
- ship
- release

## Conventions

- Output is plain text with the status markers `[OK]`, `[ERROR]`, `[WARN]`, `[CRITICAL]`, and no emojis or ASCII art. People read it in terminals and other plugins parse it; spend tokens on content, not decoration.
- In prose, write a spaced single dash (` - `), not ` -- ` or an em dash.
- Put summaries, plans and audit notes in the PR or issue, not in committed files: committed notes go stale.
- Changes reach main through a PR. A feature or fix is done when tests that cover it pass.
- Keep git hooks on. `scripts/setup-hooks.sh` installs the pre-push hook.
- When a script or tool fails, report the failure before working around it, so the tool gets fixed.
- When goals conflict, rank them: plugin users' experience, automation that needs no babysitting, token cost, output quality, simplicity.

## Dev commands

```bash
npm test                        # node --test tests/*.test.js, also run in CI and by the pre-push hook
agnix --config .agnix.toml .    # agent config lint, also run in CI
```

## References

- Part of the [agentsys](https://github.com/agent-sh/agentsys) ecosystem
- https://agentskills.io
