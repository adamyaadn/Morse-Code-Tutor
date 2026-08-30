// progress.js — all learner state lives in localStorage. No backend, no DB.
// Wrapped in an IIFE so internal function names don't leak as globals
// (which previously collided with app.js's destructured const names).

window.ProgressLib = (function () {
  const PROGRESS_KEY = 'sounder_progress_v1';
  const SETTINGS_KEY = 'sounder_settings_v1';

  const ALL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

  function defaultProgress() {
    const chars = {};
    ALL_CHARS.forEach(c => {
      chars[c] = { introduced: false, attempts: 0, correct: 0 };
    });
    return {
      chars,
      mode: 'learn',
      lastActive: new Date().toISOString(),
      recentHistory: []
    };
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return defaultProgress();
      const parsed = JSON.parse(raw);
      return { ...defaultProgress(), ...parsed, chars: { ...defaultProgress().chars, ...parsed.chars } };
    } catch (e) {
      console.warn('Progress load failed, resetting.', e);
      return defaultProgress();
    }
  }

  function saveProgress(progress) {
    progress.lastActive = new Date().toISOString();
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }

  function applyProgressPatch(progress, patch) {
    if (!patch) return progress;
    if (patch.mode) progress.mode = patch.mode;
    if (patch.chars) {
      Object.entries(patch.chars).forEach(([ch, delta]) => {
        if (!progress.chars[ch]) return;
        progress.chars[ch] = { ...progress.chars[ch], ...delta };
      });
    }
    return progress;
  }

  function pushHistory(progress, role, text) {
    progress.recentHistory.push({ role, text });
    if (progress.recentHistory.length > 6) {
      progress.recentHistory = progress.recentHistory.slice(-6);
    }
  }

  function resetProgress() {
    localStorage.removeItem(PROGRESS_KEY);
    return defaultProgress();
  }

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  return {
    loadProgress, saveProgress, applyProgressPatch, pushHistory,
    resetProgress, loadSettings, saveSettings
  };
})();
