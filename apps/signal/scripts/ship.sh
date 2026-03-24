#!/bin/bash
# Deploy to Netlify prod and re-lock deploys after
set -e

echo "Deploying to production..."
OUTPUT=$(netlify deploy --prod --json 2>&1)
echo "$OUTPUT"

DEPLOY_ID=$(echo "$OUTPUT" | node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { process.stdout.write(JSON.parse(d).deploy_id || ''); } catch(e) {}
  });
")

if [ -n "$DEPLOY_ID" ]; then
  echo "Re-locking deploy $DEPLOY_ID..."
  netlify api lockDeploy --data "{\"deploy_id\":\"$DEPLOY_ID\"}"
  echo "Deploy locked."
else
  echo "Warning: could not extract deploy ID to re-lock. Lock manually in Netlify dashboard."
fi
