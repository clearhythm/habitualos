# Ticket: Synthesis Dashboard — Display `synthesizedContext`

## Dependency

Requires `TICKET-synthesis-system.md` to be implemented first. `synthesizedContext` must exist on the owner doc in Firestore before this ticket can be verified.

## Context

The synthesis system generates a 3-paragraph behavioral narrative (`synthesizedContext`) and stores it on the owner doc. This ticket surfaces it in the owner dashboard — the primary place the owner sees "what does Signal think about me?"

---

## Files to Change

Before making changes, read the following files to understand existing patterns:
- `src/dashboard.njk` — find where profile/stats sections are rendered, where to insert the new section
- `src/assets/js/dashboard.js` — understand how owner data is fetched and rendered into the page
- Whichever Netlify function `dashboard.js` calls to load owner profile data (likely `signal-owner-init.js` or a dedicated profile endpoint — grep for `fetch('/api/` in dashboard.js to find it)

| File | Change |
|------|--------|
| `src/dashboard.njk` | Add "Your Signal Profile" section |
| `src/assets/js/dashboard.js` | Ensure `synthesizedContext` is rendered if loaded dynamically |
| Endpoint that returns owner data to dashboard | Add `synthesizedContext`, `synthesizedContextGeneratedAt`, `contextStats.processedChunks` to returned fields if they're filtered |
| `.eleventy.js` | Add `nl2br` filter if not present |

---

## Implementation

### 1. Check the data path

In `dashboard.js`, find the fetch that loads owner profile data. Check what fields the response includes. If the endpoint explicitly allowlists fields, add:
- `synthesizedContext`
- `synthesizedContextGeneratedAt`
- `contextStats` (or `contextStats.processedChunks`)

If it returns the full owner doc without filtering, no endpoint change is needed.

### 2. Add section to `dashboard.njk`

Find the dimension completeness / context stats section. Insert the new section **after** it, **before** the evaluations list.

If `synthesizedContext` is rendered server-side (available in Nunjucks context at render time):

```html
<section class="profile-synthesis">
  <h2>Your Signal Profile</h2>
  {% if owner.synthesizedContext %}
    <p class="synthesis-meta">
      Synthesized from {{ owner.contextStats.processedChunks or 0 }} work sessions
      {% if owner.synthesizedContextGeneratedAt %}
        &middot; Last updated {{ owner.synthesizedContextGeneratedAt | date('MMM D, YYYY') }}
      {% endif %}
    </p>
    <div class="synthesis-narrative">
      {{ owner.synthesizedContext | nl2br | safe }}
    </div>
  {% else %}
    <p class="synthesis-empty">Your profile summary will appear here after running synthesis.</p>
  {% endif %}
</section>
```

If `synthesizedContext` is loaded dynamically via JS after page load, add a placeholder element to the template and populate it in `dashboard.js` (see step 3).

```html
<!-- Placeholder for dynamic loading -->
<section class="profile-synthesis" id="synthesis-section" style="display:none">
  <h2>Your Signal Profile</h2>
  <p class="synthesis-meta" id="synthesis-meta"></p>
  <div class="synthesis-narrative" id="synthesis-narrative"></div>
</section>
<section class="profile-synthesis-empty" id="synthesis-empty" style="display:none">
  <h2>Your Signal Profile</h2>
  <p class="synthesis-empty">Your profile summary will appear here after running synthesis.</p>
</section>
```

### 3. `dashboard.js` — render synthesizedContext

If the owner data is loaded via JS fetch (check the existing pattern for how skillsProfile or wantsProfile data gets rendered), add handling for synthesizedContext. Follow the same pattern exactly — don't invent new patterns.

Example (adapt to match whatever pattern already exists):
```js
if (ownerData.synthesizedContext) {
  const section = document.getElementById('synthesis-section');
  const meta = document.getElementById('synthesis-meta');
  const narrative = document.getElementById('synthesis-narrative');

  const sessionCount = ownerData.contextStats?.processedChunks || 0;
  let metaText = `Synthesized from ${sessionCount} work sessions`;
  if (ownerData.synthesizedContextGeneratedAt) {
    const date = new Date(ownerData.synthesizedContextGeneratedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    metaText += ` · Last updated ${date}`;
  }
  meta.textContent = metaText;

  // Convert double newlines to paragraph breaks
  const paragraphs = ownerData.synthesizedContext.split(/\n\n+/).filter(Boolean);
  narrative.innerHTML = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

  section.style.display = '';
  document.getElementById('synthesis-empty').style.display = 'none';
} else {
  document.getElementById('synthesis-empty').style.display = '';
}
```

### 4. `.eleventy.js` — `nl2br` filter (if server-side rendering)

Only needed if using the Nunjucks `| nl2br` filter in the template. Check if it already exists in `.eleventy.js`. If not, add:

```js
eleventyConfig.addFilter('nl2br', function(str) {
  if (!str) return '';
  return str.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
});
```

If using the JS approach in step 3 instead, skip this.

### 5. Visual style

Match the existing dashboard card/section style. No new colors, no special treatments. The text should read as clean prose. Do not add border-radius, box-shadows, or other decoration that doesn't match what's already on the page. Check adjacent sections (the completeness stats block, the evaluations list) and use the same spacing and heading style.

---

## Verification

1. Ensure `signal-context-synthesize` has been run and `synthesizedContext` exists on the owner doc in Firestore
2. Load the dashboard — verify "Your Signal Profile" section appears with three paragraphs of readable prose
3. Verify "Synthesized from N work sessions" count matches `contextStats.processedChunks` in Firestore
4. Verify "Last updated" date appears and is correct
5. Test with an owner doc that has no `synthesizedContext` — verify placeholder text shows instead, no JS errors, no broken layout
6. Verify section placement: appears after completeness/stats block, before evaluations
