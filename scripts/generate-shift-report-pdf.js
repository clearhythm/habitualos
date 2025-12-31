const fs = require('fs');
const path = require('path');
const { markdownToPDF } = require('../lib/pdf-generator');

/**
 * Generate a shift report PDF for a specific user
 * @param {string} userId - User identifier (e.g., 'suzi')
 * @param {string} outputDir - Directory containing the markdown report
 */
async function generateShiftReportPDF(userId, outputDir) {
  const reportPath = path.join(outputDir, `${userId}-report.md`);
  const pdfPath = path.join(outputDir, `${userId}-shift-report.pdf`);

  // Verify report exists
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Shift report not found for ${userId} at: ${reportPath}`);
  }

  // Path to Healify template
  const templatePath = path.join(__dirname, '..', 'lib', 'templates', 'healify-template.tex');

  // Generate PDF with Healify branding
  await markdownToPDF(
    reportPath,
    pdfPath,
    {
      fontSize: '11pt',
      lineStretch: '1.5',
      mainFont: 'Poppins',
      headingFont: 'Copernicus Trial',
      template: templatePath
    }
  );

  console.log(`✓ Shift report PDF generated for ${userId}`);
  return pdfPath;
}

// CLI usage
if (require.main === module) {
  const userId = process.argv[2];
  const outputDir = process.argv[3] || path.join(__dirname, '..', 'data', 'tasks', 'healify-shift-reports', 'outputs');

  if (!userId) {
    console.error('Usage: node scripts/generate-shift-report-pdf.js <userId> [outputDir]');
    console.error('Example: node scripts/generate-shift-report-pdf.js suzi');
    process.exit(1);
  }

  generateShiftReportPDF(userId, outputDir)
    .then(pdfPath => {
      console.log(`\nSuccess! PDF created at: ${pdfPath}`);
      console.log(`\nYou can now email this PDF to the user.`);
    })
    .catch(err => {
      console.error('Error generating PDF:', err.message);
      process.exit(1);
    });
}

module.exports = { generateShiftReportPDF };
