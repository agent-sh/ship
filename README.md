# ship

Complete PR workflow from commit to production with validation, plus discovery-first release automation.

## Installation

```bash
# Claude Code
claude mcp add-plugin agent-sh/ship

# Or install from marketplace
agentsys install ship
```

## Usage

```
/ship                        # Create PR, monitor CI, merge
/release                     # Patch release (auto-discovers release method)
/release minor               # Minor version bump
/release major --dry-run     # Preview what would happen
```

## Keywords

`ci-cd`, `deployment`, `pr-workflow`, `automation`, `release`, `versioning`, `semver`

## License

MIT
