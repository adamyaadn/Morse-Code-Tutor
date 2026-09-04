// app.js — wires up the chat UI to the Cloudflare Worker and local progress state.

const { loadProgress, saveProgress, applyProgressPatch, pushHistory, resetProgress, loadSettings, saveSettings } = window.ProgressLib;
const { textToMorse, playMorse } = window.MorseLib;

// Baked-in default so anyone visiting the site can chat immediately —
// no setup required. The settings panel is only for you to override this
// (e.g. while testing a different worker) if you ever need to.
const DEFAULT_WORKER_URL = 'https://sounder-morse-tutor.adamyaadali.workers.dev';

let progress = loadProgress();
let settings = loadSettings();
if (!settings.workerUrl) {
  settings.workerUrl = DEFAULT_WORKER_URL;
  saveSettings(settings);
}
let sending = false;

const ticker = document.getElementById('ticker');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const lamp = document.getElementById('lamp');
const resetProgressBtn = document.getElementById('resetProgress');
const scratchpad = document.getElementById('scratchpad');
const flashBtn = document.getElementById('flashBtn');
const playSoundBtn = document.getElementById('playSoundBtn');
const bulbCore = document.getElementById('bulbCore');
const speakerVisual = document.getElementById('speakerVisual');

// ---- UI helpers ----
function addLine({ role, text, morseGroups }) {
  const line = document.createElement('div');
  line.className = `ticker-line ${role}`;

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = role === 'user' ? 'YOU' : 'SOUNDER';
  line.appendChild(tag);

  const msg = document.createElement('div');
  msg.className = 'msg';
  msg.textContent = text;
  line.appendChild(msg);

  if (morseGroups && morseGroups.length) {
    const block = document.createElement('div');
    block.className = 'morse-block';
    morseGroups.forEach(group => {
      const chip = document.createElement('button');
      chip.className = 'morse-chip';
      chip.textContent = `▶ ${group}`;
      chip.addEventListener('click', () => playChip(chip, group));
      block.appendChild(chip);
    });
    line.appendChild(block);
  }

  ticker.appendChild(line);
  ticker.scrollTop = ticker.scrollHeight;
  return line;
}

function addStatus(text) {
  const el = document.createElement('div');
  el.className = 'status-line';
  el.textContent = text;
  ticker.appendChild(el);
  ticker.scrollTop = ticker.scrollHeight;
  return el;
}

async function playChip(chip, group) {
  chip.disabled = true;
  await playMorse(group, {
    onLampOn: () => lamp.classList.add('lit'),
    onLampOff: () => lamp.classList.remove('lit')
  });
  chip.disabled = false;
}

resetProgressBtn.addEventListener('click', () => {
  if (confirm('Start over? This clears your saved letters, progress, and this chat.')) {
    progress = resetProgress();
    ticker.innerHTML = '';
    addLine({
      role: 'system',
      text: `Tap the key below and tell me what you'd like to learn — a letter, a word, or just say "start from scratch."`
    });
  }
});

// ---- Workbench: scratchpad, bulb, speaker ----
// Nothing typed here is ever saved — purely a scratch space to test morse.
flashBtn.addEventListener('click', async () => {
  const text = scratchpad.value.trim();
  if (!text) return;
  flashBtn.disabled = true;
  const morse = textToMorse(text);
  await playMorse(morse, {
    onLampOn: () => bulbCore.classList.add('lit'),
    onLampOff: () => bulbCore.classList.remove('lit'),
    silent: true
  });
  flashBtn.disabled = false;
});

playSoundBtn.addEventListener('click', async () => {
  const text = scratchpad.value.trim();
  if (!text) return;
  playSoundBtn.disabled = true;
  const morse = textToMorse(text);
  await playMorse(morse, {
    onLampOn: () => speakerVisual.classList.add('active'),
    onLampOff: () => speakerVisual.classList.remove('active')
  });
  playSoundBtn.disabled = false;
});

// ---- Sending messages ----
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || sending) return;

  addLine({ role: 'user', text });
  pushHistory(progress, 'user', text);
  userInput.value = '';
  sending = true;
  sendBtn.disabled = true;
  const statusEl = addStatus('sounder is thinking…');

  try {
    const res = await fetch(settings.workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, progress })
    });

    if (!res.ok) throw new Error(`Worker returned ${res.status}`);
    const data = await res.json();

    statusEl.remove();
    addLine({ role: 'bot', text: data.message, morseGroups: data.morse || [] });
    pushHistory(progress, 'assistant', data.message);

    if (data.progressPatch) {
      applyProgressPatch(progress, data.progressPatch);
    }
    saveProgress(progress);

    // Auto-play the first morse group, if any, so the lamp demonstrates rhythm immediately.
    if (data.morse && data.morse.length) {
      const firstChip = ticker.querySelector('.ticker-line.bot:last-child .morse-chip');
      if (firstChip) playChip(firstChip, data.morse[0]);
    }
  } catch (err) {
    statusEl.remove();
    addStatus(`Connection error: ${err.message}. Check your Worker URL and that it's deployed.`);
  } finally {
    sending = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}
