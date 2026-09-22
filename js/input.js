// Note input sources. Each reports plain MIDI note numbers through callbacks,
// so the instrument never needs to know where a note came from.

// Any hardware that shows up as a Web MIDI input works: keyboards, pads,
// controllers, pedals. Every connected input and every channel is listened to.
export class MidiInput {
  constructor({ onNoteOn, onNoteOff, onDevicesChanged }) {
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
    this.onDevicesChanged = onDevicesChanged;
    this.access = null;
  }

  // Resolves to { ok: true } or { ok: false, reason: "unsupported" | "denied" }.
  async start() {
    if (!navigator.requestMIDIAccess) return { ok: false, reason: "unsupported" };
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch {
      return { ok: false, reason: "denied" };
    }
    this.access.onstatechange = () => this.refresh();
    this.refresh();
    return { ok: true };
  }

  refresh() {
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = (event) => this.handle(event.data);
    }
    this.onDevicesChanged(this.deviceNames());
  }

  deviceNames() {
    return [...this.access.inputs.values()]
      .filter((input) => input.state === "connected")
      .map((input) => input.name || "Unnamed MIDI device");
  }

  handle(data) {
    const status = data[0] & 0xf0;
    const note = data[1];
    const velocity = data[2];
    if (status === 0x90 && velocity > 0) this.onNoteOn(note, velocity);
    else if (status === 0x80 || (status === 0x90 && velocity === 0)) this.onNoteOff(note);
  }
}

// Last-resort input for when there is no MIDI hardware. Uses physical key
// positions (event.code) so it works the same on any keyboard layout.
const WHITE_KEYS = {
  KeyA: 0, KeyS: 2, KeyD: 4, KeyF: 5, KeyG: 7, KeyH: 9, KeyJ: 11, KeyK: 12, KeyL: 14, Semicolon: 16, Quote: 17,
};
const BLACK_KEYS = { KeyW: 1, KeyE: 3, KeyT: 6, KeyY: 8, KeyU: 10, KeyO: 13, KeyP: 15 };
const NOTE_OFFSETS = { ...WHITE_KEYS, ...BLACK_KEYS };

export class ComputerKeyboardInput {
  constructor({ onNoteOn, onNoteOff, onOctaveChanged, octave = 3 }) {
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
    this.onOctaveChanged = onOctaveChanged;
    this.octave = octave; // A plays C of this octave; 3 puts A on C3
    this.held = new Map(); // key code -> the MIDI note it started, so a release always matches
  }

  start() {
    document.addEventListener("keydown", (event) => this.keyDown(event));
    document.addEventListener("keyup", (event) => this.keyUp(event));
    window.addEventListener("blur", () => this.releaseAll());
  }

  ignore(event) {
    if (event.ctrlKey || event.altKey || event.metaKey) return true;
    const tag = event.target && event.target.tagName;
    return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
  }

  keyDown(event) {
    if (this.ignore(event)) return;
    if (event.code === "KeyZ" || event.code === "KeyX") {
      event.preventDefault();
      if (event.repeat) return;
      const next = this.octave + (event.code === "KeyX" ? 1 : -1);
      if (next >= 0 && next <= 7) this.octave = next;
      this.onOctaveChanged(this.octave);
      return;
    }
    const offset = NOTE_OFFSETS[event.code];
    if (offset === undefined) return;
    event.preventDefault(); // also stops Firefox quick-find on the apostrophe key
    if (event.repeat || this.held.has(event.code)) return;
    const note = 12 * (this.octave + 1) + offset;
    this.held.set(event.code, note);
    this.onNoteOn(note, 100);
  }

  keyUp(event) {
    const note = this.held.get(event.code);
    if (note === undefined) return;
    this.held.delete(event.code);
    this.onNoteOff(note);
  }

  releaseAll() {
    for (const note of this.held.values()) this.onNoteOff(note);
    this.held.clear();
  }
}
