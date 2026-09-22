import { spokenName } from "./notes.js";
import { loadBank } from "./sampleBank.js";
import { Instrument } from "./voice.js";
import { MidiInput, ComputerKeyboardInput } from "./input.js";
import { SimonMode } from "./simonMode.js";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const deviceEl = $("devices");
const nowEl = $("now-playing");
const startButton = $("start");
const playArea = $("play-area");
const simonPanel = $("simon-panel");
const simonStatusEl = $("simon-status");
const simonBestEl = $("simon-best");

// Everything the player can change. `transposition` has no UI yet; it is here
// so transposing instruments can be added later without restructuring.
const settings = { useFlats: false, transposition: 0, announceNotes: false, mode: "instrument" };

let instrument = null;
let simon = null;
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

    const pool = [];
    for (let m = bank.minMidi; m <= bank.maxMidi; m++) pool.push(m);
    simon = new SimonMode({
      pool,
      soundOn,
      soundOff,
      announce: announceSimon,
      onUpdate: ({ best }) => {
        simonBestEl.textContent = String(best);
      },
    });

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
  announce("Black keys will be sung as sharps.");
});
$("spelling-flats").addEventListener("change", () => {
  settings.useFlats = true;
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

keyboard.start();
midi.start().then((result) => {
  midiState = result.ok ? "ok" : result.reason;
  updateDeviceLine();
  if (!result.ok) announce(deviceEl.textContent);
});
updateDeviceLine();
