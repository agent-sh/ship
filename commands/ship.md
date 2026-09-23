---
description: Complete PR workflow from commit to production with validation
codex-description: 'Use when user asks to "ship this", "create PR", "merge to main", "deploy changes", "push to production". Complete PR workflow: commit, create PR, monitor CI, merge, deploy, validate.'
argument-hint: "[--strategy STRATEGY] [--skip-tests] [--dry-run] [--state-file PATH] [--base BRANCH]"
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm:*), Bash(node:*), Read, Write, Edit, Glob, Grep, Task
---

# /ship

Take the current feature branch to a merged PR, and on multi-branch repos through a validated production deploy. The run is done when the PR is merged (or, on a repo you cannot merge to, ready for the maintainers), CI is green on the merged head, review feedback is handled, and anything this run created locally is cleaned up.

## Arguments

Parse from `$ARGUMENTS`:

- `--strategy squash|merge|rebase`: merge strategy. Default `squash`.
- `--skip-tests`: skip the local test run before pushing. CI still has to pass.
- `--dry-run`: print the plan and stop. Change nothing.
- `--state-file PATH`: the `/next-task` flow state. Present means `/next-task` already ran review, deslop and docs.
- `--base BRANCH`: PR target. Default: `git.baseBranch` from the flow state if `--state-file` is set, else the repo default branch.

## Constraints

- Never force-push a branch other people build on (the base branch, a production branch). Production rollback uses `git revert`, not a reset.
- Stage files by name, never `.env`, keys, or credentials. A leaked secret in a public PR is not recoverable by a later commit.
- Clean up only what this run or the `/next-task` run that called it created: its own worktree, its own local branch, its own task registry entry. Other worktrees and branches may be another agent's live work.
- On a repo where you lack write access (a fork PR to an upstream project), do not merge, do not resolve maintainers' threads, and reply only where a maintainer asked something. Stop at "ready for review" and report. Maintainers read a queue, and extra comments cost them.
- Do not post to an issue tracker unless the run came from `/next-task` with a GitHub task source. The plan approval in `/next-task` is the user's consent for those comments.

## Harness defaults

- No `Task` tool: do any review or fix work inline instead of delegating.
- No `AskUserQuestion`: ask in plain text and wait for the reply.
- An optional agent is not installed (for example `next-task:ci-fixer`): do the work inline. Nothing in this workflow requires another plugin.

## Phase 1: Pre-flight

Detect the environment with the plugin's scripts:

```bash
PLATFORM=$(node "${CLAUDE_PLUGIN_ROOT}/lib/platform/detect-platform.js")   # ci, deployment, branchStrategy, mainBranch, packageManager
TOOLS=$(node "${CLAUDE_PLUGIN_ROOT}/lib/platform/verify-tools.js")         # .gh.available etc.
```

Stop with install and `gh auth login` instructions if `gh` is missing. Stop if the current branch is the target branch: shipping needs a feature branch.

Resolve the target branch: `--base`, then the flow state's `git.baseBranch`, then `mainBranch`. If it differs from the repo default and the run is interactive (no `--state-file`), confirm it with the user. Under `--state-file`, trust the flow state.

`branchStrategy: multi-branch` means a dev and a production branch (`stable` by default). Phases 7 to 10 only run in that case.

Check write access once, it decides the external-repo rules above:

```bash
gh repo view <base-repo> --json viewerPermission -q .viewerPermission   # ADMIN, MAINTAIN or WRITE means you can merge
```

`<base-repo>` is the repo the PR targets: the upstream parent when you work from a fork.

With `--dry-run`, print this and stop:

```
## Dry Run
Branch: <current> -> <target>
Workflow: single-branch|dev-prod | CI: <ci> | Deploy: <deployment>
Will: commit <n> files | push | open PR | monitor CI and reviews | merge (<strategy>) | deploy
```

## Phase 2: Commit

Only if `git status --porcelain` shows changes. Unless `--skip-tests`, run the project's test command first and stop on failure. Stage the relevant files by path and write a conventional commit message that matches the repo's history (`git log --oneline -10`).

