
"use strict";

/* ===== CODEPAD ELEMENTS ===== */

const $ = (id) => document.getElementById(id);

const editor = $("editor");
const app = $("app");
const fileInput = $("fileInput");
const settingsBtn = $("settingsBtn");
const settingsPanel = $("settingsPanel");

const soundToggle = $("soundToggle");
const soundProfile = $("soundProfile");
const soundVolume = $("soundVolume");
const volumeLabel = $("volumeLabel");

const findDialog = $("findDialog");
const gotoDialog = $("gotoDialog");
const fontDialog = $("fontDialog");

/* ===== SAVE SETTINGS ===== */

const STORAGE_KEY = "codepad-classic-v1";

const defaults = {
  text: "",
  fileName: "Untitled",
  savedText: "",
  wrap: true,
  statusVisible: true,
  dark: false,
  fontFamily: "Consolas, monospace",
  fontSize: 15,
  zoom: 100,
  soundEnabled: false,
  soundProfile: "creamy",
  soundVolume: 30
};

let state;

try {
  state = {
    ...defaults,
    ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
  };
} catch {
  state = { ...defaults };
}

let currentFileHandle = null;

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Auto-recovery unavailable:", error);
  }
}

/* ===== TITLE AND STATUS BAR ===== */

function updateTitle() {
  const dirty = editor.value !== state.savedText;
  const title = `${dirty ? "*" : ""}${state.fileName} - CodePad`;

  $("windowTitle").textContent = title;
  document.title = title;
}

function updateStatus() {
  const before = editor.value.slice(0, editor.selectionStart);
  const lines = before.split("\n");

  $("position").textContent =
    `Ln ${lines.length}, Col ${lines.at(-1).length + 1}`;

  $("characters").textContent =
    `${editor.value.length} characters`;

  $("zoomLabel").textContent = `${state.zoom}%`;
}

/* ===== APPLY SETTINGS ===== */

function applySettings() {
  app.classList.toggle("dark", state.dark);

  $("darkToggle").checked = state.dark;
  $("statusToggle").checked = state.statusVisible;

  editor.style.fontFamily = state.fontFamily;
  editor.style.fontSize =
    `${state.fontSize * state.zoom / 100}px`;

  editor.style.whiteSpace = state.wrap ? "pre-wrap" : "pre";
  editor.style.overflowWrap =
    state.wrap ? "break-word" : "normal";

  $("statusBar").hidden = !state.statusVisible;
  $("statusBar").style.display =
    state.statusVisible ? "flex" : "none";

  $("wrapMenu").textContent =
    `${state.wrap ? "✓ " : ""}Word Wrap`;

  soundToggle.checked = state.soundEnabled;
  soundProfile.value = state.soundProfile;
  soundVolume.value = state.soundVolume;

  soundProfile.disabled = !state.soundEnabled;
  soundVolume.disabled = !state.soundEnabled;

  volumeLabel.textContent = `${state.soundVolume}%`;

  $("fontFamily").value = state.fontFamily;
  $("fontSize").value = state.fontSize;

  updateTitle();
  updateStatus();
}

editor.value = state.text;
applySettings();

editor.addEventListener("input", () => {
  state.text = editor.value;
  updateTitle();
  updateStatus();
  persist();
});

["click", "keyup", "select"].forEach((name) => {
  editor.addEventListener(name, updateStatus);
});

/* ===== FILE OPERATIONS ===== */

function setText(text, fileName) {
  editor.value = text;
  state.text = text;
  state.fileName = fileName;
  state.savedText = text;

  updateTitle();
  updateStatus();
  persist();
  editor.focus();
}

function confirmDiscard() {
  if (editor.value === state.savedText) return true;

  return confirm(
    "You have unsaved changes. Continue without saving them?"
  );
}

function newFile() {
  if (!confirmDiscard()) return;

  currentFileHandle = null;
  setText("", "Untitled");
}

function openFile() {
  if (!confirmDiscard()) return;

  fileInput.value = "";
  fileInput.click();
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    currentFileHandle = null;
    setText(text, file.name);
  } catch (error) {
    alert(`Could not open file: ${error.message}`);
  }
});

function downloadFile(name) {
  const blob = new Blob([editor.value], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = name;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  state.fileName = name;
  state.savedText = editor.value;
  updateTitle();
  persist();
}

async function saveFile(saveAs = false) {
  if (!saveAs && currentFileHandle) {
    try {
      const writable = await currentFileHandle.createWritable();
      await writable.write(editor.value);
      await writable.close();

      state.savedText = editor.value;
      updateTitle();
      persist();
      return;
    } catch (error) {
      alert(`Could not save file: ${error.message}`);
      return;
    }
  }

  if ("showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: state.fileName === "Untitled"
          ? "Untitled.txt"
          : state.fileName
      });

      const writable = await handle.createWritable();
      await writable.write(editor.value);
      await writable.close();

      currentFileHandle = handle;
      state.fileName = handle.name;
      state.savedText = editor.value;

      updateTitle();
      persist();
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
      console.warn("Native save unavailable:", error);
    }
  }

  let name = state.fileName === "Untitled"
    ? "Untitled.txt"
    : state.fileName;

  if (saveAs) {
    const chosen = prompt("Save file as:", name);
    if (chosen === null) return;

    name = chosen.trim();
    if (!name) return;
  }

  downloadFile(name);
}

