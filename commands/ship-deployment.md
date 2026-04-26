---
description: "Use when deploying and validating during /ship. Details Railway/Vercel deployment, smoke testing, and rollback procedures."
codex-description: "Use when deploying and validating during /ship. Details Railway/Vercel deployment, smoke testing, and rollback procedures."
---

# Phases 7-10: Deploy & Validate - Reference

This file contains platform-specific deployment and validation for `/ship`.

**Parent document**: `ship.md`

**Note**: Skip all phases if `WORKFLOW="single-branch"`.

## Phase 7: Deploy to Development

### Railway

```bash
if [ "$DEPLOYMENT" = "railway" ]; then
  echo "Waiting for Railway development deployment..."

  SERVICE_NAME=$(railway service list --json | jq -r '.[0].name')
  DEPLOY_ID=$(railway deployment list --service $SERVICE_NAME --json | jq -r '.[0].id')

  while true; do
    STATUS=$(railway deployment get $DEPLOY_ID --json | jq -r '.status')

    if [ "$STATUS" = "SUCCESS" ]; then
      DEV_URL=$(railway domain list --service $SERVICE_NAME --json | jq -r '.[0].domain')
      echo "[OK] Deployed to development: https://$DEV_URL"
      break
    elif [ "$STATUS" = "FAILED" ]; then
      echo "[ERROR] Development deployment failed"
      railway logs --deployment $DEPLOY_ID
      exit 1
    fi

    sleep 10
  done
fi
```

### Vercel

```bash
if [ "$DEPLOYMENT" = "vercel" ]; then
  echo "Waiting for Vercel development deployment..."

  DEPLOY_URL=$(vercel ls --json | jq -r '.[0].url')

  while true; do
    STATUS=$(vercel inspect $DEPLOY_URL --json | jq -r '.readyState')

    if [ "$STATUS" = "READY" ]; then
      echo "[OK] Deployed to development: https://$DEPLOY_URL"
      DEV_URL="https://$DEPLOY_URL"
      break
    elif [ "$STATUS" = "ERROR" ]; then
      echo "[ERROR] Development deployment failed"
      vercel logs $DEPLOY_URL
      exit 1
    fi

    sleep 10
  done
fi
```

### Netlify

```bash
if [ "$DEPLOYMENT" = "netlify" ]; then
  echo "Waiting for Netlify development deployment..."

  SITE_ID=$(netlify status --json | jq -r '.site_id')
  DEPLOY_ID=$(netlify api listSiteDeploys --data "{ \"site_id\": \"$SITE_ID\" }" | jq -r '.[0].id')

  while true; do
    STATUS=$(netlify api getDeploy --data "{ \"deploy_id\": \"$DEPLOY_ID\" }" | jq -r '.state')

    if [ "$STATUS" = "ready" ]; then
      DEV_URL=$(netlify api getDeploy --data "{ \"deploy_id\": \"$DEPLOY_ID\" }" | jq -r '.deploy_ssl_url')
      echo "[OK] Deployed to development: $DEV_URL"
      break
    elif [ "$STATUS" = "error" ]; then
      echo "[ERROR] Development deployment failed"
      exit 1
    fi

    sleep 10
  done
fi
```

### Generic / Unknown

```bash
if [ -z "$DEPLOYMENT" ] || [ "$DEPLOYMENT" = "null" ]; then
  echo "No deployment platform detected"
  echo "Assuming merge to $MAIN_BRANCH means deployment"
  DEV_URL="N/A"
fi
```

## Phase 8: Validate Development

### Health Check

```bash
echo "Running smoke tests on development..."

# Wait for deployment to stabilize
sleep 30

# Basic health check
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $DEV_URL/health || echo "000")

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
  echo "[OK] Health check passed: $HTTP_STATUS"
else
  echo "[ERROR] Health check failed: $HTTP_STATUS"
  echo "Investigate deployment issues before proceeding to production"
  exit 1
fi
```

### Error Log Monitoring

**Advisory**: This dev-stage block only blocks promotion-to-prod (`exit 1`),
not a destructive force-push, so the risk is bounded. Still, the same
log-keyword-count pattern is a DoS vector if user-controlled fields are
logged. Prefer the platform health API as in Phase 10; treat this as a
soft-advisory signal only.

