import soundfile as sf, numpy as np, json, os, parselmouth
from parselmouth.praat import call
from scipy.signal import fftconvolve

SRC = "/mnt/user-data/uploads/low_voice_f__up_and_down_two_octaves-001.flac"
x, SR = sf.read(SRC)
M = x.mean(axis=1)
rows = json.load(open("segments.json"))  # k, start, end, note, medHz, cents, spread
db = np.load("db.npy")

snd_all = parselmouth.Sound(M, sampling_frequency=SR)
pitch_all = snd_all.to_pitch_ac(time_step=0.005, pitch_floor=60, pitch_ceiling=500, very_accurate=True)
T = pitch_all.xs()
F0 = pitch_all.selected_array["frequency"]

NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLAT = {"C#": "Dflat", "D#": "Eflat", "F#": "Gflat", "G#": "Aflat", "A#": "Bflat"}
SHARP = {"C#": "Csharp", "D#": "Dsharp", "F#": "Fsharp", "G#": "Gsharp", "A#": "Asharp"}


def hz_of(name):
    pc = NAMES.index(name[:-1])
    octv = int(name[-1])
    midi = 12 * (octv + 1) + pc
    return 440.0 * 2 ** ((midi - 69) / 12)


def steadiness(k, s, e):
    sel = (T >= s + 0.3 * (e - s)) & (T <= e - 0.2 * (e - s)) & (F0 > 0)
    v = 1200 * np.log2(F0[sel] / np.median(F0[sel]))
    return float(np.std(v))


# ---- decide which takes belong to which slot ----
slots = {}  # slot name -> (pitch name like F#2, list of segment rows)
for r in rows:
    k, s, e, pname = r[0], r[1], r[2], r[3]
    base = pname[:-1]
    octv = pname[-1]
    if base in FLAT:  # black key
        label = (SHARP[base] if k <= 38 else FLAT[base]) + octv
    else:
        label = pname
    slots.setdefault(label, (pname, []))[1].append(r)

chosen = {}
for label, (pname, cand) in slots.items():
    best = min(cand, key=lambda r: abs(r[5]) + 0.5 * steadiness(r[0], r[1], r[2]))
    chosen[label] = (pname, best)


def find_bursts(a_search, b_search, thr=-55, min_len=0.02, gap_break=0.06):
    """find (start,end) of loud-enough runs between two times, for locating consonant onsets/releases"""
    hop = 0.01
    i0 = int(a_search / hop)
    i1 = int(b_search / hop)
    runs = []
    i = i0
    while i < i1:
        if db[i] > thr:
            j = i
            while j + 1 < i1 and (db[j + 1] > thr or (j + 1 < i1 - 1 and db[j + 2] > thr)):
                j += 1
            if (j - i) * hop >= min_len:
                runs.append((i * hop, (j + 1) * hop))
            i = j + 1
        else:
            i += 1
    return runs


def find_edges(s, e):
    """find a clean onset (skip a brief pre-onset blip separated by real silence) and
    a clean offset that also captures a trailing consonant burst (p, f, etc) after a gap"""
    hop = 0.01
    # --- onset: look at the loud runs starting a bit before the original mark ---
    onset_runs = find_bursts(max(0.0, s - 0.45), s + 0.25, thr=-58, min_len=0.02)
    if not onset_runs:
        a = max(0.0, s - 0.1)
    else:
        # the true onset is the run that leads into sustained voicing: pick the last run
        # that starts no more than 0.35 s before s, preferring the one immediately followed
        # by sustained energy (i.e. the last one before the long stretch of loudness)
        a = onset_runs[-1][0]
        if len(onset_runs) > 1:
            # if the chosen run is very short (<40 ms) and there's a real gap before the next
            # one, prefer the later (stronger, sustained) run -- already default via [-1]
            pass
    a = max(0.0, a - 0.03)

    # --- offset: extend through the vowel, then look ahead for a release burst ---
    i0 = int(s / hop)
    i1 = int(e / hop)
    b = i1
    while b < len(db) - 1 and db[b + 1] > -62 and (b - i1) * hop < 0.35:
        b += 1
    vowel_end = (b + 1) * hop
    tail_runs = find_bursts(vowel_end, vowel_end + 0.55, thr=-58, min_len=0.02)
    if tail_runs:
        b_time = tail_runs[-1][1] + 0.05
    else:
        b_time = vowel_end + 0.05
    return a, b_time


def last_voiced_run(a, b):
    sel = (T >= a) & (T <= b)
    tt = T[sel]
    v = F0[sel] > 0
    runs = []
    i = 0
    while i < len(v):
        if v[i]:
            j = i
            while j + 1 < len(v) and (v[j + 1] or (j + 1 < len(v) and np.any(v[j + 1:j + 12]))):
                j += 1
            runs.append((tt[i], tt[j]))
            i = j + 1
        else:
            i += 1
    # keep runs of real length
    runs = [r for r in runs if r[1] - r[0] > 0.4]
    return runs[-1]


def process(label, pname, row, mode):
    hz = hz_of(pname)
    a, b = find_edges(row[1], row[2])
    seg = M[int(a * SR):int(b * SR)]
    snd = parselmouth.Sound(seg, sampling_frequency=SR)
    manip = call(snd, "To Manipulation", 0.005, 60, 500)
    pt = call(manip, "Extract pitch tier")
    dur = snd.duration
    if mode == "steady":
        call(pt, "Remove points between", 0, dur + 1)
        call(pt, "Add point", 0.0, hz)
        call(pt, "Add point", dur, hz)
    else:
        factor = hz / row[4]
        call(pt, "Multiply frequencies", 0, dur + 1, factor)
    call([pt, manip], "Replace pitch tier")
    out = call(manip, "Get resynthesis (overlap-add)")
    y = out.values[0].copy()
    n = min(len(y), len(seg))
    y = y[:n]
    # gentle fades
    fi = int(0.008 * SR)
    fo = int(0.12 * SR)
    y[:fi] *= np.linspace(0, 1, fi)
    y[-fo:] *= (np.cos(np.linspace(0, np.pi / 2, fo))) ** 2
    return y, a, b