## Phase 3: Push and open the PR

Push with `git push -u origin <branch>`. Reuse an open PR for the branch if one exists (`gh pr list --head <branch>`). Otherwise open one with `gh pr create --base <target>`, using the repo's PR template if it has one. The body says what changed, why, and how it was tested, and links the issue (`Closes #N`) when there is one.

## Phase 4: CI and review loop

Required on every run, including runs from `/next-task`: CI and external reviewers only see the code once the PR exists. The mechanics (waiting without sleeps, fetching threads, replying, resolving) are in `ship-ci-review-loop.md`.

Exit condition: all required checks pass, and every review thread is either fixed or answered. On a repo you own, that means zero unresolved threads and no outstanding "changes requested". After 5 rounds without converging, stop and report what is left.

## Phase 5: Standalone review

Skip under `--state-file` when the flow state shows the `/next-task` review loop approved.

Otherwise review the diff (`git diff <target>...HEAD`) once for correctness, security, performance and test coverage. Default is a single pass, inline or in one `general-purpose` subagent. For a large diff (roughly 500+ changed lines or 15+ files), you may split the concerns across up to 3 parallel subagents if `Task` is available. Fix critical and high findings. Fix medium ones when the fix is small and clearly correct. Low findings are optional. Re-review only the changed hunks, at most 2 more rounds. If fixes were pushed, Phase 4 runs again.

## Phase 6: Merge

Only with write access. Check:

- `gh pr view <n> --json mergeable,mergeStateStatus` reports `MERGEABLE`.
- No unresolved review threads (query in `ship-ci-review-loop.md`).
- Checks are green on the current head.

Then merge. Inside a worktree, `gh pr merge --delete-branch` tries to check out the base branch locally and fails, so split it:

```bash
if [ -f "$(git rev-parse --show-toplevel)/.git" ]; then   # .git is a file inside a worktree
  gh pr merge "$PR" --"$STRATEGY"
  git push origin --delete "$BRANCH" || echo "[WARN] remote branch not deleted"
else
  gh pr merge "$PR" --"$STRATEGY" --delete-branch
  git checkout "$TARGET" && git pull --ff-only origin "$TARGET"
fi
MERGE_SHA=$(gh pr view "$PR" --json mergeCommit -q .mergeCommit.oid)
```

If the repo has a cached `repo-intel.json`, refresh it through the agentsys runtime (`repoMap.update`). Skip silently if the runtime or the map is missing.

## Phases 7 to 10: Deploy and validate

Multi-branch repos only. Deploy to development, validate, promote to production, validate, and roll back on failure. Platform commands and the rollback procedure are in `ship-deployment.md`.

## Phase 11: Cleanup

- Under `--state-file`: if the flow state's `git.worktreePath` is the worktree `/next-task` created for this task, remove it from the main repo after the merge, then delete its local branch. Use `git -C <git.mainRepoPath> worktree remove <path>` without `--force`. If it has uncommitted changes, leave it and report it. Release the task entry with `releaseTask(<task.id>, <mainRepoPath>)` from `lib/state/workflow-state.js`.
- Standalone, outside a worktree: switch to the target branch and delete the merged local branch.

Delete a merged branch with `git branch -D`: after a squash or rebase merge git does not see it as merged, and the PR state already confirms the merge. Only delete branches this run shipped.
- Standalone, inside a worktree you did not create in this run: leave it.
- GitHub task from `/next-task`: comment on the issue with the PR number and merge commit, then `gh issue close <id> --reason completed`.

## Phase 12: Report

```
## Shipped
PR: #<n> <url> | Merged to <target> at <sha> (or: ready for maintainer review)
CI: <passed checks> | Review: <threads fixed>/<threads answered>
Deploy: <dev url> [OK] | <prod url> [OK]   (or: single-branch, merge is the deploy)
Cleanup: <what was removed, what was left and why>
```

Then print this line on its own. `/next-task` reads it to detect completion:

```json
{"ok": true, "nextPhase": "completed", "status": "shipped"}
```

Failures and recovery messages: `ship-error-handling.md`.
