---
description: "Use when a /ship run fails and you need the recovery path: missing gh, CI failures, push or PR errors, conflicts, review deadlock, deploy failures, rollback."
codex-description: "Use when handling and recovering from /ship command errors."
---

# /ship error handling

Reference for `/ship`. When a phase fails, stop that phase, tell the user what failed with the evidence (command, exit code, the relevant log lines), and give the recovery step. Re-running `/ship` resumes safely: it reuses the open PR and picks up at the CI and review loop.

| Failure | What to report | Recovery |
|---|---|---|
| `gh` missing or not authenticated | `[ERROR] GitHub CLI (gh) required` | Install from https://cli.github.com, then `gh auth login` |
| On the target branch | `[ERROR] Cannot ship from <target>` | Create a feature branch and re-run |
| Push rejected | The rejection reason | Auth: `gh auth status`. Protected branch: push a feature branch instead. Behind remote: `git pull --rebase origin <branch>`, never a force push over someone else's commits |
| PR creation failed | The `gh` error | Existing PR: `gh pr list --head <branch>`. No commits: `git log <target>..HEAD` |
| CI failure you could not fix | Check name, failing log excerpt, what you tried | The user fixes and pushes, then re-runs `/ship` |
| Merge conflict with the target | Conflicting files | `git fetch origin && git merge origin/<target>`, resolve, push, re-run. Rebase instead only if the branch is yours alone, then `git push --force-with-lease` |
| Review loop did not converge in 5 rounds | Open threads with links | The user decides: fix, answer, or ask the reviewer to close them |
| Deploy failed | Platform, deploy ID, log excerpt | Fix and re-run; production was not touched if the failure was in development |
| Production validation failed | Failing checks, `PREV_PROD_SHA`, revert SHA | Rollback already ran (see `ship-deployment.md`). Fix forward, then ship again: the next promotion reverts the revert commit first, or the rolled-back changes stay out of production |
| Worktree could not be removed | The path and why (usually uncommitted changes) | Left in place on purpose. The user inspects it, then `git worktree remove <path>` |

## Cancel

To abandon a shipped-but-unmerged PR: `gh pr close <n>`, then delete the remote branch (`git push origin --delete <branch>`). Delete the local branch only if this run created it and it is not checked out in another worktree.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Merged (or ready for maintainer review on a repo without write access) |
| 1 | General failure |
| 2 | CI failure |
| 3 | Review loop did not converge |
| 4 | Deploy failure |
| 5 | Rollback triggered |