/* ===== TEXT EDITING ===== */

function insertText(text) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;

  editor.focus();
  editor.setRangeText(text, start, end, "end");
  editor.dispatchEvent(
    new Event("input", { bubbles: true })
  );
}

function selectedText() {
  return editor.value.slice(
    editor.selectionStart,
    editor.selectionEnd
  );
}

async function clipboardAction(action) {
  if (action === "copy" || action === "cut") {
    const text = selectedText();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      if (action === "cut") insertText("");
    } catch {
      alert("Clipboard blocked. Use the keyboard shortcut.");
    }
  }

  if (action === "paste") {
    try {
      const text = await navigator.clipboard.readText();
      insertText(text);
    } catch {
      alert("Clipboard blocked. Use Ctrl/Cmd+V.");
    }
  }
}

/* ===== FIND AND REPLACE ===== */

function findNext() {
  const query = $("findInput").value;
  if (!query) return false;

  const matchCase = $("matchCase").checked;
  const source = matchCase
    ? editor.value
    : editor.value.toLowerCase();

  const target = matchCase
    ? query
    : query.toLowerCase();

  let index = source.indexOf(target, editor.selectionEnd);

  if (index === -1) {
    index = source.indexOf(target);
  }

  if (index === -1) {
    $("findMessage").textContent = "Cannot find the text.";
    return false;
  }

  editor.focus();
  editor.setSelectionRange(index, index + query.length);

  $("findMessage").textContent = "";
  updateStatus();
  return true;
}

function replaceCurrent() {
  const query = $("findInput").value;
  if (!query) return;

  const selected = selectedText();

  const matches = $("matchCase").checked
    ? selected === query
    : selected.toLowerCase() === query.toLowerCase();

  if (!matches) {
    findNext();
    return;
  }

  insertText($("replaceInput").value);
  findNext();
}

function replaceAll() {
  const query = $("findInput").value;
  if (!query) return;

  const flags = $("matchCase").checked ? "g" : "gi";
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, flags);

  let count = 0;

  const updated = editor.value.replace(regex, () => {
    count++;
    return $("replaceInput").value;
  });

  if (count) {
    editor.value = updated;
    editor.dispatchEvent(
      new Event("input", { bubbles: true })
    );
  }

  $("findMessage").textContent =
    `${count} occurrence(s) replaced.`;
}

function showFind(replace = false) {
  findDialog.showModal();

  $("replaceInput").hidden = !replace;
  $("replaceBtn").hidden = !replace;
  $("replaceAllBtn").hidden = !replace;

  document.querySelector(
    'label[for="replaceInput"]'
  ).hidden = !replace;

  $("findInput").focus();
  $("findInput").select();
}

/* ===== GO TO LINE ===== */

function goToLine() {
  const line = Number($("gotoInput").value);
  const lines = editor.value.split("\n");

  if (
    !Number.isInteger(line) ||
    line < 1 ||
    line > lines.length
  ) {
    alert(`Enter a line between 1 and ${lines.length}.`);
    return;
  }

  let position = 0;

  for (let i = 0; i < line - 1; i++) {
    position += lines[i].length + 1;
  }

  gotoDialog.close();
  editor.focus();
  editor.setSelectionRange(position, position);
  updateStatus();
}

/* ===== APPEARANCE ===== */

function changeZoom(amount) {
  state.zoom = Math.min(
    250,
    Math.max(50, state.zoom + amount)
  );

  applySettings();
  persist();
}

/* ===== MAIN MENU ACTIONS ===== */

