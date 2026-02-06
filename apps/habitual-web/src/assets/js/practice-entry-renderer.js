/**
 * Shared utility for rendering practice entry content consistently
 * across different pages (history, detail, etc.)
 */

/**
 * Renders the inner content of a practice entry (Obi-Wai quote + Reflection)
 * @param {Object} practice - Practice log object
 * @param {Object} options - Rendering options
 * @param {boolean} options.expandableInline - Whether to make Obi-Wai quote expandable inline (vs linking to entry page)
 * @param {boolean} options.showFeedbackIcon - Whether to show thumbs up/down icon in collapsed state
 * @returns {string} HTML string
 */
export function renderPracticeEntryContent(practice, options = {}) {
  const {
    expandableInline = false,
    showFeedbackIcon = false
  } = options;

  let html = '';

  // Obi-Wai quote (shown first if it exists)
  if (practice.obi_wan_message) {
    if (expandableInline) {
      // Inline expandable version
      html += renderExpandableObiWai(practice, showFeedbackIcon);
    } else {
      // Static version (no interaction)
      html += renderStaticObiWai(practice, showFeedbackIcon);
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
 * Render expandable inline Obi-Wai quote
 */
function renderExpandableObiWai(practice, showFeedbackIcon) {
  const hasExpanded = !!practice.obi_wan_expanded;
  const feedbackClass = practice.obi_wan_feedback === 'thumbs_up' ? 'feedback-up' :
                        practice.obi_wan_feedback === 'thumbs_down' ? 'feedback-down' : '';

  return `
    <div class="obi-wai-entry ${hasExpanded ? 'obi-wai-expandable' : ''}" data-practice-id="${practice.id}" style="padding: 1.25rem; background: #faf9f7; border-radius: 8px; border-left: 4px solid #9b59b6; margin-bottom: 1rem; ${hasExpanded ? 'cursor: pointer; transition: background 0.2s;' : ''}">
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

      ${hasExpanded ? `
        <div class="obi-wai-expand-toggle" style="margin-top: 0.75rem; color: #9b59b6; font-size: 0.9rem;">Read more...</div>
        <div class="obi-wai-expanded-content" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(155, 89, 182, 0.2);">
          <div style="font-size: 0.95rem; line-height: 1.6; color: #333; padding-bottom: 1rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(155, 89, 182, 0.2);">
            ${escapeHtml(practice.obi_wan_expanded)}
          </div>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <button
              class="obi-wai-thumbs-up ${feedbackClass === 'feedback-up' ? 'selected' : ''}"
              style="padding: 0.75rem 1.5rem; background: ${practice.obi_wan_feedback === 'thumbs_up' ? '#d4edda' : '#f0f0f0'}; border: 2px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 1.5rem; transition: all 0.2s; ${practice.obi_wan_feedback === 'thumbs_down' ? 'opacity: 0.3;' : ''}"
              title="This felt supportive"
            >
              👍
            </button>
            <button
              class="obi-wai-thumbs-down ${feedbackClass === 'feedback-down' ? 'selected' : ''}"
              style="padding: 0.75rem 1.5rem; background: ${practice.obi_wan_feedback === 'thumbs_down' ? '#f8d7da' : '#f0f0f0'}; border: 2px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 1.5rem; transition: all 0.2s; ${practice.obi_wan_feedback === 'thumbs_up' ? 'opacity: 0.3;' : ''}"
              title="This didn't land well"
            >
              👎
            </button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render static (non-expandable) Obi-Wai quote
 */
function renderStaticObiWai(practice, showFeedbackIcon) {
  return `
    <div style="padding: 1.25rem; background: #faf9f7; border-radius: 8px; border-left: 4px solid #9b59b6; margin-bottom: 1rem;">
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
}

/**
 * Initialize expand/collapse and feedback for all Obi-Wai entries on the page
 * Call this after rendering entries with expandableInline: true
 */
export function initObiWaiEntries() {
  // Make entire expandable card clickable
  document.querySelectorAll('.obi-wai-expandable').forEach(entry => {
    entry.addEventListener('click', (e) => {
      // Don't toggle if clicking on feedback buttons
      if (e.target.closest('.obi-wai-thumbs-up') || e.target.closest('.obi-wai-thumbs-down')) {
        return;
      }

      const content = entry.querySelector('.obi-wai-expanded-content');
      const toggle = entry.querySelector('.obi-wai-expand-toggle');

      if (content.style.display === 'none') {
        content.style.display = 'block';
        if (toggle) toggle.textContent = 'Show less';
      } else {
        content.style.display = 'none';
        if (toggle) toggle.textContent = 'Read more...';
      }
    });

    // Hover effect
    entry.addEventListener('mouseenter', () => {
      entry.style.background = '#f5f3f1';
    });
    entry.addEventListener('mouseleave', () => {
      entry.style.background = '#faf9f7';
    });
  });

  // Feedback buttons
  document.querySelectorAll('.obi-wai-thumbs-up, .obi-wai-thumbs-down').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const entry = e.target.closest('.obi-wai-entry');
      const practiceId = entry.dataset.practiceId;
      const isThumbsUp = btn.classList.contains('obi-wai-thumbs-up');
      const feedback = isThumbsUp ? 'thumbs_up' : 'thumbs_down';

      const thumbsUp = entry.querySelector('.obi-wai-thumbs-up');
      const thumbsDown = entry.querySelector('.obi-wai-thumbs-down');

      try {
        await fetch('/.netlify/functions/practice-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: practiceId, feedback })
        });

        if (isThumbsUp) {
          thumbsUp.style.background = '#d4edda';
          thumbsUp.classList.add('selected');
          thumbsUp.style.opacity = '1';
          thumbsDown.style.background = '#f0f0f0';
          thumbsDown.classList.remove('selected');
          thumbsDown.style.opacity = '0.3';
        } else {
          thumbsDown.style.background = '#f8d7da';
          thumbsDown.classList.add('selected');
          thumbsDown.style.opacity = '1';
          thumbsUp.style.background = '#f0f0f0';
          thumbsUp.classList.remove('selected');
          thumbsUp.style.opacity = '0.3';
        }
      } catch (error) {
        console.error('Error submitting feedback:', error);
      }
    });
  });
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
