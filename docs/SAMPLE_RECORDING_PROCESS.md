# How the sample pack was made

This documents the actual process used to turn a raw sung recording into
the sample pack in samples/low_voice, step by step, so a future register
(middle, high) can be produced the same way, or the process itself can be
changed on purpose rather than by accident. It describes what tools.py
does and why, not just what it outputs (see SAMPLE_PACK.md for that).

## Tools used

Python 3.12, run in a plain Linux environment. Libraries:

    soundfile      reading and writing the WAV/FLAC audio files
    numpy          general numeric work, loudness measurement
    parselmouth    a Python interface to Praat, a free speech analysis
                   program. This does the actual pitch tracking and pitch
                   correction; parselmouth just lets Python drive it.
    scipy.signal   one function, fftconvolve, used to find a clean loop
                   point by cross-correlating the audio against itself.
    ffmpeg         only used afterward, to make mp3 listening copies for
                   sending over chat. Not part of the sample pack itself.

Two other tools, eSpeak NG and MBROLA, and two other scripts, sing.py and
audition.py, were used earlier in the project to test synthetic singing
voices before deciding to record Rusty's own voice instead. They are not
part of how the delivered sample pack was made and are not needed to
reproduce or extend it; they're kept only as a record of that earlier
comparison (see DECISIONS.md, "voices tried").

The working script is tools/cutpack.py. Running it end to end expects two
files that were produced once, by hand, while first inspecting the
recording, and are not regenerated automatically: segments.json (see
"Step 1" below) and db.npy (a saved loudness-over-time array for the
whole recording, described in step 2). Recording a new register would
need these regenerated the same way before running cutpack.py; ask a
future Claude to redo this analysis pass rather than guessing the
parameters, since it involves looking at the actual measurements.

## The recording this was built from

low_voice_f__up_and_down_two_octaves-001.flac: a single take, 44.1 kHz,
24-bit, two channels but identical in both (effectively mono). Rusty sang
a chromatic scale from F sharp 2 up to C4 naming each note with its
sharp name, then back down naming each with its flat name, each note
sung twice in a row, about two seconds per note with roughly a second of
silence between notes.

## Step 1: finding each sung note in the recording

