// morse.js — encode/decode table + audio + lamp playback
// Wrapped in an IIFE so internal function names (like playMorse) don't leak
// as globals and collide with app.js's destructured const names.

window.MorseLib = (function () {
  const MORSE_MAP = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
    H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
    O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
    V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
    5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.',
    '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
    '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
    '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.',
    '$': '...-..-', '@': '.--.-.'
  };

  const MORSE_MAP_REVERSE = Object.fromEntries(
    Object.entries(MORSE_MAP).map(([k, v]) => [v, k])
  );

  function textToMorse(text) {
    return text
      .toUpperCase()
      .split('')
      .map(ch => (ch === ' ' ? '/' : (MORSE_MAP[ch] || '')))
      .filter(Boolean)
      .join(' ');
  }

  function morseToText(morse) {
    return morse
      .trim()
      .split(' ')
      .map(code => (code === '/' ? ' ' : (MORSE_MAP_REVERSE[code] || '')))
      .join('');
  }

  const UNIT_MS = 90;
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function beep(durationMs) {
    return new Promise(resolve => {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 600;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        resolve();
      }, durationMs);
    });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function playMorse(morseString, { onLampOn, onLampOff } = {}) {
    const symbols = morseString.trim().split('');
    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      if (sym === '.') {
        onLampOn && onLampOn();
        await beep(UNIT_MS);
        onLampOff && onLampOff();
        await sleep(UNIT_MS);
      } else if (sym === '-') {
        onLampOn && onLampOn();
        await beep(UNIT_MS * 3);
        onLampOff && onLampOff();
        await sleep(UNIT_MS);
      } else if (sym === ' ') {
        await sleep(UNIT_MS * 2);
      } else if (sym === '/') {
        await sleep(UNIT_MS * 6);
      }
    }
  }

  return { textToMorse, morseToText, playMorse, MORSE_MAP };
})();