def pick_loop(y, run_rel, minlen=0.25):
    """choose loop start/end (samples) inside the final voiced run, seam matched by waveform"""
    rs = int((run_rel[0] + 0.30) * SR)
    re_ = int((run_rel[1] - 0.40) * SR)
    if re_ - rs < int(0.35 * SR):
        rs = int((run_rel[0] + 0.15) * SR)
        re_ = int((run_rel[1] - 0.25) * SR)
    win = 2048
    best = None
    # candidate loop starts across the first half of the allowed region
    for s0 in np.linspace(rs, max(rs, rs + (re_ - rs) * 0.3), 6).astype(int):
        ref = y[s0 - win:s0]
        lo = s0 + int(minlen * SR)
        hi = re_
        if hi - lo < 200:
            continue
        seg = y[lo - win:hi]
        num = fftconvolve(seg, ref[::-1], mode="valid")
        en = np.sqrt(fftconvolve(seg ** 2, np.ones(win), mode="valid") * np.sum(ref ** 2)) + 1e-12
        ncc = num / en
        j = int(np.argmax(ncc))
        s1 = lo + j
        score = float(ncc[j]) + 0.0002 * (s1 - s0) / SR  # slight preference for longer loops
        if best is None or score > best[0]:
            best = (score, s0, s1, float(ncc[j]))
    return best


def measure_cents(y, run_rel, hz):
    s = parselmouth.Sound(y, sampling_frequency=SR)
    p = s.to_pitch_ac(time_step=0.005, pitch_floor=60, pitch_ceiling=500, very_accurate=True)
    t = p.xs()
    f = p.selected_array["frequency"]
    sel = (t >= run_rel[0] + 0.3) & (t <= run_rel[1] - 0.3) & (f > 0)
    v = f[sel]
    med = float(np.median(v))
    return 1200 * np.log2(med / hz), float(np.std(1200 * np.log2(v / med)))


def rms_norm(y, run_rel, target_db=-22.0):
    a = int((run_rel[0] + 0.3) * SR)
    b = int((run_rel[1] - 0.3) * SR)
    r = np.sqrt(np.mean(y[a:b] ** 2)) + 1e-12
    g = 10 ** (target_db / 20) / r
    y = y * g
    pk = np.max(np.abs(y))
    if pk > 0.89:
        y = y * (0.89 / pk)
    return y


def hold(y, s0, s1, seconds, xf=int(0.02 * SR)):
    """render a held note: attack, looped vowel, release"""
    out = y[:s1].copy()
    loop = y[s0:s1]
    post = y[s1:]
    target = int(seconds * SR)
    while len(out) + len(post) < target:
        fadeout = np.linspace(1, 0, xf)
        fadein = 1 - fadeout
        out[-xf:] = out[-xf:] * fadeout + y[s0 - xf:s0] * fadein
        out = np.concatenate([out, loop])
    return np.concatenate([out, post])


if __name__ == "__main__":
    os.makedirs("pack/steady", exist_ok=True)
    os.makedirs("pack/natural", exist_ok=True)
    meta = {}
    report = []
    store = {"steady": {}, "natural": {}}
    for label, (pname, row) in sorted(chosen.items(), key=lambda kv: hz_of(kv[1][0]) if False else kv[1][1][1]):
        a, b = find_edges(row[1], row[2])
        run = last_voiced_run(a, b)
        run_rel = (run[0] - a, run[1] - a)
        info = {"source_take": row[0], "pitch": pname, "measured_cents_before": row[5], "target_hz": round(hz_of(pname), 2)}
        for mode in ("steady", "natural"):
            y, a2, b2 = process(label, pname, row, mode)
            y = rms_norm(y, run_rel)
            lp = pick_loop(y, run_rel, 0.6 if mode == 'natural' else 0.25)
            if lp is None:
                lp = pick_loop(y, run_rel, 0.25)
            cents, wob = measure_cents(y, run_rel, hz_of(pname))
            sf.write(f"pack/{mode}/{label}.wav", y, SR, subtype="PCM_24")
            info[mode] = {"loop_start_sample": int(lp[1]), "loop_end_sample": int(lp[2]), "loop_seam_match": round(lp[3], 3),
                          "cents_after": round(cents, 1), "wobble_std_cents": round(wob, 1), "length_seconds": round(len(y) / SR, 2)}
            store[mode][label] = (y, int(lp[1]), int(lp[2]))
        meta[label] = info
        report.append((label, pname, row[0], round(row[5], 1), info["steady"]["cents_after"], info["steady"]["wobble_std_cents"],
                       info["natural"]["cents_after"], info["natural"]["wobble_std_cents"], info["steady"]["loop_seam_match"]))
    json.dump({"sample_rate": SR, "note": "loop points are sample indexes into each wav", "samples": meta}, open("pack/loops.json", "w"), indent=1)
    np.save("store.npy", store, allow_pickle=True)
    print("slot pitch take before steady_after steady_wob natural_after natural_wob seam")
    for r in report:
        print(*r)
