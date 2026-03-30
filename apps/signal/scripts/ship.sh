#!/bin/bash
# Promote the latest Netlify CI build to production and re-lock.
# Does NOT deploy local _site — uses the build Netlify already ran on git push.
set -e

SITE_ID="877381f6-7e53-45ea-8e50-50f1394d3107"

echo "Fetching latest CI build..."
DEPLOYS_JSON=$(netlify api listSiteDeploys --data "{\"site_id\":\"$SITE_ID\",\"per_page\":\"10\"}" 2>/dev/null)
HEAD_SHA=$(git rev-parse --short HEAD)

LATEST_DEPLOY_ID=$(node -e "
  try {
    const deploys = JSON.parse(process.argv[1]);
    const latest = deploys.find(d => d.state === 'ready');
    process.stdout.write(latest ? latest.id : '');
  } catch(e) {}
" "$DEPLOYS_JSON")

LATEST_COMMIT=$(node -e "
  try {
    const deploys = JSON.parse(process.argv[1]);
    const latest = deploys.find(d => d.state === 'ready');
    process.stdout.write(latest && latest.commit_ref ? latest.commit_ref.slice(0,7) : '');
  } catch(e) {}
" "$DEPLOYS_JSON")

if [ -n "$LATEST_COMMIT" ] && [ "$LATEST_COMMIT" != "$HEAD_SHA" ]; then
  echo "Error: latest build is for $LATEST_COMMIT but HEAD is $HEAD_SHA — Netlify hasn't finished building yet. Try again in a moment."
  exit 1
fi

if [ -z "$LATEST_DEPLOY_ID" ]; then
  echo "Error: no ready CI build found. Push your changes and wait for the Netlify build to finish."
  exit 1
fi

echo "Promoting deploy $LATEST_DEPLOY_ID to production..."
netlify api updateSite --data "{\"site_id\":\"$SITE_ID\",\"body\":{\"published_deploy_id\":\"$LATEST_DEPLOY_ID\"}}" > /dev/null 2>&1

echo "Re-locking deploy $LATEST_DEPLOY_ID..."
netlify api lockDeploy --data "{\"deploy_id\":\"$LATEST_DEPLOY_ID\"}" > /dev/null 2>&1

echo "Shipped: https://signal.habitualos.com"
