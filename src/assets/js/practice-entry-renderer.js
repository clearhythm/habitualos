/**
 * Shared utility for rendering practice entry content consistently
 * across different pages (history, detail, etc.)
 */

/**
 * Renders the inner content of a practice entry (Obi-Wai quote + Reflection)
 * @param {Object} practice - Practice log object
 * @param {Object} options - Rendering options
 * @param {boolean} options.makeObiWaiClickable - Whether to make Obi-Wai quote clickable
 * @param {boolean} options.showFeedbackIcon - Whether to show thumbs up/down icon
 * @returns {string} HTML string
 */
export function renderPracticeEntryContent(practice, options = {}) {
  const {
    makeObiWaiClickable = false,
    showFeedbackIcon = false
  } = options;

  let html = '';

  // Obi-Wai quote (shown first if it exists)
  if (practice.obi_wan_message) {
    const obiWaiContent = `
      <div style="padding: 1.25rem; background: #faf9f7; border-radius: 8px; border-left: 4px solid #9b59b6; ${makeObiWaiClickable ? 'cursor: pointer; transition: background 0.2s;' : ''}"
           ${makeObiWaiClickable ? `onmouseover="this.style.background='#f5f3f1'" onmouseout="this.style.background='#faf9f7'"` : ''}>
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 0.5rem; color: #9b59b6;">
              Obi-Wai
            </div>
            <div style="font-style: italic; font-size: 0.95rem; line-height: 1.5; color: #555;">
              "${escapeHtml(practice.obi_wan_message)}"
            </div>
          </div>
          ${showFeedbackIcon ? getFeedbackIcon(practice.obi_wan_feedback) : ''}
        </div>
      </div>
    `;

    if (makeObiWaiClickable) {
      html += `<a href="/practice/log/?practice=${practice.id}" style="text-decoration: none; color: inherit; display: block; margin-bottom: 1rem;">${obiWaiContent}</a>`;
    } else {
      html += `<div style="margin-bottom: 1rem;">${obiWaiContent}</div>`;
    }
  }

  // Reflection (shown second if it exists)
  if (practice.reflection) {
    html += `
      <div style="padding: 1rem; background: #f9f9f9; border-radius: 4px;">
        <div style="font-size: 0.85rem; font-weight: 600; color: #666; text-transform: uppercase; margin-bottom: 0.5rem;">
          Reflection
        </div>
        <div style="color: #333; line-height: 1.6; white-space: pre-line;">${escapeHtml(practice.reflection)}</div>
      </div>
    `;
  }

  return html;
}

/**
 * Get feedback icon HTML based on feedback type
 */
function getFeedbackIcon(feedback) {
  if (feedback === 'thumbs_up') {
    return '<div style="font-size: 1.5rem;">👍</div>';
  } else if (feedback === 'thumbs_down') {
    return '<div style="font-size: 1.5rem;">👎</div>';
  }
  return '';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