```bash
echo "Checking dev deployment status (advisory)..."

# Best-effort structured status from the platform API.
if [ "$DEPLOYMENT" = "railway" ]; then
  DEV_STATUS=$(railway status --json 2>/dev/null | jq -r '.environment.status // "unknown"')
elif [ "$DEPLOYMENT" = "vercel" ]; then
  DEV_STATUS=$(vercel inspect "$DEV_URL" --json 2>/dev/null | jq -r '.readyState // "UNKNOWN"')
elif [ "$DEPLOYMENT" = "netlify" ]; then
  DEV_STATUS=$(netlify api getDeploy --data "{ \"deploy_id\": \"$DEPLOY_ID\" }" 2>/dev/null | jq -r '.state // "unknown"')
else
  DEV_STATUS="unknown"
fi

case "$DEV_STATUS" in
  healthy|SUCCESS|running|READY|ready)
    echo "[OK] Dev platform reports healthy: $DEV_STATUS"
    ;;
  unknown|UNKNOWN)
    echo "[WARN] Dev platform status unknown (API unavailable). Relying on health check + smoke tests."
    ;;
  *)
    echo "[ERROR] Dev platform reports unhealthy: $DEV_STATUS"
    echo "Review deployment before proceeding to production"
    exit 1
    ;;
esac
```

### Project Smoke Tests

```bash
if jq -e '.scripts["smoke-test"]' package.json > /dev/null 2>&1; then
  echo "Running project smoke tests..."

  export SMOKE_TEST_URL=$DEV_URL
  $PACKAGE_MGR run smoke-test

  if [ $? -eq 0 ]; then
    echo "[OK] Smoke tests passed"
  else
    echo "[ERROR] Smoke tests failed"
    exit 1
  fi
fi
```

### Validation Summary

```markdown
## Development Validation [OK]

**URL**: ${DEV_URL}
**Health Check**: [OK] ${HTTP_STATUS}
**Platform Status**: [OK] ${DEV_STATUS}
**Smoke Tests**: [OK] Passed

Proceeding to production...
```

## Phase 9: Deploy to Production

### Merge to Production Branch

```bash
# Worktree check must come first - multi-branch deployment requires branch checkout
if [ -f "$(git rev-parse --show-toplevel 2>/dev/null)/.git" ]; then
  MAIN_REPO=$(dirname "$(git rev-parse --git-common-dir 2>/dev/null)")
  echo "[ERROR] Multi-branch deployment is not supported from a worktree"
  echo "Run from the main repo: cd $MAIN_REPO"
  exit 1
fi

echo "Merging $MAIN_BRANCH → $PROD_BRANCH..."

git checkout $PROD_BRANCH
git pull origin $PROD_BRANCH

git merge $MAIN_BRANCH --no-edit

if [ $? -ne 0 ]; then
  echo "[ERROR] Merge to production failed (conflicts)"
  git merge --abort
  exit 1
fi

git push origin $PROD_BRANCH

if [ $? -eq 0 ]; then
  PROD_SHA=$(git rev-parse HEAD)
  echo "[OK] Production branch at: $PROD_SHA"
else
  echo "[ERROR] Push to production failed"
  exit 1
fi
```

### Wait for Production Deployment

Same platform-specific logic as Phase 7, but targeting production environment.

```bash
echo "Waiting for production deployment..."

# Platform-specific deployment monitoring
# (Similar to Phase 7)

echo "[OK] Deployed to production: $PROD_URL"
```

## Phase 10: Validate Production

### Conservative Validation

```bash
echo "Validating production deployment..."

# Wait longer for production to stabilize
sleep 60

# Health check
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $PROD_URL/health || echo "000")

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
  echo "[OK] Production health check: $HTTP_STATUS"
else
  echo "[ERROR] Production health check failed: $HTTP_STATUS"
  rollback_production
fi
```

### Production Error Monitoring

**Security note (rollback-DoS vector)**: Do NOT gate `rollback_production` on
raw log-line counts of the words `error|exception|fatal`. Application logs
regularly echo user-controlled data (request headers, query strings, bodies,
auth identifiers). An attacker who can influence any logged field can inflate
the match count past the threshold and force `rollback_production`, which
performs `git reset --hard HEAD~1` + `git push --force-with-lease` against the
production branch. This turns a grep heuristic into a remote rollback primitive.

Use deploy-platform health APIs (structured, signed by the platform) as the
authoritative signal. Fall back to CI exit-code history only when no platform
API is available. Never fall back to keyword-density grep.

