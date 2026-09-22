import { resolvePlayback } from "./notes.js";

const CUT_FADE_SECONDS = 0.006;
const BEEP_SECONDS = 0.18;
const BEEP_LEVEL = 0.12;

// Monophonic sung-note instrument: one sounding note at a time.
// A held note plays attack, then loops the marked loop region until the key is
// released, then plays the rest of the file (the release, including any final
// consonant). A new note cuts whatever is still sounding with a very short fade.
export class Instrument {
  constructor(ctx, bank, { onVoiceEnd } = {}) {
    this.ctx = ctx;
    this.bank = bank;
    this.onVoiceEnd = onVoiceEnd || (() => {});
    this.current = null;
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(ctx.destination);
  }

  // Returns the playback plan so the caller can report a beep vs. a sample.
  noteOn(midi, useFlats) {
    const plan = resolvePlayback(midi, this.bank, { useFlats });
    this.cutCurrent();
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.connect(this.out);

    let source;
    if (plan.kind === "sample") {
      const sample = this.bank.samples.get(plan.key);
      source = this.ctx.createBufferSource();
      source.buffer = sample.buffer;
      source.loop = true;
      source.loopStart = sample.loopStart;
      source.loopEnd = sample.loopEnd;
      source.connect(gain);
      source.start(now);
    } else {
      source = this.ctx.createOscillator();
      source.type = "sine";
      source.frequency.value = plan.hz;
      gain.gain.setValueAtTime(BEEP_LEVEL, now);
      gain.gain.setValueAtTime(BEEP_LEVEL, now + BEEP_SECONDS - 0.02);
      gain.gain.linearRampToValueAtTime(0, now + BEEP_SECONDS);
      source.connect(gain);
      source.start(now);
      source.stop(now + BEEP_SECONDS);
    }

    const voice = { midi, source, gain, plan, released: false };
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (this.current === voice) this.current = null;
      this.onVoiceEnd(voice);
    };
    this.current = voice;
    return plan;
  }

  // Key released: stop looping. Playback carries on from wherever it is,
  // through the end of the loop region and on into the release.
  noteOff(midi) {
    const voice = this.current;
    if (!voice || voice.midi !== midi || voice.released) return;
    voice.released = true;
    if (voice.plan.kind === "sample") voice.source.loop = false;
  }

  cutCurrent() {
    const voice = this.current;
    if (!voice) return;
    this.current = null;
    const now = this.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + CUT_FADE_SECONDS);
    try {
      voice.source.stop(now + CUT_FADE_SECONDS + 0.002);
    } catch {
      // already stopped
    }
  }
}
