//
// scripts/file.js
// ------------------------------------------------------
// File viewer page module - displays markdown files from actions
// Self-initializes on DOMContentLoaded
// ------------------------------------------------------

import { initializeUser } from '/assets/js/auth/auth.js';
import { log } from '/assets/js/utils/log.js';
import { formatDate, escapeHtml, formatFileSize } from '/assets/js/utils/utils.js';

// -----------------------------
// File Loading
// -----------------------------
async function loadFileView() {
  const loadingEl = document.querySelector('#loading-file');
  const errorEl = document.querySelector('#file-error');
  const contentEl = document.querySelector('#file-content');

  // Extract actionId and filename from URL: /do/file/:actionId/:filename
  const pathParts = window.location.pathname.split('/').filter(p => p);
  const actionId = pathParts[2];
  const filename = pathParts[3];

  if (!actionId || !filename) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const response = await fetch(`/api/file-view/${actionId}/${filename}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'File not found');
    }

    // Display file info
    document.querySelector('#file-title').textContent = data.filename;
    document.querySelector('#file-meta').textContent = `Modified: ${formatDate(data.modified)} • Size: ${formatFileSize(data.size)}`;

    // Setup back link
    const backLink = document.querySelector('#back-to-task');
    backLink.textContent = data.actionTitle;
    backLink.href = `/do/action/${actionId}`;

    // Update breadcrumb (function from nav.js, loaded globally)
    if (typeof updateBreadcrumb === 'function') {
      updateBreadcrumb([
        { label: 'Dashboard', url: '/do/' },
        { label: data.actionTitle, url: `/do/action/${actionId}` },
        { label: data.filename, url: '#' }
      ]);
    }

    // Render markdown using marked library
    const markdownContent = document.querySelector('#markdown-content');
    if (typeof marked !== 'undefined') {
      markdownContent.innerHTML = marked.parse(data.content);
    } else {
      // Fallback if marked library not loaded
      markdownContent.innerHTML = `<pre>${escapeHtml(data.content)}</pre>`;
    }

    // Show content
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

  } catch (error) {
    log('error', 'Error loading file:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
  }
}

// -----------------------------
// Page Initialization
// -----------------------------
function init() {
  log('debug', 'Initializing file module');

  // Initialize user
  initializeUser();

  // Load file view
  loadFileView();
}

// Self-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
