// app.js — wires up the chat UI to the Cloudflare Worker and local progress state.

const { loadProgress, saveProgress, applyProgressPatch, pushHistory, resetProgress, loadSettings, saveSettings } = window.ProgressLib;
const { playMorse } = window.MorseLib;

let progress = loadProgress();
let settings = loadSettings();
let sending = false;

const ticker = document.getElementById('ticker');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const lamp = document.getElementById('lamp');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const workerUrlInput = document.getElementById('workerUrl');
const saveSettingsBtn = document.getElementById('saveSettings');
const resetProgressBtn = document.getElementById('resetProgress');

workerUrlInput.value = settings.workerUrl || '';

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

// ---- Settings panel ----
settingsBtn.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
});

saveSettingsBtn.addEventListener('click', () => {
  settings.workerUrl = workerUrlInput.value.trim();
  saveSettings(settings);
  settingsPanel.hidden = true;
  addStatus('Worker URL saved.');
});

resetProgressBtn.addEventListener('click', () => {
  if (confirm('Reset all learning progress stored in this browser?')) {
    progress = resetProgress();
    addStatus('Progress reset. Starting fresh.');
  }
});

// ---- Sending messages ----
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || sending) return;

  if (!settings.workerUrl) {
    addStatus('Set your Cloudflare Worker URL first (⚙ top right).');
    settingsPanel.hidden = false;
    return;
  }

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
