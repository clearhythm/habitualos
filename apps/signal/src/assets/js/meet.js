var signalId = window.location.pathname.replace(/\/+$/, '').split('/').pop();

if (!signalId || signalId === 'meet') {
  // No signalId in path — nothing to load
} else {
  fetch('/api/signal-config-get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signalId: signalId })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (!data.success) { console.warn('[meet] config-get failed:', data.error); return; }
    var config = data.config;
    var displayName = config.displayName || signalId;

    // Name + title
    document.getElementById('widget-name').textContent = displayName;
    document.title = displayName + ' — Signal';

    // Tagline
    if (config.tagline) {
      document.getElementById('widget-tagline').textContent = config.tagline;
    }

    // Tags
    if (config.tags && config.tags.length) {
      var tagsEl = document.getElementById('meet-tags');
      config.tags.forEach(function(tag) {
        var pill = document.createElement('span');
        pill.className = 'signal-pill';
        pill.textContent = tag;
        tagsEl.appendChild(pill);
      });
    }

    // Avatar
    var avatarWrap = document.getElementById('widget-avatar-wrap');
    var avatarEl = document.getElementById('widget-avatar');
    avatarEl.src = config.avatarUrl || '/assets/images/signal-agent_clean.png';
    avatarEl.alt = displayName;
    avatarWrap.style.display = '';
    avatarEl.onerror = function() { avatarWrap.style.display = 'none'; };

    // Stats card
    var stats = config.contextStats || {};
    var chunks = stats.processedChunks || stats.totalChunks;
    if (chunks) {
      var statsCard = document.getElementById('meet-stats-card');
      var statsList = document.getElementById('meet-stats-list');
      var statsUpdated = document.getElementById('meet-stats-updated');

      statsCard.style.display = '';

      if (chunks) {
        var li = document.createElement('li');
        li.textContent = chunks + ' work sessions';
        statsList.appendChild(li);
      }

      var li2 = document.createElement('li');
      li2.innerHTML = '<a href="https://github.com/clearhythm" target="_blank" rel="noopener" class="meet-stats-cred-link">2 repositories →</a>';
      statsList.appendChild(li2);

      if (stats.lastIngestAt) {
        var last = new Date(stats.lastIngestAt);
        var now = new Date();
        var diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));
        var time = last.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        var lastStr = diffDays === 0 ? 'today at ' + time : diffDays === 1 ? 'yesterday' : diffDays + ' days ago';
        statsUpdated.textContent = 'Last updated ' + lastStr;
      }
    }

    // CTA button
    var btn = document.getElementById('widget-open-btn');
    btn.style.display = '';
    btn.addEventListener('click', function() {
      window.signalOpen({ mode: 'visitor', signalId: signalId });
    });

    // Auto-open only if #interview hash present
    if (window.location.hash === '#interview') {
      var attempts = 0;
      var autoOpen = setInterval(function() {
        attempts++;
        if (typeof window.signalOpen === 'function') {
          clearInterval(autoOpen);
          window.signalOpen({ mode: 'visitor', signalId: signalId });
        } else if (attempts > 40) {
          clearInterval(autoOpen);
        }
      }, 50);
    }
  })
  .catch(function(err) { console.error('[meet] fetch error:', err); });
}
