//
// netlify/functions/_tools/sync-documentation.cjs
// ------------------------------------------------------
// Tool: sync_documentation
//
// Executes the context-sync script to update project
// documentation based on recent git commits.
// ------------------------------------------------------

const { execSync } = require('child_process');
const path = require('path');

/**
 * Execute the sync_documentation tool
 * @param {Object} input - Tool input parameters
 * @param {boolean} input.force - Force sync even if not stale
 * @returns {Promise<Object>} Execution result
 */
async function execute(input = {}) {
  const { force = false } = input;

  try {
    const projectRoot = path.join(__dirname, '../../..');
    const scriptPath = path.join(projectRoot, 'scripts/context-sync.js');

    // Build command
    const command = `node "${scriptPath}"${force ? ' --force' : ''}`;

    // Execute script and capture output
    const output = execSync(command, {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    // Parse output for results
    const lines = output.split('\n');
    const updatedFiles = [];
    const warnings = [];

    lines.forEach(line => {
      if (line.includes('✅') || line.includes('Updated:')) {
        // Extract file name from success messages
        const match = line.match(/(?:✅|Updated:)\s*(.+\.md)/);
        if (match) {
          updatedFiles.push(match[1]);
        }
      } else if (line.includes('⚠️') || line.includes('Warning:')) {
        warnings.push(line.trim());
      }
    });

    return {
      success: true,
      message: `Documentation sync completed. ${updatedFiles.length} file(s) updated.`,
      updatedFiles,
      warnings,
      output: output.trim()
    };

  } catch (error) {
    // Script execution failed
    return {
      success: false,
      error: error.message,
      output: error.stdout || error.stderr || '',
      message: 'Documentation sync failed. See output for details.'
    };
  }
}

module.exports = { execute };
