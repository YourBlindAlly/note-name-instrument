# Sample pack format

Applies to samples/low_voice, and to any later register pack recorded the
same way.

## Files

Each file is one sung note name, mono, 44.1 kHz, 24-bit WAV.

File names are the pitch name plus octave number, using scientific pitch
notation where middle C is C4. For example:

    C3.wav        the note C, one octave below middle C
    Fsharp2.wav   F sharp, two octaves below middle C
    Gflat2.wav    G flat, the same pitch as F sharp 2, sung and spoken
                  as "flat" rather than "sharp"

Every natural note (no sharp or flat) has one file. Every black key has
two files, one for its sharp name and one for its flat name, sung as two
different words ("C sharp" versus "D flat") even though they are the same
pitch. Which one plays for a given black key press is a user setting (see
SPEC.md, "Black keys"), not something decided by the file itself.

Two parallel sets exist for every note:

    steady/     pitch is locked exactly on the note (equal temperament,
                A4 = 440 Hz). Use this set by default.
    natural/    the singer's own small pitch movement is kept; the note
                is centered on the correct pitch but wanders a little
                around it, more so on the lower notes. Kept for
                reference; nothing in the current spec calls for it.

## Mapping a file to a MIDI note number

Standard MIDI note number to scientific pitch name, where middle C (MIDI
60) is C4:

    MIDI note = (octave + 1) * 12 + pitch class

    pitch class: C=0, C#/Db=1, D=2, D#/Eb=3, E=4, F=5, F#/Gb=6, G=7,
    G#/Ab=8, A=9, A#/Bb=10, B=11

So MIDI 60 is C4, MIDI 66 is F#4/Gb4, MIDI 43 is G2, and so on. Look up
the sharp or flat file name according to the user's sharps-or-flats
setting for any black key MIDI number.

## Loop points and how to play a held note

Each file has three parts in sequence: an attack (the consonant and the
start of the vowel, not meant to be looped), a loop section (a clean,
steady stretch of the vowel), and a release (the vowel finishing and any
trailing consonant, such as the "p" in "sharp"). loops.json gives the
loop boundaries for every file, in both sets, as sample indexes (not
seconds) into that specific file, at that file's sample rate (44100):

    {
      "sample_rate": 44100,
      "samples": {
        "C3": {
          "steady": {
            "loop_start_sample": ...,
            "loop_end_sample": ...,
            ...
          },
          "natural": { ... }
        },
        ...
      }
    }

To play a held note:

1. On note-on, start playback from sample 0.
2. When playback reaches loop_end_sample, jump back to loop_start_sample
   and continue, repeating this for as long as the key is held. Apply a
   short crossfade (10 to 20 milliseconds) across the jump to avoid an
   audible seam; loops.json also records a loop_seam_match score for
   each file (close to 1.0 is a very clean match, notably lower values,
   currently around 0.8 to 0.85 on a handful of natural-set files, may
   still have an audible seam even with a crossfade).
3. On note-off, stop looping: let playback continue past loop_end_sample
   to the end of the file (the release) and then stop. Do not truncate
   or fade out early here. If a new note-on arrives before the release
   has finished (see SPEC.md, monophonic behavior), cut off immediately
   with a very short fade instead, rather than letting the release
   finish.

This means a held note can sustain indefinitely while a key is down, and
always ends with its proper release, including any trailing consonant,
once the key is released. Cutting a file short at a fixed length (as was
done for a quick listening comparison during development) is not the
intended playback method and should not be used in the app.

## Provenance and license

All samples in samples/low_voice are Rusty's own voice, recorded for this
project. No third-party licensing restrictions apply.
