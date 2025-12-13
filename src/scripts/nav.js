// Navigation Component
// Handles breadcrumb navigation and other navigation UI elements

/**
 * Get dashboard URL with current state preserved
 * @returns {string} Dashboard URL with query params
 */
function getDashboardURL() {
  const savedState = sessionStorage.getItem('dashboardState');
  return savedState ? `/?${savedState}` : '/';
}

/**
 * Save current dashboard state to session storage
 */
function saveDashboardState() {
  const currentParams = window.location.search.substring(1); // Remove leading '?'
  if (currentParams) {
    sessionStorage.setItem('dashboardState', currentParams);
  } else {
    sessionStorage.removeItem('dashboardState');
  }
}

/**
 * Update breadcrumb navigation with context-aware path
 * @param {Array} crumbs - Array of {label, url} objects representing the breadcrumb path
 */
function updateBreadcrumb(crumbs) {
  const breadcrumbEl = document.querySelector('#breadcrumb');
  if (!breadcrumbEl) return;

  const links = crumbs.map(crumb =>
    `<a href="${crumb.url}">${crumb.label}</a>`
  ).join(' &gt; ');

  breadcrumbEl.innerHTML = `&larr; ${links}`;
}

/**
 * Initialize breadcrumb with dashboard state preservation
 */
function initBreadcrumb() {
  const breadcrumbEl = document.querySelector('#breadcrumb');
  if (!breadcrumbEl) return;

  // If on dashboard, save state
  if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    saveDashboardState();
  } else {
    // On other pages, update default breadcrumb link to preserve state
    const defaultLink = breadcrumbEl.querySelector('a[href="/"]');
    if (defaultLink) {
      defaultLink.href = getDashboardURL();
    }
  }
}

/**
 * Get URL parameter value
 * @param {string} param - Parameter name
 * @returns {string|null} Parameter value or null
 */
function getURLParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

/**
 * Set URL parameter and update browser history
 * @param {string} param - Parameter name
 * @param {string|null} value - Parameter value (null to remove)
 */
function setURLParam(param, value) {
  const url = new URL(window.location.href);

  if (value === null || value === '') {
    url.searchParams.delete(param);
  } else {
    url.searchParams.set(param, value);
  }

  // Update URL without page reload
  window.history.pushState({}, '', url);

  // Update breadcrumb if on dashboard
  if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    updateDashboardBreadcrumb();
  }
}

/**
 * Update dashboard breadcrumb based on URL state
 */
function updateDashboardBreadcrumb() {
  const showCompleted = getURLParam('completed') === 'true';

  if (showCompleted) {
    updateBreadcrumb([
      { label: 'Dashboard', url: getDashboardURL() },
      { label: 'Completed', url: '/?completed=true' }
    ]);
  } else {
    // Reset to default
    const breadcrumbEl = document.querySelector('#breadcrumb');
    if (breadcrumbEl) {
      breadcrumbEl.innerHTML = `<a href="${getDashboardURL()}">&larr; Back to Dashboard</a>`;
    }
  }
}

/**
 * Toggle completed actions visibility with URL state management
 */
function initToggleCompleted() {
  const toggleBtn = document.querySelector('#toggle-completed');
  const actionsGrid = document.querySelector('#actions-grid');

  if (!toggleBtn || !actionsGrid) return;

  // Read initial state from URL
  const showCompleted = getURLParam('completed') === 'true';

  // Apply initial filter
  applyCompletedFilter(showCompleted);

  // Update button text
  const count = window.completedActionsCount || 0;
  toggleBtn.textContent = showCompleted
    ? `Hide Completed (${count})`
    : `Show Completed (${count})`;

  if (showCompleted) {
    updateDashboardBreadcrumb();
  }

  // Handle toggle click
  toggleBtn.addEventListener('click', () => {
    const showCompleted = getURLParam('completed') === 'true';
    const newState = !showCompleted;
    const count = window.completedActionsCount || 0;

    if (newState) {
      // Show completed
      applyCompletedFilter(true);
      toggleBtn.textContent = `Hide Completed (${count})`;
      setURLParam('completed', 'true');
      saveDashboardState(); // Save state after URL update
    } else {
      // Hide completed
      applyCompletedFilter(false);
      toggleBtn.textContent = `Show Completed (${count})`;
      setURLParam('completed', null);
      saveDashboardState(); // Save state after URL update
    }
  });

  // Handle browser back/forward
  window.addEventListener('popstate', () => {
    const showCompleted = getURLParam('completed') === 'true';
    const count = window.completedActionsCount || 0;

    applyCompletedFilter(showCompleted);
    toggleBtn.textContent = showCompleted
      ? `Hide Completed (${count})`
      : `Show Completed (${count})`;

    updateDashboardBreadcrumb();
  });
}

/**
 * Apply filter to show/hide completed action cards
 * @param {boolean} showCompleted - Whether to show completed cards
 */
function applyCompletedFilter(showCompleted) {
  const completedCards = document.querySelectorAll('[data-card-type="completed"]');

  completedCards.forEach(card => {
    card.style.display = showCompleted ? '' : 'none';
  });
}
