// core/dom.js — HTML template injection and DOM ref binding

export const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

// Inject the widget overlay into <body>. Called once on init.
export function injectHTML(baseUrl) {
  const el = document.createElement('div');
  el.innerHTML = template(baseUrl);
  document.body.appendChild(el.firstElementChild);
}

// Query all DOM refs after injection. Returns named els object.
export function bindEls() {
  const root = document.getElementById('signal-embed-overlay');
  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => root.querySelectorAll(sel);
  return {
    root,

    // Header
    title:        q('.title'),
    closeBtn:     q('.close'),

    // Left panel (profile only)
    profilePanel:    q('.profile'),
    profileSkeleton: q('.profile-skeleton'),
    profileContent:  q('.profile-content'),
    agentName:       q('.agent-name'),
    agentSub:        q('.agent-sub'),
    avatarImg:       q('.avatar-wrap img'),
    credsIntro:      q('.creds-intro'),
    credsList:       q('.creds-list'),
    updated:         q('.updated'),
    contact:         q('.contact'),

    // Mobile profile header (top of chat on mobile)
    mobileProfileHeader: q('.mobile-profile-header'),
    mobileAgentName:     q('.mobile-agent-name'),
    mobileAgentSub:      q('.mobile-agent-sub'),
    mobileAvatarImg:     q('.mobile-avatar-wrap img'),

    // Chat panel
    personaWrap:   q('.persona-wrap'),
    personaPrompt: q('.persona-prompt'),
    personaBtns:   q('.persona-btns'),
    messages:      q('.messages'),
    form:          q('.input-wrap'),
    input:         q('.input-wrap textarea'),
    sendBtn:       q('.input-wrap button[type="submit"]'),
  };
}

// initRing removed — score panel moved to chat delivery

function template(baseUrl) {
  return `
<div id="signal-embed-overlay" hidden>

  <div class="header">
    <span class="title">Signal Interview</span>
    <button class="close" aria-label="Close"><span></span><span></span></button>
  </div>

  <div class="body">
    <div class="widget">

      <!-- Left panel (profile) -->
      <div class="panel left">

        <div class="phase-wrap">
          <div class="profile">
            <!-- Skeleton shown while loading -->
            <div class="profile-skeleton">
              <div class="skel skel-name"></div>
              <div class="skel skel-sub"></div>
              <div class="skel skel-avatar"></div>
              <div class="skel skel-line" style="width:80%"></div>
              <div class="skel skel-line" style="width:65%"></div>
              <div class="skel skel-line" style="width:72%"></div>
              <div class="skel skel-line" style="width:55%"></div>
            </div>
            <!-- Real content, hidden until loaded -->
            <div class="profile-content" hidden>
              <div class="agent-name"></div>
              <div class="agent-sub"></div>
              <div class="avatar-wrap">
                <img src="${baseUrl}/assets/images/signal-agent_clean.png" alt="" style="visibility:hidden" />
              </div>
              <div class="creds-block">
                <h3>What's this?</h3>
              </div>
              <p class="creds-intro"></p>
              <ul class="creds-list"></ul>
              <p class="updated"></p>
              <div class="contact"></div>
            </div>
          </div>
        </div><!-- /.phase-wrap -->

        <div class="left-footer">
          <a href="https://signal.habitualos.com" target="_blank" rel="noopener">
            <img src="${baseUrl}/assets/favicon-32x32.png" alt="" />
            <strong>Signal.</strong> Get your own →
          </a>
        </div>

      </div><!-- /.panel.left -->

      <!-- Chat panel -->
      <div class="panel chat">

        <!-- Mobile profile header (visible on small screens only) -->
        <div class="mobile-profile-header">
          <div class="mobile-avatar-wrap">
            <img src="${baseUrl}/assets/images/signal-agent_clean.png" alt="" style="visibility:hidden" />
          </div>
          <div class="mobile-profile-info">
            <div class="mobile-agent-name"></div>
            <div class="mobile-agent-sub"></div>
          </div>
        </div>

        <div class="persona-wrap" hidden>
          <p class="persona-prompt"></p>
          <div class="persona-btns"></div>
        </div>
        <div class="messages" aria-live="polite" aria-label="Conversation"></div>
        <form class="input-wrap" aria-label="Send a message">
          <textarea
            placeholder="Tell me about your AI work…"
            rows="3"
            aria-label="Your message"
            disabled
          ></textarea>
          <button type="submit" aria-label="Send" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </form>
      </div><!-- /.panel.chat -->

    </div><!-- /.widget -->
  </div><!-- /.body -->

</div><!-- /#signal-embed-overlay -->
`.trim();
}
