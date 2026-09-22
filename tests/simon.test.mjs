import test from "node:test";
import assert from "node:assert/strict";
import { pickRandomNote, extendSequence, judge, buildPool } from "../js/simon.js";

const pool = [60, 62, 64]; // C4 D4 E4
const range = { minMidi: 42, maxMidi: 60 }; // F sharp 2 to C4, the recorded pack

test("pickRandomNote uses the rng to index into the pool", () => {
  assert.equal(pickRandomNote(pool, () => 0), 60);
  assert.equal(pickRandomNote(pool, () => 0.9999), 64);
});

test("extendSequence appends one note and grows the sequence by one", () => {
  const seq = extendSequence([60, 62], pool, () => 0);
  assert.deepEqual(seq, [60, 62, 60]);
});

test("extendSequence avoids an immediate repeat when the pool allows it", () => {
  // rng always picks index 0 (60); since the last note is also 60, it must
  // keep redrawing until it lands on something else. With a fixed rng that
  // never varies, use one that cycles so we can prove it eventually differs.
  let calls = 0;
  const cyclingRng = () => (calls++ === 0 ? 0 : 0.5); // 0 -> 60 (rejected), then 0.5 -> 62
  const seq = extendSequence([60], pool, cyclingRng);
  assert.deepEqual(seq, [60, 62]);
});

test("extendSequence allows a repeat when the pool has only one note", () => {
  const seq = extendSequence([60], [60], () => 0);
  assert.deepEqual(seq, [60, 60]);
});

test("judge: correct notes short of the full sequence are progress", () => {
  assert.equal(judge([60, 62, 64], [60]), "progress");
  assert.equal(judge([60, 62, 64], [60, 62]), "progress");
});

test("judge: the final correct note completes the sequence", () => {
  assert.equal(judge([60, 62, 64], [60, 62, 64]), "complete");
});

test("judge: a mismatched note at the current position is wrong", () => {
  assert.equal(judge([60, 62, 64], [61]), "wrong");
  assert.equal(judge([60, 62, 64], [60, 60]), "wrong");
});

test("judge only checks the most recently played note, not the whole prefix", () => {
  // an inconsistent history before the last entry is not re-validated
  assert.equal(judge([60, 62, 64], [99, 99, 64]), "complete");
});

test("buildPool chromatic is every note in range", () => {
  const chromatic = buildPool(range, "chromatic");
  assert.equal(chromatic.length, 19);
  assert.equal(chromatic[0], 42);
  assert.equal(chromatic[chromatic.length - 1], 60);
});

test("buildPool blackKeys is only the black keys in range", () => {
  assert.deepEqual(buildPool(range, "blackKeys"), [42, 44, 46, 49, 51, 54, 56, 58]);
});

test("buildPool key returns only that major scale's notes in range", () => {
  // C major (tonic pitch class 0): naturals only.
  assert.deepEqual(buildPool(range, "key", { tonicPitchClass: 0 }), [43, 45, 47, 48, 50, 52, 53, 55, 57, 59, 60]);
});

test("buildPool key works for a black-key tonic too", () => {
  // F# major (tonic pitch class 6): F# G# A# B C# D# F (and back to F# at the top).
  const fSharpMajor = buildPool(range, "key", { tonicPitchClass: 6 });
  for (const midi of fSharpMajor) {
    const pc = ((midi % 12) + 12) % 12;
    assert.ok([6, 8, 10, 11, 1, 3, 5].includes(pc), `pitch class ${pc} from midi ${midi} is not in F# major`);
  }
  assert.ok(fSharpMajor.includes(42)); // F#2 itself
});

test("buildPool key rejects a tonic outside 0-11", () => {
  assert.throws(() => buildPool(range, "key", { tonicPitchClass: 12 }));
  assert.throws(() => buildPool(range, "key", {}));
});

test("buildPool rejects an unknown pool kind", () => {
  assert.throws(() => buildPool(range, "nonsense"));
});
