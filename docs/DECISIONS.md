# Decision log

A running record of what has been decided, why, and what is still open.
Written for whoever picks this project up, whether that is a future
session or a coder, so the reasoning behind SPEC.md is not lost.

## Settled

Purpose: link a note's name, its pitch, and the physical action of
playing it, for a blind musician learning an instrument. This is the
center of the idea, not a side feature.

Platform: a web app first (GitHub Pages for testing), wrapped as a native
app for iOS later specifically to get real MIDI keyboard support there,
since no iOS browser supports Web MIDI.

Input: a connected MIDI keyboard is the primary input. A computer keyboard
key mapping is a secondary, always-available fallback. No on-screen touch
keyboard in version one; considered a poor technique-learning tool and
hard for a blind player to use, though it stays on the list as a possible
optional add-on later.

No hard coded practice melody. Free play with a MIDI keyboard is the
first thing to test.

No voice input to the app, at any stage.

Sound design: sung note names, not an instrument sound, are the whole
point. A plain piano or instrument tone was considered as a possible
companion sound (for a mode that reads back a piece) but is not part of
version one.

The sung names are pre-recorded samples, not generated live by a speech
engine on the device. This was decided after comparing a synthesizer
(eSpeak NG, DECtalk, MBROLA) against a sample pack: a sample pack gives
up almost nothing for this project (the vocabulary needed is small and
fixed: note names, sharp, flat) and gains clarity, zero playback latency,
no runtime licensing question, and the ability to check and hand-fix
every sound before it ships. See "voices tried" below for what was tested
before landing on this.

Voice: Rusty's own voice, sung and recorded directly. This sidesteps
every licensing question that came up with synthetic voices (DECtalk's
license terms were unclear when last checked; MBROLA's voices carry
non-commercial or attribution conditions depending on the voice; eSpeak's
raw formant voice was judged less clear than a real voice once MBROLA was
tried). Recording your own voice has none of these issues.

Instrument is monophonic: one sung note at a time, full stop. A new note
cuts off whatever is currently sounding. Multi-timbral or chordal
playback is a later, separate conversation, not a version-one feature.

Version one targets a C instrument (flute, ocarina): written pitch and
sounding pitch are the same, so there is no transposition to handle yet.
A transposition value should exist in the data model, defaulted to zero,
so adding clarinet/trumpet/etc. later does not require restructuring.

Key of C only for now: no key signature handling. The sample pack itself
has specific sharps and flats (see SAMPLE_PACK.md), used for explicit
sharp or flat notes and for black keys generally, not for a key
signature.

Black keys: each has both a sharp name and a flat name recorded. Because
raw MIDI note numbers do not distinguish enharmonic spelling, version one
uses a single sharps-or-flats setting the user sets once, rather than
attempting to infer spelling from context.

Scanning printed sheet music (optical music recognition) is set aside as
a distant, high-risk feature. Research into current OMR accuracy suggests
it is not reliable enough for a blind user to trust unsupervised, since
they cannot visually catch a misread note the way a sighted person could.
If pursued later, it needs a verification design: flag measures whose
note lengths do not add up to the time signature, flag out-of-range or
suspiciously large leaps, and have the app announce what it detected
(clef, key, time signature, measure count, uncertain measures) before
playing anything. MusicXML files remain the much safer, preferred way to
get a piece into the app, since they carry exact pitch and spelling
information a photo cannot reliably provide.

## Voices tried, for reference

DECtalk: source is available and its phoneme mode can specify a musical
pitch directly. License terms were ambiguous as of last check
(proprietary-sounding language despite the public source release);
would need re-checking before any public use.

eSpeak NG: open source (GPLv3), runs on Android and can be built for iOS,
but is a raw formant synthesizer and sounded more robotic and less clear
than the MBROLA option once both were tried.

MBROLA: diphone-based, sounds clearer than eSpeak's own voice. Can't hit
an exact pitch on its own (measured 15 to 35 cents off) but this was
correctable with a pitch-fixing pass. Its voices carry their own license
terms (checked for voices "us2" and "en1"): us2 forbids commercial use or
sale without the rights holder's permission but allows free distribution
at no charge; en1 is built on a database offered for use and distribution
for any purpose at no fee. Not a concern now since the project moved to
Rusty's own voice, but documented here in case a second/backup voice is
ever wanted.

## Still open

Middle and high register recordings. The only sample pack so far (see
samples/low_voice) covers F sharp 2 to C4, roughly one and a half
octaves. A usable instrument, and reading real pieces later, will need
several more octaves recorded the same way. Same process as before:
record a chromatic scale up naming sharps, then down naming flats, in
each new register, unprocessed, following the same recording guidance
used for the first pass (quiet room, steady pitch, consistent distance
from the microphone, about two seconds per note with a second of silence
between, three seconds of silence before a re-take).

Known rough edges in the current sample pack, low priority, fixable with
a small re-cut or a short new recording rather than a redesign: the
trailing "p" in the sharp names and "t" in the flat names is faint to
missing on several notes; the E3 sample has an end-of-note click whose
cause was not pinpointed by automated checks. None of this blocks
building and testing milestone 1, since the loop-based playback (attack,
looped sustain, full release) is the correct long-term design regardless
of these specific recordings; it just means a couple of notes will sound
a little rough in the first test.

Whether to keep the "natural" (unflattened pitch) version of each sample
at all. Rusty preferred the fully steady, pitch-locked version on first
listen. Steady is the default in SPEC.md; natural ships alongside it in
the sample pack in case it's wanted later, but nothing in the app needs
to use it.

How many sung letters can overlap or follow each other quickly before
they become hard to understand. Not yet tested. Relevant once the echo
game or fast passages come up; not a concern for milestone 1's simple
free play.

Whether note durations should ever be sung (as opposed to shown as text)
in the MusicXML reading mode. Current answer is text only, spoken/shown,
not sung. Worth revisiting once that mode is actually built.

Design of the echo/"Simon" game: how many notes to start with, how to
grow the sequence, whether to drill name-to-key, pitch-to-key, or both,
and what happens on a miss. Discussed only at a concept level so far.
