import { isSignedIn, getUserId } from '../auth/auth.js';
import { initChimeAudio, playChime, generateChime, swingChime } from '../chime.js';
import { fetchProfile, saveProfile } from '../collections/users.js';
import { log } from '../utils/log.js';

if (!isSignedIn() || !getUserId()?.startsWith('u-')) {
  window.location.replace('/signin/');
}

const headerChimeWrap = document.getElementById('header-chime-wrap');
const headerEmail     = document.getElementById('header-email');
const nameInput       = document.getElementById('settings-name');
const nameError       = document.getElementById('name-error');
const saveBtn         = document.getElementById('save-btn');
const savedIndicator  = document.getElementById('settings-saved');
const changeChimeBtn  = document.getElementById('change-chime-btn');

let _pendingChime  = null;
let _originalName  = '';
let _originalChime = null;

// ─── State
function currentName()  { return nameInput.value.trim(); }
function nameChanged()  { return currentName() !== _originalName; }
function chimeChanged() { return JSON.stringify(_pendingChime) !== JSON.stringify(_originalChime); }
function isDirty()      { return nameChanged() || chimeChanged(); }

// ─── Save indicator
function markDirty() { saveBtn.hidden = false; savedIndicator.hidden = true; }
function markSaved() { saveBtn.hidden = true;  savedIndicator.hidden = false; }

// ─── Chime
function playPending()  { playChime(_pendingChime); swingChime(headerChimeWrap); }
function changeChime()  { _pendingChime = generateChime(); playPending(); if (isDirty()) markDirty(); }

// ─── Save
async function save() {
  const name = currentName();
  if (!name) { nameInput.focus(); return; }
  nameError.hidden = true;
  saveBtn.disabled = true;
  saveBtn.textContent = 'saving…';
  try {
    await saveProfile({ name, chime: _pendingChime });
    _originalName  = name;
    _originalChime = _pendingChime;
    saveBtn.disabled = false;
    saveBtn.textContent = 'save settings';
    markSaved();
  } catch (err) {
    log('warn', '[settings] save failed:', err.message);
    nameError.textContent = 'something went wrong — try again';
    nameError.hidden = false;
    saveBtn.disabled = false;
    saveBtn.textContent = 'save settings';
  }
}

// ─── Events
headerChimeWrap.addEventListener('click', async () => { await initChimeAudio(); playPending(); });
changeChimeBtn.addEventListener('click', changeChime);
nameInput.addEventListener('input', () => { if (isDirty()) markDirty(); else saveBtn.hidden = true; });
saveBtn.addEventListener('click', save);
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });

// ─── Init
(async () => {
  try {
    const profile = await fetchProfile();
    nameInput.value = profile.name || '';
    if (headerEmail) headerEmail.textContent = profile.email ? `for ${profile.email}` : '';
    _pendingChime = profile.chime || generateChime();
  } catch (err) {
    log('warn', '[settings] profile load failed:', err.message);
    _pendingChime = generateChime();
  }

  _originalName  = nameInput.value;
  _originalChime = _pendingChime;

document.querySelectorAll('.auth-step').forEach(el => { el.hidden = true; });
  document.getElementById('step-settings').hidden = false;

  initChimeAudio().then(playPending);
})();