```bash
echo "Monitoring production status (via platform API, not log grep)..."

PROD_STATUS="unknown"

if [ "$DEPLOYMENT" = "railway" ]; then
  # Prefer structured status over log parsing.
  PROD_STATUS=$(railway status --json 2>/dev/null | jq -r '.environment.status // "unknown"')
  # Cross-check with a direct HTTP probe (already validated above, but
  # re-probe here so a post-validation regression also triggers rollback).
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/health" || echo "000")
  case "$PROD_STATUS" in
    healthy|SUCCESS|running) ;;
    *) PROD_STATUS="errored" ;;
  esac
elif [ "$DEPLOYMENT" = "vercel" ]; then
  READY_STATE=$(vercel inspect "$PROD_URL" --json 2>/dev/null | jq -r '.readyState // "UNKNOWN"')
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/health" || echo "000")
  [ "$READY_STATE" = "READY" ] && PROD_STATUS="healthy" || PROD_STATUS="errored"
elif [ "$DEPLOYMENT" = "netlify" ]; then
  NETLIFY_STATE=$(netlify api getDeploy --data "{ \"deploy_id\": \"$DEPLOY_ID\" }" 2>/dev/null | jq -r '.state // "unknown"')
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/health" || echo "000")
  [ "$NETLIFY_STATE" = "ready" ] && PROD_STATUS="healthy" || PROD_STATUS="errored"
else
  # No platform API available. Fall back to CI history (deploy workflow runs).
  # DO NOT fall back to `| grep error | wc -l` on logs - that is a rollback-DoS vector.
  FAILED_RUNS=$(gh run list --branch "$PROD_BRANCH" --limit 3 --json conclusion \
    --jq '[.[] | select(.conclusion != "success" and .conclusion != null)] | length' 2>/dev/null || echo "0")
  if [ "$FAILED_RUNS" = "0" ]; then
    PROD_STATUS="healthy"
  else
    PROD_STATUS="errored"
  fi
fi

if [ "$PROD_STATUS" != "healthy" ] || { [ -n "$HTTP_STATUS" ] && [ "$HTTP_STATUS" != "200" ] && [ "$HTTP_STATUS" != "301" ] && [ "$HTTP_STATUS" != "302" ]; }; then
  echo "[ERROR] CRITICAL: Production status from platform API: $PROD_STATUS (HTTP $HTTP_STATUS)"
  rollback_production
else
  echo "[OK] Production status from platform API: $PROD_STATUS (HTTP $HTTP_STATUS)"
fi
```

### Production Smoke Tests

```bash
if jq -e '.scripts["smoke-test:prod"]' package.json > /dev/null 2>&1; then
  echo "Running production smoke tests..."

  export SMOKE_TEST_URL=$PROD_URL
  $PACKAGE_MGR run smoke-test:prod

  if [ $? -ne 0 ]; then
    echo "[ERROR] Production smoke tests failed"
    rollback_production
  fi
fi
```

## Rollback Mechanism

**Triggered automatically on any production validation failure.**

```bash
rollback_production() {
  # Worktree check must come first
  if [ -f "$(git rev-parse --show-toplevel 2>/dev/null)/.git" ]; then
    MAIN_REPO=$(dirname "$(git rev-parse --git-common-dir 2>/dev/null)")
    echo "[ERROR] Rollback is not supported from a worktree"
    echo "Run from the main repo: cd $MAIN_REPO"
    exit 1
  fi

  echo "========================================"
  echo "ROLLBACK INITIATED"
  echo "========================================"

  echo "WARNING: Force pushing to $PROD_BRANCH to revert"

  git checkout $PROD_BRANCH
  git reset --hard HEAD~1

  # Use --force-with-lease for safety
  if ! git push --force-with-lease origin $PROD_BRANCH; then
    echo "[ERROR] Force push failed - remote may have unexpected changes"
    echo "Manual intervention required"
    exit 1
  fi

  echo "[OK] Rolled back production to previous deployment"
  echo "Previous version will redeploy automatically"

  # Wait for rollback deployment
  sleep 30

  # Verify rollback succeeded
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $PROD_URL/health || echo "000")
  if [ "$HTTP_STATUS" = "200" ]; then
    echo "[OK] Rollback successful, production is healthy"
  else
    echo "[WARN] Rollback deployed but health check unclear"
    echo "Manual investigation required"
  fi

  exit 1
}
```

## Platform Detection Reference

The `detect-platform.js` script returns:

```json
{
  "ci": "github-actions|gitlab-ci|circleci|jenkins|travis|null",
  "deployment": "railway|vercel|netlify|heroku|null",
  "branchStrategy": "single-branch|multi-branch",
  "mainBranch": "main|master",
  "projectType": "nodejs|python|rust|go",
  "packageManager": "npm|yarn|pnpm|pip|cargo"
}
```

Use these values to adapt deployment monitoring to your specific platform.