The recording's loudness was measured in short (10 millisecond) windows
across its whole length, converted to decibels. Any stretch louder than
-50 dB, with gaps shorter than 150 milliseconds bridged over (so a brief
dip mid-word doesn't split one note into two) and anything shorter than
250 milliseconds thrown out (too short to be a real sung note), was
treated as one sung utterance. This found 74 utterances: 37 notes, each
sung twice, in the order they were sung.

Each utterance's pitch was measured with Praat's pitch tracker, using the
middle half of the utterance only (the outer edges are the least
reliable part of a sung note), and compared against the nearest
equal-tempered pitch (A4 = 440 Hz) to get how many cents sharp or flat it
was.

Utterances were assigned to note names by their position in the known
singing order: the first 19 are F sharp 2 up to C4 ascending, sung with
sharp names; the remaining 18 are B3 down to G flat 2 descending, sung
with flat names. For a black key, the ascending take supplies the sharp
name (for example Fsharp2) and the descending take supplies the flat
name (Gflat2), even though they are the same pitch, because they were
sung as different words.

The result of this step is segments.json: a list of, for each utterance,
its position in the recording, its start and end time, its note name,
its measured pitch, how many cents off it was, and how much its pitch
wandered. This file has to exist before cutpack.py can run; it was built
once with a short exploratory script while examining the recording, not
by cutpack.py itself.

## Step 2: choosing which of the two takes to use

Most notes were sung twice. cutpack.py picks one take per note this way:

For natural (white key) notes, the take with the steadier pitch wins.
Steadiness is measured as how much the pitch wanders, in cents, across
the middle of the note; the take with the lower number wins.

For black keys, the same steadiness measurement is taken for both
candidate takes, and each is also checked for how clean its ending
sounds (see step 4 below for how an ending is judged). The steadier take
is preferred by default, but if the other take is close in steadiness
(within 6 cents) and has a clearly better ending, that one is used
instead. This is deliberately conservative: a better ending never
outweighs a real difference in how steady the pitch is. Two notes in the
current pack, G flat 3 and A flat 2, ended up using their second take for
this reason.

## Step 3: finding the true start and the true end of each note

A note's rough boundaries from step 1 are not exactly right for cutting a
clean sample: the start sometimes includes a faint pre-onset sound (a
breath, or the very beginning of a consonant catching before the real
attack), and the end needs to capture not just the vowel but also
whatever comes after it, which might be nothing, might be a trailing
hiss (as in "F"), or might be a short consonant burst (the "p" in
"sharp," the "t" in "flat").

The onset is found by searching a window from just under half a second
before to a quarter second after the rough start, for loud stretches at
least 20 milliseconds long, and taking the last one found close to the
rough start. This is what lets the code tell a real, sustained onset
apart from an isolated faint blip well before it, which is what was
happening on D flat and G flat before this was added: a faint pre-onset
sound was being mistaken for the start of the note.

The vowel's own end is found by extending forward from the rough end for
as long as the sound stays above a fairly low loudness floor, up to a
maximum of 350 milliseconds, which captures the vowel's natural decay
without running on indefinitely.

Whatever comes after the vowel is searched separately (see step 4). The
overall file boundary is the vowel's end, or the end of whatever was
found after it if anything was.

## Step 4: finding a consonant burst or trailing sound after the vowel

Right after the vowel ends, the code looks for a second short burst of
loudness within the next half second: something clearly louder than the
quiet background of the room at that point in the recording, no more
than 150 milliseconds long (long enough for a real consonant burst, too
short to mistake a lingering breath or hiss for one). If found, the file
is extended to include it, plus a short margin. If not found, the file
just ends shortly after the vowel.

This step matters for two different problems that came up in testing.
First, a "p" or "t" release is very brief and often much quieter than
the vowel before it, easy to mistake for silence and cut off; searching
specifically for a short loud burst, rather than just checking whether
the sound has stopped, is what makes it possible to find one. Second,
measuring this burst's strength (how far above the room's background it
is, and how long it lasts) is what lets step 2 judge whether one take's
ending is meaningfully better than the other's.

This search does not always find something real. On a few notes,
whatever was sung at the very end is close enough to the room's own
background noise that there is genuinely very little there. When that
happens, the file just ends with whatever quiet trailing sound exists;
no software step invents a stronger ending than what was recorded.

## Step 5: pitch correction, applied only to the vowel

This is the step that had to change partway through. The first version
of this pipeline ran Praat's pitch correction across the whole cut file,
including any release sound after the vowel. That process is built for
reshaping a smooth, steady vowel and does not treat a short burst
gently; it was part of why "p" and "t" endings were coming through faint
or missing.

The corrected pipeline only pitch-corrects the vowel part, from the true
onset (step 3) to the vowel's own end (step 3), not the release found in
step 4. Correction itself works the same way as before: Praat's
Manipulation object is built from the vowel audio, and its pitch tier
(the curve of pitch over time that Praat extracted from the recording)
is replaced.

Two versions are produced from the same vowel audio:

    steady: the whole pitch tier is deleted and replaced with a single
    flat value at the exact target pitch (equal temperament, A4 = 440).

    natural: the original pitch tier is kept, but every point on it is
    multiplied by a single constant factor that shifts its center onto
    the target pitch, without flattening the shape. This keeps whatever
    natural movement or slight vibrato the singer had.

Praat then resynthesizes audio from this modified pitch tier using
overlap-add, which is a fairly standard method for repitching a speech
recording: it works with the original recording's own pitch periods
rather than generating a wholly new sound, so it tends to sound close to
the original voice rather than synthetic. Duration was left alone in
this step (no duration tier was applied); only pitch was changed.

