# Note Name Instrument (working title)

A web instrument for a blind musician. Play a key on a MIDI keyboard and the
app sings that note's letter name, in a recorded human voice, at the note's own
pitch, for as long as the key is held. The point is to tie together a note's
name, its pitch, and the physical act of playing it.

A second mode, "Simon Plays," is also here: the app sings a short, growing
series of notes and the player echoes it back on their keyboard. Switch modes
with the Free play / Simon Plays radio buttons after pressing Start.

## Running it

The app needs to be served over http so the browser will load the samples and
allow MIDI. From this folder:

    python -m http.server 8090

or double-click `serve.cmd`, then open http://localhost:8090 and press Start.

Any browser with Web MIDI works (Chrome, Edge, Firefox on a computer, Chrome on
Android). No iPhone or iPad browser supports Web MIDI. Without MIDI hardware the
computer keyboard plays notes instead: A S D F G H J K L ; ' are white keys,
W E T Y U O P are black keys, Z and X change octave.

## Layout

    index.html, css/style.css   the page
    js/notes.js                 note names, sample lookup, range decisions (no browser APIs)
    js/sampleBank.js            loads and decodes a sample pack
    js/voice.js                 monophonic sung-note playback (attack, loop, release)
    js/input.js                 Web MIDI input and computer keyboard fallback
    js/simon.js                 Simon Plays rules: note choice, sequence growth, judging (no browser APIs)
    js/simonMode.js             Simon Plays round orchestration: timing, narration, sound
    js/main.js                  wiring, settings, mode switching, screen reader status messages
    samples/low_voice/          Rusty's recorded sample pack, F sharp 2 to C4
    docs/                       spec, decision log, sample pack format, how the pack was made
    tools/cutpack.py            script used to cut a raw recording into a pack (see docs)
    tests/                      run with: node --test tests/

## Behavior worth knowing

- Monophonic. A new note cuts the previous one with a few milliseconds of fade.
- Black keys are sung as sharps or flats depending on a setting (default sharps).
- A note outside the recorded range plays a short beep at its true pitch,
  rather than a pitch-shifted sample (tried and dropped: it sang the wrong
  note name, which defeats the point). More recordings are the real fix for
  the range itself.
- Status messages go to a polite live region. Each note's name is not announced
  by the screen reader by default, since it would talk over the sung name; there
  is a checkbox to turn that on.
- Simon Plays starts at one note and grows by one on a correct answer. A wrong
  answer doesn't end the game; it replays the same sequence and tries again.
  Notes are drawn from the recorded range only, never a beeped out-of-range
  note. It has its own status region so game narration doesn't mix with device
  messages. The note pacing (a hold and a gap between notes) is a first guess,
  not yet confirmed by ear.
- Simon Plays has four note pools, switchable any time: White keys only (the
  default), Chromatic (every recorded note), Black keys only, and A specific
  key (a major scale for a chosen tonic, restricted to the recorded range).
  Changing the pool ends whatever round is running and resets that pool's
  best-so-far to zero.
- Simon Plays can be stopped at any time with Escape, Space, or the Stop
  button, whether it's mid-playback or waiting on you. This cuts off a
  singing note immediately if one's sounding and returns to idle; nothing
  else (best-so-far, pool choice) changes. Space is ignored when a button
  has focus, since Space is already that button's own activate key.

See docs/SPEC.md and docs/DECISIONS.md for the full reasoning.
