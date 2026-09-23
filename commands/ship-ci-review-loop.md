---
description: "Use when monitoring CI and handling review comments during /ship. Covers waiting for checks and review bots without sleeps, triaging feedback, replying and resolving threads."
codex-description: "Use when monitoring CI and handling review comments during /ship. Covers waiting for checks and review bots without sleeps, triaging feedback, replying and resolving threads."
---

# /ship Phase 4: CI and review loop

Reference for `/ship` Phase 4. Goal: the PR's current head has green checks, and every piece of review feedback has been fixed or answered. Each round is: wait for CI, fix failures, collect feedback, handle it, push. Stop after 5 rounds without converging and report what is left.

## Waiting for CI

Block on the checks instead of polling:

```bash
gh pr checks "$PR" --watch --interval 30   # returns when all checks finish, non-zero if any failed
```

Run it in the background if the harness supports that, and do other work (reading feedback) while it runs. If `gh` reports no checks at all, the repo has no CI: note it and move on.

On a failure, read the failing job's log (`gh run view <run-id> --log-failed`), fix the cause, commit, push, and wait again. If `next-task:ci-fixer` is installed and `Task` is available you may delegate the fix to it with the check name and log excerpt. Otherwise fix it yourself. Do not weaken a test, disable a lint rule, or skip a check to get green: the check exists to catch exactly that change.

## Waiting for review bots

Many AI reviewers (a Claude or Codex review workflow, CodeRabbit, Gemini, Copilot) run as checks, so `--watch` already covers them. Some post as a GitHub App with no check run. If recent merged PRs in this repo show such a bot reviewing, wait for that bot's review of the current head before calling the PR clean. Filter by its login and the head commit: any other review (a human, another bot, your own thread replies, the bot's review of an older push) does not count. Use one bounded background wait, not a fixed sleep:

```bash
HEAD_SHA=$(gh pr view "$PR" --json headRefOid -q .headRefOid)
timeout 900 bash -c 'until [ "$(gh pr view "$0" --json reviews -q "[.reviews[] | select(.author.login == \"$1\" and .commit.oid == \"$2\")] | length")" -gt 0 ]; do sleep 30; done' "$PR" "$BOT_LOGIN" "$HEAD_SHA"
```

If it times out, proceed and mention it in the report. No sign of review bots on recent PRs means no wait.

## Collecting feedback

Unresolved review threads (first 100; paginate with `pageInfo` if a PR ever has more):

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!, $pr: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100) {
          nodes { id isResolved path line comments(first: 20) { nodes { id databaseId author { login } body } } }
        }
      }
    }
  }' -f owner="$OWNER" -f repo="$REPO" -F pr="$PR" \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)'
```

Also read top-level review bodies and PR comments (`gh pr view "$PR" --json reviews,comments`), since some reviewers put findings there instead of in threads. `CHANGES_REQUESTED` reviews count as open feedback.

## Handling feedback

Judge each item on its merits:

- Correct and in scope: fix it. Nits count when the fix is cheap and clearly right.
- Wrong, or already handled: reply once with the reason (point at the line or commit). Do not change code to appease a wrong comment.
- Correct but out of scope: reply saying so, and open a follow-up issue only on a repo you own.
- A question: answer it.

On a repo you own, resolve each thread after fixing or answering it, and re-request review from anyone who requested changes. On a repo you do not own, never resolve threads (the maintainer decides), reply only where a maintainer or a reviewer they rely on asked something, and fold everything else into the PR body.

Reply to a review comment and resolve its thread:

```bash
gh api -X POST "repos/$OWNER/$REPO/pulls/$PR/comments/$COMMENT_DATABASE_ID/replies" -f body="$REPLY"
gh api graphql -f query='mutation($id: ID!) { resolveReviewThread(input: {threadId: $id}) { thread { isResolved } } }' -f id="$THREAD_ID"
```

## Pushing fixes

Commit fixes with a message that names what changed (not "address review feedback"), push normally, and start the next round. Rounds without code changes (replies only) still end with a check that nothing new arrived.

## Round summary

After each round, print one line:

```
[CI/Review] round <n>: CI <passed|failed|none> | fixed <a> | answered <b> | open <c>
```
