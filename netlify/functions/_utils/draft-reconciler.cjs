//
// netlify/functions/_utils/draft-reconciler.cjs
// ------------------------------------------------------
// Draft Reconciliation Logic
// Converts reviewed Firestore drafts into markdown files.
//
// All reviewed drafts become files — scoring and annotation IS the data,
// not a gate. Both positively and negatively evaluated items are written
// to build a comprehensive record.
//
// Exports:
//   - reconcile({ userId? }) - Main entry point
//   - generateMarkdown(draft, feedback) - Generate YAML frontmatter markdown
//   - toFilename(name) - Convert name to filename slug
// ------------------------------------------------------

const { getReconciledDrafts, updateDraftStatus } = require('../_services/db-agent-drafts.cjs');
const { getAgent } = require('../_services/db-agents.cjs');
const { getFeedbackByDraft } = require('../_services/db-user-feedback.cjs');
const agentFilesystem = require('./agent-filesystem.cjs');

/**
 * Convert a name to a safe filename slug
 * "Spring Health" -> "Spring-Health.md"
 * @param {string} name - The name to convert
 * @returns {string} Filename with .md extension
 */
function toFilename(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }

  // Replace spaces and special chars with dashes, remove consecutive dashes
  const slug = name
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars except spaces and dashes
    .replace(/\s+/g, '-')            // Replace spaces with dashes
    .replace(/-+/g, '-')             // Remove consecutive dashes
    .replace(/^-|-$/g, '');          // Remove leading/trailing dashes

  return slug ? `${slug}.md` : null;
}

/**
 * Format a Firestore timestamp to ISO string
 * @param {Object} timestamp - Firestore timestamp object
 * @returns {string|null} ISO string or null
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return null;

  // Handle Firestore timestamp objects
  if (timestamp._seconds !== undefined) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }

  // Handle Date objects
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  // Handle ISO strings
  if (typeof timestamp === 'string') {
    return timestamp;
  }

  return null;
}

/**
 * Generate YAML frontmatter markdown from draft and feedback data
 * @param {Object} draft - Draft document from Firestore
 * @param {Object|null} feedback - Feedback document (may be null)
 * @returns {string} Complete markdown string with YAML frontmatter
 */
function generateMarkdown(draft, feedback) {
  const data = draft.data || {};

  // Build frontmatter object
  const frontmatter = {
    type: draft.type || 'company',
    name: data.name || '',
    domain: data.domain || '',
    stage: data.stage || '',
    employee_band: data.employee_band || '',
    agent_recommendation: data.agent_recommendation || '',
    agent_fit_score: data.agent_fit_score ?? '',
    user_fit_score: feedback?.score ?? '',
    user_feedback: feedback?.feedback || '',
    agent_tags: data.agent_tags || [],
    user_tags: feedback?.user_tags || [],
    source: 'agent-discovery',
    discovered_at: formatTimestamp(draft._createdAt) || ''
  };

  // Convert to YAML (simple implementation)
  const yamlLines = ['---'];

  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        yamlLines.push(`${key}: []`);
      } else {
        yamlLines.push(`${key}:`);
        for (const item of value) {
          yamlLines.push(`  - "${item}"`);
        }
      }
    } else if (typeof value === 'string' && (value.includes(':') || value.includes('"') || value.includes('\n'))) {
      // Quote strings that contain special chars
      yamlLines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
    } else if (typeof value === 'string') {
      yamlLines.push(`${key}: ${value}`);
    } else {
      yamlLines.push(`${key}: ${value}`);
    }
  }

  yamlLines.push('---');
  yamlLines.push(''); // Empty line after frontmatter

  return yamlLines.join('\n');
}

/**
 * Main reconciliation function
 * Processes reviewed drafts and writes them to the filesystem
 *
 * @param {Object} options - Options
 * @param {string} options.userId - Optional: filter to specific user
 * @returns {Promise<Object>} Results { committed, skipped, errors, details }
 */
