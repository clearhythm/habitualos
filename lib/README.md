# HabitualOS Utilities

## PDF Generator (`pdf-generator.js`)

A reusable utility for converting markdown files to PDF using Pandoc + BasicTeX.

### Installation

```bash
# Install Pandoc (markdown → PDF converter)
brew install pandoc

# Install BasicTeX (LaTeX engine, ~80MB)
brew install --cask basictex

# Update PATH (required after BasicTeX install)
eval "$(/usr/libexec/path_helper)"
```

### Usage

#### As a Module

```javascript
const { combineMarkdownToPDF, markdownToPDF } = require('./lib/pdf-generator');

// Convert single markdown file
await markdownToPDF('input.md', 'output.pdf');

// Combine multiple markdown files
await combineMarkdownToPDF(
  ['card1.md', 'card2.md', 'card3.md'],
  'combined.pdf',
  {
    prefix: '# My Document\n\n',
    separator: '\n\n\\newpage\n\n',
    fontSize: '11pt',
    mainFont: 'Georgia'
  }
);
```

#### From Command Line

```bash
# Generate Shift Cards PDF
npm run pdf:shift-cards suzi

# Or directly
node scripts/generate-shift-cards-pdf.js suzi
```

### API

#### `markdownToPDF(inputPath, outputPath, options)`

Convert a single markdown file to PDF.

**Parameters:**
- `inputPath` (string): Path to input markdown file
- `outputPath` (string): Path to output PDF file
- `options` (object): Pandoc options
  - `pdfEngine` (string): PDF engine to use (default: 'xelatex')
  - `margin` (string): Page margins (default: '1in')
  - `fontSize` (string): Base font size (default: '11pt')
  - `lineStretch` (string): Line spacing (default: '1.5')
  - `mainFont` (string): Main font (default: 'Georgia')
  - `headingFont` (string): Font for headings (optional)
  - `template` (string): Path to custom LaTeX template (optional)

**Returns:** Promise<string> - Path to generated PDF

#### `combineMarkdownToPDF(inputPaths, outputPath, options)`

Combine multiple markdown files and convert to PDF.

**Parameters:**
- `inputPaths` (string[]): Array of markdown file paths
- `outputPath` (string): Path to output PDF file
- `options` (object): Configuration options
  - `separator` (string): Text between files (default: '\\n\\n\\\\newpage\\n\\n')
  - `prefix` (string): Text at the beginning (default: '')
  - `tempDir` (string): Temporary directory (default: '/tmp')
  - `cleanupTemp` (boolean): Delete temp file (default: true)
  - All `markdownToPDF` options

**Returns:** Promise<string> - Path to generated PDF

#### `checkDependencies()`

Check if Pandoc and BasicTeX are installed.

**Returns:** Promise<Object> - Status object with `pandoc` and `basictex` booleans

### Custom Templates

The PDF generator supports custom LaTeX templates for branding and styling.

**Healify Template Example:**

```javascript
const path = require('path');
const { combineMarkdownToPDF } = require('./lib/pdf-generator');

const templatePath = path.join(__dirname, 'lib', 'templates', 'healify-template.tex');

await combineMarkdownToPDF(
  ['card1.md', 'card2.md', 'card3.md'],
  'shift-cards.pdf',
  {
    template: templatePath,
    mainFont: 'Poppins',
    headingFont: 'Copernicus',
    fontSize: '11pt',
    lineStretch: '1.5'
  }
);
```

**Template Features:**
- Custom fonts (requires XeLaTeX with fontspec)
- Brand colors for headings
- Custom spacing and margins
- Styled hyperlinks

See [lib/templates/healify-template.tex](templates/healify-template.tex) for reference.

### Use Cases

- **Shift Cards**: Generate PDFs of Healify shift cards for email delivery
- **Reports**: Combine multiple markdown reports into a single PDF
- **Documentation**: Export project documentation as PDF
- **Artifacts**: Create shareable PDF artifacts from agent outputs

### Future Enhancements

- HTML output option
- Table of contents generation
- Header/footer customization
- Watermarks
