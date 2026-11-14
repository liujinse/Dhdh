"""Generate narration with edge-tts, build the timeline and the mixed soundtrack."""
import asyncio, json, os, subprocess
import numpy as np
import edge_tts

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, "audio")
PROXY = os.environ.get("HTTPS_PROXY")

STEP_LEAD = 1.8   # step title card before first line
LEAD = 0.6        # other scenes
GAP = 0.35        # between lines
TAIL = 0.9        # after last line

def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1",
                          "-ar", str(SR), "-af", "silenceremove=start_periods=1:start_threshold=-50dB,"
                          "areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

async def tts(text, voice, rate, pitch, out):
    if os.path.exists(out) and os.path.getsize(out) > 0:
        return
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, proxy=PROXY).save(out)
            return
        except Exception as e:
            print("retry", out, e); await asyncio.sleep(2 * (attempt + 1))
    raise RuntimeError(out)

def synth_bgm(dur):
    """Cheerful marimba-style loop, C-Am-F-G, 112 BPM."""
    bpm = 112; beat = 60 / bpm
    n = int(dur * SR) + SR
    out = np.zeros(n, np.float32)
    def note(freq, t0, length, amp, bright=1.0):
        i0 = int(t0 * SR); L = int(length * SR)
        if i0 >= n: return
        L = min(L, n - i0)
        tt = np.arange(L) / SR
        env = np.exp(-tt * 6.0) * np.minimum(1, tt * 400)
        w = np.sin(2*np.pi*freq*tt) + 0.35*bright*np.sin(2*np.pi*freq*4*tt)*np.exp(-tt*20)
        out[i0:i0+L] += amp * env * w
    midi = lambda m: 440 * 2 ** ((m - 69) / 12)
    chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]
    bass = [36, 33, 29, 31]
    melody = [  # per bar, 8 eighth notes (None = rest)
        [72, None, 76, 79, 76, None, 74, 72],
        [69, None, 72, 76, 74, 72, None, None],
        [69, 72, 77, None, 76, 74, 72, None],
        [71, None, 74, 79, 77, 76, 74, None],
        [72, 76, 79, None, 84, None, 79, 76],
        [76, None, 72, 69, 72, None, 76, None],
        [77, None, 76, 74, 72, 74, 76, None],
        [74, None, 71, None, 67, None, None, None],
    ]
    t = 0.0; bar = 0
    while t < dur:
        ci = bar % 4
        for k in range(4):  # chord plucks on beats
            for m in chords[ci]:
                note(midi(m), t + k*beat, 0.6, 0.05 if k % 2 else 0.07, 0.6)
        note(midi(bass[ci]), t, 1.2, 0.16, 0.2); note(midi(bass[ci]+7), t + 2*beat, 1.0, 0.12, 0.2)
        for j, m in enumerate(melody[bar % 8]):
            if m: note(midi(m), t + j*beat/2, 0.5, 0.09)
        # soft shaker
        for j in range(8):
            i0 = int((t + j*beat/2) * SR); L = int(0.05*SR)
            if i0 + L < n:
                out[i0:i0+L] += (np.random.rand(L).astype(np.float32)-0.5) * 0.025 * np.exp(-np.arange(L)/SR*80)
        t += 4*beat; bar += 1
    return out[:int(dur*SR)]

def pop_sfx():
    L = int(0.25*SR); tt = np.arange(L)/SR
    f = 500 + 900*tt/0.25
    return (0.25*np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*14)).astype(np.float32)

async def main():
    data = json.load(open(os.path.join(HERE, "script.json")))
    voices = data["voices"]
    jobs = []
    for si, sc in enumerate(data["scenes"]):
        for li, (who, text, rate, pitch) in enumerate(sc["lines"]):
            jobs.append(tts(text, voices[who]["voice"], rate, pitch, os.path.join(A, f"s{si:02d}_l{li:02d}.mp3")))
    sem = asyncio.Semaphore(4)
    async def lim(c):
        async with sem: await c
    await asyncio.gather(*(lim(j) for j in jobs))

    t = 0.0; timeline = {"scenes": [], "voices": {k: v["name"] for k, v in voices.items()}}
    clips = []; pops = []
    for si, sc in enumerate(data["scenes"]):
        s = {"id": sc["id"], "title": sc["title"], "step": sc.get("step"), "start": t, "lines": []}
        if sc.get("step"): pops.append(t + 0.15)
        t += STEP_LEAD if sc.get("step") else LEAD
        for li, (who, text, *_ ) in enumerate(sc["lines"]):
            pcm = decode(os.path.join(A, f"s{si:02d}_l{li:02d}.mp3"))
            d = len(pcm) / SR
            s["lines"].append({"who": who, "text": text, "start": t, "end": t + d})
            clips.append((t, pcm)); t += d + GAP
        t += TAIL - GAP
        if sc["id"] == "finale": t += 2.5
        s["end"] = t
        timeline["scenes"].append(s)
    timeline["duration"] = t
    json.dump(timeline, open(os.path.join(HERE, "timeline.json"), "w"), ensure_ascii=False, indent=1)

    n = int(t * SR) + 1
    voice = np.zeros(n, np.float32)
    for t0, pcm in clips:
        i = int(t0 * SR); voice[i:i+len(pcm)] += pcm
    # duck music under voice (smoothed envelope), fade in/out
    act = np.zeros(n, np.float32)
    for t0, pcm in clips:
        act[int((t0-0.15)*SR):int((t0+len(pcm)/SR+0.25)*SR)] = 1
    k = int(0.25*SR); act = np.convolve(act, np.ones(k)/k, mode="same")
    music = synth_bgm(t)
    music = music[:n] if len(music) >= n else np.pad(music, (0, n-len(music)))
    music *= (1 - 0.72*act)
    fade = np.ones(n, np.float32); fi = int(1.5*SR); fo = int(3*SR)
    fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
    music *= fade * 0.55
    sfx = np.zeros(n, np.float32); p = pop_sfx()
    for t0 in pops:
        i = int(t0*SR); sfx[i:i+len(p)] += p[:max(0, min(len(p), n-i))]
    mix = voice / max(1e-6, np.abs(voice).max()) * 0.8 + music + sfx
    mix = np.clip(mix, -1, 1)
    raw = os.path.join(A, "mix_raw.f32"); mix.astype(np.float32).tofile(raw)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", raw,
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", str(SR), "-ac", "2",
                    os.path.join(A, "soundtrack.wav")], check=True)
    os.remove(raw)
    print("duration %.1fs, %d lines" % (t, len(clips)))

asyncio.run(main())
