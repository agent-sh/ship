---
description: Create a versioned release with automatic ecosystem and tooling detection.
codex-description: 'Use when user asks to "release", "cut a release", "bump version", "create release", "tag release", "publish version", "new version". Discovers how the repo releases and executes it.'
argument-hint: "[patch|minor|major] [--dry-run] [--skip-publish] [--skip-changelog] [--yes]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git:*), Bash(npm:*), Bash(cargo:*), Bash(go:*), Bash(python:*), Bash(pip:*), Bash(twine:*), Bash(mvn:*), Bash(gradle:*), Bash(gh:*), Bash(make:*), Bash(node:*), Bash(npx:*), Bash(sed:*), Bash(just:*), Bash(goreleaser:*), Skill, Task
---

# /release - Versioned Release Workflow

Spawn the release agent to discover how this repo releases and execute it.

Pre-fetch repo health data (informational context for the release agent):

```javascript
let healthContext = '';
try {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (!pluginRoot) throw new Error('CLAUDE_PLUGIN_ROOT not set');
  const { repoIntel } = require(`${pluginRoot}/lib/agentsys`).get();
  if (!repoIntel) {
    // Older agentsys (< v5.8.6) without the typed query module. Surface a
    // visible note instead of silently skipping - the user can update with
    // /plugin marketplace update and re-run if they want pre-release health
    // data.
    console.error('[INFO] Pre-release health check skipped: agentsys is older than v5.8.6 (run `/plugin marketplace update` to enable).');
  } else {
    const fs = require('fs');
    const path = require('path');
    const cwd = process.cwd();
    const stateDir = ['.claude', '.opencode', '.codex'].find(d => fs.existsSync(path.join(cwd, d))) || '.claude';
    const mapFile = path.join(cwd, stateDir, 'repo-intel.json');

    if (fs.existsSync(mapFile)) {
      const health = repoIntel.queries.health(cwd);
      const bugspots = repoIntel.queries.bugspots(cwd, { limit: 5 });
      healthContext = `\n\nPre-release health (informational only, do not block release):`;
      healthContext += `\nBus factor: ${health.busFactor}, AI ratio: ${(health.aiRatio * 100).toFixed(1)}%`;
      const highBugs = bugspots.filter(b => b.bugFixRate > 0.5);
      if (highBugs.length > 0) {
        healthContext += '\nHigh bugspot files: ' + highBugs.map(b => `${b.path} (${(b.bugFixRate * 100).toFixed(0)}% fix rate)`).join(', ');
      }
    }
  }
} catch (e) {
  // Health check is informational - log the cause so users know why it
  // failed (rather than swallowing silently as the old code did).
  console.error(`[INFO] Pre-release health check skipped: ${e.message}`);
}
```

```
Task:
  subagent_type: "release-agent"
  prompt: |
    Perform a release in this repository.
    Arguments: $ARGUMENTS
    Follow the release-agent workflow. Report the result.${healthContext}
```

See `agents/release-agent.md` for discovery logic, constraints, and error handling.