function runAction(action) {
  closeMenus();

  switch (action) {
    case "new":
      newFile();
      break;

    case "open":
      openFile();
      break;

    case "save":
      saveFile();
      break;

    case "saveas":
      saveFile(true);
      break;

    case "print":
      printDocument();
      break;

    case "undo":
    case "redo":
      editor.focus();
      document.execCommand(action);
      break;

    case "cut":
    case "copy":
    case "paste":
      clipboardAction(action);
      break;

    case "delete":
      insertText("");
      break;

    case "selectall":
      editor.focus();
      editor.select();
      updateStatus();
      break;

    case "datetime":
      insertText(new Date().toLocaleString());
      break;

    case "find":
      showFind(false);
      break;

    case "replace":
      showFind(true);
      break;

    case "goto":
      gotoDialog.showModal();
      $("gotoInput").focus();
      break;

    case "wrap":
      state.wrap = !state.wrap;
      applySettings();
      persist();
      break;

    case "font":
      fontDialog.showModal();
      break;

    case "zoomin":
      changeZoom(10);
      break;

    case "zoomout":
      changeZoom(-10);
      break;

    case "zoomreset":
      state.zoom = 100;
      applySettings();
      persist();
      break;

    case "about":
      alert(
        "CodePad Classic\n\n" +
        "A Windows Notepad-inspired text editor.\n" +
        "8 customizable typing sound profiles.\n" +
        "Version 1.0"
      );
      break;
  }
}

/* ===== PRINT DOCUMENT ===== */

function printDocument() {
  const printable = document.createElement("pre");

  printable.id = "printContent";
  printable.textContent = editor.value;

  document.body.appendChild(printable);

  window.addEventListener("afterprint", () => {
    printable.remove();
  }, { once: true });

  window.print();
}

/* ===== DROPDOWN MENUS ===== */

const menus = [...document.querySelectorAll(".menu")];

function closeMenus() {
  menus.forEach((menu) => {
    menu.classList.remove("open");
    menu.querySelector(".menu-trigger")
      .setAttribute("aria-expanded", "false");
  });
}

menus.forEach((menu) => {
  const trigger = menu.querySelector(".menu-trigger");

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();

    const wasOpen = menu.classList.contains("open");
    closeMenus();

    if (!wasOpen) {
      menu.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
      setSettingsOpen(false);
    }
  });

  menu.addEventListener("mouseenter", () => {
    if (menus.some((m) => m.classList.contains("open"))) {
      closeMenus();
      menu.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
    }
  });
});

document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");

  if (actionButton) {
    runAction(actionButton.dataset.action);
    setSettingsOpen(false);
  } else if (!event.target.closest(".menu")) {
    closeMenus();
  }
});

/* ===== THREE-DOT SETTINGS ===== */

function setSettingsOpen(open) {
  settingsPanel.hidden = !open;
  settingsBtn.setAttribute("aria-expanded", String(open));
}

settingsBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  closeMenus();
  setSettingsOpen(settingsPanel.hidden);
});

$("closeSettings").addEventListener("click", () => {
  setSettingsOpen(false);
});

document.addEventListener("click", (event) => {
  if (
    !settingsPanel.hidden &&
    !settingsPanel.contains(event.target) &&
    !settingsBtn.contains(event.target)
  ) {
    setSettingsOpen(false);
  }
});

$("statusToggle").addEventListener("change", (event) => {
  state.statusVisible = event.target.checked;
  applySettings();
  persist();
});

$("darkToggle").addEventListener("change", (event) => {
  state.dark = event.target.checked;
  applySettings();
  persist();
});

/* ===== DIALOG BUTTONS ===== */

document.querySelectorAll(".close-dialog").forEach((button) => {
  button.addEventListener("click", () => {
    button.closest("dialog").close();
    editor.focus();
  });
});

$("findForm").addEventListener("submit", (event) => {
  event.preventDefault();
  findNext();
});

$("replaceBtn").addEventListener("click", replaceCurrent);
$("replaceAllBtn").addEventListener("click", replaceAll);
$("gotoBtn").addEventListener("click", goToLine);

$("applyFontBtn").addEventListener("click", () => {
  state.fontFamily = $("fontFamily").value;
  state.fontSize = Math.min(
    48,
    Math.max(8, Number($("fontSize").value) || 15)
  );

  applySettings();
  persist();
  fontDialog.close();
  editor.focus();
});

/* ===== KEYBOARD SHORTCUTS ===== */

document.addEventListener("keydown", (event) => {
  const modifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (event.key === "Escape") {
    closeMenus();
    setSettingsOpen(false);
  }

  if (modifier) {
    const actions = {
      n: "new",
      o: "open",
      s: "save",
      p: "print",
      f: "find",
      h: "replace",
      g: "goto"
    };

    if (actions[key]) {
      event.preventDefault();
      runAction(actions[key]);
      return;
    }

    if (key === "+" || key === "=") {
      event.preventDefault();
      changeZoom(10);
    } else if (key === "-") {
      event.preventDefault();
      changeZoom(-10);
    }
  }

  if (
    event.key === "F5" &&
    document.activeElement === editor
  ) {
    event.preventDefault();
    insertText(new Date().toLocaleString());
  }
});

/* ===== UNSAVED CHANGES WARNING ===== */

window.addEventListener("beforeunload", (event) => {
  if (editor.value !== state.savedText) {
    event.preventDefault();
    event.returnValue = "";
  }
});

