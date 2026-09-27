"""Shorten the release tail of every steady sample, without touching pitch.

Stopgap for faster playing until the whole bank is re-recorded with a
snappier ending. Leaves the attack and the looped sustain completely
untouched -- only the release (everything from loop_end_sample onward) is
time-compressed, using Praat's duration tier (via parselmouth), which
resynthesizes at a different speed while leaving the pitch tier alone. Loop
points in loops.json do not change, since nothing before loop_end_sample is
touched.

Usage:
    python shorten_release.py <pack_dir> [--factor 0.5] [--set steady]

pack_dir is a SAMPLE_PACK.md-format folder (e.g. samples/low_voice), with
loops.json and a <set>/ subfolder of wav files. Writes the shortened wavs
back in place and updates each processed note's length_seconds in
loops.json. Run with --dry-run first to see the numbers without writing.
"""

import argparse
import json
import sys

import numpy as np
import parselmouth
import soundfile as sf
from parselmouth.praat import call

CROSSFADE_SECONDS = 0.025  # long enough to cover a full pitch cycle even at F#2 (~10.8ms period)


def compress_duration(segment, sr, factor, pitch_floor=60, pitch_ceiling=500):
    """Time-compress `segment` by `factor` (0.5 = play twice as fast), pitch unchanged."""
    if len(segment) < int(0.02 * sr):
        # too short for Praat's pitch analysis window; just resample the time axis directly
        n = max(1, int(round(len(segment) * factor)))
        return np.interp(np.linspace(0, len(segment) - 1, n), np.arange(len(segment)), segment).astype(segment.dtype)
    snd = parselmouth.Sound(segment.astype(np.float64), sampling_frequency=sr)
    manipulation = call(snd, "To Manipulation", 0.01, pitch_floor, pitch_ceiling)
    duration_tier = call(manipulation, "Extract duration tier")
    call(duration_tier, "Add point", 0, factor)
    call(duration_tier, "Add point", snd.duration, factor)
    call([duration_tier, manipulation], "Replace duration tier")
    out = call(manipulation, "Get resynthesis (overlap-add)")
    return out.values[0].astype(np.float32)


def crossfade_join(a, b, sr, seconds=CROSSFADE_SECONDS):
    """Equal-power crossfade -- gentler than linear when the two sides are out
    of phase with each other, which they are here: `a` is raw audio and `b`
    is a Praat resynthesis, and Praat re-grids the waveform onto its own
    pitch-cycle boundaries rather than preserving the original sample values,
    so the two sides don't line up sample-for-sample at the join."""
    n = min(int(seconds * sr), len(a), len(b))
    if n <= 1:
        return np.concatenate([a, b])
    t = np.linspace(0, np.pi / 2, n)
    fade_out, fade_in = np.cos(t), np.sin(t)
    joined_middle = a[-n:] * fade_out + b[:n] * fade_in
    return np.concatenate([a[:-n], joined_middle, b[n:]])


def process_pack(pack_dir, sample_set, factor, dry_run):
    loops_path = pack_dir / "loops.json"
    meta = json.loads(loops_path.read_text())
    sr = meta["sample_rate"]

    report = []
    for name, entry in meta["samples"].items():
        info = entry[sample_set]
        wav_path = pack_dir / sample_set / f"{name}.wav"
        y, file_sr = sf.read(wav_path, always_2d=False)
        assert file_sr == sr, f"{name}: file sample rate {file_sr} != loops.json {sr}"
        y = y.astype(np.float32)

        loop_end = info["loop_end_sample"]
        kept, release = y[:loop_end], y[loop_end:]
        old_release_seconds = len(release) / sr

        compressed = compress_duration(release, sr, factor)
        new_audio = crossfade_join(kept, compressed, sr)
        new_release_seconds = (len(new_audio) - loop_end) / sr
        new_total_seconds = len(new_audio) / sr

        report.append((name, old_release_seconds, new_release_seconds, info["length_seconds"], round(new_total_seconds, 2)))

        if not dry_run:
            sf.write(wav_path, new_audio, sr, subtype="PCM_24")
            info["length_seconds"] = round(new_total_seconds, 2)

    if not dry_run:
        loops_path.write_text(json.dumps(meta, indent=1))

    report.sort(key=lambda r: -r[1])
    print(f"{'note':10s} {'old release(s)':>15s} {'new release(s)':>15s} {'old total(s)':>13s} {'new total(s)':>13s}")
    for name, old_r, new_r, old_t, new_t in report:
        print(f"{name:10s} {old_r:15.2f} {new_r:15.2f} {old_t:13.2f} {new_t:13.2f}")
    old_total = sum(r[3] for r in report)
    new_total = sum(r[4] for r in report)
    print(f"\nmean release: {sum(r[1] for r in report)/len(report):.2f}s -> {sum(r[2] for r in report)/len(report):.2f}s")
    print(f"total pack duration: {old_total:.1f}s -> {new_total:.1f}s")


if __name__ == "__main__":
    from pathlib import Path

    parser = argparse.ArgumentParser()
    parser.add_argument("pack_dir", type=Path)
    parser.add_argument("--factor", type=float, default=0.5, help="duration multiplier for the release, 0.5 = twice as fast")
    parser.add_argument("--set", default="steady")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    process_pack(args.pack_dir, args.set, args.factor, args.dry_run)
