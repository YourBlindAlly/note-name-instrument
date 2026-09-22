import test from "node:test";
import assert from "node:assert/strict";
import { sampleKey, spokenName, pitchClassName, keyToMidi, resolvePlayback, midiToHz, isBlackKey } from "../js/notes.js";

const range = { minMidi: 42, maxMidi: 60 }; // F sharp 2 to C4

test("MIDI numbers map to sample names", () => {
  assert.equal(sampleKey(60, false), "C4");
  assert.equal(sampleKey(43, false), "G2");
  assert.equal(sampleKey(42, false), "Fsharp2");
  assert.equal(sampleKey(42, true), "Gflat2");
  assert.equal(sampleKey(46, true), "Bflat2");
});

test("keyToMidi inverts sampleKey for every note in the pack", () => {
  for (let midi = 42; midi <= 60; midi++) {
    assert.equal(keyToMidi(sampleKey(midi, false)), midi);
    assert.equal(keyToMidi(sampleKey(midi, true)), midi);
  }
});

test("spoken names", () => {
  assert.equal(spokenName(66, false), "F sharp 4");
  assert.equal(spokenName(63, true), "E flat 4");
  assert.equal(spokenName(60, false), "C 4");
});

test("pitch class names have no octave", () => {
  assert.equal(pitchClassName(0, false), "C");
  assert.equal(pitchClassName(6, false), "F sharp");
  assert.equal(pitchClassName(6, true), "G flat");
  assert.equal(pitchClassName(11, false), "B");
});

test("black keys", () => {
  const blackInOctave = [61, 63, 66, 68, 70].every(isBlackKey);
  assert.ok(blackInOctave);
  assert.ok(![60, 62, 64, 65, 67, 69, 71].some(isBlackKey));
});

test("A4 is 440 Hz and middle C is about 261.63 Hz", () => {
  assert.equal(midiToHz(69), 440);
  assert.ok(Math.abs(midiToHz(60) - 261.63) < 0.01);
});

test("in-range notes use their own sample", () => {
  assert.deepEqual(resolvePlayback(50, range, { useFlats: false }), { kind: "sample", key: "D3" });
  assert.deepEqual(resolvePlayback(42, range), { kind: "sample", key: "Fsharp2" });
  assert.deepEqual(resolvePlayback(60, range), { kind: "sample", key: "C4" });
});

test("any note outside the range beeps at the true pitch", () => {
  const high = resolvePlayback(61, range);
  assert.equal(high.kind, "beep");
  assert.ok(Math.abs(high.hz - midiToHz(61)) < 1e-9);
  assert.equal(resolvePlayback(41, range).kind, "beep");
  assert.equal(resolvePlayback(20, range).kind, "beep");
});
