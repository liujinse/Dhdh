"""Scene 1 narration (edge-tts) + timeline + soundtrack."""
import asyncio, json, os, subprocess
import numpy as np
import edge_tts

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, "audio")
PROXY = os.environ.get("HTTPS_PROXY")
LEAD, SAME_GAP, SWITCH_GAP, TAIL = 1.2, 0.25, 0.6, 2.0

def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-af",
        "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse", "-"],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

async def tts(text, voice, rate, pitch, out):
    if os.path.exists(out) and os.path.getsize(out) > 0: return
    for k in range(4):
        try:
            await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, proxy=PROXY).save(out); return
        except Exception as e:
            print("retry", out, e); await asyncio.sleep(2 * (k + 1))
    raise RuntimeError(out)

def bgm(dur):
    """Soft, light marimba loop (C-Am-F-G) kept quiet under the dialogue."""
    beat = 60 / 96; n = int(dur * SR) + SR; out = np.zeros(n, np.float32)
    midi = lambda m: 440 * 2 ** ((m - 69) / 12)
    def note(f, t0, L, amp):
        i0 = int(t0 * SR); L = min(int(L * SR), n - i0)
        if L <= 0: return
        tt = np.arange(L) / SR
        out[i0:i0 + L] += amp * np.exp(-tt * 5) * np.minimum(1, tt * 300) * (np.sin(2*np.pi*f*tt) + 0.25*np.sin(2*np.pi*f*4*tt)*np.exp(-tt*20))
    chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]; bass = [36, 33, 29, 31]
    t = 0; bar = 0
    while t < dur:
        c = chords[bar % 4]
        for k in range(8): note(midi(c[[0, 1, 2, 1][k % 4]] + 12), t + k * beat / 2, 0.6, 0.05)
        note(midi(bass[bar % 4]), t, 1.5, 0.12)
        t += 4 * beat; bar += 1
    return out[:int(dur * SR)]

async def main():
    d = json.load(open(os.path.join(HERE, "script.json")))
    V = d["voices"]
    await asyncio.gather(*(tts(txt, V[w]["voice"], r, p, os.path.join(A, f"l{i:02d}.mp3")) for i, (w, txt, r, p) in enumerate(d["lines"])))
    t = LEAD; lines = []; clips = []; prev = None
    for i, (w, txt, *_ ) in enumerate(d["lines"]):
        if prev is not None: t += SAME_GAP if w == prev else SWITCH_GAP
        pcm = decode(os.path.join(A, f"l{i:02d}.mp3")); dur = len(pcm) / SR
        lines.append({"who": w, "text": txt, "start": t, "end": t + dur}); clips.append((t, pcm))
        t += dur; prev = w
    total = t + TAIL
    json.dump({"duration": total, "voices": {k: v["name"] for k, v in V.items()}, "lines": lines},
              open(os.path.join(HERE, "timeline.json"), "w"), ensure_ascii=False, indent=1)
    n = int(total * SR) + 1
    voice = np.zeros(n, np.float32); act = np.zeros(n, np.float32)
    for t0, pcm in clips:
        i = int(t0 * SR); voice[i:i + len(pcm)] += pcm
        act[max(0, i - int(0.15 * SR)):i + len(pcm) + int(0.25 * SR)] = 1
    k = int(0.25 * SR); act = np.convolve(act, np.ones(k) / k, mode="same")
    music = bgm(total); music = np.pad(music, (0, max(0, n - len(music))))[:n]
    fade = np.ones(n, np.float32); fade[:int(SR)] = np.linspace(0, 1, int(SR)); fade[-int(1.5*SR):] = np.linspace(1, 0, int(1.5*SR))
    mix = np.clip(voice / np.abs(voice).max() * 0.8 + music * (1 - 0.75 * act) * fade * 0.5, -1, 1)
    raw = os.path.join(A, "mix.f32"); mix.astype(np.float32).tofile(raw)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", raw,
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", str(SR), "-ac", "2", os.path.join(A, "soundtrack.wav")], check=True)
    os.remove(raw)
    for l in lines: print(f"{l['who']:5} {l['start']:5.1f}-{l['end']:5.1f}  {l['text']}")
    print("total %.1fs" % total)

asyncio.run(main())
