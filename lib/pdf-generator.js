/**
 * PDF Generator Utility for HabitualOS
 *
 * Converts markdown files to PDF using Pandoc + BasicTeX
 *
 * Requirements:
 * - brew install pandoc
 * - brew install --cask basictex
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Convert a single markdown file to PDF
 *
 * @param {string} inputPath - Path to input markdown file
 * @param {string} outputPath - Path to output PDF file
 * @param {Object} options - Pandoc options
 * @returns {Promise<string>} - Path to generated PDF
 */
async function markdownToPDF(inputPath, outputPath, options = {}) {
  const defaults = {
    pdfEngine: 'xelatex',
    margin: '1in',
    fontSize: '11pt',
    lineStretch: '1.5',
    mainFont: 'Georgia',
    headingFont: null,
    template: null
  };

  const config = { ...defaults, ...options };

  // Build pandoc command
  let cmd = `pandoc "${inputPath}" -o "${outputPath}" \
    --pdf-engine=${config.pdfEngine} \
    --variable geometry:margin=${config.margin} \
    --variable fontsize=${config.fontSize} \
    --variable linestretch=${config.lineStretch} \
    --variable mainfont="${config.mainFont}"`;

  // Add heading font if specified
  if (config.headingFont) {
    cmd += ` --variable headingfont="${config.headingFont}"`;
  }

  // Add custom template if specified
  if (config.template) {
    cmd += ` --template="${config.template}"`;
  }

  try {
    await execAsync(cmd);
    console.log(`✓ PDF generated: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw error;
  }
}

/**
 * Combine multiple markdown files and convert to PDF
 *
 * @param {string[]} inputPaths - Array of markdown file paths
 * @param {string} outputPath - Path to output PDF file
 * @param {Object} options - Configuration options
 * @returns {Promise<string>} - Path to generated PDF
 */
async function combineMarkdownToPDF(inputPaths, outputPath, options = {}) {
  const {
    separator = '\n\n\\newpage\n\n', // LaTeX page break
    prefix = '',
    tempDir = '/tmp',
    cleanupTemp = true,
    ...pandocOptions
  } = options;

  // Create temporary combined file
  const tempPath = path.join(tempDir, `combined-${Date.now()}.md`);

  try {
    // Read all input files
    const contents = inputPaths.map(filePath =>
      fs.readFileSync(filePath, 'utf-8')
    );

    // Combine with separator
    const combined = prefix + contents.join(separator);

    // Write to temp file
    fs.writeFileSync(tempPath, combined);

    // Convert to PDF
    await markdownToPDF(tempPath, outputPath, pandocOptions);

    return outputPath;
  } finally {
    // Clean up temp file
    if (cleanupTemp && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

/**
 * Check if required dependencies are installed
 *
 * @returns {Promise<Object>} - Status of dependencies
 */
async function checkDependencies() {
  const status = {
    pandoc: false,
    basictex: false
  };

  try {
    await execAsync('which pandoc');
    status.pandoc = true;
  } catch (error) {
    console.warn('⚠️  Pandoc not found. Install with: brew install pandoc');
  }

  try {
    await execAsync('which xelatex');
    status.basictex = true;
  } catch (error) {
    console.warn('⚠️  BasicTeX not found. Install with: brew install --cask basictex');
  }

  return status;
}

module.exports = {
  markdownToPDF,
  combineMarkdownToPDF,
  checkDependencies
};
