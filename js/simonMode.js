// Orchestrates a round of "Simon Plays": the app sings a growing sequence of
// notes, the player echoes it back on their keyboard, and on success the
// sequence grows by one and repeats. Timing, sound, and narration all go
// through callbacks so the actual rules (js/simon.js) stay easy to test on
// their own; this file is the stateful, DOM/audio-adjacent half, in the same
// spirit as voice.js and input.js.

import { extendSequence, judge } from "./simon.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A first guess at pacing, not yet confirmed by ear. See docs/DECISIONS.md,
// "How many sung letters can overlap or follow each other quickly before
// they become hard to understand" -- this errs slow until that's tested.
const DEFAULT_HOLD_MS = 650;
const DEFAULT_GAP_MS = 500;
const PAUSE_MS = 1300;

export class SimonMode {
  constructor({ pool, poolLabel = "", soundOn, soundOff, hardStop, announce, onUpdate, holdMs = DEFAULT_HOLD_MS, gapMs = DEFAULT_GAP_MS, rng = Math.random }) {
    this.pool = pool;
    this.poolLabel = poolLabel;
    this.soundOn = soundOn;
    this.soundOff = soundOff;
    this.hardStop = hardStop || (() => {});
    this.announce = announce;
    this.onUpdate = onUpdate || (() => {});
    this.holdMs = holdMs;
    this.gapMs = gapMs;
    this.rng = rng;

    this.sequence = [];
    this.answer = [];
    this.phase = "idle"; // idle | playing | awaiting | correct | wrong
    this.best = 0;
    this.round = 0; // bumped on newGame() so a stale timer from a previous game can't fire
  }

  // Switches which notes rounds are drawn from (chromatic, black keys, or a
  // particular key). Ends whatever round is in progress rather than trying
  // to carry it over, since a sequence already sung from the old pool can't
  // be judged fairly against the new one; a fresh best-so-far for the new
  // pool starts at zero rather than carrying over the old pool's score,
  // since different pools aren't the same difficulty.
  setPool(pool, poolLabel) {
    this.round += 1;
    this.pool = pool;
    this.poolLabel = poolLabel;
    this.sequence = [];
    this.answer = [];
    this.phase = "idle";
    this.best = 0;
    this.onUpdate({ best: 0, length: 0 });
  }

  // Halts everything right away: cancels a sequence mid-playback (and
  // silences whatever note it was singing), cancels the pause between
  // rounds, and returns to idle. Doesn't touch the pool or the best-so-far,
  // since stopping isn't the same as abandoning the game -- New game or
  // Replay sequence both still work afterward.
  stop() {
    const wasActive = this.phase !== "idle";
    this.round += 1; // invalidates any pending timer or in-flight playback loop
    this.hardStop();
    this.sequence = [];
    this.answer = [];
    this.phase = "idle";
    this.announce(wasActive ? "Stopped. Press New game to start." : "Nothing to stop.");
  }

  // Starts fresh, at one note, rather than continuing whatever came before.
  newGame() {
    this.round += 1;
    this.sequence = extendSequence([], this.pool, this.rng);
    this.runSequence();
  }

  // Re-hears the current sequence without changing anything, available any
  // time except while it's already sounding.
  replay() {
    if (this.sequence.length === 0) {
      this.announce("Press New game to start.");
      return;
    }
    if (this.phase === "playing") return;
    this.runSequence();
  }

  async runSequence() {
    const round = this.round;
    this.phase = "playing";
    this.answer = [];
    const count = this.sequence.length;
    this.announce(`Listen. ${count} note${count === 1 ? "" : "s"}.`);
    await wait(600);
    for (const midi of this.sequence) {
      if (round !== this.round) return; // superseded by a new game mid-playback
      this.soundOn(midi);
      await wait(this.holdMs);
      this.soundOff(midi);
      await wait(this.gapMs);
    }
    if (round !== this.round) return;
    this.phase = "awaiting";
    this.announce(`Your turn. Play back ${count} note${count === 1 ? "" : "s"}.`);
  }

  // Called for every note the player plays while this mode is active. Sound
  // and scoring only happen on the player's turn; a press while the app is
  // singing its own sequence is ignored rather than cutting that note off
  // (the instrument is monophonic), and a press between rounds is a short,
  // deliberately silent window rather than one more thing to announce.
  handleInput(midi) {
    if (this.phase === "idle") {
      this.announce("Press New game to start.");
      return;
    }
    if (this.phase !== "awaiting") return;

    this.soundOn(midi);
    this.answer.push(midi);
    const result = judge(this.sequence, this.answer);

    if (result === "wrong") {
      this.phase = "wrong";
      this.announce("Not quite. Listen again.");
      const round = this.round;
      setTimeout(() => {
        if (round === this.round) this.runSequence();
      }, PAUSE_MS);
    } else if (result === "complete") {
      this.phase = "correct";
      this.best = Math.max(this.best, this.sequence.length);
      this.onUpdate({ best: this.best, length: this.sequence.length });
      this.announce(`That's right. ${this.sequence.length} notes.`);
      const round = this.round;
      setTimeout(() => {
        if (round !== this.round) return;
        this.sequence = extendSequence(this.sequence, this.pool, this.rng);
        this.runSequence();
      }, PAUSE_MS);
    }
    // "progress": correct so far, nothing extra to say -- the sung note
    // they just heard back is confirmation enough.
  }
}
