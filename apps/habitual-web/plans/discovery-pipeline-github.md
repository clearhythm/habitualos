# Discovery Pipeline — GitHub Integration

> **Requirement for**: Production deployment, mobile usage

This document covers the GitHub API integration needed for the draft reconciler to work in production (Netlify) where filesystem writes are not available.

---

## Problem

Netlify functions run in a read-only filesystem environment. The local reconciler (Phase 4) writes markdown files directly to `data/{agentPath}/companies/`, but this only works during local development.

For production use (especially mobile where local dev isn't running), we need an alternative write strategy that commits files to the GitHub repository, which then triggers a Netlify redeploy.

---

## Solution: GitHub API Commits

Use Octokit to commit files directly to the repository via the GitHub API.

### New File: `netlify/functions/_utils/github-commit.cjs`

```javascript
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const branch = process.env.GITHUB_BRANCH || 'main';

/**
 * Check if a file exists in the repository
 * @param {string} path - Repository-relative path
 * @returns {Promise<boolean>}
 */
exports.fileExists = async (path) => {
  try {
    await octokit.repos.getContent({ owner, repo, path, ref: branch });
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
};

/**
 * Commit multiple files atomically
 * Uses the Git Data API for atomic multi-file commits
 * @param {Array<{path: string, content: string}>} files - Files to commit
 * @param {string} message - Commit message
 * @returns {Promise<{sha: string, url: string}>}
 */
exports.commitFiles = async (files, message) => {
  // 1. Get the current commit SHA for the branch
  const { data: ref } = await octokit.git.getRef({
    owner, repo,
    ref: `heads/${branch}`
  });
  const latestCommitSha = ref.object.sha;

  // 2. Get the tree SHA from the latest commit
  const { data: commit } = await octokit.git.getCommit({
    owner, repo,
    commit_sha: latestCommitSha
  });
  const baseTreeSha = commit.tree.sha;

  // 3. Create blobs for each file
  const blobs = await Promise.all(
    files.map(async (file) => {
      const { data: blob } = await octokit.git.createBlob({
        owner, repo,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64'
      });
      return { path: file.path, sha: blob.sha, mode: '100644', type: 'blob' };
    })
  );

  // 4. Create a new tree with the new files
  const { data: newTree } = await octokit.git.createTree({
    owner, repo,
    base_tree: baseTreeSha,
    tree: blobs
  });

  // 5. Create the commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner, repo,
    message,
    tree: newTree.sha,
    parents: [latestCommitSha]
  });

  // 6. Update the branch reference
  await octokit.git.updateRef({
    owner, repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha
  });

  return { sha: newCommit.sha, url: newCommit.html_url };
};
```

---

## Integration with Draft Reconciler

Update `draft-reconciler.cjs` to detect environment and use appropriate write strategy:

```javascript
const { isFilesystemAvailable, writeFile, getAgentDataPath } = require('./agent-filesystem.cjs');
const { fileExists: ghFileExists, commitFiles } = require('./github-commit.cjs');

async function writeReconciled(agentLocalPath, relativePath, content) {
  if (isFilesystemAvailable()) {
    // Local mode: write directly
    const agentDataPath = getAgentDataPath(agentLocalPath);
    return await writeFile(agentDataPath, relativePath, content);
  } else {
    // Remote mode: queue for GitHub commit
    // Returns file info to be batched
    return {
      path: `data/${agentLocalPath}/${relativePath}`,
      content
    };
  }
}

// In reconcile():
if (!isFilesystemAvailable()) {
  // Batch all files and commit atomically
  const filesToCommit = results
    .filter(r => r.success && r.file)
    .map(r => r.file);

  if (filesToCommit.length > 0) {
    await commitFiles(filesToCommit, `Reconcile ${filesToCommit.length} drafts`);
  }
}
```

---

## Environment Variables

Add to `.env` and Netlify dashboard:

```
GITHUB_TOKEN=ghp_...      # Personal access token with repo scope
GITHUB_OWNER=your-username
GITHUB_REPO=habitualos
GITHUB_BRANCH=main        # Optional, defaults to main
```

---

## Package Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "@octokit/rest": "^20.0.0"
  }
}
```

---

## Scheduled Execution

Add to `netlify.toml` for daily automated reconciliation:

```toml
[functions."reconciler-run"]
  schedule = "0 7 * * *"  # Daily at 7am UTC
```

The function should detect scheduled vs HTTP invocation and handle accordingly.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| GitHub API rate limit | Fail batch, log error, retry later |
| GitHub API auth failure | Fail batch, log error |
| GitHub API network error | Fail batch, log error |
| Partial blob creation fails | Fail batch (atomic), no partial commits |

---

## Security Considerations

- Use a GitHub token with minimal required scope (just `repo` or ideally `contents:write`)
- Consider using a GitHub App instead of personal access token for production
- Token should be stored in Netlify environment variables, not in code

---

## Implementation Sequence

1. Complete Phase 4 (local mode) first
2. Add `@octokit/rest` to dependencies
3. Create `github-commit.cjs`
4. Update `draft-reconciler.cjs` with dual-mode logic
5. Add environment variables to Netlify dashboard
6. Add scheduled function config to `netlify.toml`
7. Test with a manual trigger before enabling schedule
