# Note Name Instrument (working title)

A web instrument for a blind musician. Play a key on a MIDI keyboard and the
app sings that note's letter name, in a recorded human voice, at the note's own
pitch, for as long as the key is held. The point is to tie together a note's
name, its pitch, and the physical act of playing it.

A second mode, working title "Simon Plays" (the app plays a short series of
sung notes and the player repeats them), is planned but not built yet.

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
    js/main.js                  wiring, settings, screen reader status messages
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

See docs/SPEC.md and docs/DECISIONS.md for the full reasoning.
