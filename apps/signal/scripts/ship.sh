#!/bin/bash
# Deploy to Netlify prod and re-lock deploys after
set -e

SITE_ID="877381f6-7e53-45ea-8e50-50f1394d3107"

echo "Unlocking production..."
SITE_JSON=$(netlify api getSite --data "{\"site_id\":\"$SITE_ID\"}" 2>/dev/null)
CURRENT_DEPLOY_ID=$(node -e "
  try { process.stdout.write(JSON.parse(process.argv[1]).published_deploy.id || ''); } catch(e) {}
" "$SITE_JSON")

if [ -n "$CURRENT_DEPLOY_ID" ]; then
  netlify api unlockDeploy --data "{\"deploy_id\":\"$CURRENT_DEPLOY_ID\"}" > /dev/null 2>&1 || true
fi

echo "Deploying to production..."
DEPLOY_JSON=$(mktemp)
netlify deploy --prod --json 2>/dev/null > "$DEPLOY_JSON"
cat "$DEPLOY_JSON"

DEPLOY_ID=$(node -e "
  const d = require('fs').readFileSync('$DEPLOY_JSON', 'utf8');
  try { process.stdout.write(JSON.parse(d).deploy_id || ''); } catch(e) {}
")
rm -f "$DEPLOY_JSON"

if [ -n "$DEPLOY_ID" ]; then
  echo "Re-locking deploy $DEPLOY_ID..."
  netlify api lockDeploy --data "{\"deploy_id\":\"$DEPLOY_ID\"}" > /dev/null 2>&1
  echo "Deploy locked."
else
  echo "Warning: could not extract deploy ID to re-lock. Lock manually in Netlify dashboard."
fi
