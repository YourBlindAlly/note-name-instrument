// Pure note math: MIDI numbers, sample file names, spoken names, and the
// decision about how to sound a note that may fall outside the recorded range.
// No browser APIs in here so it can be tested with plain Node.

const SHARP_NAMES = ["C", "Csharp", "D", "Dsharp", "E", "F", "Fsharp", "G", "Gsharp", "A", "Asharp", "B"];
const FLAT_NAMES = ["C", "Dflat", "D", "Eflat", "E", "F", "Gflat", "G", "Aflat", "A", "Bflat", "B"];
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);
const NATURAL_PITCH_CLASS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function pitchClass(midi) {
  return ((midi % 12) + 12) % 12;
}

// Scientific pitch notation: middle C (MIDI 60) is C4.
export function octaveOf(midi) {
  return Math.floor(midi / 12) - 1;
}

export function isBlackKey(midi) {
  return BLACK_PITCH_CLASSES.has(pitchClass(midi));
}

// The sample file name (without extension) for a MIDI note, e.g. "Fsharp2".
export function sampleKey(midi, useFlats) {
  const names = useFlats ? FLAT_NAMES : SHARP_NAMES;
  return names[pitchClass(midi)] + octaveOf(midi);
}

// The name as it should be read or shown, e.g. "F sharp 2".
export function spokenName(midi, useFlats) {
  const names = useFlats ? FLAT_NAMES : SHARP_NAMES;
  const name = names[pitchClass(midi)];
  const accidental = name.slice(1);
  return `${name[0]}${accidental ? " " + accidental : ""} ${octaveOf(midi)}`;
}

// Inverse of sampleKey: "Gflat2" -> 42.
export function keyToMidi(key) {
  const match = /^([A-G])(sharp|flat)?(-?\d+)$/.exec(key);
  if (!match) throw new Error(`Unrecognized sample name: ${key}`);
  const [, letter, accidental, octave] = match;
  const offset = accidental === "sharp" ? 1 : accidental === "flat" ? -1 : 0;
  return 12 * (Number(octave) + 1) + NATURAL_PITCH_CLASS[letter] + offset;
}

export function midiToHz(midi, a4 = 440) {
  return a4 * 2 ** ((midi - 69) / 12);
}

// Decide how to sound `midi` given the recorded range { minMidi, maxMidi }.
//   In range:     play that note's own sample.
//   Out of range: a plain beep at the true pitch. A pitch-shifted nearby
//                 sample was tried as a placeholder here but sings the wrong
//                 note name, which defeats the point of the app, so it was
//                 dropped; the beep at least doesn't lie about the pitch.
export function resolvePlayback(midi, range, { useFlats = false } = {}) {
  const { minMidi, maxMidi } = range;
  if (midi >= minMidi && midi <= maxMidi) {
    return { kind: "sample", key: sampleKey(midi, useFlats) };
  }
  return { kind: "beep", hz: midiToHz(midi) };
}
