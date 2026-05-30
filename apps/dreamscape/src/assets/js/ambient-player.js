import { ensureAudioUnlocked } from './audio-unlock.js';
import { log } from './utils/log.js';

// Shared DOM wiring for ambient-mute-btn + ambient-volume slider.
// Calls ensureAudioUnlocked() when the user turns sound on — either by
// clicking the mute icon in the off state or by dragging the slider from 0.
// Pages provide callbacks for the actual audio operations.
//
// Usage:
//   initAmbientPlayer({ isMuted, getVolume, onVolumeChange, onMuteChange })
//
// Callbacks:
//   isMuted()             → bool — current muted state
//   getVolume()           → number — current volume (0–1)
//   onVolumeChange(vol)   → void — slider moved; update audio + LS
//   onMuteChange(muted)   → void — mute toggled; update audio + pref + volume

export function initAmbientPlayer({ isMuted, getVolume, onVolumeChange, onMuteChange }) {
  const muteBtn     = document.getElementById('ambient-mute-btn');
  const slider      = document.getElementById('ambient-volume');
  const iconOn      = document.getElementById('icon-sound-on');
  const iconOff     = document.getElementById('icon-sound-off');

  function syncUI() {
    const muted = isMuted();
    if (iconOn)  iconOn.style.display  = muted ? 'none' : '';
    if (iconOff) iconOff.style.display = muted ? '' : 'none';
    if (slider)  slider.value = muted ? 0 : getVolume();
    log('debug', '[ambient-player] syncUI muted=', muted, 'vol=', getVolume());
  }

  syncUI();

  if (slider) {
    slider.addEventListener('input', () => {
      const vol = parseFloat(slider.value);
      if (vol > 0) ensureAudioUnlocked(); // gesture captured synchronously; no need to await
      if (vol > 0 && isMuted()) onMuteChange(false);
      onVolumeChange(vol);
      syncUI();
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const wasMuted = isMuted();
      if (wasMuted) ensureAudioUnlocked(); // gesture captured synchronously; no need to await
      onMuteChange(!wasMuted);
      syncUI();
    });
  }

  return { syncUI };
}
