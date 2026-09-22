import { spokenName, pitchClassName } from "./notes.js";
import { loadBank } from "./sampleBank.js";
import { Instrument } from "./voice.js";
import { MidiInput, ComputerKeyboardInput } from "./input.js";
import { SimonMode } from "./simonMode.js";
import { buildPool } from "./simon.js";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const deviceEl = $("devices");
const nowEl = $("now-playing");
const startButton = $("start");
const playArea = $("play-area");
const simonPanel = $("simon-panel");
const simonStatusEl = $("simon-status");
const simonBestEl = $("simon-best");
const poolChromaticRadio = $("pool-chromatic");
const poolBlackKeysRadio = $("pool-black-keys");
const poolKeyRadio = $("pool-key");
const keyTonicSelect = $("simon-key-tonic");

// Everything the player can change. `transposition` has no UI yet; it is here
// so transposing instruments can be added later without restructuring.
const settings = { useFlats: false, transposition: 0, announceNotes: false, mode: "instrument" };

let instrument = null;
let simon = null;
let noteRange = null; // { minMidi, maxMidi }, set once the sample bank loads
let midiDevices = [];
let midiState = "pending"; // pending | ok | unsupported | denied

// Screen reader friendly status. Clearing first makes an identical message
// announce again.
function announce(message) {
  statusEl.textContent = "";
  setTimeout(() => {
    statusEl.textContent = message;
  }, 40);
}

// Simon Plays gets its own live region so game narration (listen, your turn,
// correct, try again) doesn't interleave with device/status messages.
function announceSimon(message) {
  simonStatusEl.textContent = "";
  setTimeout(() => {
    simonStatusEl.textContent = message;
  }, 40);
}

function updateDeviceLine() {
  if (midiState === "ok" && midiDevices.length > 0) {
    deviceEl.textContent = `MIDI input: ${midiDevices.join(", ")}. The computer keyboard also works.`;
  } else if (midiState === "ok") {
    deviceEl.textContent = "No MIDI device found. Using computer keyboard. Plug in a MIDI keyboard any time and it will be picked up.";
  } else if (midiState === "denied") {
    deviceEl.textContent = "MIDI access was denied. Using computer keyboard.";
  } else if (midiState === "unsupported") {
    deviceEl.textContent = "This browser does not support MIDI. Using computer keyboard.";
  } else {
    deviceEl.textContent = "Looking for MIDI devices.";
  }
}

const midi = new MidiInput({
  onNoteOn: (note) => noteOn(note),
  onNoteOff: (note) => noteOff(note),
  onDevicesChanged: (names) => {
    const changed = midiDevices.join("|") !== names.join("|");
    midiDevices = names;
    updateDeviceLine();
    if (changed) {
      announce(names.length ? `MIDI input: ${names.join(", ")}.` : "No MIDI device connected. Using computer keyboard.");
    }
  },
});

const keyboard = new ComputerKeyboardInput({
  onNoteOn: (note) => noteOn(note),
  onNoteOff: (note) => noteOff(note),
  onOctaveChanged: (octave) => announce(`Computer keyboard octave ${octave}. The A key plays C ${octave}.`),
});

// Shared by free play and Simon Plays: actually sound a note and show it.
function soundOn(note) {
  instrument.noteOn(note, settings.useFlats);
  nowEl.textContent = spokenName(note, settings.useFlats);
}
function soundOff(note) {
  instrument.noteOff(note);
}

function noteOn(rawNote) {
  if (!instrument) {
    announce("Press the Start button first, then play.");
    return;
  }
  const note = rawNote + settings.transposition;
  if (settings.mode === "simon") {
    simon.handleInput(note);
  } else {
    soundOn(note);
  }
}

// The key tonic dropdown's labels follow the same sharps-or-flats setting
// as everything else sung -- there's no separate per-key spelling
// convention here (see docs/DECISIONS.md on why the app doesn't try to
// infer spelling from context).
function populateKeyTonicOptions() {
  const previous = keyTonicSelect.value;
  keyTonicSelect.textContent = "";
  for (let pc = 0; pc < 12; pc++) {
    const option = document.createElement("option");
    option.value = String(pc);
    option.textContent = pitchClassName(pc, settings.useFlats);
    keyTonicSelect.appendChild(option);
  }
  keyTonicSelect.value = previous || "0";
}

