# Spec: Note Name Instrument, version one

## What this is

A web app for a blind musician (the person commissioning it is blind) that
links three things together: a note's name, its pitch, and the physical
act of playing it. A MIDI keyboard is connected to the browser. When a key
is played, the app sings that note's letter name, sustained at the note's
own pitch, for as long as the key is held. There is no printed music, no
scanning, and no scoring in version one. It is a single sustained
instrument, one note at a time.

This is a testable proof of concept, not a finished product. The goal of
version one is to prove the core loop works and sounds right: press a key,
hear your own note name at the right pitch, for as long as you hold it.

## Platform

Build as a plain web app (HTML, CSS, JavaScript), no framework required
unless it genuinely helps. Host it on GitHub Pages for easy testing and
sharing during development.

Use the Web MIDI API for keyboard input. This works in Chrome, Edge, and
Firefox on a computer, and in Chrome on Android. It does not work in any
browser on iPhone or iPad, including Chrome there, because every iOS
browser is required to use Apple's WebKit engine, which does not support
Web MIDI. A native iOS wrapper (see "Not in version one") is the planned
fix for that, later.

As a fallback input method with no MIDI hardware attached, map a row of
computer keyboard keys to notes (for example, the way a simple on-screen
piano app often does it: A S D F G H J K to a white key run, W E T Y U to
the black keys above them). This is for development testing and for
anyone trying the app without a MIDI keyboard, not a primary interface.

## Core interaction (milestone 1, build this first)

1. On page load, request Web MIDI access and list available MIDI inputs.
   If none are available or permission is denied, fall back to the
   computer keyboard mapping and say so in the page, in a way a screen
   reader will announce.
2. On a MIDI note-on message, look up the sung sample for that MIDI note
   number (see docs/SAMPLE_PACK.md for the mapping and file format) and
   begin playing it: the attack, then loop the marked loop section for as
   long as the key stays down.
3. On the matching MIDI note-off message, stop looping and play the rest
   of the file from the loop end onward (the release, including the
   trailing consonant), then stop.
4. This is a monophonic instrument. If a new note is pressed while
   another is still sounding, immediately cut the previous note (attack
   and release both skipped, hard stop or a very short fade of a few
   milliseconds to avoid a click) and start the new one. Do not try to
   play more than one sung note at a time.
5. Nothing needs to be drawn on screen for this to work, but the page
   should not be blank: show the connected MIDI device's name (or "using
   computer keyboard" if none), and the name of the note currently
   sounding, in a way a screen reader announces automatically (for
   example, an ARIA live region), since the person using this cannot see
   the screen.
6. Audio will not play in a browser until the user has interacted with
   the page once. Include a clearly labeled start button for this.

## Black keys

The sample pack has two names for every black key: a sharp name and a
flat name (see docs/SAMPLE_PACK.md). MIDI note numbers do not say which
spelling is intended. For version one, add a simple setting, sharps or
flats, that the user sets once and that decides which sample plays for
every black key. Default to sharps. Do not try to guess the right
spelling from context in version one; that is a later, harder problem
tied to key signatures (see DECISIONS.md).

## Missing notes

The sample pack currently only covers F sharp 2 up to C4 (about one and a
half octaves). A MIDI keyboard has a much wider range. For any MIDI note
outside the sample pack's range, do not pitch-shift a distant sample to
cover it. Either play nothing and flag it in the on-screen status (so
this is easy to notice while testing), or, if you want sound for every
key in the meantime, shift only from a sample within two semitones and
mark clearly in the code that this is a placeholder. The right fix is
recording more registers (see DECISIONS.md, "still needed"), not
stretching the pitch shift further.

## Not in version one

These are real parts of the eventual product, discussed and wanted, but
deliberately excluded from the first build so testing can start sooner:

- Reading a piece of music (MusicXML import), step mode with a foot
  pedal, and a hard coded practice melody. All dropped for now in favor
  of testing free play on a MIDI keyboard first.
- An on-screen touch keyboard. Explicitly not wanted for version one;
  touch keyboards are poor for technique and difficult for a blind
  player to use reliably. May be reconsidered later as an optional
  add-on, not a priority.
- A "Simon says" style echo game (app plays a short sequence of sung
  notes, the player repeats it back). Wanted, likely as a second mode in
  the same app, but design it after the core instrument has been tried.
- Photo scanning of printed sheet music. Set aside as a distant,
  higher-risk feature; optical music recognition is not considered
  reliable enough yet for unsupervised use by a blind musician (see
  DECISIONS.md).
- Any voice input to the app. Not wanted at all, at any stage.
- Transposing instruments (clarinet, trumpet, etc). Version one assumes a
  C instrument (flute, ocarina) where written and sounding pitch match.
  Leave a transposition setting in the data model defaulted to zero
  semitones so this is easy to add later, but no UI for it yet.
- A key signature other than C. All pitches are natural or the specific
  sharps and flats in the sample pack; no flats/sharps implied by a key
  signature.
- Multi-timbral or chordal playback. Strictly one voice, one note at a
  time.

## After milestone 1

Once free play with a MIDI keyboard works and sounds right, the
suggested next steps, in order, are:

1. MusicXML import and a simple on-screen (screen reader readable) list
   of the notes in a piece, including durations shown as text (not
   sung). No playback of a whole piece yet, just confirming the file can
   be read and its contents announced correctly.
2. Step mode: move through the imported piece one note at a time, using
   a connected foot pedal (these present themselves to the computer as
   ordinary keyboard key presses, typically arrow keys, so this is
   mostly a matter of listening for those key codes) or a large tap
   target, singing the correct name and pitch at each step.
3. The echo/game mode.

Do not start any of these until milestone 1 has actually been tried on a
real MIDI keyboard and the sound and feel confirmed as good.
