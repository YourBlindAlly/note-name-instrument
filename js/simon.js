// Pure "Simon Plays" game rules: choosing notes, growing a sequence, and
// judging the player's answer against it. No DOM, no audio, no timers, so
// this can be tested with plain Node. See docs/DECISIONS.md, "Design of the
// echo/Simon game" for the choices made here and why.

import { isBlackKey, pitchClass } from "./notes.js";

// Semitone steps of a major scale above its tonic. Simon Plays' "key mode"
// is major only for now; minor or other modes are a later addition.
export const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11];

// The candidate notes for a round, given the recorded range and which of
// Simon Plays' note pools is selected:
//   "whiteKeys": only the white (natural) keys in range. The default.
//   "chromatic": every recorded note (the original mode).
//   "blackKeys": only the black keys in range.
//   "key": only the notes of a major scale in range, given a tonic pitch
//          class 0-11 (options.tonicPitchClass).
export function buildPool(range, kind, options = {}) {
  const all = [];
  for (let midi = range.minMidi; midi <= range.maxMidi; midi++) all.push(midi);
  if (kind === "chromatic") return all;
  if (kind === "blackKeys") return all.filter(isBlackKey);
  if (kind === "whiteKeys") return all.filter((midi) => !isBlackKey(midi));
  if (kind === "key") {
    const { tonicPitchClass } = options;
    if (!Number.isInteger(tonicPitchClass) || tonicPitchClass < 0 || tonicPitchClass > 11) {
      throw new Error(`tonicPitchClass must be 0-11, got ${tonicPitchClass}`);
    }
    const scalePitchClasses = new Set(MAJOR_SCALE_STEPS.map((step) => (tonicPitchClass + step) % 12));
    return all.filter((midi) => scalePitchClasses.has(pitchClass(midi)));
  }
  throw new Error(`Unknown pool kind: ${kind}`);
}

export function pickRandomNote(pool, rng = Math.random) {
  if (pool.length === 0) throw new Error("Empty note pool");
  return pool[Math.floor(rng() * pool.length)];
}

// Add one note to a sequence, starting a new one from an empty sequence.
// Avoids repeating the immediately preceding note when the pool is large
// enough to avoid it, since two sung copies of the same note back to back
// are hard to tell apart as two separate notes rather than one held note.
export function extendSequence(sequence, pool, rng = Math.random) {
  if (pool.length === 0) throw new Error("Empty note pool");
  let next = pickRandomNote(pool, rng);
  if (pool.length > 1) {
    const last = sequence[sequence.length - 1];
    while (next === last) next = pickRandomNote(pool, rng);
  }
  return [...sequence, next];
}

// Judge what the player has played so far against the target sequence.
// Only the most recently played note actually needs checking, since every
// earlier one already passed judge() on a previous call.
//   "progress": correct so far, more notes still expected
//   "complete": correct, and this was the last note needed
//   "wrong":    this note does not match the sequence at this position
export function judge(sequence, playedSoFar) {
  const index = playedSoFar.length - 1;
  if (index < 0 || playedSoFar[index] !== sequence[index]) return "wrong";
  return playedSoFar.length >= sequence.length ? "complete" : "progress";
}
