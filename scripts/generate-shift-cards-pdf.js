/**
 * Generate Shift Cards PDF
 *
 * Combines 3 shift card markdown files into a single PDF with intro
 */

const fs = require('fs');
const path = require('path');
const { combineMarkdownToPDF } = require('../lib/pdf-generator');

/**
 * Generate PDF for a user's shift cards
 *
 * @param {string} userId - User identifier
 * @param {string} outputDir - Directory containing card markdown files
 * @returns {Promise<string>} - Path to generated PDF
 */
async function generateShiftCardsPDF(userId, outputDir) {
  // Define file paths
  const card1Path = path.join(outputDir, `${userId}_card1.md`);
  const card2Path = path.join(outputDir, `${userId}_card2.md`);
  const card3Path = path.join(outputDir, `${userId}_card3.md`);
  const pdfPath = path.join(outputDir, `${userId}_shift-cards.pdf`);

  // Verify all cards exist
  const missingCards = [];
  if (!fs.existsSync(card1Path)) missingCards.push('card1');
  if (!fs.existsSync(card2Path)) missingCards.push('card2');
  if (!fs.existsSync(card3Path)) missingCards.push('card3');

  if (missingCards.length > 0) {
    throw new Error(`Missing cards for ${userId}: ${missingCards.join(', ')}`);
  }

  // Intro text
  const intro = `# Your Healify Shift Cards

Thank you for sharing your check-in data with Healify. Based on your entries, we've generated 3 personalized Shift Cards to help you reflect on patterns in your mental health journey.

## How to Use These Cards

Each card highlights a different aspect of your experience:

- **Card 1 (Primary Theme):** A pattern that stayed consistent
- **Card 2 (Primary Shift):** A significant change or turning point
- **Card 3 (Current Orientation):** Where you are now

Take time to read each card and sit with the reflection question. There's no right or wrong answer — these are invitations to notice what resonates.

---

`;

  // Path to Healify template
  const templatePath = path.join(__dirname, '..', 'lib', 'templates', 'healify-template.tex');

  // Generate PDF
  await combineMarkdownToPDF(
    [card1Path, card2Path, card3Path],
    pdfPath,
    {
      prefix: intro,
      separator: '\n\n\\newpage\n\n',
      fontSize: '11pt',
      lineStretch: '1.5',
      mainFont: 'Poppins',
      headingFont: 'Copernicus',
      template: templatePath
    }
  );

  console.log(`✓ Shift cards PDF generated for ${userId}`);
  return pdfPath;
}

// CLI usage
if (require.main === module) {
  const userId = process.argv[2];
  const outputDir = process.argv[3] || path.join(__dirname, '..', 'data', 'tasks', 'healify-shift-cards', 'outputs');

  if (!userId) {
    console.error('Usage: node scripts/generate-shift-cards-pdf.js <userId> [outputDir]');
    console.error('Example: node scripts/generate-shift-cards-pdf.js suzi');
    process.exit(1);
  }

  generateShiftCardsPDF(userId, outputDir)
    .then(pdfPath => {
      console.log(`\nSuccess! PDF created at: ${pdfPath}`);
      console.log(`\nYou can now email this PDF to the user.`);
    })
    .catch(err => {
      console.error('Error generating PDF:', err.message);
      process.exit(1);
    });
}

module.exports = { generateShiftCardsPDF };
