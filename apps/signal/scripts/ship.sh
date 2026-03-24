#!/bin/bash
# Deploy to Netlify prod and re-lock deploys after
set -e

echo "Deploying to production..."
# Write JSON to a temp file to avoid ANSI escape code contamination
DEPLOY_JSON=$(mktemp)
echo "y" | netlify deploy --prod --json 2>/dev/null > "$DEPLOY_JSON" || true
cat "$DEPLOY_JSON"

DEPLOY_ID=$(node -e "
  const d = require('fs').readFileSync('$DEPLOY_JSON', 'utf8');
  try { process.stdout.write(JSON.parse(d).deploy_id || ''); } catch(e) {}
")
rm -f "$DEPLOY_JSON"

if [ -n "$DEPLOY_ID" ]; then
  echo "Re-locking deploy $DEPLOY_ID..."
  netlify api lockDeploy --data "{\"deploy_id\":\"$DEPLOY_ID\"}"
  echo "Deploy locked."
else
  echo "Warning: could not extract deploy ID to re-lock. Lock manually in Netlify dashboard."
fi
