// Pure "Simon Plays" game rules: choosing notes, growing a sequence, and
// judging the player's answer against it. No DOM, no audio, no timers, so
// this can be tested with plain Node. See docs/DECISIONS.md, "Design of the
// echo/Simon game" for the choices made here and why.

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
