/**
 * text-animate.js - Letter-by-letter text transition utility
 *
 * Animates text changes by typing out new text character by character.
 * Used for weather label transitions on the homepage.
 */

/**
 * Animate text content of an element with a letter-by-letter transition.
 * @param {HTMLElement} element - The element to animate
 * @param {string} newText - The new text to display
 * @param {Object} [options]
 * @param {number} [options.speed=40] - Milliseconds per character
 * @param {boolean} [options.clearFirst=true] - Clear element before typing
 * @returns {Promise<void>} Resolves when animation completes
 */
export function animateText(element, newText, { speed = 40, clearFirst = true } = {}) {
  return new Promise((resolve) => {
    if (clearFirst) element.textContent = '';
    let i = 0;

    function typeNext() {
      if (i < newText.length) {
        element.textContent += newText[i];
        i++;
        setTimeout(typeNext, speed);
      } else {
        resolve();
      }
    }

    typeNext();
  });
}
