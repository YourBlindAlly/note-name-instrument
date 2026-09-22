import test from "node:test";
import assert from "node:assert/strict";
import { pickRandomNote, extendSequence, judge } from "../js/simon.js";

const pool = [60, 62, 64]; // C4 D4 E4

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
