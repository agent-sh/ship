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
  const { binary } = require('@agentsys/lib');
  const fs = require('fs');
  const path = require('path');
  const cwd = process.cwd();
  const stateDir = ['.claude', '.opencode', '.codex'].find(d => fs.existsSync(path.join(cwd, d))) || '.claude';
  const mapFile = path.join(cwd, stateDir, 'repo-intel.json');

  if (fs.existsSync(mapFile)) {
    const health = JSON.parse(binary.runAnalyzer(['repo-intel', 'query', 'health', '--map-file', mapFile, cwd]));
    const bugspots = JSON.parse(binary.runAnalyzer(['repo-intel', 'query', 'bugspots', '--top', '5', '--map-file', mapFile, cwd]));
    healthContext = `\n\nPre-release health (informational only, do not block release):`;
    healthContext += `\nBus factor: ${health.busFactor}, AI ratio: ${(health.aiRatio * 100).toFixed(1)}%`;
    const highBugs = bugspots.filter(b => b.bugFixRate > 0.5);
    if (highBugs.length > 0) {
      healthContext += '\nHigh bugspot files: ' + highBugs.map(b => `${b.path} (${(b.bugFixRate * 100).toFixed(0)}% fix rate)`).join(', ');
    }
  }
} catch (e) { /* unavailable */ }
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