## Step 6: rejoining the corrected vowel to the raw release

The release audio found in step 4, whatever it is, is taken completely
unprocessed, straight from the original recording. It is joined onto the
end of the corrected vowel with a very short (6 millisecond) crossfade to
avoid an audible seam at the join. A short fade-in (8 milliseconds) is
applied at the very start of the file, and a short fade-out (25
milliseconds) at the very end, just enough in each case to avoid a click
at the boundary of the file, not intended to shape the sound in any
other way. An earlier version of this fade was much longer (120
milliseconds) and applied to the whole note including the release, which
was quietly smothering some of the endings; that longer fade was
specifically what got replaced when this problem was found.

## Step 7: loudness matching

Every file's loudness is measured in the middle of its vowel (the outer
30 percent at each end is skipped, since that's the attack or the
approach to the release, not representative of the note's steady
volume) and scaled so that portion sits at a fixed target loudness
(-22 dB relative to full scale). If that scaling would push the loudest
point in the whole file too close to clipping, the whole file is scaled
down slightly further to keep a small safety margin.

## Step 8: choosing loop points

For a key to be held indefinitely, some stretch of the vowel needs to
repeat cleanly. The code searches within the vowel (skipping the very
start, which is still settling into the note, and the very end, which is
close to the release) for a loop start and loop end whose waveforms
match each other closely, using cross-correlation, so that jumping from
the end back to the start doesn't produce an audible click or bump. It
tries several candidate starting points and keeps whichever pairing
matches best, with a slight preference for a longer loop over a shorter
one when the match quality is similar.

The minimum allowed loop length differs between the two versions on
purpose: at least a quarter of a second for the steady version, since a
perfectly flat pitch hides a short loop well, and at least six tenths of
a second for the natural version, since a short loop would otherwise
repeat the singer's own pitch wobble at an unnaturally fast, obvious
rate.

How well two ends of a loop match is saved as loop_seam_match in
loops.json, from 0 to 1. Most notes match above 0.97; a small number,
mostly in the natural version of a few low notes, are lower, around 0.8
to 0.85, and might have a faintly audible seam even with the short
crossfade the playback code is expected to apply (see SAMPLE_PACK.md).

## Step 9: a final check, and writing the files out

After all of the above, each finished file's pitch is measured again,
the same way it was measured for the original recording in step 1, and
compared to the target. This is only a check, not a correction; it
exists so that any note whose result came out wrong for an unexpected
reason would show up clearly in the numbers, rather than only being
caught by ear. In practice every note in the pack lands within a few
tenths of a cent of the intended pitch.

Every file is written as mono, 44.1 kHz, 24-bit WAV. Alongside the audio,
loops.json is written with, for every note, which take was used, its
pitch before correction, the loop points, the seam match score, the
pitch and wobble measured after correction, and the file's length. This
is the same file described in SAMPLE_PACK.md, from the playback side;
this document is where it comes from.

## Reproducing this for a new register

Record the same way as before (see DECISIONS.md, "still needed," for the
recording guidance given at the time): a chromatic scale up naming
sharps, then down naming flats, two takes per note, unprocessed, quiet
room. Then:

1. Segment the new recording into utterances and measure each one's
   pitch, the same way step 1 describes, to produce a new segments.json
   and db.npy for that recording. This part was done by hand with a
   short exploratory script the first time, not by a reusable tool, so
   it would need to be redone with care, checking the results by
   listening or by the same kind of measurement shown in this
   conversation's history, rather than assumed to just work.
2. Point cutpack.py at the new recording and the new segments.json /
   db.npy, and run it. Everything from step 2 onward is already
   automatic.
3. Spot check a handful of notes the way this conversation did: measure
   each ending's strength, listen to a few held notes for clean loop
   seams, and specifically check the black key endings, since those are
   the ones that needed the most care the first time.