async function reconcile({ userId } = {}) {
  const results = {
    committed: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  // Check if filesystem is available (local mode only)
  if (!agentFilesystem.isFilesystemAvailable()) {
    return {
      ...results,
      errors: 1,
      details: [{ error: 'Filesystem not available. Reconciler only works in local mode (APP_ENV=local).' }]
    };
  }

  // Get all drafts ready for reconciliation
  let drafts = await getReconciledDrafts();

  // Filter by userId if provided
  if (userId) {
    drafts = drafts.filter(d => d._userId === userId);
  }

  console.log(`[reconciler] Found ${drafts.length} drafts to reconcile`);

  if (drafts.length === 0) {
    return results;
  }

  // Process each draft
  for (const draft of drafts) {
    const draftResult = { draftId: draft.id, type: draft.type };

    try {
      // Validate draft has required data
      if (!draft.data?.name) {
        draftResult.status = 'skipped';
        draftResult.reason = 'Draft has no data.name';
        results.skipped++;
        results.details.push(draftResult);
        continue;
      }

      // Look up agent to get localDataPath
      const agent = await getAgent(draft.agentId);
      if (!agent) {
        draftResult.status = 'skipped';
        draftResult.reason = 'Agent not found';
        results.skipped++;
        results.details.push(draftResult);
        continue;
      }

      if (!agent.localDataPath) {
        draftResult.status = 'skipped';
        draftResult.reason = 'Agent has no localDataPath';
        results.skipped++;
        results.details.push(draftResult);
        continue;
      }

      // Get feedback for this draft (may not exist)
      const feedback = await getFeedbackByDraft(draft.id, draft._userId);

      // Generate filename
      const filename = toFilename(draft.data.name);
      if (!filename) {
        draftResult.status = 'skipped';
        draftResult.reason = 'Could not generate valid filename';
        results.skipped++;
        results.details.push(draftResult);
        continue;
      }

      // Build relative path: {type}s/{filename} (e.g., companies/Spring-Health.md)
      // Handle basic pluralization (company -> companies, person -> people)
      const pluralize = (type) => {
        if (type === 'person') return 'people';
        if (type.endsWith('y')) return type.slice(0, -1) + 'ies';
        return type + 's';
      };
      const typeFolder = pluralize(draft.type);
      const relativePath = `${typeFolder}/${filename}`;

      // Get agent's data path
      const agentDataPath = agentFilesystem.getAgentDataPath(agent.localDataPath);
      if (!agentDataPath) {
        draftResult.status = 'skipped';
        draftResult.reason = 'Invalid agent localDataPath';
        results.skipped++;
        results.details.push(draftResult);
        continue;
      }

      // Check if file already exists
      const existingFile = await agentFilesystem.readFile(agentDataPath, relativePath);
      if (existingFile.success) {
        // File exists - skip write but still mark as committed
        draftResult.status = 'skipped';
        draftResult.reason = 'File already exists';
        draftResult.path = relativePath;

        // Mark draft as committed (idempotent)
        await updateDraftStatus(draft.id, 'committed');

        results.skipped++;
        results.details.push(draftResult);
        continue;
      }

      // Generate markdown content
      const markdown = generateMarkdown(draft, feedback);

      // Write file
      const writeResult = await agentFilesystem.writeFile(agentDataPath, relativePath, markdown);

      if (!writeResult.success) {
        draftResult.status = 'error';
        draftResult.reason = writeResult.error;
        results.errors++;
        results.details.push(draftResult);
        continue;
      }

      // Mark draft as committed
      await updateDraftStatus(draft.id, 'committed');

      draftResult.status = 'committed';
      draftResult.path = relativePath;
      draftResult.name = draft.data.name;
      draftResult.hasFeedback = !!feedback;
      results.committed++;
      results.details.push(draftResult);

    } catch (err) {
      draftResult.status = 'error';
      draftResult.reason = err.message;
      results.errors++;
      results.details.push(draftResult);
    }
  }

  console.log(`[reconciler] Complete: ${results.committed} committed, ${results.skipped} skipped, ${results.errors} errors`);

  return results;
}

module.exports = {
  reconcile,
  generateMarkdown,
  toFilename
};