// Reads the Note pool controls and applies the choice to the running Simon
// Plays game, if one exists yet. Called on every relevant control change,
// and once after Start finishes loading so a selection made before Start
// was pressed still takes effect.
function applyPoolSelection() {
  if (!simon || !noteRange) return;
  let pool, label;
  if (poolBlackKeysRadio.checked) {
    pool = buildPool(noteRange, "blackKeys");
    label = "Black keys only";
  } else if (poolKeyRadio.checked) {
    const tonicPitchClass = Number(keyTonicSelect.value);
    pool = buildPool(noteRange, "key", { tonicPitchClass });
    label = `${pitchClassName(tonicPitchClass, settings.useFlats)} major`;
  } else {
    pool = buildPool(noteRange, "chromatic");
    label = "Chromatic";
  }
  simon.setPool(pool, label);
  simonBestEl.textContent = "0";
  announceSimon(`${label}. Press New game to start.`);
}

function noteOff(rawNote) {
  if (!instrument) return;
  // Always forward the release, regardless of mode: Instrument.noteOff is a
  // no-op unless this note is the one currently sounding, so it's safe even
  // for a key Simon Plays chose not to sound on the way down.
  soundOff(rawNote + settings.transposition);
}

async function start() {
  startButton.disabled = true;
  announce("Loading sung note samples.");
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    await ctx.resume();
    const bank = await loadBank(ctx);
    instrument = new Instrument(ctx, bank);

    noteRange = { minMidi: bank.minMidi, maxMidi: bank.maxMidi };
    simon = new SimonMode({
      pool: buildPool(noteRange, "chromatic"),
      poolLabel: "Chromatic",
      soundOn,
      soundOff,
      announce: announceSimon,
      onUpdate: ({ best }) => {
        simonBestEl.textContent = String(best);
      },
    });
    applyPoolSelection(); // in case a pool choice was made before Start was pressed

    startButton.textContent = "Started";
    announce("Ready. Play a note. Focus is on the playing area.");
    playArea.focus();
  } catch (error) {
    startButton.disabled = false;
    announce(`Could not start: ${error.message}`);
  }
}

startButton.addEventListener("click", start);

$("spelling-sharps").addEventListener("change", () => {
  settings.useFlats = false;
  populateKeyTonicOptions();
  announce("Black keys will be sung as sharps.");
});
$("spelling-flats").addEventListener("change", () => {
  settings.useFlats = true;
  populateKeyTonicOptions();
  announce("Black keys will be sung as flats.");
});
$("announce-notes").addEventListener("change", (event) => {
  settings.announceNotes = event.target.checked;
  nowEl.setAttribute("aria-live", settings.announceNotes ? "polite" : "off");
});

$("mode-instrument").addEventListener("change", () => {
  settings.mode = "instrument";
  simonPanel.hidden = true;
  announce("Free play mode.");
});
$("mode-simon").addEventListener("change", () => {
  settings.mode = "simon";
  simonPanel.hidden = false;
  announce("Simon Plays mode. Press New game to start.");
});

for (const radio of [poolChromaticRadio, poolBlackKeysRadio, poolKeyRadio]) {
  radio.addEventListener("change", () => {
    keyTonicSelect.disabled = !poolKeyRadio.checked;
    applyPoolSelection();
  });
}
keyTonicSelect.addEventListener("change", () => {
  if (poolKeyRadio.checked) applyPoolSelection();
});

$("simon-new-game").addEventListener("click", () => {
  if (!simon) {
    announce("Press the Start button first.");
    return;
  }
  simon.newGame();
});
$("simon-replay").addEventListener("click", () => {
  if (!simon) {
    announce("Press the Start button first.");
    return;
  }
  simon.replay();
});

populateKeyTonicOptions();

keyboard.start();
midi.start().then((result) => {
  midiState = result.ok ? "ok" : result.reason;
  updateDeviceLine();
  if (!result.ok) announce(deviceEl.textContent);
});
updateDeviceLine();
