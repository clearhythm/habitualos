/**
 * Shared module for Obi-Wai quote display with expandable wisdom
 */

/**
 * Initialize the expand/collapse functionality for Obi-Wai wisdom
 * @param {Object} elements - DOM elements
 * @param {HTMLElement} elements.expandButton - The "Read more" button
 * @param {HTMLElement} elements.expandedContent - The expandable content div
 * @param {HTMLElement} [elements.expandContainer] - Optional container to hide if no expanded content
 */
export function initExpandWisdom({ expandButton, expandedContent, expandContainer }) {
  if (!expandButton || !expandedContent) return;

  expandButton.addEventListener('click', () => {
    if (expandedContent.style.display === 'none') {
      expandedContent.style.display = 'block';
      expandButton.textContent = 'Show less';
    } else {
      expandedContent.style.display = 'none';
      expandButton.textContent = 'Read more...';
    }
  });
}

/**
 * Display an Obi-Wai quote with optional expanded wisdom
 * @param {Object} options
 * @param {string} options.message - The main quote message
 * @param {string} [options.expanded] - The expanded wisdom text
 * @param {HTMLElement} options.messageEl - Element to display the message
 * @param {HTMLElement} options.expandedEl - Element to show/hide for expanded content
 * @param {HTMLElement} [options.expandedTextEl] - Optional separate element for expanded text (if expandedEl contains other content)
 * @param {HTMLElement} options.expandButton - The expand button
 * @param {HTMLElement} [options.expandContainer] - Container to hide if no expanded content
 */
export function displayObiWaiQuote({ message, expanded, messageEl, expandedEl, expandedTextEl, expandButton, expandContainer }) {
  // Set the main message
  messageEl.textContent = message;

  // Handle expanded content
  if (expanded) {
    // Put text in expandedTextEl if provided, otherwise in expandedEl
    const textTarget = expandedTextEl || expandedEl;
    textTarget.textContent = expanded;
    expandedEl.style.display = 'none';
    expandButton.textContent = 'Read more...';
    if (expandContainer) {
      expandContainer.style.display = 'block';
    }
  } else {
    // Hide expand section if no expanded content
    if (expandContainer) {
      expandContainer.style.display = 'none';
    }
  }
}

/**
 * Initialize feedback buttons for Obi-Wai quotes
 * @param {Object} options
 * @param {HTMLElement} options.thumbsUp - Thumbs up button
 * @param {HTMLElement} options.thumbsDown - Thumbs down button
 * @param {Function} options.getPracticeId - Function that returns current practice ID
 * @param {string} [options.initialFeedback] - Initial feedback state ('thumbs_up' or 'thumbs_down')
 */
export function initFeedbackButtons({ thumbsUp, thumbsDown, getPracticeId, initialFeedback }) {
  // Show initial state
  if (initialFeedback === 'thumbs_up') {
    thumbsUp.style.background = '#d4edda';
    thumbsUp.classList.add('selected');
    thumbsDown.style.opacity = '0.3';
  } else if (initialFeedback === 'thumbs_down') {
    thumbsDown.style.background = '#f8d7da';
    thumbsDown.classList.add('selected');
    thumbsUp.style.opacity = '0.3';
  }

  thumbsUp.addEventListener('click', async () => {
    const practiceId = getPracticeId();
    if (!practiceId) return;

    try {
      await fetch('/.netlify/functions/practice-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: practiceId, feedback: 'thumbs_up' })
      });

      thumbsUp.style.background = '#d4edda';
      thumbsUp.classList.add('selected');
      thumbsDown.style.opacity = '0.3';
      thumbsDown.classList.remove('selected');
      thumbsDown.style.background = '#f0f0f0';
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  });

  thumbsDown.addEventListener('click', async () => {
    const practiceId = getPracticeId();
    if (!practiceId) return;

    try {
      await fetch('/.netlify/functions/practice-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: practiceId, feedback: 'thumbs_down' })
      });

      thumbsDown.style.background = '#f8d7da';
      thumbsDown.classList.add('selected');
      thumbsUp.style.opacity = '0.3';
      thumbsUp.classList.remove('selected');
      thumbsUp.style.background = '#f0f0f0';
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  });
}
