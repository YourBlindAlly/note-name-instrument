import test from "node:test";
import assert from "node:assert/strict";
import { sampleKey, spokenName, keyToMidi, resolvePlayback, midiToHz, isBlackKey } from "../js/notes.js";

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

test("black keys", () => {
  const blackInOctave = [61, 63, 66, 68, 70].every(isBlackKey);
  assert.ok(blackInOctave);
  assert.ok(![60, 62, 64, 65, 67, 69, 71].some(isBlackKey));
});

test("A4 is 440 Hz and middle C is about 261.63 Hz", () => {
  assert.equal(midiToHz(69), 440);
  assert.ok(Math.abs(midiToHz(60) - 261.63) < 0.01);
});

test("in-range notes use their own sample unshifted", () => {
  assert.deepEqual(resolvePlayback(50, range, { useFlats: false }), { kind: "sample", key: "D3", rate: 1, shift: 0 });
});

test("up to two semitones outside the range shifts the edge sample", () => {
  const up = resolvePlayback(62, range);
  assert.equal(up.kind, "sample");
  assert.equal(up.key, "C4");
  assert.equal(up.shift, 2);
  assert.ok(Math.abs(up.rate - 2 ** (2 / 12)) < 1e-12);

  const down = resolvePlayback(41, range, { useFlats: true });
  assert.equal(down.key, "Gflat2");
  assert.equal(down.shift, -1);
  assert.ok(down.rate < 1);
});

test("three or more semitones outside the range beeps at the true pitch", () => {
  const high = resolvePlayback(63, range);
  assert.equal(high.kind, "beep");
  assert.ok(Math.abs(high.hz - midiToHz(63)) < 1e-9);
  assert.equal(resolvePlayback(39, range).kind, "beep");
  assert.equal(resolvePlayback(40, range).kind, "sample");
});