/* ===== EIGHT KEYBOARD SOUND PROFILES ===== */

const profiles = {
  creamy: {
    pitch: 175,
    duration: 0.065,
    wave: "sine",
    level: 0.17,
    noise: 0.20
  },

  thock: {
    pitch: 105,
    duration: 0.105,
    wave: "triangle",
    level: 0.23,
    noise: 0.35
  },

  typewriter: {
    pitch: 440,
    duration: 0.045,
    wave: "square",
    level: 0.075,
    noise: 0.85
  },

  whisper: {
    pitch: 230,
    duration: 0.025,
    wave: "sine",
    level: 0.05,
    noise: 0.15
  },

  crystal: {
    pitch: 1050,
    duration: 0.085,
    wave: "sine",
    level: 0.055,
    noise: 0.10
  },

  retro: {
    pitch: 310,
    duration: 0.060,
    wave: "square",
    level: 0.09,
    noise: 0.50
  },

  wooden: {
    pitch: 135,
    duration: 0.085,
    wave: "triangle",
    level: 0.18,
    noise: 0.40
  },

  cyber: {
    pitch: 720,
    duration: 0.055,
    wave: "sawtooth",
    level: 0.065,
    noise: 0.12
  }
};

let audioContext = null;
let noiseBuffer = null;

function getAudioContext() {
  const AudioClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioClass) return null;

  if (!audioContext) {
    audioContext = new AudioClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

function getNoiseBuffer(ctx) {
  if (noiseBuffer) return noiseBuffer;

  const length = Math.floor(ctx.sampleRate * 0.15);

  noiseBuffer = ctx.createBuffer(
    1,
    length,
    ctx.sampleRate
  );

  const data = noiseBuffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  return noiseBuffer;
}

function playKeySound(key = "") {
  if (!state.soundEnabled || state.soundVolume <= 0) {
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  const profile =
    profiles[state.soundProfile] || profiles.creamy;

  const now = ctx.currentTime;
  const variation = 0.92 + Math.random() * 0.16;

  const duration = profile.duration *
    (key === "Enter" ? 1.4 : 1);

  const master = ctx.createGain();
  master.gain.value = state.soundVolume / 100;
  master.connect(ctx.destination);

  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();

  const pitch = profile.pitch * variation *
    (key === "Backspace" ? 0.8 : 1);

  oscillator.type = profile.wave;
  oscillator.frequency.setValueAtTime(pitch, now);

  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(30, pitch * 0.55),
    now + duration
  );

  envelope.gain.setValueAtTime(
    Math.max(0.0001, profile.level),
    now
  );

  envelope.gain.exponentialRampToValueAtTime(
    0.0001,
    now + duration
  );

  oscillator.connect(envelope);
  envelope.connect(master);

  oscillator.start(now);
  oscillator.stop(now + duration);

  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value =
    state.soundProfile === "thock" ? 650 : 1700;
  filter.Q.value = 0.7;

  const noiseEnvelope = ctx.createGain();
  const noiseDuration = Math.min(duration, 0.035);

  noiseEnvelope.gain.setValueAtTime(
    Math.max(0.0001, profile.level * profile.noise),
    now
  );

  noiseEnvelope.gain.exponentialRampToValueAtTime(
    0.0001,
    now + noiseDuration
  );

  noise.connect(filter);
  filter.connect(noiseEnvelope);
  noiseEnvelope.connect(master);

  noise.start(now);
  noise.stop(now + noiseDuration);

  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };

  noise.onended = () => {
    noise.disconnect();
    filter.disconnect();
    noiseEnvelope.disconnect();
    master.disconnect();
  };
}

/* ===== PLAY SOUND WHEN TYPING ===== */

editor.addEventListener("keydown", (event) => {
  if (
    !state.soundEnabled ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.repeat ||
    event.isComposing
  ) {
    return;
  }

  const validKey =
    event.key.length === 1 ||
    ["Enter", "Backspace", "Delete", "Tab"].includes(
      event.key
    );

  if (validKey) {
    playKeySound(event.key);
  }
});

/* ===== SOUND SETTINGS ===== */

soundToggle.addEventListener("change", (event) => {
  state.soundEnabled = event.target.checked;

  if (state.soundEnabled) {
    getAudioContext();
    playKeySound("Enter");
  }

  applySettings();
  persist();
});

soundProfile.addEventListener("change", () => {
  state.soundProfile = soundProfile.value;
  persist();
  playKeySound("Enter");
});

soundVolume.addEventListener("input", () => {
  state.soundVolume = Number(soundVolume.value);
  volumeLabel.textContent = `${state.soundVolume}%`;
  persist();
});

/* ===== START EDITOR ===== */

editor.focus();
