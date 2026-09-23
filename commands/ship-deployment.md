---
description: "Use when deploying and validating during /ship on multi-branch repos. Covers Railway, Vercel and Netlify deploy waits, health checks, smoke tests, and production rollback."
codex-description: "Use when deploying and validating during /ship on multi-branch repos. Covers Railway, Vercel and Netlify deploy waits, health checks, smoke tests, and production rollback."
---

# /ship Phases 7 to 10: Deploy and validate

Reference for `/ship` on multi-branch repos (`branchStrategy: multi-branch`). Single-branch repos skip all of this: the merge is the deploy. Goal: the merged code runs healthy in development, then in production, and production goes back to its previous state if validation fails.

## Waiting for a deploy

Use the platform's own wait where it has one, and bound every wait with `timeout` so a stuck deploy cannot hang the run. Run long waits in the background if the harness supports it.

| Platform | Wait | Status field |
|---|---|---|
| Vercel | `vercel inspect <deploy-url> --wait --timeout 10m` | `readyState` is `READY` (failure: `ERROR`) |
| Netlify | `timeout 600 netlify watch` | `netlify api getDeploy --data '{"deploy_id":"<id>"}'` `.state` is `ready` (failure: `error`) |
| Railway | `railway deployment list --json`, then a bounded wait on `railway deployment get <id> --json` | `.status` is `SUCCESS` (failure: `FAILED`) |
| None detected | Treat the merge as the deploy | - |

On failure, print the platform's deploy logs (`vercel logs`, `railway logs --deployment <id>`, the Netlify deploy log URL) and stop before production.

## Phase 7 and 8: Development

After the merge to the base branch, wait for the development deploy, then validate it:

1. Health: `curl -s -o /dev/null -w '%{http_code}' <dev-url>/health`. 200, 301 or 302 passes.
2. Platform status from the table above.
3. Smoke tests: if `package.json` has a `smoke-test` script, run it with `SMOKE_TEST_URL=<dev-url>`.

Any failure stops the run before production. Report the URL and the failing check.

## Phase 9: Production

Promotion needs a branch checkout, so it does not run from a worktree. If `.git` is a file (you are in a worktree), stop and tell the user to run from the main checkout.

```bash
PREV_PROD_SHA=$(git rev-parse "origin/$PROD_BRANCH")
git checkout "$PROD_BRANCH" && git pull --ff-only origin "$PROD_BRANCH"
git merge --no-ff --no-edit "$TARGET" || { git merge --abort; echo "[ERROR] conflict promoting to $PROD_BRANCH"; exit 1; }
git push origin "$PROD_BRANCH" || { echo "[ERROR] push to $PROD_BRANCH rejected"; exit 1; }
PROD_MERGE_SHA=$(git rev-parse HEAD)
```

`--no-ff` guarantees a single merge commit, which is what rollback reverts. A rejected push stops the run: production still runs the old deploy, and validating it would report a false success.

Before the merge above: if an earlier run rolled production back (a `Revert "Merge ..."` commit on the production branch for changes that are still on the target), revert that revert with `git revert --no-edit <revert-sha>`. Git treats the reverted commits as already merged, so a plain promotion would ship the new fix without the feature it fixes.

## Phase 10: Validate production

Wait for the production deploy, then run the same health check, platform status, and `smoke-test:prod` script (with `SMOKE_TEST_URL=<prod-url>`). Any failure triggers rollback.

Base the health decision on the platform status API and the HTTP probe, never on counting words like "error" in application logs. Logs echo user-controlled input, so anyone who can get a string logged could force a production rollback. With no platform API, fall back to the conclusion of the last deploy workflow runs on the production branch (`gh run list --branch "$PROD_BRANCH" --limit 3 --json conclusion`).

## Rollback

```bash
git checkout "$PROD_BRANCH" && git pull --ff-only origin "$PROD_BRANCH"
git revert -m 1 --no-edit "$PROD_MERGE_SHA"
git push origin "$PROD_BRANCH"
```

A revert is a normal push: nobody else's commits on the production branch are rewritten, and the history shows what happened. Wait for the redeploy, re-run the health check, and report `PREV_PROD_SHA`, the revert SHA, and the failing checks. Record the revert SHA with `updateFlow({ rollback: { revertSha } })` when running under `--state-file`: the next promotion has to revert it first (see Phase 9). If the push is rejected because someone else pushed in the meantime, stop and hand it to the user.

## Platform detection output

`lib/platform/detect-platform.js` returns JSON with `ci`, `deployment` (`railway|vercel|netlify|null`), `branchStrategy` (`single-branch|multi-branch`), `mainBranch`, `projectType`, and `packageManager`.
