(function() {
  var configEl = document.getElementById('demo-config');
  if (!configEl) return;

  var DEMO_ID = configEl.dataset.demoId;
  var CHARACTER_IDS = JSON.parse(configEl.dataset.characterIds || '[]');

  var demoData = null;
  var activeRole = null;

  function scoreColor(n) {
    if (n >= 8) return '#22c55e';
    if (n >= 6) return '#eab308';
    return '#ef4444';
  }

  function recClass(rec) {
    return 'rec-' + (rec || 'poor-fit').replace(/\s+/g, '-');
  }

  function recLabel(rec) {
    var map = {
      'strong-candidate': 'Strong Candidate',
      'worth-applying': 'Worth Applying',
      'stretch': 'Stretch Role',
      'questionable-fit': 'Questionable Fit',
      'poor-fit': 'Oh, Hell No'
    };
    return map[rec] || rec;
  }

  function ytLink(title) {
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent('Star Trek ' + title);
  }

  function shortName(p, id) {
    var name = p.nickname || p.displayName || id;
    return name.split(' ')[0];
  }

  function profileBodyHtml(id, p) {
    var skills = (p.skillsProfile && p.skillsProfile.coreSkills || []).slice(0, 6);
    var pillsHtml = skills.map(function(s) { return '<span class="signal-pill">' + s + '</span>'; }).join('');
    var bioText = '';
    if (p.synthesizedContext) {
      var paras = p.synthesizedContext.split(/\n\n+/);
      var prose = paras.find(function(para) {
        var stripped = para.replace(/^\*{1,2}|^#+\s*/gm, '').trim();
        return stripped.length > 80 && !/^\*{1,2}/.test(para.trim());
      });
      bioText = prose ? prose.replace(/\*{1,2}/g, '').trim() : (p.tagline || '');
    } else {
      bioText = p.tagline || '';
    }
    return '<p class="tagline">' + (p.tagline || '') + '</p>' +
      '<p class="bio">' + bioText + '</p>' +
      '<div class="svd-skill-tags">' + pillsHtml + '</div>' +
      '<div class="svd-card-cta"><button class="btn btn-outline" onclick="window.svdOpenChat(\'' + id + '\')">Interview ' + shortName(p, id) + ' \u2192</button></div>';
  }

  var RING_R = 44;
  var RING_C = +(2 * Math.PI * RING_R).toFixed(2);

  function scoreRingHtml(overall) {
    var offset = overall != null ? (RING_C * (1 - overall / 10)).toFixed(2) : RING_C;
    var color = scoreColor(overall);
    return '<div class="svd-ring-wrap">' +
      '<svg class="svd-ring" viewBox="0 0 100 100" width="72" height="72">' +
        '<circle class="svd-ring-track" cx="50" cy="50" r="' + RING_R + '"/>' +
        '<circle class="svd-ring-fill" cx="50" cy="50" r="' + RING_R + '"' +
          ' stroke-dasharray="' + RING_C + '"' +
          ' data-offset="' + offset + '"' +
          ' stroke-dashoffset="' + RING_C + '"' +
          ' style="stroke:' + color + '"/>' +
      '</svg>' +
      '<span class="svd-ring-score" style="color:' + color + ';font-size:1.25rem">' + (overall != null ? overall : '\u2014') + '</span>' +
    '</div>';
  }

  function scoredBodyHtml(id, evalData, p) {
    var score = evalData.score || {};
    var overall = score.overall;
    var scoreDims = [
      { label: 'Skills', key: 'skills' },
      { label: 'Alignment', key: 'alignment' },
      { label: 'Personality', key: 'personality' }
    ];
    var scoreBars = scoreDims.map(function(s) {
      var val = score[s.key];
      if (val == null) return '';
      var color = scoreColor(val);
      return '<div class="svd-score-row">' +
        '<span class="svd-score-label">' + s.label + '</span>' +
        '<div class="svd-score-bar-wrap"><div class="svd-score-bar" data-pct="' + (val / 10 * 100).toFixed(0) + '" style="width:0%;background:' + color + '"></div></div>' +
        '<span class="svd-score-val" style="color:' + color + '">' + val + '</span>' +
        '</div>';
    }).join('');

    var eFor = evalData.evidenceFor || [];
    var eAgainst = evalData.evidenceAgainst || [];
    var allEvidence = eFor.map(function(e) { return { item: e, pro: true }; })
      .concat(eAgainst.map(function(e) { return { item: e, pro: false }; }));
    var evidenceHtml = allEvidence.length
      ? '<p class="svd-section-label">Signal Evidence</p><ul class="svd-evidence-list">' +
        allEvidence.map(function(e) {
          var icon = e.pro ? '<span class="svd-ev-pro">+</span>' : '<span class="svd-ev-con">\u2212</span>';
          return '<li>' + icon + ' <a href="' + ytLink(e.item.title) + '" target="_blank" rel="noopener" class="svd-ev-title">' + e.item.title + '</a> \u2014 ' + e.item.signal + '</li>';
        }).join('') + '</ul>' : '';

    return '<div style="text-align:center;margin-top:0.25rem;margin-bottom:1.25rem"><span class="svd-recommendation ' + recClass(evalData.recommendation) + '">' + recLabel(evalData.recommendation) + '</span></div>' +
      '<div class="svd-scored-top">' + scoreRingHtml(overall) + '<div class="svd-scores" style="flex:1;margin:0">' + scoreBars + '</div></div>' +
      (evalData.summary ? '<p class="svd-summary">' + evalData.summary + '</p>' : '') +
      evidenceHtml +
      '<div class="svd-card-cta"><button class="btn btn-outline" onclick="window.svdOpenChat(\'' + id + '\')">Interview ' + shortName(p, id) + ' \u2192</button></div>';
  }

  function animateBars(bodyEl) {
    setTimeout(function() {
      bodyEl.querySelectorAll('.svd-score-bar[data-pct]').forEach(function(bar) {
        bar.style.width = bar.getAttribute('data-pct') + '%';
      });
      bodyEl.querySelectorAll('.svd-ring-fill[data-offset]').forEach(function(fill) {
        fill.style.strokeDashoffset = fill.getAttribute('data-offset');
      });
    }, 50);
  }

  function swapCardBody(id, renderFn) {
    var bodyEl = document.getElementById('body-' + id);
    if (!bodyEl) return;
    bodyEl.classList.add('is-out');
    setTimeout(function() {
      bodyEl.innerHTML = renderFn();
      bodyEl.classList.remove('is-out');
      animateBars(bodyEl);
    }, 160);
  }

  function renderProfiles(profiles) {
    CHARACTER_IDS.forEach(function(id) {
      var p = profiles[id];
      if (!p) return;

      // Avatar
      var avatarEl = document.getElementById('avatar-' + id);
      if (avatarEl) {
        avatarEl.src = p.avatarUrl || '/assets/images/avatar-placeholder.svg';
        avatarEl.alt = p.nickname || p.displayName || id;
      }

      // Heading
      var nameEl = document.getElementById('name-' + id);
      if (nameEl) nameEl.textContent = p.nickname || p.displayName || id;

      // Card body
      var bodyEl = document.getElementById('body-' + id);
      if (bodyEl) bodyEl.innerHTML = profileBodyHtml(id, p);
    });
  }

  function renderRolePicker(roles) {
    var picker = document.getElementById('role-picker');
    if (!picker) return;
    picker.innerHTML = roles.map(function(r) {
      return '<button class="svd-role-btn" data-role="' + r + '" onclick="window.svdSelectRole(this, \'' + r.replace(/'/g, "\\'") + '\')">' + r + '</button>';
    }).join('');
  }

  function applyWinnerState(roleEvals, profiles) {
    var scores = {};
    CHARACTER_IDS.forEach(function(id) {
      var e = roleEvals[id];
      scores[id] = e && e.score ? (e.score.overall || 0) : null;
    });

    var ids = CHARACTER_IDS.filter(function(id) { return scores[id] != null; });
    var winnerId = null;
    if (ids.length === 2 && scores[ids[0]] !== scores[ids[1]]) {
      winnerId = scores[ids[0]] > scores[ids[1]] ? ids[0] : ids[1];
    }

    CHARACTER_IDS.forEach(function(id) {
      var card = document.getElementById('card-' + id);
      if (!card) return;
      card.classList.remove('svd-card--winner', 'svd-card--loser');
      if (winnerId) {
        card.classList.add(id === winnerId ? 'svd-card--winner' : 'svd-card--loser');
      }
    });

    var verdictEl = document.getElementById('svd-verdict');
    if (!verdictEl) return;

    if (!winnerId || ids.length < 2) {
      verdictEl.hidden = true;
      return;
    }

    var loserId = CHARACTER_IDS.find(function(id) { return id !== winnerId; });
    var winnerName = shortName(profiles[winnerId] || {}, winnerId);
    var loserName = shortName(profiles[loserId] || {}, loserId);
    var winScore = scores[winnerId];
    var loseScore = scores[loserId];
    var winRec = recLabel((roleEvals[winnerId] || {}).recommendation);
    var loseRec = recLabel((roleEvals[loserId] || {}).recommendation);

    verdictEl.innerHTML =
      '<span class="svd-verdict-winner">' + winnerName + ' wins this one.</span>' +
      '<span class="svd-verdict-scores">' +
        winnerName + ': ' + winRec + ' (' + winScore + ')' +
        ' &nbsp;&middot;&nbsp; ' +
        loserName + ': ' + loseRec + ' (' + loseScore + ')' +
      '</span>';
    verdictEl.hidden = false;
  }

  window.svdSelectRole = function(btn, role) {
    var isActive = btn.classList.contains('active');
    document.querySelectorAll('.svd-role-btn').forEach(function(b) { b.classList.remove('active'); });

    if (isActive) { clearRole(); return; }

    btn.classList.add('active');
    activeRole = role;
    if (!demoData) return;

    var roleEvals = (demoData.evalsByRole || {})[role] || {};
    var profiles = demoData.profiles || {};

    CHARACTER_IDS.forEach(function(id) {
      var evalData = roleEvals[id];
      var p = profiles[id] || {};
      swapCardBody(id, evalData
        ? function() { return scoredBodyHtml(id, evalData, p); }
        : function() { return '<p class="bio" style="color:#64748b">No evaluation data.</p>'; }
      );
    });

    setTimeout(function() { applyWinnerState(roleEvals, profiles); }, 200);
  };

  window.svdOpenChat = function(signalId) {
    if (typeof window.signalOpen === 'function') {
      window.signalOpen({ mode: 'visitor', signalId: signalId });
    } else {
      alert('Chat widget not loaded yet \u2014 try again in a moment.');
    }
  };

  function clearRole() {
    if (!activeRole) return;
    activeRole = null;
    document.querySelectorAll('.svd-role-btn').forEach(function(b) { b.classList.remove('active'); });
    CHARACTER_IDS.forEach(function(id) {
      var card = document.getElementById('card-' + id);
      if (card) card.classList.remove('svd-card--winner', 'svd-card--loser');
    });
    var verdictEl = document.getElementById('svd-verdict');
    if (verdictEl) verdictEl.hidden = true;
    if (demoData) {
      var profiles = demoData.profiles || {};
      CHARACTER_IDS.forEach(function(id) {
        var p = profiles[id];
        if (p) swapCardBody(id, function() { return profileBodyHtml(id, p); });
      });
    }
  }

  document.addEventListener('click', function(e) {
    if (activeRole && !e.target.closest('.svd-role-btn, .svd-profiles')) clearRole();
  });

  function init() {
    fetch('/api/signal-demo-evals-get?demo=' + DEMO_ID)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.success) throw new Error(data.error || 'Failed to load demo data');
        demoData = data;
        renderProfiles(data.profiles || {});
        renderRolePicker(data.roles || []);
      })
      .catch(function(err) {
        console.error('Demo data load failed:', err);
        var picker = document.getElementById('role-picker');
        if (picker) picker.innerHTML = '<p style="color:#ef4444;font-size:0.875rem">Could not load demo data. Is the dev server running?</p>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
